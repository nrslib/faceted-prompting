import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isResourcePath, resolveResourcePath } from '../resolve.js';
import { isScopeRef, parseScopeRef, resolveScopeRef } from '../scope.js';
import { ensurePathWithinRoots } from './path-guard.js';
import type { ComposeDefinition, FacetKind, FacetSet } from '../types.js';
import type {
  InstructionSection,
  ResolvedDefinitionSections,
  SkillDocumentInput,
  SkillSection,
} from './skill-types.js';
export { hasYamlFrontmatter, renderSkillDocument, renderSkillFrontmatter } from './skill-document-renderer.js';

function requireFile(path: string, label: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
  return readFileSync(path, 'utf-8');
}

export function ensureSafeDefinitionName(name: string): string {
  if (!/^[A-Za-z0-9._-]+$/u.test(name)) {
    throw new Error(`Invalid compose definition name: ${name}`);
  }
  return name;
}

function resolveFacetRefContent(options: {
  ref: string;
  label: string;
  baseDir: string;
  facetDirs: readonly string[];
  allowedRoots: readonly string[];
  resourceAllowedRoots: readonly string[];
  repertoireRoots: readonly string[];
  scopeFacetKind: FacetKind;
}): { body: string; path: string } {
  const { ref, label, baseDir, facetDirs, allowedRoots, resourceAllowedRoots, repertoireRoots, scopeFacetKind } = options;
  const primaryFacetDir = facetDirs[0];
  if (!primaryFacetDir) {
    throw new Error(`Missing ${label}: facet directory is required`);
  }
  if (isScopeRef(ref)) {
    if (repertoireRoots.length === 0) {
      throw new Error(`Missing ${label}: scope reference requires repertoire roots`);
    }
    const scopeRef = parseScopeRef(ref);
    for (const repertoireRoot of repertoireRoots) {
      const scopePath = resolveScopeRef(scopeRef, scopeFacetKind, repertoireRoot);
      if (!existsSync(scopePath)) {
        continue;
      }
      const boundedPath = ensurePathWithinRoots(scopePath, repertoireRoots, label);
      return { path: boundedPath, body: requireFile(boundedPath, label) };
    }
    throw new Error(`Missing ${label}: ${resolveScopeRef(scopeRef, scopeFacetKind, repertoireRoots[0]!)}`);
  }
  if (isResourcePath(ref)) {
    const resourcePath = resolveResourcePath(ref, baseDir);
    const boundedPath = ensurePathWithinRoots(resourcePath, resourceAllowedRoots, label);
    return { path: boundedPath, body: requireFile(boundedPath, label) };
  }

  for (const facetDir of facetDirs) {
    const facetPath = join(facetDir, `${ref}.md`);
    if (!existsSync(facetPath)) {
      continue;
    }
    const boundedPath = ensurePathWithinRoots(facetPath, allowedRoots, label);
    return { path: boundedPath, body: requireFile(boundedPath, label) };
  }

  throw new Error(`Missing ${label}: ${join(primaryFacetDir, `${ref}.md`)}`);
}

function resolveFacetsRoots(params: {
  facetsRoot?: string;
  facetsRoots?: readonly string[];
}): readonly string[] {
  if (params.facetsRoots && params.facetsRoots.length > 0) {
    return params.facetsRoots;
  }
  if (params.facetsRoot) {
    return [params.facetsRoot];
  }
  throw new Error('Facet roots are required');
}

