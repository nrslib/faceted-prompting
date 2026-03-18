import { closeSync, constants, existsSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { ensurePathAncestorsContainNoSymbolicLinks, isWithinRoot } from '../path-guard.js';

export function readUtf8FileWithoutFollowingSymbolicLinks(filePath: string): string {
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

export function writeUtf8FileWithoutFollowingSymbolicLinks(filePath: string, content: string): void {
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

export function resolveBoundedOutputFilePath(
  filePath: string,
  rootDir: string,
): { filePath: string; rootRealPath: string } {
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
