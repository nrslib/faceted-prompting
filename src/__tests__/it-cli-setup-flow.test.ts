import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

describe('facet init/setup integration flow', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
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
  });

  it('should set up faceted home via setup command without overwriting existing files', async () => {
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
    const original = readFileSync(personaPath, 'utf-8');

    const result = await runFacetCli(['setup'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({
      kind: 'text',
      text: `Set up: ${join(homeDir, '.faceted')}`,
    });
    expect(readFileSync(personaPath, 'utf-8')).toBe(original);
    expect(existsSync(join(homeDir, '.faceted', 'templates', 'issue-worktree', 'SKILL.md'))).toBe(true);
  });
});
