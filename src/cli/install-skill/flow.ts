import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  ensurePathAncestorsAndRealPathWithinHome,
  ensurePathAncestorsContainNoSymbolicLinks,
  ensurePathIsNotSymbolicLink,
  isWithinRoot,
  ensurePathWithinRoots,
} from '../path-guard.js';
import { isResourcePath, resolveResourcePath } from '../../resolve.js';
import type { FacetCliOptions } from '../types.js';
export { defaultOutputPath, listInstallTargets, resolveInstallTarget } from './targets.js';

export function shouldOverwrite(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

export function ensureTemplateDirectoryFromRoots(
  facetedRoots: readonly string[],
  templateRef: string,
  definitionDir?: string,
): string {
  if (isResourcePath(templateRef) && definitionDir) {
    const resolvedPath = resolveResourcePath(templateRef, definitionDir);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Template directory does not exist: ${resolvedPath}`);
    }
    if (!lstatSync(resolvedPath).isDirectory()) {
      throw new Error(`Template path must be a directory: ${resolvedPath}`);
    }
    return resolvedPath;
  }

  const templatesRoots = facetedRoots.map(facetedRoot => join(facetedRoot, 'templates'));
  const primaryTemplatesRoot = templatesRoots[0];
  if (!primaryTemplatesRoot) {
    throw new Error('Template roots are required');
  }

  for (const templatesRoot of templatesRoots) {
    const candidatePath = join(templatesRoot, templateRef);
    if (!existsSync(candidatePath)) {
      continue;
    }
    const templatePath = ensurePathWithinRoots(
      candidatePath,
      [templatesRoot],
      `template "${templateRef}"`,
    );
    if (!lstatSync(templatePath).isDirectory()) {
      throw new Error(`Template path must be a directory: ${templatePath}`);
    }
    return templatePath;
  }

  throw new Error(`Template directory does not exist: ${join(primaryTemplatesRoot, templateRef)}`);
}

function copyFileIntoTargetRoot(params: {
  sourcePath: string;
  targetPath: string;
  rootTargetDir: string;
  rootTargetRealPath: string;
}): void {
  const targetParentDir = dirname(params.targetPath);
  mkdirSync(targetParentDir, { recursive: true });
  ensurePathAncestorsContainNoSymbolicLinks(targetParentDir, 'Output directory', params.rootTargetDir);

  const targetParentRealPath = realpathSync(targetParentDir);
  if (!isWithinRoot(targetParentRealPath, params.rootTargetRealPath)) {
    throw new Error(`Output path escapes target directory: ${params.targetPath}`);
  }
  const targetFilePath = join(targetParentRealPath, basename(params.targetPath));
  const tempFilePath = join(
    targetParentRealPath,
    `.${basename(params.targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  const openFlags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  let targetFileDescriptor: number;
  try {
    if (existsSync(targetFilePath) && lstatSync(targetFilePath).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed for output file: ${params.targetPath}`);
    }
    targetFileDescriptor = openSync(tempFilePath, openFlags, 0o600);
  } catch (error: unknown) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === 'ELOOP') {
      throw new Error(`Symbolic links are not allowed for output file: ${tempFilePath}`);
    }
    throw error;
  }

  try {
    writeFileSync(targetFileDescriptor, readFileSync(params.sourcePath));
  } finally {
    closeSync(targetFileDescriptor);
  }

  try {
    renameSync(tempFilePath, targetFilePath);
  } catch (error) {
    if (existsSync(tempFilePath)) {
      unlinkSync(tempFilePath);
    }
    throw error;
  }

  const targetRealPath = realpathSync(targetFilePath);
  if (!isWithinRoot(targetRealPath, params.rootTargetRealPath)) {
    throw new Error(`Output path escapes target directory: ${params.targetPath}`);
  }
}

function copyDirectoryTreeInternal(params: {
  sourceDir: string;
  targetDir: string;
  rootTargetDir: string;
  rootTargetRealPath: string;
}): void {
  mkdirSync(params.targetDir, { recursive: true });

  for (const entry of readdirSync(params.sourceDir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in template directory: ${join(params.sourceDir, entry.name)}`);
    }

    const sourcePath = join(params.sourceDir, entry.name);
    const targetPath = join(params.targetDir, entry.name);

    if (entry.isDirectory()) {
      ensurePathAncestorsContainNoSymbolicLinks(targetPath, 'Output directory', params.rootTargetDir);
      copyDirectoryTreeInternal({
        sourceDir: sourcePath,
        targetDir: targetPath,
        rootTargetDir: params.rootTargetDir,
        rootTargetRealPath: params.rootTargetRealPath,
      });
      continue;
    }

    if (entry.isFile()) {
      copyFileIntoTargetRoot({
        sourcePath,
        targetPath,
        rootTargetDir: params.rootTargetDir,
        rootTargetRealPath: params.rootTargetRealPath,
      });
    }
  }
}

export function copyDirectoryTree(sourceDir: string, targetDir: string, rootTargetDir = targetDir): void {
  mkdirSync(targetDir, { recursive: true });
  const rootTargetRealPath = realpathSync(rootTargetDir);
  copyDirectoryTreeInternal({
    sourceDir,
    targetDir,
    rootTargetDir,
    rootTargetRealPath,
  });
}

export function collectDirectoryFiles(dir: string, basePath = ''): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const relativePath = basePath ? join(basePath, entry.name) : entry.name;
    const entryPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectDirectoryFiles(entryPath, relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

function ensurePathSafety(params: {
  targetDir: string;
  promptLabel: string;
  cwd: string;
  homeDir?: string;
}): void {
  if (params.homeDir) {
    ensurePathAncestorsAndRealPathWithinHome(params.targetDir, params.homeDir, params.promptLabel);
    return;
  }

  ensurePathIsNotSymbolicLink(params.targetDir, params.promptLabel);
  ensurePathAncestorsContainNoSymbolicLinks(params.targetDir, params.promptLabel, params.cwd);
}

export async function ensureRegenerationTargetDir(params: {
  targetDir: string;
  options: FacetCliOptions;
  promptLabel: string;
  homeDir?: string;
}): Promise<void> {
  const { targetDir, options, promptLabel } = params;
  if (params.homeDir && resolve(targetDir) === resolve(params.homeDir)) {
    throw new Error(`${promptLabel} must not be home directory: ${resolve(targetDir)}`);
  }
  ensurePathSafety({
    targetDir,
    promptLabel,
    homeDir: params.homeDir,
    cwd: options.cwd,
  });

  if (existsSync(targetDir)) {
    const overwriteAnswer = await options.input(`${promptLabel} exists. Replace? (${targetDir}) [y/N]`, 'n');
    if (!shouldOverwrite(overwriteAnswer)) {
      throw new Error(`${promptLabel} exists and overwrite was cancelled: ${targetDir}`);
    }
    rmSync(targetDir, { recursive: true, force: true });
  }

  mkdirSync(targetDir, { recursive: true });
}
