import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tracedConfig } from 'traced-config';
import { parse } from 'yaml';

export interface FacetedConfig {
  readonly version: number;
  readonly skillPaths?: readonly string[];
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

function ensureNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid faceted config field: ${field}`);
  }
  return value;
}

function ensureStringList(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new Error(`Invalid faceted config field: ${field}`);
  }
  return value;
}

export async function readFacetedConfig(homeDir: string): Promise<FacetedConfig> {
  const configPath = getConfigPath(homeDir);
  if (!existsSync(configPath)) {
    throw new Error(`Missing faceted config: ${configPath}`);
  }

  const resolver = tracedConfig({
    schema: {
      version: {
        default: 1,
        doc: 'config schema version',
        sources: { global: false, local: true, env: false, cli: false },
      },
      skillPaths: {
        default: [],
        doc: 'skill path list',
        sources: { global: false, local: true, env: false, cli: false },
      },
    },
  });

  resolver.addParser('yaml', content => {
    const parsed = parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Invalid faceted config file: ${configPath}`);
    }
    return parsed;
  });

  try {
    await resolver.loadFile([{ path: configPath, label: 'local' }]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === `Failed to parse config file '${configPath}' (label: local)`
    ) {
      throw new Error(`Invalid faceted config file: ${configPath}`);
    }
    throw error;
  }

  const config = {
    version: resolver.get('version'),
    skillPaths: resolver.get('skillPaths'),
  };
  return {
    version: ensureNumber(config.version, 'version'),
    skillPaths: ensureStringList(config.skillPaths, 'skillPaths'),
  };
}
