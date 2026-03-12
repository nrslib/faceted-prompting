import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

type CliModule = {
  runFacetCli: (args: string[], options: {
    cwd: string;
    homeDir: string;
    select: (candidates: string[], prompt?: string) => Promise<string>;
    input: (prompt: string, defaultValue: string) => Promise<string>;
  }) => Promise<
    | { kind: 'path'; path: string }
    | { kind: 'paths'; paths: string[] }
    | { kind: 'text'; text: string }
  >;
};

async function loadCliModule(): Promise<CliModule> {
  const modulePath = pathToFileURL(resolve('src/cli/index.ts')).href;
  return import(modulePath) as Promise<CliModule>;
}

describe('facet init/pull-sample integration flow', () => {
  const tempDirs: string[] = [];
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should initialize faceted home via init command', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['init'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({
      kind: 'text',
      text: `Initialized: ${join(homeDir, '.faceted')}`,
    });
    expect(existsSync(join(homeDir, '.faceted', 'config.yaml'))).toBe(true);
    expect(existsSync(join(homeDir, '.faceted', 'compositions', 'coding.yaml'))).toBe(true);
    expect(existsSync(join(homeDir, '.faceted', 'facets', 'persona', 'coder.md'))).toBe(false);
  });

  it('should fetch TAKT sample facets via pull-sample command', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    globalThis.fetch = (async (input: string | URL) => {
      const url = input.toString();
      const key = url.replace('https://raw.githubusercontent.com/nrslib/takt/main/builtins/ja/facets/', '');
      const responses = new Map<string, string>([
        ['personas/coder.md', '# Pulled Coder\n'],
        ['knowledge/architecture.md', '# Pulled Architecture\n'],
        ['knowledge/frontend.md', '# Pulled Frontend\n'],
        ['knowledge/backend.md', '# Pulled Backend\n'],
        ['policies/coding.md', '# Pulled Coding\n'],
        ['policies/ai-antipattern.md', '# Pulled AI Antipattern\n'],
      ]);
      const body = responses.get(key);
      if (!body) {
        return new Response('', { status: 404 });
      }
      return new Response(body, { status: 200 });
    }) as typeof fetch;

    const result = await runFacetCli(['pull-sample'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({
      kind: 'text',
      text: `Pulled sample: ${join(homeDir, '.faceted')}`,
    });
    expect(readFileSync(join(homeDir, '.faceted', 'facets', 'persona', 'coder.md'), 'utf-8')).toBe('# Pulled Coder\n');
    expect(readFileSync(join(homeDir, '.faceted', 'facets', 'knowledge', 'architecture.md'), 'utf-8')).toBe(
      '# Pulled Architecture\n',
    );
  });

  it('should confirm before overwriting existing pull-sample targets', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    await runFacetCli(['init'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    });

    const personaPath = join(homeDir, '.faceted', 'facets', 'persona', 'coder.md');
    writeFileSync(personaPath, '# Existing Persona\n', 'utf-8');

    globalThis.fetch = (async () => new Response('# Overwritten Persona\n', { status: 200 })) as typeof fetch;

    await expect(runFacetCli(['pull-sample'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (prompt, defaultValue) => {
        expect(prompt).toContain('[y/N]');
        return defaultValue;
      },
    })).rejects.toThrow(`Pull sample was cancelled: ${personaPath}`);

    const result = await runFacetCli(['pull-sample'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (prompt, defaultValue) => {
        if (prompt.startsWith('Pull sample will overwrite existing files.')) {
          return 'y';
        }
        return defaultValue;
      },
    });

    expect(result).toEqual({
      kind: 'text',
      text: `Pulled sample: ${join(homeDir, '.faceted')}`,
    });
    expect(readFileSync(personaPath, 'utf-8')).toBe('# Overwritten Persona\n');
  });
});
