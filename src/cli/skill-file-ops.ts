import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  ensurePathAncestorsAndRealPathWithinAllowedRoots,
  isWithinRoot,
} from './path-guard.js';

function ensureParentPathWithinAllowedRoots(resolvedPath: string, allowedRootRealPaths: readonly string[]): string {
  const outputParentDirectory = dirname(resolvedPath);
  mkdirSync(outputParentDirectory, { recursive: true });
  const outputParentRealPath = realpathSync(outputParentDirectory);
  if (!allowedRootRealPaths.some(root => isWithinRoot(outputParentRealPath, root))) {
    throw new Error(`Skill output path escapes allowed roots: ${resolvedPath}`);
  }
  return outputParentRealPath;
}

function buildTemporaryPath(targetPath: string, parentRealPath: string): string {
  return join(parentRealPath, `.${basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
}

function resolveOutputTargetPathForWrite(
  resolvedPath: string,
  allowedRootRealPaths: readonly string[],
): { outputParentRealPath: string; outputTargetPath: string } {
  const outputParentRealPath = ensureParentPathWithinAllowedRoots(resolvedPath, allowedRootRealPaths);
  const outputTargetPath = join(outputParentRealPath, basename(resolvedPath));
  return { outputParentRealPath, outputTargetPath };
}

function writeFreshFile(path: string, content: string): void {
  const openFlags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;

  let fileDescriptor: number;
  try {
    fileDescriptor = openSync(path, openFlags, 0o600);
  } catch (error: unknown) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === 'ELOOP') {
      throw new Error(`Symbolic links are not allowed for skill output file: ${path}`);
    }
    throw error;
  }

  try {
    writeFileSync(fileDescriptor, content, 'utf-8');
  } finally {
    closeSync(fileDescriptor);
  }
}

export function writeSkillFile(outputPath: string, content: string, allowedRoots: readonly string[]): void {
  const { resolvedPath, allowedRootRealPaths } = ensurePathAncestorsAndRealPathWithinAllowedRoots(
    outputPath,
    allowedRoots,
    'Skill output path',
  );
  const { outputParentRealPath, outputTargetPath } = resolveOutputTargetPathForWrite(
    resolvedPath,
    allowedRootRealPaths,
  );
  const tempOutputPath = buildTemporaryPath(outputTargetPath, outputParentRealPath);

  try {
    if (existsSync(outputTargetPath) && lstatSync(outputTargetPath).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed for skill output file: ${resolvedPath}`);
    }

    writeFreshFile(tempOutputPath, content);
    renameSync(tempOutputPath, outputTargetPath);
  } catch (error) {
    if (existsSync(tempOutputPath)) {
      unlinkSync(tempOutputPath);
    }
    throw error;
  }

  const outputRealPath = realpathSync(outputTargetPath);
  if (!allowedRootRealPaths.some(root => isWithinRoot(outputRealPath, root))) {
    throw new Error(`Skill output path escapes allowed roots: ${resolvedPath}`);
  }
}
