import { closeSync, constants, mkdirSync, openSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import type { ComposedPrompt } from '../types.js';

export function resolveOutputDirectory(inputValue: string, defaultDirectory: string): string {
  const trimmed = inputValue.trim();
  if (trimmed.length === 0) {
    return defaultDirectory;
  }
  return resolve(defaultDirectory, trimmed);
}

export function formatCombinedOutput(composed: ComposedPrompt): string {
  const parts: string[] = [];
  if (composed.systemPrompt.length > 0) {
    parts.push(composed.systemPrompt);
  }
  if (composed.userMessage.length > 0) {
    parts.push(composed.userMessage);
  }
  return parts.join('\n\n') + '\n';
}

export async function writeComposeOutput(options: {
  outputDir: string;
  fileName: string;
  content: string;
  overwrite: boolean;
}): Promise<string> {
  const outputDir = resolve(options.outputDir);
  mkdirSync(outputDir, { recursive: true });
  const outputDirRealPath = realpathSync(outputDir);

  if (basename(options.fileName) !== options.fileName) {
    throw new Error(`Output file name must not include path segments: ${options.fileName}`);
  }

  const outputPath = resolve(outputDir, options.fileName);
  if (!(outputPath === outputDir || outputPath.startsWith(`${outputDir}${sep}`))) {
    throw new Error(`Output path escapes target directory: ${options.fileName}`);
  }

  const outputParentDirectory = dirname(outputPath);
  mkdirSync(outputParentDirectory, { recursive: true });
  const outputParentRealPath = realpathSync(outputParentDirectory);
  if (!(outputParentRealPath === outputDirRealPath || outputParentRealPath.startsWith(`${outputDirRealPath}${sep}`))) {
    throw new Error(`Output path escapes target directory: ${options.fileName}`);
  }

  const openFlags = constants.O_WRONLY
    | constants.O_CREAT
    | (options.overwrite ? constants.O_TRUNC : constants.O_EXCL)
    | constants.O_NOFOLLOW;

  let fileDescriptor: number;
  try {
    fileDescriptor = openSync(outputPath, openFlags, 0o600);
  } catch (error: unknown) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === 'ELOOP') {
      throw new Error(`Symbolic links are not allowed for output file: ${outputPath}`);
    }
    if (errorCode === 'EEXIST' && !options.overwrite) {
      throw new Error(`Output file exists and overwrite was cancelled: ${outputPath}`);
    }
    throw error;
  }

  try {
    writeFileSync(fileDescriptor, options.content, 'utf-8');
  } finally {
    closeSync(fileDescriptor);
  }

  const outputRealPath = realpathSync(outputPath);
  if (!(outputRealPath === outputDirRealPath || outputRealPath.startsWith(`${outputDirRealPath}${sep}`))) {
    throw new Error(`Output path escapes target directory: ${options.fileName}`);
  }
  return outputPath;
}
