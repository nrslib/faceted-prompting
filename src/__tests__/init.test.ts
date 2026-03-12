import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

type InitModule = {
  initializeFacetedHome: (options: { homeDir: string }) => Promise<void>;
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

  it('should create default templates on first run', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    expect(existsSync(join(facetsRoot, 'persona', 'coder.md'))).toBe(true);
    expect(existsSync(join(facetsRoot, 'knowledge', 'architecture.md'))).toBe(true);
    expect(existsSync(join(facetsRoot, 'policies', 'coding.md'))).toBe(true);
    expect(existsSync(join(facetedRoot, 'compositions', 'coding.yaml'))).toBe(true);
    expect(existsSync(join(facetedRoot, 'compositions', 'issue-worktree.yaml'))).toBe(true);
    expect(existsSync(join(facetedRoot, 'templates', 'issue-worktree', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(facetedRoot, 'templates', 'issue-worktree', 'README.md'))).toBe(true);
    expect(
      existsSync(join(facetedRoot, 'templates', 'issue-worktree', 'templates', 'instructions', 'fix.md')),
    ).toBe(true);
  });

  it('should install the default issue-worktree sample template content', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'faceted-home-'));
    tempDirs.push(homeDir);

    const { initializeFacetedHome } = await loadInitModule();
    await initializeFacetedHome({ homeDir });

    const facetedRoot = join(homeDir, '.faceted');
    const compositionBody = readFileSync(join(facetedRoot, 'compositions', 'issue-worktree.yaml'), 'utf-8');
    const skillTemplateBody = readFileSync(join(facetedRoot, 'templates', 'issue-worktree', 'SKILL.md'), 'utf-8');

    expect(compositionBody).toContain('template: issue-worktree');
    expect(skillTemplateBody).toContain('{{facet:persona}}');
    expect(skillTemplateBody).toContain('{{facet:policies}}');
    expect(skillTemplateBody).toContain('{{facet:knowledges}}');
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

    const personaTemplatePath = join(homeDir, '.faceted', 'facets', 'persona', 'coder.md');
    const customPersonaTemplate = 'Custom persona template';
    writeFileSync(personaTemplatePath, customPersonaTemplate, 'utf-8');

    await initializeFacetedHome({ homeDir });
    expect(readFileSync(personaTemplatePath, 'utf-8')).toBe(customPersonaTemplate);
  });
});
