import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

type ConfigModule = {
  readFacetedConfig: (homeDir: string) => Promise<{
    version: number;
    skillPaths?: readonly string[];
  }>;
};

type ResolverMock = {
  addParser: ReturnType<typeof vi.fn>;
  addFormat: ReturnType<typeof vi.fn>;
  loadFile: ReturnType<typeof vi.fn>;
  validate: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

function createResolverMock(): ResolverMock {
  return {
    addParser: vi.fn(),
    addFormat: vi.fn(),
    loadFile: vi.fn(),
    validate: vi.fn(),
    get: vi.fn(),
  };
}

async function loadConfigModuleWithResolver(resolver: ResolverMock): Promise<ConfigModule> {
  const tracedConfigMock = vi.fn(() => resolver);
  vi.resetModules();
  vi.doMock('traced-config', () => ({ tracedConfig: tracedConfigMock }));

  const modulePath = pathToFileURL(resolve('src/config/index.ts')).href;
  const cacheKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const module = await import(`${modulePath}?case=${cacheKey}`);
  return module as ConfigModule;
}

function writeConfig(homeDir: string, body: string): string {
  const facetedRoot = join(homeDir, '.faceted');
  mkdirSync(facetedRoot, { recursive: true });
  const configPath = join(facetedRoot, 'config.yaml');
  writeFileSync(configPath, body, 'utf-8');
  return configPath;
}

describe('readFacetedConfig with traced-config error handling', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.doUnmock('traced-config');
    vi.resetModules();
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should normalize parse errors even when traced-config message has extra details', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-mock-'));
    tempDirs.push(homeDir);
    const configPath = writeConfig(homeDir, 'version: [1\n');

    const resolver = createResolverMock();
    resolver.loadFile.mockRejectedValue(
      new Error(`Failed to parse config file '${configPath}' (label: local): yaml parser detail`),
    );

    const { readFacetedConfig } = await loadConfigModuleWithResolver(resolver);

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      `Invalid faceted config file: ${configPath}`,
    );
    expect(resolver.addParser).not.toHaveBeenCalled();
    expect(resolver.addFormat).toHaveBeenCalledWith('string-list', expect.any(Function));
  });

  it('should throw invalid field error when traced-config validate reports schema issues', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-mock-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, 'version: 1\nskillPaths:\n  - /skills/custom\n');

    const resolver = createResolverMock();
    resolver.loadFile.mockResolvedValue(undefined);
    resolver.validate.mockReturnValue([{ key: 'skillPaths' }]);
    resolver.get.mockImplementation((key: string) => {
      if (key === 'version') {
        return 1;
      }
      if (key === 'skillPaths') {
        return ['/skills/custom'];
      }
      return undefined;
    });

    const { readFacetedConfig } = await loadConfigModuleWithResolver(resolver);

    await expect(readFacetedConfig(homeDir)).rejects.toThrow(
      'Invalid faceted config field: skillPaths',
    );
  });

  it('should throw a generic field error when validate reports an issue without key metadata', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-config-mock-'));
    tempDirs.push(homeDir);
    writeConfig(homeDir, 'version: 1\nskillPaths:\n  - /skills/custom\n');

    const resolver = createResolverMock();
    resolver.loadFile.mockResolvedValue(undefined);
    resolver.validate.mockReturnValue([{}]);
    resolver.get.mockImplementation((key: string) => {
      if (key === 'version') {
        return 1;
      }
      if (key === 'skillPaths') {
        return ['/skills/custom'];
      }
      return undefined;
    });

    const { readFacetedConfig } = await loadConfigModuleWithResolver(resolver);

    await expect(readFacetedConfig(homeDir)).rejects.toThrow('Invalid faceted config field');
  });
});
