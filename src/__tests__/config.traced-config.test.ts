import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

type ConfigModule = {
  readFacetedConfig: (homeDir: string) => Promise<{
    version: number;
    skillPaths?: readonly string[];
    install: {
      targets: {
        codex: {
          roots: readonly string[];
        };
      };
    };
  }>;
};

async function loadConfigModule(): Promise<ConfigModule> {
  const modulePath = pathToFileURL(resolve('src/config/index.ts')).href;
  return import(modulePath) as Promise<ConfigModule>;
}

function writeConfig(homeDir: string, body: string): string {
  const facetedRoot = join(homeDir, '.faceted');
  fs.mkdirSync(facetedRoot, { recursive: true });
  const configPath = join(facetedRoot, 'config.yaml');
  fs.writeFileSync(configPath, body, 'utf-8');
  return configPath;
}

describe('readFacetedConfig traced-config integration', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('yaml');
    vi.resetModules();
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads a valid object-root yaml file', async () => {
    const homeDir = fs.mkdtempSync(join(tmpdir(), 'faceted-config-real-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, 'version: 2\nskillPaths:\n  - /skills/custom\n');

    const { readFacetedConfig } = await loadConfigModule();
    const config = await readFacetedConfig(homeDir);

    expect(config).toEqual({
      version: 2,
      skillPaths: ['/skills/custom'],
      install: {
        targets: {
          codex: {
            roots: ['{homeDir}/.agents/skills'],
          },
        },
      },
    });
  });

  it('fails when yaml root is an array', async () => {
    const homeDir = fs.mkdtempSync(join(tmpdir(), 'faceted-config-real-'));
    tempDirs.push(homeDir);
    const configPath = writeConfig(homeDir, '- item\n');

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      `Invalid faceted config file: ${configPath}`,
    );
  });

  it('fails when yaml root is a scalar', async () => {
    const homeDir = fs.mkdtempSync(join(tmpdir(), 'faceted-config-real-'));
    tempDirs.push(homeDir);
    const configPath = writeConfig(homeDir, 'hello\n');

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      `Invalid faceted config file: ${configPath}`,
    );
  });

  it('returns invalid field using validation issue key', async () => {
    const homeDir = fs.mkdtempSync(join(tmpdir(), 'faceted-config-real-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, 'version: 1\nskillPaths:\n  - 100\n');

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      'Invalid faceted config field: skillPaths',
    );
  });

  it('fails when yaml is malformed', async () => {
    const homeDir = fs.mkdtempSync(join(tmpdir(), 'faceted-config-real-'));
    tempDirs.push(homeDir);
    const configPath = writeConfig(homeDir, 'version: [1\n');

    const { readFacetedConfig } = await loadConfigModule();

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      `Invalid faceted config file: ${configPath}`,
    );
  });

  it('uses a single file read during one config load', async () => {
    const homeDir = fs.mkdtempSync(join(tmpdir(), 'faceted-config-real-'));
    tempDirs.push(homeDir);
    const configPath = writeConfig(homeDir, 'version: 2\nskillPaths:\n  - /skills/custom\n');

    let parseCallCount = 0;
    vi.resetModules();
    vi.doMock('yaml', async () => {
      const actual = await vi.importActual<typeof import('yaml')>('yaml');
      return {
        ...actual,
        parse: (...args: Parameters<typeof actual.parse>) => {
          parseCallCount += 1;
          if (parseCallCount === 1) {
            fs.writeFileSync(configPath, '- broken-after-first-read\n', 'utf-8');
          }
          return actual.parse(...args);
        },
      };
    });

    const { readFacetedConfig } = await loadConfigModule();
    const config = await readFacetedConfig(homeDir);

    expect(config).toEqual({
      version: 2,
      skillPaths: ['/skills/custom'],
      install: {
        targets: {
          codex: {
            roots: ['{homeDir}/.agents/skills'],
          },
        },
      },
    });
    expect(parseCallCount).toBe(1);
  });
});
