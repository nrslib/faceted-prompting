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

function invalidInstallRootField(target: InstallTarget): never {
  throw new Error(`Invalid faceted config field: install.targets.${target}.roots`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateInstallRootTemplates(
  target: InstallTarget,
  rootTemplates: unknown,
): readonly string[] {
  if (
    !Array.isArray(rootTemplates)
    || rootTemplates.length === 0
    || rootTemplates.some(root => typeof root !== 'string' || !hasNonEmptyInstallRootTemplate(root))
  ) {
    invalidInstallRootField(target);
  }

  return [...rootTemplates];
}

function readNestedConfigValue(
  parent: Record<string, unknown>,
  key: string,
  target: InstallTarget,
): Record<string, unknown> | undefined {
  const value = parent[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    invalidInstallRootField(target);
  }
  return value;
}

export function readInstallRootTemplatesFromConfigValue(
  target: InstallTarget,
  configValue: unknown,
): readonly string[] {
  const defaultRootTemplates = getBuiltInInstallRootTemplates(target);
  if (target !== 'codex') {
    return defaultRootTemplates;
  }
  if (configValue === undefined) {
    return defaultRootTemplates;
  }
  if (!isRecord(configValue)) {
    invalidInstallRootField(target);
  }

  const installValue = readNestedConfigValue(configValue, 'install', target);
  if (!installValue) {
    return defaultRootTemplates;
  }

  const targetsValue = readNestedConfigValue(installValue, 'targets', target);
  if (!targetsValue) {
    return defaultRootTemplates;
  }

  const targetValue = readNestedConfigValue(targetsValue, target, target);
  if (!targetValue) {
    return defaultRootTemplates;
  }

  const rootsValue = targetValue.roots;
  if (rootsValue === undefined) {
    return defaultRootTemplates;
  }

  return validateInstallRootTemplates(target, rootsValue);
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
