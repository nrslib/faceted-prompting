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
  facetDir: string;
  allowedRoots: readonly string[];
}): { body: string; path: string } {
  const { ref, label, baseDir, facetDir, allowedRoots } = options;
  if (isResourcePath(ref)) {
    const resourcePath = resolveResourcePath(ref, baseDir);
    const boundedPath = ensurePathWithinRoots(resourcePath, allowedRoots, label);
    return { path: boundedPath, body: requireFile(boundedPath, label) };
  }

  const facetPath = join(facetDir, `${ref}.md`);
  const boundedPath = ensurePathWithinRoots(facetPath, allowedRoots, label);
  return { path: boundedPath, body: requireFile(boundedPath, label) };
}

export function resolveDefinitionSections(params: {
  definition: ComposeDefinition;
  definitionDir: string;
  facetsRoot: string;
}): ResolvedDefinitionSections {
  const { definition, definitionDir, facetsRoot } = params;
  const allowedRoots = [facetsRoot];

  const personaContent = resolveFacetRefContent({
    ref: definition.persona,
    label: `persona facet "${definition.persona}"`,
    baseDir: definitionDir,
    facetDir: join(facetsRoot, 'persona'),
    allowedRoots,
  });

  const policies: SkillSection[] =
    definition.policies?.map(ref => {
      const resolved = resolveFacetRefContent({
        ref,
        label: `policy facet "${ref}"`,
        baseDir: definitionDir,
        facetDir: join(facetsRoot, 'policies'),
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
        facetDir: join(facetsRoot, 'knowledge'),
        allowedRoots,
      });
      return { ref, body: resolved.body, path: resolved.path };
    }) ?? [];

  let instruction: InstructionSection | undefined;
  if (definition.instruction) {
    if (isResourcePath(definition.instruction)) {
      const resolved = resolveFacetRefContent({
        ref: definition.instruction,
        label: 'instruction file',
        baseDir: definitionDir,
        facetDir: facetsRoot,
        allowedRoots,
      });
      instruction = {
        ref: definition.instruction,
        body: resolved.body,
        path: resolved.path,
      };
    } else {
      instruction = {
        ref: 'literal',
        body: definition.instruction,
      };
    }
  }

  return {
    persona: {
      ref: definition.persona,
      body: personaContent.body,
      path: personaContent.path,
    },
    policies,
    knowledge,
    instruction,
  };
}

export function listCompositionDefinitions(compositionsDir: string): Record<string, string> {
  if (!existsSync(compositionsDir)) {
    throw new Error(`Compose definition directory does not exist: ${compositionsDir}`);
  }

  const entries = readdirSync(compositionsDir, { withFileTypes: true })
    .filter(entry => !entry.isDirectory() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
    .map(entry => entry.name);

  const definitions: Record<string, string> = {};
  for (const entry of entries) {
    const name = entry.replace(/\.(yaml|yml)$/u, '');
    const definitionPath = join(compositionsDir, entry);
    definitions[name] = ensurePathWithinRoots(
      definitionPath,
      [compositionsDir],
      `compose definition "${entry}"`,
    );
  }

  return definitions;
}

export function buildFacetSet(params: {
  definitionDir: string;
  facetsRoot: string;
  definition: ComposeDefinition;
}): FacetSet {
  const resolved = resolveDefinitionSections(params);

  return {
    persona: { body: resolved.persona.body, sourcePath: resolved.persona.path },
    policies: resolved.policies.map(policy => ({ body: policy.body, sourcePath: policy.path })),
    knowledge: resolved.knowledge.map(item => ({ body: item.body, sourcePath: item.path })),
    instruction: resolved.instruction
      ? ('path' in resolved.instruction
          ? { body: resolved.instruction.body, sourcePath: resolved.instruction.path }
          : { body: resolved.instruction.body })
      : undefined,
  };
}

export function buildSkillSections(params: {
  definition: ComposeDefinition;
  definitionDir: string;
  facetsRoot: string;
}): Omit<SkillDocumentInput, 'mode'> {
  const { definition } = params;
  const resolved = resolveDefinitionSections(params);

  return {
    definition,
    persona: resolved.persona,
    policies: resolved.policies,
    knowledge: resolved.knowledge,
    instruction: resolved.instruction,
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

  if (input.instruction) {
    lines.push('## Instruction');
    lines.push('');

    if (input.mode === 'reference' && hasInstructionPath(input.instruction)) {
      lines.push(input.instruction.path);
    } else {
      lines.push(input.instruction.body);
    }
    lines.push('');
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
