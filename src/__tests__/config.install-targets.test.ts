import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

type FacetedConfigWithInstallTargets = {
  version: number;
  skillPaths?: readonly string[];
  install?: {
    targets?: {
      codex?: {
        roots?: readonly string[];
      };
    };
  };
};

type ConfigModule = {
  createDefaultFacetedConfig: () => FacetedConfigWithInstallTargets;
  readFacetedConfig: (homeDir: string) => Promise<FacetedConfigWithInstallTargets>;
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

describe('readFacetedConfig install target roots', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should return built-in Codex install roots when config.yaml omits install.targets.codex.roots', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-install-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, 'version: 1\n');

    const { readFacetedConfig } = await loadConfigModule();
    const config = await readFacetedConfig(homeDir);

    expect(config.install?.targets?.codex?.roots).toEqual([
      '{homeDir}/.agents/skills',
    ]);
  });

  it('should expose the same built-in Codex roots through the default config factory', async () => {
    const { createDefaultFacetedConfig } = await loadConfigModule();

    expect(createDefaultFacetedConfig().install?.targets?.codex?.roots).toEqual([
      '{homeDir}/.agents/skills',
    ]);
  });

  it('should fully override built-in Codex install roots when config.yaml provides install.targets.codex.roots', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-install-'));
    tempDirs.push(homeDir);
    writeConfig(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets:',
        '    codex:',
        '      roots:',
        '        - "/opt/company/skills"',
      ].join('\n'),
    );

    const { readFacetedConfig } = await loadConfigModule();
    const config = await readFacetedConfig(homeDir);

    expect(config.install?.targets?.codex?.roots).toEqual([
      '/opt/company/skills',
    ]);
  });

  it('should keep built-in Codex install roots when config.yaml omits the codex target object', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-install-'));
    tempDirs.push(homeDir);
    writeConfig(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets: {}',
      ].join('\n'),
    );

    const { readFacetedConfig } = await loadConfigModule();
    const config = await readFacetedConfig(homeDir);

    expect(config.install?.targets?.codex?.roots).toEqual([
      '{homeDir}/.agents/skills',
    ]);
  });

  it('should throw when install is not an object', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-install-'));
    tempDirs.push(homeDir);
    writeConfig(
      homeDir,
      [
        'version: 1',
        'install: invalid',
      ].join('\n'),
    );

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      'Invalid faceted config field: install.targets.codex.roots',
    );
  });

  it('should throw when install.targets is not an object', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-install-'));
    tempDirs.push(homeDir);
    writeConfig(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets: invalid',
      ].join('\n'),
    );

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      'Invalid faceted config field: install.targets.codex.roots',
    );
  });

  it('should throw when install.targets.codex is not an object', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-install-'));
    tempDirs.push(homeDir);
    writeConfig(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets:',
        '    codex: invalid',
      ].join('\n'),
    );

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      'Invalid faceted config field: install.targets.codex.roots',
    );
  });

  it('should throw when install.targets.codex.roots contains non-string entries', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-install-'));
    tempDirs.push(homeDir);
    writeConfig(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets:',
        '    codex:',
        '      roots:',
        '        - "{homeDir}/.agents/skills"',
        '        - 100',
      ].join('\n'),
    );

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      'Invalid faceted config field: install.targets.codex.roots',
    );
  });

  it('should throw when install.targets.codex.roots contains blank entries', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-install-'));
    tempDirs.push(homeDir);
    writeConfig(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets:',
        '    codex:',
        '      roots:',
        '        - "   "',
      ].join('\n'),
    );

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      'Invalid faceted config field: install.targets.codex.roots',
    );
  });
});
