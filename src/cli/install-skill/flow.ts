import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { ensurePathAncestorsAndRealPathWithinHome, ensurePathWithinRoots } from '../path-guard.js';
import type { FacetCliOptions } from '../types.js';

export type InstallFlowSelection = 'Skill deploy' | 'File placement' | 'Template apply';

export function shouldOverwrite(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

export function ensureSkillModeFromLabel(modeLabel: string): 'inline' | 'reference' {
  if (modeLabel === 'Inline') {
    return 'inline';
  }
  if (modeLabel === 'Reference') {
    return 'reference';
  }
  throw new Error(`Unsupported skill mode: ${modeLabel}`);
}

export function ensureInstallFlowSelection(selection: string): InstallFlowSelection {
  if (selection === 'Skill deploy' || selection === 'File placement' || selection === 'Template apply') {
    return selection;
  }
  throw new Error(`Unsupported install flow selection: ${selection}`);
}

export function resolveInstallTarget(targetLabel: string): 'cc' {
  if (targetLabel === 'Claude Code') {
    return 'cc';
  }
  throw new Error(`Unsupported skill target: ${targetLabel}`);
}

export function defaultOutputPath(homeDir: string, skillName: string): string {
  return join(homeDir, '.claude', 'skills', skillName, 'SKILL.md');
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
  homeDir?: string;
}): void {
  if (!params.homeDir) {
    return;
  }

  ensurePathAncestorsAndRealPathWithinHome(params.targetDir, params.homeDir, params.promptLabel);
}

export async function ensureRegenerationTargetDir(params: {
  targetDir: string;
  options: FacetCliOptions;
  promptLabel: string;
  homeDir?: string;
}): Promise<void> {
  const { targetDir, options, promptLabel } = params;

  if (existsSync(targetDir)) {
    const overwriteAnswer = await options.input(`${promptLabel} exists. Replace? (${targetDir})`, 'n');
    if (!shouldOverwrite(overwriteAnswer)) {
      throw new Error(`${promptLabel} exists and overwrite was cancelled: ${targetDir}`);
    }
    ensurePathSafety(params);
    rmSync(targetDir, { recursive: true, force: true });
  }

  ensurePathSafety(params);
  mkdirSync(targetDir, { recursive: true });
}

export function ensureDirectoryExists(path: string, label: string): void {
  if (!existsSync(path) || !lstatSync(path).isDirectory()) {
    throw new Error(`${label} does not exist: ${path}`);
  }
}

export async function dispatchInstallFlow<T>(params: {
  selection: InstallFlowSelection;
  onSkillDeploy: () => Promise<T>;
  onFilePlacement: () => Promise<T>;
  onTemplateApply: () => Promise<T>;
}): Promise<T> {
  if (params.selection === 'File placement') {
    return params.onFilePlacement();
  }

  if (params.selection === 'Template apply') {
    return params.onTemplateApply();
  }

  return params.onSkillDeploy();
}
