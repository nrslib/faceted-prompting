import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import { ensurePathWithinHome, isWithinRoot } from './path-guard.js';
import type { SkillEntry, SkillMode, SkillsRegistry } from './skill-types.js';

function ensureObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid skills config field: ${label}`);
  }
  return value as Record<string, unknown>;
}

function ensureNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid skills config field: ${label}`);
  }
  return value;
}

function ensureSkillMode(value: unknown, label: string): SkillMode {
  if (value !== 'inline' && value !== 'reference') {
    throw new Error(`Invalid skills config field: ${label}`);
  }
  return value;
}

function parseSkillEntry(value: unknown, label: string): SkillEntry {
  const entryObject = ensureObject(value, label);
  const allowedKeys = new Set(['source', 'mode', 'output', 'cc']);
  for (const key of Object.keys(entryObject)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Invalid skills config field: ${label}.${key}`);
    }
  }

  const source = ensureNonEmptyString(entryObject.source, `${label}.source`);
  const mode = ensureSkillMode(entryObject.mode, `${label}.mode`);
  const output = ensureNonEmptyString(entryObject.output, `${label}.output`);

  let cc: SkillEntry['cc'];
  if (entryObject.cc !== undefined) {
    const ccObject = ensureObject(entryObject.cc, `${label}.cc`);
    const ccAllowedKeys = new Set(['user-invocable']);
    for (const ccKey of Object.keys(ccObject)) {
      if (!ccAllowedKeys.has(ccKey)) {
        throw new Error(`Invalid skills config field: ${label}.cc.${ccKey}`);
      }
    }

    if (ccObject['user-invocable'] !== undefined && typeof ccObject['user-invocable'] !== 'boolean') {
      throw new Error(`Invalid skills config field: ${label}.cc.user-invocable`);
    }

    cc = {
      'user-invocable': ccObject['user-invocable'] as boolean | undefined,
    };
  }

  return {
    source,
    mode,
    output,
    cc,
  };
}

export function readSkillsRegistry(skillsPath: string): SkillsRegistry {
  if (!existsSync(skillsPath)) {
    return {};
  }

  const parsed = parse(readFileSync(skillsPath, 'utf-8'));
  if (parsed === null || parsed === undefined) {
    return {};
  }

  const root = ensureObject(parsed, 'root');
  const registry: SkillsRegistry = {};
  for (const [target, targetValue] of Object.entries(root)) {
    const targetObject = ensureObject(targetValue, target);
    const targetEntries: Record<string, SkillEntry> = {};

    for (const [skillName, entry] of Object.entries(targetObject)) {
      targetEntries[skillName] = parseSkillEntry(entry, `${target}.${skillName}`);
    }

    registry[target] = targetEntries;
  }

  return registry;
}

export function writeSkillsRegistry(skillsPath: string, registry: SkillsRegistry, homeDir: string): void {
  const { resolvedPath, homeRealPath } = ensurePathWithinHome(
    skillsPath,
    homeDir,
    'Skills registry path',
  );

  mkdirSync(dirname(resolvedPath), { recursive: true });
  const registryParentRealPath = realpathSync(dirname(resolvedPath));
  if (!isWithinRoot(registryParentRealPath, homeRealPath)) {
    throw new Error(`Skills registry path escapes home directory: ${resolvedPath}`);
  }
  const registryTargetPath = join(registryParentRealPath, basename(resolvedPath));

  const rendered = stringify(registry);
  const openFlags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  const tempRegistryPath = join(
    registryParentRealPath,
    `.${basename(resolvedPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  let fileDescriptor: number;
  try {
    if (existsSync(registryTargetPath) && lstatSync(registryTargetPath).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed for skills registry file: ${resolvedPath}`);
    }

    fileDescriptor = openSync(tempRegistryPath, openFlags, 0o600);
  } catch (error: unknown) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === 'ELOOP') {
      throw new Error(`Symbolic links are not allowed for skills registry file: ${resolvedPath}`);
    }
    throw error;
  }

  try {
    writeFileSync(fileDescriptor, rendered.endsWith('\n') ? rendered : `${rendered}\n`, 'utf-8');
  } finally {
    closeSync(fileDescriptor);
  }

  try {
    renameSync(tempRegistryPath, registryTargetPath);
  } catch (error) {
    if (existsSync(tempRegistryPath)) {
      unlinkSync(tempRegistryPath);
    }
    throw error;
  }

  const registryRealPath = realpathSync(registryTargetPath);
  if (!isWithinRoot(registryRealPath, homeRealPath)) {
    throw new Error(`Skills registry path escapes home directory: ${resolvedPath}`);
  }
}

export function buildInstalledSkillLabels(registry: SkillsRegistry): Array<{
  readonly label: string;
  readonly target: string;
  readonly skillName: string;
  readonly entry: SkillEntry;
}> {
  const labels: Array<{
    readonly label: string;
    readonly target: string;
    readonly skillName: string;
    readonly entry: SkillEntry;
  }> = [];

  for (const target of Object.keys(registry).sort()) {
    const entries = registry[target];
    if (!entries) {
      continue;
    }

    for (const skillName of Object.keys(entries).sort()) {
      const entry = entries[skillName];
      if (!entry) {
        continue;
      }

      labels.push({
        label: `${skillName} (${target}: ${entry.mode})`,
        target,
        skillName,
        entry,
      });
    }
  }

  return labels;
}
