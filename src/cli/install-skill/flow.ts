import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  ensurePathAncestorsAndRealPathWithinHome,
  ensurePathAncestorsContainNoSymbolicLinks,
  ensurePathWithinRoots,
} from '../path-guard.js';
import type { FacetCliOptions } from '../types.js';
export { defaultOutputPath, listInstallTargets, resolveInstallTarget } from './targets.js';

export function shouldOverwrite(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

export function ensureTemplateDirectory(facetedRoot: string, templateName: string): string {
  const templatesRoot = join(facetedRoot, 'templates');
  const templatePath = ensurePathWithinRoots(
    join(templatesRoot, templateName),
    [templatesRoot],
    `template "${templateName}"`,
  );

  if (!lstatSync(templatePath).isDirectory()) {
    throw new Error(`Template path must be a directory: ${templatePath}`);
  }

  return templatePath;
}

export function copyDirectoryTree(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in template directory: ${join(sourceDir, entry.name)}`);
    }

    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryTree(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      copyFileSync(sourcePath, targetPath);
    }
  }
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

  ensurePathAncestorsContainNoSymbolicLinks(params.targetDir, params.promptLabel, params.cwd);
}

export async function ensureRegenerationTargetDir(params: {
  targetDir: string;
  options: FacetCliOptions;
  promptLabel: string;
  homeDir?: string;
}): Promise<void> {
  const { targetDir, options, promptLabel } = params;
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

export function ensureDirectoryExists(path: string, label: string): void {
  if (!existsSync(path) || !lstatSync(path).isDirectory()) {
    throw new Error(`${label} does not exist: ${path}`);
  }
}