export function resolveDefinitionSections(params: {
  definition: ComposeDefinition;
  definitionDir: string;
  facetsRoot?: string;
  facetsRoots?: readonly string[];
  facetedRoots?: readonly string[];
}): ResolvedDefinitionSections {
  const { definition, definitionDir } = params;
  const facetsRoots = resolveFacetsRoots(params);
  const allowedRoots = facetsRoots;
  const resourceAllowedRoots = [definitionDir, ...facetsRoots];
  const repertoireRoots = params.facetedRoots?.map(facetedRoot => join(facetedRoot, 'repertoire')) ?? [];

  const personaContent = resolveFacetRefContent({
    ref: definition.persona,
    label: `persona facet "${definition.persona}"`,
    baseDir: definitionDir,
    facetDirs: facetsRoots.map(facetsRoot => join(facetsRoot, 'persona')),
    allowedRoots,
    resourceAllowedRoots,
    repertoireRoots,
    scopeFacetKind: 'personas',
  });

  const policies: SkillSection[] =
    definition.policies?.map(ref => {
      const resolved = resolveFacetRefContent({
        ref,
        label: `policy facet "${ref}"`,
        baseDir: definitionDir,
        facetDirs: facetsRoots.map(facetsRoot => join(facetsRoot, 'policies')),
        allowedRoots,
        resourceAllowedRoots,
        repertoireRoots,
        scopeFacetKind: 'policies',
      });
      return { ref, body: resolved.body, path: resolved.path };
    }) ?? [];

  const knowledge: SkillSection[] =
    definition.knowledge?.map(ref => {
      const resolved = resolveFacetRefContent({
        ref,
        label: `knowledge facet "${ref}"`,
        baseDir: definitionDir,
        facetDirs: facetsRoots.map(facetsRoot => join(facetsRoot, 'knowledge')),
        allowedRoots,
        resourceAllowedRoots,
        repertoireRoots,
        scopeFacetKind: 'knowledge',
      });
      return { ref, body: resolved.body, path: resolved.path };
    }) ?? [];

  const instructions: InstructionSection[] =
    definition.instructions?.map(ref => {
      const resolved = resolveFacetRefContent({
        ref,
        label: `instruction facet "${ref}"`,
        baseDir: definitionDir,
        facetDirs: facetsRoots.map(facetsRoot => join(facetsRoot, 'instructions')),
        allowedRoots,
        resourceAllowedRoots,
        repertoireRoots,
        scopeFacetKind: 'instructions',
      });
      return { ref, body: resolved.body, path: resolved.path };
    }) ?? [];

  const outputContracts: SkillSection[] =
    definition.outputContracts?.map(ref => {
      const resolved = resolveFacetRefContent({
        ref,
        label: `output-contracts facet "${ref}"`,
        baseDir: definitionDir,
        facetDirs: facetsRoots.map(facetsRoot => join(facetsRoot, 'output-contracts')),
        allowedRoots,
        resourceAllowedRoots,
        repertoireRoots,
        scopeFacetKind: 'output-contracts',
      });
      return { ref, body: resolved.body, path: resolved.path };
    }) ?? [];

  return {
    persona: {
      ref: definition.persona,
      body: personaContent.body,
      path: personaContent.path,
    },
    policies,
    knowledge,
    instructions,
    outputContracts,
  };
}

export function listCompositionDefinitions(compositionsDirs: string | readonly string[]): Record<string, string> {
  const dirs = Array.isArray(compositionsDirs) ? compositionsDirs : [compositionsDirs];
  const definitions: Record<string, string> = {};

  for (const compositionsDir of dirs) {
    if (!existsSync(compositionsDir)) {
      continue;
    }

    const entries = readdirSync(compositionsDir, { withFileTypes: true })
      .filter(entry => !entry.isDirectory() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
      .map(entry => entry.name)
      .sort();

    for (const entry of entries) {
      const name = entry.replace(/\.(yaml|yml)$/u, '');
      if (name in definitions) {
        continue;
      }
      const definitionPath = join(compositionsDir, entry);
      definitions[name] = ensurePathWithinRoots(
        definitionPath,
        [compositionsDir],
        `compose definition "${entry}"`,
      );
    }
  }

  return definitions;
}

export function buildFacetSet(params: {
  definitionDir: string;
  facetsRoot?: string;
  facetsRoots?: readonly string[];
  facetedRoots?: readonly string[];
  definition: ComposeDefinition;
}): FacetSet {
  const resolved = resolveDefinitionSections(params);

  return buildFacetSetFromResolvedSections(resolved);
}

export function buildFacetSetFromResolvedSections(resolved: ResolvedDefinitionSections): FacetSet {
  return {
    persona: { body: resolved.persona.body, sourcePath: resolved.persona.path },
    policies: resolved.policies.map(policy => ({ body: policy.body, sourcePath: policy.path })),
    knowledge: resolved.knowledge.map(item => ({ body: item.body, sourcePath: item.path })),
    instructions: resolved.instructions.map(instruction =>
      'path' in instruction
        ? { body: instruction.body, sourcePath: instruction.path }
        : { body: instruction.body },
    ),
    outputContracts: resolved.outputContracts.map(outputContract => ({
      body: outputContract.body,
      sourcePath: outputContract.path,
    })),
  };
}

export function buildSkillSections(params: {
  definition: ComposeDefinition;
  definitionDir: string;
  facetsRoot?: string;
  facetsRoots?: readonly string[];
  facetedRoots?: readonly string[];
}): Omit<SkillDocumentInput, 'mode'> {
  const { definition } = params;
  const resolved = resolveDefinitionSections(params);

  return {
    definition,
    persona: resolved.persona,
    policies: resolved.policies,
    knowledge: resolved.knowledge,
    instructions: resolved.instructions,
    outputContracts: resolved.outputContracts,
  };
}

export function resolveDefinitionPathFromSource(source: string, compositionsDir: string): string {
  return ensurePathWithinRoots(
    join(compositionsDir, source),
    [compositionsDir],
    `compose definition "${source}"`,
  );
}
