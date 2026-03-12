import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

type InitModule = {
  initializeFacetedHome: (options: { homeDir: string }) => Promise<void>;
  pullSampleFacets: (options: {
    homeDir: string;
    fetchImpl?: (input: string) => Promise<{
      ok: boolean;
      status: number;
      text(): Promise<string>;
    }>;
    overwrite?: boolean;
  }) => Promise<void>;
};

async function loadInitModule(): Promise<InitModule> {
  const modulePath = pathToFileURL(resolve('src/init/index.ts')).href;
  return import(modulePath) as Promise<InitModule>;
}

describe('initializeFacetedHome', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should create config and required facet directories on first run', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome } = await loadInitModule();
    await initializeFacetedHome({ homeDir });
    expect(existsSync(join(homeDir, '.faceted', 'config.yaml'))).toBe(true);
    expect(existsSync(join(homeDir, '.faceted', 'facets', 'persona'))).toBe(true);
    expect(existsSync(join(homeDir, '.faceted', 'facets', 'knowledge'))).toBe(true);
    expect(existsSync(join(homeDir, '.faceted', 'facets', 'policies'))).toBe(true);
    expect(existsSync(join(homeDir, '.faceted', 'compositions'))).toBe(true);
    expect(existsSync(join(homeDir, '.faceted', 'templates'))).toBe(true);
  });

  it('should create empty composition and template directories on first run', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    expect(existsSync(join(facetsRoot, 'persona', 'coder.md'))).toBe(false);
    expect(existsSync(join(facetsRoot, 'knowledge', 'architecture.md'))).toBe(false);
    expect(existsSync(join(facetsRoot, 'policies', 'coding.md'))).toBe(false);
    expect(existsSync(join(facetedRoot, 'compositions', 'coding.yaml'))).toBe(false);
    expect(existsSync(join(facetedRoot, 'compositions', 'issue-worktree.yaml'))).toBe(false);
    expect(existsSync(join(facetedRoot, 'templates', 'issue-worktree', 'SKILL.md'))).toBe(false);
    expect(existsSync(join(facetedRoot, 'templates', 'issue-worktree', 'README.md'))).toBe(false);
  });

  it('should not install sample composition or template content during init', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const facetedRoot = join(homeDir, '.faceted');
    expect(existsSync(join(facetedRoot, 'compositions', 'issue-worktree.yaml'))).toBe(false);
    expect(existsSync(join(facetedRoot, 'templates', 'issue-worktree', 'SKILL.md'))).toBe(false);
  });

  it('should initialize config with extensible skillPaths field', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const configPath = join(homeDir, '.faceted', 'config.yaml');
    const configBody = readFileSync(configPath, 'utf-8');
    expect(configBody).toContain('version: 1');
    expect(configBody).toContain('skillPaths: []');
  });

  it('should be idempotent and keep existing config values on re-run', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const configPath = join(homeDir, '.faceted', 'config.yaml');
    const customConfig = [
      'version: 1',
      'skillPaths:',
      '  - /tmp/custom-skill',
    ].join('\n');
    rmSync(configPath, { force: true });
    writeFileSync(configPath, customConfig, 'utf-8');
    await initializeFacetedHome({ homeDir });
    expect(readFileSync(configPath, 'utf-8')).toContain('/tmp/custom-skill');
    expect(existsSync(join(homeDir, '.faceted', 'templates'))).toBe(true);
  });

  it('should not overwrite existing templates on re-run', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const personaTemplatePath = join(homeDir, '.faceted', 'templates', 'custom', 'SKILL.md');
    mkdirSync(dirname(personaTemplatePath), { recursive: true });
    const customPersonaTemplate = 'Custom persona template';
    writeFileSync(personaTemplatePath, customPersonaTemplate, 'utf-8');

    await initializeFacetedHome({ homeDir });
    expect(readFileSync(personaTemplatePath, 'utf-8')).toBe(customPersonaTemplate);
  });
});

describe('pullSampleFacets', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should pull TAKT sample facets into an initialized home', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome, pullSampleFacets } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const fetchUrls: string[] = [];
    const responses = new Map<string, string>([
      ['personas/coder.md', '# Remote Coder\n'],
      ['knowledge/architecture.md', '# Remote Architecture\n'],
      ['knowledge/frontend.md', '# Remote Frontend\n'],
      ['knowledge/backend.md', '# Remote Backend\n'],
      ['policies/coding.md', '# Remote Coding\n'],
      ['policies/ai-antipattern.md', '# Remote AI Antipattern\n'],
    ]);

    await pullSampleFacets({
      homeDir,
      fetchImpl: async input => {
        fetchUrls.push(input);
        const key = input.replace('https://raw.githubusercontent.com/nrslib/takt/main/builtins/ja/facets/', '');
        const body = responses.get(key);
        if (!body) {
          return {
            ok: false,
            status: 404,
            text: async () => '',
          };
        }

        return {
          ok: true,
          status: 200,
          text: async () => body,
        };
      },
    });

    expect(fetchUrls).toHaveLength(6);
    expect(readFileSync(join(homeDir, '.faceted', 'facets', 'persona', 'coder.md'), 'utf-8')).toBe('# Remote Coder\n');
    expect(readFileSync(join(homeDir, '.faceted', 'facets', 'knowledge', 'architecture.md'), 'utf-8')).toBe(
      '# Remote Architecture\n',
    );
    expect(readFileSync(join(homeDir, '.faceted', 'facets', 'policies', 'coding.md'), 'utf-8')).toBe('# Remote Coding\n');
    expect(readFileSync(join(homeDir, '.faceted', 'compositions', 'coding.yaml'), 'utf-8')).toContain('name: coding');
    expect(readFileSync(join(homeDir, '.faceted', 'templates', 'issue-worktree', 'SKILL.md'), 'utf-8')).toContain(
      '{{facet:persona}}',
    );
  });

  it('should skip existing facet files unless overwrite is requested', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome, pullSampleFacets } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const coderPath = join(homeDir, '.faceted', 'facets', 'persona', 'coder.md');
    writeFileSync(coderPath, '# Custom Coder\n', 'utf-8');

    const fetchUrls: string[] = [];
    await pullSampleFacets({
      homeDir,
      fetchImpl: async input => {
        fetchUrls.push(input);
        return {
          ok: true,
          status: 200,
          text: async () => '# Remote\n',
        };
      },
    });

    expect(readFileSync(coderPath, 'utf-8')).toBe('# Custom Coder\n');
    expect(fetchUrls).toHaveLength(5);
    expect(fetchUrls.some(url => url.endsWith('/personas/coder.md'))).toBe(false);
  });

  it('should overwrite existing facet files when overwrite is requested', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome, pullSampleFacets } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const coderPath = join(homeDir, '.faceted', 'facets', 'persona', 'coder.md');
    writeFileSync(coderPath, '# Custom Coder\n', 'utf-8');

    await pullSampleFacets({
      homeDir,
      overwrite: true,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => '# Remote Overwrite\n',
      }),
    });

    expect(readFileSync(coderPath, 'utf-8')).toBe('# Remote Overwrite\n');
  });
});
