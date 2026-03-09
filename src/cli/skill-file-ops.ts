import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { ensurePathWithinHome, isWithinRoot } from './path-guard.js';

function ensureParentPathWithinHome(resolvedPath: string, homeRealPath: string): string {
  const outputParentDirectory = dirname(resolvedPath);
  mkdirSync(outputParentDirectory, { recursive: true });
  const outputParentRealPath = realpathSync(outputParentDirectory);
  if (!isWithinRoot(outputParentRealPath, homeRealPath)) {
    throw new Error(`Skill output path escapes home directory: ${resolvedPath}`);
  }
  return outputParentRealPath;
}

function buildTemporaryPath(targetPath: string, parentRealPath: string): string {
  return join(parentRealPath, `.${basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
}

function resolveOutputTargetPathForWrite(
  resolvedPath: string,
  homeRealPath: string,
): { outputParentRealPath: string; outputTargetPath: string } {
  const outputParentRealPath = ensureParentPathWithinHome(resolvedPath, homeRealPath);
  const outputTargetPath = join(outputParentRealPath, basename(resolvedPath));
  return { outputParentRealPath, outputTargetPath };
}

function resolveOutputTargetPathForRemoval(resolvedPath: string, homeRealPath: string): string {
  const outputParentRealPath = realpathSync(dirname(resolvedPath));
  if (!isWithinRoot(outputParentRealPath, homeRealPath)) {
    throw new Error(`Skill output path escapes home directory: ${resolvedPath}`);
  }
  return join(outputParentRealPath, basename(resolvedPath));
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

export function writeSkillFile(outputPath: string, content: string, homeDir: string): void {
  const { resolvedPath, homeRealPath } = ensurePathWithinHome(outputPath, homeDir, 'Skill output path');
  const { outputParentRealPath, outputTargetPath } = resolveOutputTargetPathForWrite(
    resolvedPath,
    homeRealPath,
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
  if (!isWithinRoot(outputRealPath, homeRealPath)) {
    throw new Error(`Skill output path escapes home directory: ${resolvedPath}`);
  }
}

export function removeSkillFile(outputPath: string, homeDir: string): void {
  const { resolvedPath, homeRealPath } = ensurePathWithinHome(outputPath, homeDir, 'Skill output path');

  if (!existsSync(resolvedPath)) {
    return;
  }

  const outputTargetPath = resolveOutputTargetPathForRemoval(resolvedPath, homeRealPath);
  const fileStat = lstatSync(outputTargetPath);
  if (fileStat.isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed for skill output file: ${resolvedPath}`);
  }

  const fileRealPath = realpathSync(outputTargetPath);
  if (!isWithinRoot(fileRealPath, homeRealPath)) {
    throw new Error(`Skill output path escapes home directory: ${resolvedPath}`);
  }

  const outputParentRealPath = ensureParentPathWithinHome(outputTargetPath, homeRealPath);
  const quarantinePath = join(
    outputParentRealPath,
    `.${basename(outputTargetPath)}.${process.pid}.${Date.now()}.delete`,
  );
  renameSync(outputTargetPath, quarantinePath);
  rmSync(quarantinePath, { force: true });
}
