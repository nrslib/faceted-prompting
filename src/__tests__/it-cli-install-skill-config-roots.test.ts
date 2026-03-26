import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
  }) => Promise<{ kind: 'path'; path: string } | { kind: 'text'; text: string }>;
};

async function loadCliModule(): Promise<CliModule> {
  const modulePath = pathToFileURL(resolve('src/cli/index.ts')).href;
  return import(modulePath) as Promise<CliModule>;
}

function createSelectStub(expectedSelections: readonly string[]) {
  const queue = [...expectedSelections];
  return async (candidates: string[]): Promise<string> => {
    const next = queue.shift();
    if (!next) {
      throw new Error(`Unexpected select call: ${candidates.join(', ')}`);
    }
    expect(candidates).toContain(next);
    return next;
  };
}

function createFacetedFixture(homeDir: string, configBody?: string): void {
  const facetedRoot = join(homeDir, '.faceted');
  const facetsRoot = join(facetedRoot, 'facets');
  const compositionsRoot = join(facetedRoot, 'compositions');

  mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
  mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
  mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
  mkdirSync(compositionsRoot, { recursive: true });

  if (configBody !== undefined) {
    writeFileSync(join(facetedRoot, 'config.yaml'), configBody, 'utf-8');
  }
  writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'coding.md'), 'Never hide errors.', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), 'Architecture reference.', 'utf-8');
  writeFileSync(
    join(compositionsRoot, 'coding.yaml'),
    [
      'name: coding',
      'description: Coding workflow',
      'persona: coder',
      'policies:',
      '  - coding',
      'knowledge:',
      '  - architecture',
    ].join('\n'),
    'utf-8',
  );
}

describe('facet install skill Codex roots integration', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should install Codex skills to .agents/skills by default', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const expectedOutputPath = join(homeDir, '.agents', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Codex']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: expectedOutputPath });
    expect(existsSync(expectedOutputPath)).toBe(true);
    expect(readFileSync(expectedOutputPath, 'utf-8')).toContain('You are a coding agent.');
  });

  it('should install Codex skills to .agents/skills when config.yaml is missing', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir, undefined);

    const expectedOutputPath = join(homeDir, '.agents', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Codex']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: expectedOutputPath });
    expect(existsSync(expectedOutputPath)).toBe(true);
    expect(readFileSync(expectedOutputPath, 'utf-8')).toContain('You are a coding agent.');
  });

  it('should reject the legacy Codex path when config.yaml does not opt into it', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const disallowedOutputPath = join(homeDir, '.codex', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Codex']),
      input: async (prompt, defaultValue) => {
        if (prompt.toLowerCase().includes('output path')) {
          expect(defaultValue).toBe(join(homeDir, '.agents', 'skills', 'coding', 'SKILL.md'));
          return disallowedOutputPath;
        }
        return defaultValue;
      },
    })).rejects.toThrow(`Skill output path must be inside target directory: ${join(homeDir, '.agents', 'skills')}`);
  });

  it('should use only configured Codex roots for install path validation and default selection', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets:',
        '    codex:',
        '      roots:',
        '        - "{homeDir}/.codex/skills"',
      ].join('\n'),
    );

    const expectedOutputPath = join(homeDir, '.codex', 'skills', 'coding', 'SKILL.md');
    const disallowedOutputPath = join(homeDir, '.agents', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Codex']),
      input: async (prompt, defaultValue) => {
        if (prompt.toLowerCase().includes('output path')) {
          expect(defaultValue).toBe(expectedOutputPath);
          return disallowedOutputPath;
        }
        return defaultValue;
      },
    })).rejects.toThrow(`Skill output path must be inside target directory: ${join(homeDir, '.codex', 'skills')}`);
  });

  it('should install into a configured Codex root outside home directory', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    const externalRoot = mkdtempSync(join(tmpdir(), 'facet-codex-root-'));
    tempDirs.push(workspaceDir, homeDir, externalRoot);
    createFacetedFixture(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets:',
        '    codex:',
        '      roots:',
        `        - "${externalRoot}"`,
      ].join('\n'),
    );

    const expectedOutputPath = join(externalRoot, 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Codex']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: expectedOutputPath });
    expect(existsSync(expectedOutputPath)).toBe(true);
  });

  it('should allow both configured Codex roots and default to the first one', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    const primaryRoot = mkdtempSync(join(tmpdir(), 'facet-codex-primary-'));
    const secondaryRoot = mkdtempSync(join(tmpdir(), 'facet-codex-secondary-'));
    tempDirs.push(workspaceDir, homeDir, primaryRoot, secondaryRoot);
    createFacetedFixture(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets:',
        '    codex:',
        '      roots:',
        `        - "${primaryRoot}"`,
        `        - "${secondaryRoot}"`,
      ].join('\n'),
    );

    const expectedDefaultOutputPath = join(primaryRoot, 'coding', 'SKILL.md');
    const selectedSecondaryOutputPath = join(secondaryRoot, 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Codex']),
      input: async (prompt, defaultValue) => {
        if (prompt.toLowerCase().includes('output path')) {
          expect(defaultValue).toBe(expectedDefaultOutputPath);
          return selectedSecondaryOutputPath;
        }
        return defaultValue;
      },
    });

    expect(result).toEqual({ kind: 'path', path: selectedSecondaryOutputPath });
    expect(existsSync(selectedSecondaryOutputPath)).toBe(true);
    expect(existsSync(expectedDefaultOutputPath)).toBe(false);
  });

  it('should fail fast when config.yaml contains an empty Codex roots list', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets:',
        '    codex:',
        '      roots: []',
      ].join('\n'),
    );

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Invalid faceted config field: install.targets.codex.roots');
  });

  it('should fail fast when config.yaml contains a non-array Codex roots value', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(
      homeDir,
      [
        'version: 1',
        'install:',
        '  targets:',
        '    codex:',
        '      roots: invalid',
      ].join('\n'),
    );

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Invalid faceted config field: install.targets.codex.roots');
  });

  it('should fail fast when config.yaml contains a blank Codex root entry', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(
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

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Invalid faceted config field: install.targets.codex.roots');
  });
});
