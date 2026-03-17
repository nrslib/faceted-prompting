import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
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

export function ensureTemplateDirectoryFromRoots(
  facetedRoots: readonly string[],
  templateName: string,
): string {
  const templatesRoots = facetedRoots.map(facetedRoot => join(facetedRoot, 'templates'));
  const primaryTemplatesRoot = templatesRoots[0];
  if (!primaryTemplatesRoot) {
    throw new Error('Template roots are required');
  }

  for (const templatesRoot of templatesRoots) {
    const candidatePath = join(templatesRoot, templateName);
    if (!existsSync(candidatePath)) {
      continue;
    }
    const templatePath = ensurePathWithinRoots(
      candidatePath,
      [templatesRoot],
      `template "${templateName}"`,
    );
    if (!lstatSync(templatePath).isDirectory()) {
      throw new Error(`Template path must be a directory: ${templatePath}`);
    }
    return templatePath;
  }

  throw new Error(`Template directory does not exist: ${join(primaryTemplatesRoot, templateName)}`);
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
