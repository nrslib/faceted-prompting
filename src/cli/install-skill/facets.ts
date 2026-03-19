import { basename, join } from 'node:path';
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import type { buildSkillSections } from '../skill-renderer.js';
import type { CopyFiles } from '../../types.js';
import { isWithinRoot } from '../path-guard.js';
import {
  readUtf8FileWithoutFollowingSymbolicLinks,
  resolveBoundedOutputFilePath,
  writeUtf8FileWithoutFollowingSymbolicLinks,
} from './facet-token-file-ops.js';
import { hasFacetToken, replaceFacetTokens } from './facet-token-renderer.js';
import type { FacetTokenValues } from './facet-token-renderer.js';

export type SkillSections = ReturnType<typeof buildSkillSections>;

export interface FacetPathMap {
  readonly persona: string;
  readonly knowledges: readonly string[];
  readonly policies: readonly string[];
  readonly instructions: readonly string[];
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

export function buildInlineFacetTokenValues(sections: SkillSections): FacetTokenValues {
  return {
    persona: sections.persona.body,
    knowledges: sections.knowledge.map(knowledge => knowledge.body).join('\n'),
    policies: sections.policies.map(policy => policy.body).join('\n'),
    instructions: sections.instructions.map(instruction => instruction.body).join('\n'),
  };
}

function applyFacetTokensToSingleFile(params: {
  filePath: string;
  tokenValues: FacetTokenValues;
  rootDir: string;
}): void {
  const boundedPath = resolveBoundedOutputFilePath(params.filePath, params.rootDir);
  const original = readUtf8FileWithoutFollowingSymbolicLinks(boundedPath.filePath);
  if (!hasFacetToken(original)) {
    return;
  }

  const replaced = replaceFacetTokens(original, params.tokenValues);
  if (replaced === original) {
    return;
  }

  writeUtf8FileWithoutFollowingSymbolicLinks(boundedPath.filePath, replaced);
  const outputRealPath = realpathSync(boundedPath.filePath);
  if (!isWithinRoot(outputRealPath, boundedPath.rootRealPath)) {
    throw new Error(`Output path escapes target directory: ${params.filePath}`);
  }
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
    instructions: sections.instructions.map((instruction, index) => {
      const instructionPath = facets.instructions[index];
      if (instructionPath) {
        return {
          ref: basename(instructionPath, '.md'),
          body: instruction.body,
          path: instructionPath,
        };
      }
      return instruction;
    }),
  };
}

export function copyFacetFiles(params: {
  targetDir: string;
  safeSkillName: string;
  copyFiles: CopyFiles;
  literalInstructionBodies?: readonly string[];
}): FacetPathMap {
  const facetsDir = join(params.targetDir, 'facets');
  const personaDir = join(facetsDir, 'persona');
  const knowledgeDir = join(facetsDir, 'knowledge');
  const policiesDir = join(facetsDir, 'policies');
  const instructionsDir = join(facetsDir, 'instructions');

  mkdirSync(personaDir, { recursive: true });
  mkdirSync(knowledgeDir, { recursive: true });
  mkdirSync(policiesDir, { recursive: true });

  const sourcePersonaPath = params.copyFiles.persona[0];
  if (!sourcePersonaPath) {
    throw new Error('Missing persona copy file path');
  }
  const personaPath = join(personaDir, basename(sourcePersonaPath));
  copyFileSync(sourcePersonaPath, personaPath);

  const knowledgePaths = params.copyFiles.knowledge.map(path => {
    const targetPath = join(knowledgeDir, basename(path));
    copyFileSync(path, targetPath);
    return targetPath;
  });

  const policyPaths = params.copyFiles.policies.map(path => {
    const targetPath = join(policiesDir, basename(path));
    copyFileSync(path, targetPath);
    return targetPath;
  });

  const instructionPaths: string[] = [];
  const hasSourceInstructions = params.copyFiles.instructions.length > 0;
  const hasLiteralInstructions = params.literalInstructionBodies && params.literalInstructionBodies.length > 0;

  if (hasSourceInstructions || hasLiteralInstructions) {
    mkdirSync(instructionsDir, { recursive: true });
    if (hasSourceInstructions) {
      for (const sourceInstructionPath of params.copyFiles.instructions) {
        const targetPath = join(instructionsDir, basename(sourceInstructionPath));
        copyFileSync(sourceInstructionPath, targetPath);
        instructionPaths.push(targetPath);
      }
    } else if (params.literalInstructionBodies) {
      for (let i = 0; i < params.literalInstructionBodies.length; i++) {
        const suffix = params.literalInstructionBodies.length === 1 ? '' : `-${i + 1}`;
        const targetPath = join(instructionsDir, `${params.safeSkillName}${suffix}.md`);
        writeFileSync(targetPath, normalizeInstructionBody(params.literalInstructionBodies[i] ?? ''), 'utf-8');
        instructionPaths.push(targetPath);
      }
    }
  }

  return {
    persona: personaPath,
    knowledges: knowledgePaths,
    policies: policyPaths,
    instructions: instructionPaths,
  };
}

export function applyFacetTokensToPath(params: {
  rootDir: string;
  maxDepth: number;
  tokenValues: FacetTokenValues;
  excludeDirs: readonly string[];
}): void {
  const { rootDir, maxDepth, tokenValues, excludeDirs } = params;

  const visit = (currentDir: string, depth: number): void => {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const entryPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (currentDir === rootDir && excludeDirs.includes(entry.name)) {
          continue;
        }
        if (depth < maxDepth) {
          visit(entryPath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      applyFacetTokensToSingleFile({
        filePath: entryPath,
        tokenValues,
        rootDir,
      });
    }
  };

  visit(rootDir, 0);
}

export function applyFacetTokensToFiles(params: {
  filePaths: readonly string[];
  tokenValues: FacetTokenValues;
  rootDir: string;
}): void {
  for (const filePath of params.filePaths) {
    applyFacetTokensToSingleFile({
      filePath,
      tokenValues: params.tokenValues,
      rootDir: params.rootDir,
    });
  }
}

export function parseScanDepth(rawDepth: string): number {
  const parsed = Number.parseInt(rawDepth, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid scan depth: ${rawDepth}`);
  }
  return parsed;
}
