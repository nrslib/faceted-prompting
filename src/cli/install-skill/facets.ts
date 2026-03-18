import { basename, dirname, join, resolve } from 'node:path';
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import type { buildSkillSections } from '../skill-renderer.js';
import type { CopyFiles } from '../../types.js';
import { ensurePathAncestorsContainNoSymbolicLinks, isWithinRoot } from '../path-guard.js';

const FACET_TOKEN_PATTERN = /{{facet:(persona|knowledges|policies|instructions)}}/g;
const FACET_TOKEN_TEST = /{{facet:(persona|knowledges|policies|instructions)}}/;

type FacetPlaceholderKey = 'persona' | 'knowledges' | 'policies' | 'instructions';
type FacetTokenValues = Record<FacetPlaceholderKey, string>;

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

export function buildInlineFacetTokenValues(sections: SkillSections): FacetTokenValues {
  return {
    persona: sections.persona.body,
    knowledges: sections.knowledge.map(knowledge => knowledge.body).join('\n'),
    policies: sections.policies.map(policy => policy.body).join('\n'),
    instructions: sections.instruction ? sections.instruction.body : '',
  };
}

function replaceFacetTokens(content: string, values: FacetTokenValues): string {
  return content.replaceAll(FACET_TOKEN_PATTERN, (_match, token: FacetPlaceholderKey) => {
    return values[token];
  });
}

function readUtf8FileWithoutFollowingSymbolicLinks(filePath: string): string {
  const openFlags = constants.O_RDONLY | constants.O_NOFOLLOW;

  let fileDescriptor: number;
  try {
    fileDescriptor = openSync(filePath, openFlags);
  } catch (error: unknown) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === 'ELOOP') {
      throw new Error(`Symbolic links are not allowed for output file: ${filePath}`);
    }
    throw error;
  }

  try {
    return readFileSync(fileDescriptor, 'utf-8');
  } finally {
    closeSync(fileDescriptor);
  }
}

function writeUtf8FileWithoutFollowingSymbolicLinks(filePath: string, content: string): void {
  const openFlags = constants.O_WRONLY | constants.O_TRUNC | constants.O_NOFOLLOW;

  let fileDescriptor: number;
  try {
    fileDescriptor = openSync(filePath, openFlags);
  } catch (error: unknown) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === 'ELOOP') {
      throw new Error(`Symbolic links are not allowed for output file: ${filePath}`);
    }
    throw error;
  }

  try {
    writeFileSync(fileDescriptor, content, 'utf-8');
  } finally {
    closeSync(fileDescriptor);
  }
}

function resolveBoundedOutputFilePath(filePath: string, rootDir: string): { filePath: string; rootRealPath: string } {
  const resolvedRootDir = resolve(rootDir);
  const resolvedFilePath = resolve(filePath);

  ensurePathAncestorsContainNoSymbolicLinks(resolvedFilePath, 'Output directory', resolvedRootDir);
  const rootRealPath = realpathSync(resolvedRootDir);

  const parentDir = dirname(resolvedFilePath);
  if (!existsSync(parentDir)) {
    throw new Error(`Output file directory does not exist: ${parentDir}`);
  }

  const parentRealPath = realpathSync(parentDir);
  if (!isWithinRoot(parentRealPath, rootRealPath)) {
    throw new Error(`Output path escapes target directory: ${resolvedFilePath}`);
  }

  const boundedFilePath = join(parentRealPath, basename(resolvedFilePath));
  if (!existsSync(boundedFilePath)) {
    throw new Error(`Output file does not exist: ${resolvedFilePath}`);
  }

  if (lstatSync(boundedFilePath).isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed for output file: ${resolvedFilePath}`);
  }

  return {
    filePath: boundedFilePath,
    rootRealPath,
  };
}

function applyFacetTokensToSingleFile(params: {
  filePath: string;
  tokenValues: FacetTokenValues;
  rootDir: string;
}): void {
  const boundedPath = resolveBoundedOutputFilePath(params.filePath, params.rootDir);
  const original = readUtf8FileWithoutFollowingSymbolicLinks(boundedPath.filePath);
  if (!FACET_TOKEN_TEST.test(original)) {
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
  copyFiles: CopyFiles;
  literalInstructionBody?: string;
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

  let instructionPath: string | undefined;
  const sourceInstructionPath = params.copyFiles.instructions[0];
  if (sourceInstructionPath || params.literalInstructionBody) {
    mkdirSync(instructionsDir, { recursive: true });
    if (sourceInstructionPath) {
      instructionPath = join(instructionsDir, basename(sourceInstructionPath));
      copyFileSync(sourceInstructionPath, instructionPath);
    } else {
      instructionPath = join(instructionsDir, `${params.safeSkillName}.md`);
      writeFileSync(instructionPath, normalizeInstructionBody(params.literalInstructionBody ?? ''), 'utf-8');
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
