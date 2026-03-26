import { resolve } from 'node:path';
import type { InstallTarget } from '../install-targets.js';

const BUILTIN_INSTALL_ROOT_TEMPLATES = {
  cc: ['{homeDir}/.claude/skills'],
  codex: ['{homeDir}/.agents/skills'],
} as const satisfies Record<InstallTarget, readonly string[]>;

export function getBuiltInInstallRootTemplates(target: InstallTarget): readonly string[] {
  return [...BUILTIN_INSTALL_ROOT_TEMPLATES[target]];
}

export function hasNonEmptyInstallRootTemplate(root: string): boolean {
  return root.trim().length > 0;
}

export function resolveInstallRootTemplates(
  homeDir: string,
  rootTemplates: readonly string[],
): readonly string[] {
  if (rootTemplates.some(root => !hasNonEmptyInstallRootTemplate(root))) {
    throw new Error('Install root template must not be empty');
  }
  return rootTemplates.map(root => resolve(root.replaceAll('{homeDir}', homeDir)));
}
