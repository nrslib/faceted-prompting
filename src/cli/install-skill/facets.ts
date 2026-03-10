import { basename, join } from 'node:path';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { buildSkillSections } from '../skill-renderer.js';

const FACET_TOKEN_PATTERN = /{{facet:(persona|knowledges|policies|instructions)}}/g;

type FacetPlaceholderKey = 'persona' | 'knowledges' | 'policies' | 'instructions';

export type SkillSections = ReturnType<typeof buildSkillSections>;

export interface FacetPathMap {
  readonly persona: string;
  readonly knowledges: readonly string[];
  readonly policies: readonly string[];
  readonly instructions?: string;
}

function requireFacetPathCount(params: {
  readonly label: 'knowledge' | 'policy';
  readonly expected: number;
  readonly actual: number;
}): void {
  if (params.expected !== params.actual) {
    throw new Error(
      `Copied ${params.label} facet count mismatch: expected ${params.expected}, received ${params.actual}`,
    );
  }
}

function requireFacetPathAtIndex(params: {
  readonly label: 'knowledge' | 'policy';
  readonly paths: readonly string[];
  readonly index: number;
}): string {
  const path = params.paths[params.index];
  if (path === undefined) {
    throw new Error(`Missing copied ${params.label} facet path at index ${params.index}`);
  }
  return path;
}

function normalizeInstructionBody(body: string): string {
  return body.endsWith('\n') ? body : `${body}\n`;
}

function renderFacetTokenValue(key: FacetPlaceholderKey, facets: FacetPathMap): string {
  if (key === 'persona') {
    return facets.persona;
  }
  if (key === 'knowledges') {
    return facets.knowledges.join('\n');
  }
  if (key === 'policies') {
    return facets.policies.join('\n');
  }
  if (!facets.instructions) {
    throw new Error('Missing instructions facet path for {{facet:instructions}} placeholder');
  }
  return facets.instructions;
}

function replaceFacetTokens(content: string, facets: FacetPathMap): string {
  return content.replaceAll(FACET_TOKEN_PATTERN, (_match, token: FacetPlaceholderKey) => {
    return renderFacetTokenValue(token, facets);
  });
}

export function buildSectionsWithCopiedPaths(
  sections: SkillSections,
  facets: FacetPathMap,
): SkillSections {
  requireFacetPathCount({
    label: 'knowledge',
    expected: sections.knowledge.length,
    actual: facets.knowledges.length,
  });
  requireFacetPathCount({
    label: 'policy',
    expected: sections.policies.length,
    actual: facets.policies.length,
  });

  const instruction =
    sections.instruction && facets.instructions
      ? {
          ref: basename(facets.instructions, '.md'),
          body: sections.instruction.body,
          path: facets.instructions,
        }
      : sections.instruction;

  return {
    ...sections,
    persona: {
      ...sections.persona,
      path: facets.persona,
    },
    knowledge: sections.knowledge.map((knowledge, index) => ({
      ...knowledge,
      path: requireFacetPathAtIndex({
        label: 'knowledge',
        paths: facets.knowledges,
        index,
      }),
    })),
    policies: sections.policies.map((policy, index) => ({
      ...policy,
      path: requireFacetPathAtIndex({
        label: 'policy',
        paths: facets.policies,
        index,
      }),
    })),
    instruction,
  };
}

export function copyFacetFiles(params: {
  targetDir: string;
  safeSkillName: string;
  sections: SkillSections;
}): FacetPathMap {
  const facetsDir = join(params.targetDir, 'facets');
  const personaDir = join(facetsDir, 'persona');
  const knowledgeDir = join(facetsDir, 'knowledge');
  const policiesDir = join(facetsDir, 'policies');
  const instructionsDir = join(facetsDir, 'instructions');

  mkdirSync(personaDir, { recursive: true });
  mkdirSync(knowledgeDir, { recursive: true });
  mkdirSync(policiesDir, { recursive: true });

  const personaPath = join(personaDir, basename(params.sections.persona.path));
  copyFileSync(params.sections.persona.path, personaPath);

  const knowledgePaths = params.sections.knowledge.map(knowledge => {
    const targetPath = join(knowledgeDir, basename(knowledge.path));
    copyFileSync(knowledge.path, targetPath);
    return targetPath;
  });

  const policyPaths = params.sections.policies.map(policy => {
    const targetPath = join(policiesDir, basename(policy.path));
    copyFileSync(policy.path, targetPath);
    return targetPath;
  });

  let instructionPath: string | undefined;
  if (params.sections.instruction) {
    mkdirSync(instructionsDir, { recursive: true });
    if (!('path' in params.sections.instruction)) {
      instructionPath = join(instructionsDir, `${params.safeSkillName}.md`);
      writeFileSync(instructionPath, normalizeInstructionBody(params.sections.instruction.body), 'utf-8');
    } else {
      instructionPath = join(instructionsDir, basename(params.sections.instruction.path));
      copyFileSync(params.sections.instruction.path, instructionPath);
    }
  }

  return {
    persona: personaPath,
    knowledges: knowledgePaths,
    policies: policyPaths,
    instructions: instructionPath,
  };
}

export function applyFacetTokensToPath(params: {
  rootDir: string;
  maxDepth: number;
  facets: FacetPathMap;
}): void {
  const { rootDir, maxDepth, facets } = params;

  const visit = (currentDir: string, depth: number): void => {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const entryPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (depth < maxDepth) {
          visit(entryPath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const original = readFileSync(entryPath, 'utf-8');
      if (!FACET_TOKEN_PATTERN.test(original)) {
        FACET_TOKEN_PATTERN.lastIndex = 0;
        continue;
      }
      FACET_TOKEN_PATTERN.lastIndex = 0;

      const replaced = replaceFacetTokens(original, facets);
      if (replaced !== original) {
        writeFileSync(entryPath, replaced, 'utf-8');
      }
    }
  };

  visit(rootDir, 0);
}

export function parseScanDepth(rawDepth: string): number {
  const parsed = Number.parseInt(rawDepth, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid scan depth: ${rawDepth}`);
  }
  return parsed;
}
