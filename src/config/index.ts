import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tracedConfig, type ValidateError } from 'traced-config';
import { parse } from 'yaml';
import {
  getBuiltInInstallRootTemplates,
  hasNonEmptyInstallRootTemplate,
} from './install-targets.js';

export interface CodexInstallTargetConfig {
  readonly roots: readonly string[];
}

export interface InstallTargetsConfig {
  readonly codex: CodexInstallTargetConfig;
}

export interface InstallConfig {
  readonly targets: InstallTargetsConfig;
}

export interface FacetedConfig {
  readonly version: number;
  readonly skillPaths?: readonly string[];
  readonly install: InstallConfig;
}

const DEFAULT_CONFIG = ['version: 1', 'skillPaths: []'].join('\n');

export function getFacetedRoot(homeDir: string): string {
  return join(homeDir, '.faceted');
}

export function getConfigPath(homeDir: string): string {
  return join(getFacetedRoot(homeDir), 'config.yaml');
}

export function ensureConfigFile(homeDir: string): void {
  const root = getFacetedRoot(homeDir);
  mkdirSync(root, { recursive: true });

  const configPath = getConfigPath(homeDir);
  if (!existsSync(configPath)) {
    writeFileSync(configPath, `${DEFAULT_CONFIG}\n`, 'utf-8');
  }
}

function parseConfigRootAsObject(content: string): Record<string, unknown> {
  const parsed = parse(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Config root must be an object');
  }
  return parsed as Record<string, unknown>;
}

function hasErrorCode(error: unknown): error is NodeJS.ErrnoException {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const withCode = error as { code?: unknown };
  return typeof withCode.code === 'string';
}

function invalidConfigField(field: string): never {
  throw new Error(`Invalid faceted config field: ${field}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCodexInstallRoots(configRoot: Record<string, unknown>): readonly string[] {
  const defaultCodexInstallRoots = getBuiltInInstallRootTemplates('codex');
  const installValue = configRoot.install;
  if (installValue === undefined) {
    return defaultCodexInstallRoots;
  }
  if (!isRecord(installValue)) {
    invalidConfigField('install.targets.codex.roots');
  }

  const targetsValue = installValue.targets;
  if (targetsValue === undefined) {
    return defaultCodexInstallRoots;
  }
  if (!isRecord(targetsValue)) {
    invalidConfigField('install.targets.codex.roots');
  }

  const codexValue = targetsValue.codex;
  if (codexValue === undefined) {
    return defaultCodexInstallRoots;
  }
  if (!isRecord(codexValue)) {
    invalidConfigField('install.targets.codex.roots');
  }

  const rootsValue = codexValue.roots;
  if (rootsValue === undefined) {
    return defaultCodexInstallRoots;
  }
  if (
    !Array.isArray(rootsValue)
    || rootsValue.length === 0
    || rootsValue.some(root => typeof root !== 'string' || !hasNonEmptyInstallRootTemplate(root))
  ) {
    invalidConfigField('install.targets.codex.roots');
  }

  return [...rootsValue];
}

export function createDefaultFacetedConfig(): FacetedConfig {
  return {
    version: 1,
    skillPaths: [],
    install: {
      targets: {
        codex: {
          roots: getBuiltInInstallRootTemplates('codex'),
        },
      },
    },
  };
}

export async function readFacetedConfigOrDefault(homeDir: string): Promise<FacetedConfig> {
  const configPath = getConfigPath(homeDir);
  if (!existsSync(configPath)) {
    return createDefaultFacetedConfig();
  }

  return readFacetedConfig(homeDir);
}

export async function readFacetedConfig(homeDir: string): Promise<FacetedConfig> {
  const configPath = getConfigPath(homeDir);
  if (!existsSync(configPath)) {
    throw new Error(`Missing faceted config: ${configPath}`);
  }

  let parsedConfigRoot: Record<string, unknown> | undefined;
  const resolver = tracedConfig({
    schema: {
      version: {
        default: 1,
        doc: 'config schema version',
        format: Number,
        sources: { global: false, local: true, env: false, cli: false },
      },
      skillPaths: {
        default: [] as string[],
        doc: 'skill path list',
        format: 'string-list',
        sources: { global: false, local: true, env: false, cli: false },
      },
    },
  });

  resolver.addFormat('string-list', value => {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
  });
  resolver.addParser('yaml', content => {
    parsedConfigRoot = parseConfigRootAsObject(content);
    return parsedConfigRoot;
  });
  resolver.addParser('yml', content => {
    parsedConfigRoot = parseConfigRootAsObject(content);
    return parsedConfigRoot;
  });

  try {
    await resolver.loadFile([{ path: configPath, label: 'local' }]);
  } catch (error) {
    if (hasErrorCode(error)) {
      throw error;
    }
    throw new Error(`Invalid faceted config file: ${configPath}`);
  }

  const validationIssues: ValidateError[] = resolver.validate();
  if (validationIssues.length > 0) {
    const invalidField = validationIssues[0]?.key;
    if (invalidField) {
      throw new Error(`Invalid faceted config field: ${invalidField}`);
    }
    throw new Error('Invalid faceted config field');
  }

  if (!parsedConfigRoot) {
    throw new Error(`Invalid faceted config file: ${configPath}`);
  }

  const codexRoots = readCodexInstallRoots(parsedConfigRoot);

  return {
    version: resolver.get('version'),
    skillPaths: resolver.get('skillPaths'),
    install: {
      targets: {
        codex: {
          roots: codexRoots,
        },
      },
    },
  };
}
