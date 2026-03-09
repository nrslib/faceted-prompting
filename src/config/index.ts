import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function getInvalidFieldFromValidationIssue(issue: unknown): string | undefined {
  if (typeof issue === 'string' && issue.length > 0) {
    return issue;
  }
  if (!issue || typeof issue !== 'object') {
    return undefined;
  }

  const record = issue as Record<string, unknown>;
  const key = record.key;
  if (typeof key === 'string' && key.length > 0) {
    return key;
  }
  const field = record.field;
  if (typeof field === 'string' && field.length > 0) {
    return field;
  }
  return undefined;
}

function assertConfigRootIsObject(configPath: string): void {
  const content = readFileSync(configPath, 'utf-8');
  const parsed = parse(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid faceted config file: ${configPath}`);
  }
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

  try {
    await resolver.loadFile([{ path: configPath, label: 'local' }]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith(`Failed to parse config file '${configPath}' (label: local)`)
    ) {
      throw new Error(`Invalid faceted config file: ${configPath}`);
    }
    throw error;
  }

  assertConfigRootIsObject(configPath);

  const validationIssues = resolver.validate();
  if (validationIssues.length > 0) {
    const invalidField = getInvalidFieldFromValidationIssue(validationIssues[0]);
    if (invalidField) {
      throw new Error(`Invalid faceted config field: ${invalidField}`);
    }
    throw new Error('Invalid faceted config field');
  }

  return {
    version: resolver.get('version'),
    skillPaths: resolver.get('skillPaths'),
  };
}
