import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isResourcePath, resolveResourcePath } from '../resolve.js';
import { ensurePathWithinRoots } from './path-guard.js';
import type { ComposeDefinition, FacetSet } from '../types.js';
import type {
  InstructionSection,
  ResolvedDefinitionSections,
  SkillDocumentInput,
  SkillSection,
} from './skill-types.js';

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
}): { body: string; path: string } {
  const { ref, label, baseDir, facetDirs, allowedRoots } = options;
  const primaryFacetDir = facetDirs[0];
  if (!primaryFacetDir) {
    throw new Error(`Missing ${label}: facet directory is required`);
  }
  if (isResourcePath(ref)) {
    const resourcePath = resolveResourcePath(ref, baseDir);
    const boundedPath = ensurePathWithinRoots(resourcePath, allowedRoots, label);
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
}): ResolvedDefinitionSections {
  const { definition, definitionDir } = params;
  const facetsRoots = resolveFacetsRoots(params);
  const allowedRoots = facetsRoots;

  const personaContent = resolveFacetRefContent({
    ref: definition.persona,
    label: `persona facet "${definition.persona}"`,
    baseDir: definitionDir,
    facetDirs: facetsRoots.map(facetsRoot => join(facetsRoot, 'persona')),
    allowedRoots,
  });

  const policies: SkillSection[] =
    definition.policies?.map(ref => {
      const resolved = resolveFacetRefContent({
        ref,
        label: `policy facet "${ref}"`,
        baseDir: definitionDir,
        facetDirs: facetsRoots.map(facetsRoot => join(facetsRoot, 'policies')),
        allowedRoots,
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
  definition: ComposeDefinition;
}): FacetSet {
  const resolved = resolveDefinitionSections(params);

  return {
    persona: { body: resolved.persona.body, sourcePath: resolved.persona.path },
    policies: resolved.policies.map(policy => ({ body: policy.body, sourcePath: policy.path })),
    knowledge: resolved.knowledge.map(item => ({ body: item.body, sourcePath: item.path })),
    instructions: resolved.instructions.map(instruction =>
      'path' in instruction
        ? { body: instruction.body, sourcePath: instruction.path }
        : { body: instruction.body },
    ),
  };
}

export function buildSkillSections(params: {
  definition: ComposeDefinition;
  definitionDir: string;
  facetsRoot?: string;
  facetsRoots?: readonly string[];
}): Omit<SkillDocumentInput, 'mode'> {
  const { definition } = params;
  const resolved = resolveDefinitionSections(params);

  return {
    definition,
    persona: resolved.persona,
    policies: resolved.policies,
    knowledge: resolved.knowledge,
    instructions: resolved.instructions,
  };
}

function makeSkillHeader(definition: ComposeDefinition): string {
  const lines = ['---', `name: ${definition.name}`];
  if (definition.description) {
    lines.push(`description: ${definition.description}`);
  }
  lines.push('---');
  return lines.join('\n');
}

export function renderSkillFrontmatter(definition: ComposeDefinition): string {
  return `${makeSkillHeader(definition)}\n`;
}

export function hasYamlFrontmatter(content: string): boolean {
  return /^---\n[\s\S]*?\n---(?:\n|$)/u.test(content);
}

function hasInstructionPath(instruction: InstructionSection): instruction is SkillSection {
  return instruction.ref !== 'literal';
}

export function renderSkillDocument(input: SkillDocumentInput): string {
  const lines: string[] = [];

  lines.push(makeSkillHeader(input.definition));
  lines.push('');
  lines.push('<!-- Generated by faceted-prompting. Do not edit manually. -->');
  lines.push('');

  lines.push('## Persona');
  lines.push('');
  lines.push(input.mode === 'inline' ? input.persona.body : input.persona.path);
  lines.push('');

  if (input.policies.length > 0) {
    lines.push('## Policies');
    lines.push('');
    for (const policy of input.policies) {
      lines.push(`### ${policy.ref}`);
      lines.push('');
      lines.push(input.mode === 'inline' ? policy.body : policy.path);
      lines.push('');
    }
  }

  if (input.knowledge.length > 0) {
    lines.push('## Knowledge');
    lines.push('');
    for (const knowledge of input.knowledge) {
      lines.push(`### ${knowledge.ref}`);
      lines.push('');
      lines.push(input.mode === 'inline' ? knowledge.body : knowledge.path);
      lines.push('');
    }
  }

  if (input.instructions.length > 0) {
    lines.push('## Instructions');
    lines.push('');
    for (const instruction of input.instructions) {
      if (input.mode === 'reference' && hasInstructionPath(instruction)) {
        lines.push(`### ${instruction.ref}`);
        lines.push('');
        lines.push(instruction.path);
      } else {
        lines.push(instruction.body);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function resolveDefinitionPathFromSource(source: string, compositionsDir: string): string {
  return ensurePathWithinRoots(
    join(compositionsDir, source),
    [compositionsDir],
    `compose definition "${source}"`,
  );
}
