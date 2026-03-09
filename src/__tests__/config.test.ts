import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

type ConfigModule = {
  readFacetedConfig: (homeDir: string) => Promise<{
    version: number;
    skillPaths?: readonly string[];
  }>;
};

async function loadConfigModule(): Promise<ConfigModule> {
  const modulePath = pathToFileURL(resolve('src/config/index.ts')).href;
  return import(modulePath) as Promise<ConfigModule>;
}

function writeConfig(homeDir: string, body: string): void {
  const facetedRoot = join(homeDir, '.faceted');
  mkdirSync(facetedRoot, { recursive: true });
  writeFileSync(join(facetedRoot, 'config.yaml'), body, 'utf-8');
}

describe('readFacetedConfig', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should resolve config values from config.yaml when fields are explicitly provided', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, ['version: 2', 'skillPaths:', '  - /skills/custom'].join('\n'));

    const { readFacetedConfig } = await loadConfigModule();
    const config = await readFacetedConfig(homeDir);

    expect(config).toEqual({
      version: 2,
      skillPaths: ['/skills/custom'],
    });
  });

  it('should prioritize config.yaml values over default layer on conflict', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, ['version: 9', 'skillPaths:', '  - /skills/override'].join('\n'));

    const { readFacetedConfig } = await loadConfigModule();
    const config = await readFacetedConfig(homeDir);

    expect(config.version).toBe(9);
    expect(config.skillPaths).toEqual(['/skills/override']);
  });

  it('should fill skillPaths from default layer when config.yaml omits the field', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, 'version: 1\n');

    const { readFacetedConfig } = await loadConfigModule();
    const config = await readFacetedConfig(homeDir);

    expect(config.skillPaths).toEqual([]);
  });

  it('should fill version from default layer when config.yaml omits the field', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, 'skillPaths: []\n');

    const { readFacetedConfig } = await loadConfigModule();
    const config = await readFacetedConfig(homeDir);

    expect(config.version).toBe(1);
  });

  it('should throw when skillPaths contains non-string entries', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, ['version: 1', 'skillPaths:', '  - 100'].join('\n'));

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      'Invalid faceted config field: skillPaths',
    );
  });

  it('should throw an invalid file error when config.yaml contains malformed yaml', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, 'version: [1\n');

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      `Invalid faceted config file: ${join(homeDir, '.faceted', 'config.yaml')}`,
    );
  });

  it('should throw when config.yaml parses to a non-object root value', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, '- not-an-object\n');

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      `Invalid faceted config file: ${join(homeDir, '.faceted', 'config.yaml')}`,
    );
  });
});
