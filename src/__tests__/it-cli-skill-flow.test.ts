import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

async function runInit(runFacetCli: CliModule['runFacetCli'], workspaceDir: string, homeDir: string): Promise<void> {
  await runFacetCli(['init'], {
    cwd: workspaceDir,
    homeDir,
    select: async () => 'unused',
    input: async (_prompt, defaultValue) => defaultValue,
  });
}

function writeGlobalConfig(homeDir: string): void {
  const facetedRoot = join(homeDir, '.faceted');
  mkdirSync(facetedRoot, { recursive: true });
  writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
}

function createFacetedFixtureAtRoot(facetedRoot: string): {
  compositionsRoot: string;
} {
  const facetsRoot = join(facetedRoot, 'facets');
  const compositionsRoot = join(facetedRoot, 'compositions');

  mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
  mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
  mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
  mkdirSync(compositionsRoot, { recursive: true });

  writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
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

  return { compositionsRoot };
}

function createFacetedFixture(homeDir: string): {
  compositionsRoot: string;
} {
  return createFacetedFixtureAtRoot(join(homeDir, '.faceted'));
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

describe('facet skill integration flow', () => {
  const tempDirs: string[] = [];
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should install Claude Code skill', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const skillOutputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Claude Code']),
      input: async (prompt, defaultValue) =>
        prompt.toLowerCase().includes('output') ? skillOutputPath : defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: skillOutputPath });
    expect(existsSync(skillOutputPath)).toBe(true);
    expect(readFileSync(skillOutputPath, 'utf-8')).toContain('You are a coding agent.');
  });

  it('should prefer local composition and facets while falling back to global facets for missing refs', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    createFacetedFixture(homeDir);

    const localFacetedRoot = join(workspaceDir, '.faceted');
    mkdirSync(join(localFacetedRoot, 'facets', 'persona'), { recursive: true });
    mkdirSync(join(localFacetedRoot, 'compositions'), { recursive: true });
    writeFileSync(
      join(localFacetedRoot, 'compositions', 'coding.yaml'),
      [
        'name: coding',
        'description: Local coding workflow',
        'persona: local-coder',
        'policies:',
        '  - coding',
        'knowledge:',
        '  - architecture',
      ].join('\n'),
      'utf-8',
    );
    writeFileSync(
      join(localFacetedRoot, 'facets', 'persona', 'local-coder.md'),
      'You are a local coding agent.',
      'utf-8',
    );

    const defaultSkillOutputPath = join(homeDir, '.codex', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (local)', 'Codex']),
      input: async (prompt, defaultValue) =>
        prompt.includes('overrides global definition') ? 'y' : defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: defaultSkillOutputPath });
    const skillBody = readFileSync(defaultSkillOutputPath, 'utf-8');
    expect(skillBody).toContain('You are a local coding agent.');
    expect(skillBody).toContain('Never hide errors.');
    expect(skillBody).toContain('Architecture reference.');
  });

  it('should require init before install skill', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow(`No compose definitions found in ${join(homeDir, '.faceted', 'compositions')}`);
  });

  it('should install skill using local faceted root when global faceted home is not initialized', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    createFacetedFixtureAtRoot(join(workspaceDir, '.faceted'));

    const defaultSkillOutputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (local)', 'Claude Code']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: defaultSkillOutputPath });
    expect(existsSync(defaultSkillOutputPath)).toBe(true);
    expect(readFileSync(defaultSkillOutputPath, 'utf-8')).toContain('You are a coding agent.');
    expect(readFileSync(defaultSkillOutputPath, 'utf-8')).toContain('Never hide errors.');
  });

  it('should not offer compositions immediately after init', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    await runInit(runFacetCli, workspaceDir, homeDir);
    writeGlobalConfig(homeDir);

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow(
      `No compose definitions found in ${join(workspaceDir, '.faceted', 'compositions')}, ${join(homeDir, '.faceted', 'compositions')}`,
    );
  });

  it('should install skill to default Claude Code output path when default input is accepted', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const defaultSkillOutputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Claude Code']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: defaultSkillOutputPath });
    expect(existsSync(defaultSkillOutputPath)).toBe(true);
  });

  it('should present only supported targets in skill deploy mode', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const skillOutputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    let selectCallCount = 0;
    const select = async (candidates: string[]): Promise<string> => {
      selectCallCount += 1;
      if (selectCallCount === 1) return 'coding (global)';
      if (selectCallCount === 2) {
        expect(candidates).toEqual(['Claude Code', 'Codex']);
        return 'Claude Code';
      }
      throw new Error(`Unexpected select call: ${candidates.join(', ')}`);
    };

    await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select,
      input: async (prompt, defaultValue) =>
        prompt.toLowerCase().includes('output') ? skillOutputPath : defaultValue,
    });
  });

  it('should install Codex skill to default Codex output path when selected', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const defaultSkillOutputPath = join(homeDir, '.codex', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Codex']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: defaultSkillOutputPath });
    expect(existsSync(defaultSkillOutputPath)).toBe(true);
    expect(readFileSync(defaultSkillOutputPath, 'utf-8')).toContain('You are a coding agent.');
  });

  it('should keep install skill UX after pull-sample without template-apply prompts', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    const seenPrompts: string[] = [];
    await runInit(runFacetCli, workspaceDir, homeDir);
    globalThis.fetch = (async () => new Response('# Pulled Sample\n', { status: 200 })) as typeof fetch;
    await runFacetCli(['pull-sample'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    });

    let selectCallCount = 0;
    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: async (candidates: string[]): Promise<string> => {
        selectCallCount += 1;
        if (selectCallCount === 1) {
          expect(candidates).toEqual([
            'backend (global)',
            'coding (global)',
            'frontend (global)',
            'issue-worktree (global)',
          ]);
          return 'issue-worktree (global)';
        }
        if (selectCallCount === 2) {
          expect(candidates).toEqual(['Claude Code', 'Codex']);
          return 'Codex';
        }
        throw new Error(`Unexpected select call: ${candidates.join(', ')}`);
      },
      input: async (prompt, defaultValue) => {
        seenPrompts.push(prompt);
        return defaultValue;
      },
    });

    expect(result).toEqual({ kind: 'path', path: join(homeDir, '.codex', 'skills', 'issue-worktree', 'SKILL.md') });
    expect(seenPrompts.some(prompt => prompt.includes('Output directory'))).toBe(false);
    expect(seenPrompts.some(prompt => prompt.includes('Scan depth'))).toBe(false);
    expect(seenPrompts.some(prompt => prompt.includes('Choose skill mode'))).toBe(false);
    expect(existsSync(join(homeDir, '.codex', 'skills', 'issue-worktree', 'SKILL.md'))).toBe(true);
  });

  it('should reject install when compose definition name is unsafe', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    const { compositionsRoot } = createFacetedFixture(homeDir);
    writeFileSync(join(compositionsRoot, 'unsafe.yaml'), 'name: ../unsafe\npersona: coder\n', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['unsafe (global)', 'Claude Code']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Invalid compose definition name: ../unsafe');
  });

  it('should reject install when skill output path is outside home directory', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const outsidePath = join(tmpdir(), 'outside-install-skill.md');
    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Claude Code']),
      input: async (prompt, defaultValue) =>
        prompt.toLowerCase().includes('output') ? outsidePath : defaultValue,
    })).rejects.toThrow(`Skill output path must be inside home directory: ${outsidePath}`);
  });

  it('should reject install when output path points to target root SKILL.md', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const targetRootOutputPath = join(homeDir, '.claude', 'skills', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Claude Code']),
      input: async (prompt, defaultValue) =>
        prompt.toLowerCase().includes('output') ? targetRootOutputPath : defaultValue,
    })).rejects.toThrow(
      `Skill output path must include a skill directory under target directory: ${join(homeDir, '.claude', 'skills')}`,
    );
  });

  it('should reject install when output path file name is not SKILL.md', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const invalidFileNamePath = join(homeDir, '.claude', 'skills', 'coding', 'custom.md');
    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Claude Code']),
      input: async (prompt, defaultValue) =>
        prompt.toLowerCase().includes('output') ? invalidFileNamePath : defaultValue,
    })).rejects.toThrow(`Skill output path must point to SKILL.md: ${invalidFileNamePath}`);
  });

  it('should reject install when skill output path points to a symbolic link', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const targetPath = join(homeDir, '.claude', 'skills', 'coding', 'actual.md');
    const symlinkPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    mkdirSync(dirname(symlinkPath), { recursive: true });
    writeFileSync(targetPath, 'existing', 'utf-8');
    symlinkSync(targetPath, symlinkPath);

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Claude Code']),
      input: async (prompt, defaultValue) =>
        prompt.toLowerCase().includes('output') ? symlinkPath : defaultValue,
    })).rejects.toThrow(`Symbolic links are not allowed for skill output file: ${symlinkPath}`);
  });

  it('should require explicit confirmation when local composition overrides global definition', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const localFacetedRoot = join(workspaceDir, '.faceted');
    mkdirSync(join(localFacetedRoot, 'facets', 'persona'), { recursive: true });
    mkdirSync(join(localFacetedRoot, 'compositions'), { recursive: true });
    writeFileSync(join(localFacetedRoot, 'facets', 'persona', 'local-coder.md'), 'local', 'utf-8');
    writeFileSync(
      join(localFacetedRoot, 'compositions', 'coding.yaml'),
      ['name: coding', 'persona: local-coder', 'policies:', '  - coding', 'knowledge:', '  - architecture'].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (local)', 'Codex']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Install was cancelled for local composition: coding');
  });

  it('should continue install when local shadow confirmation is yes with extra spaces', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const localFacetedRoot = join(workspaceDir, '.faceted');
    mkdirSync(join(localFacetedRoot, 'facets', 'persona'), { recursive: true });
    mkdirSync(join(localFacetedRoot, 'compositions'), { recursive: true });
    writeFileSync(join(localFacetedRoot, 'facets', 'persona', 'local-coder.md'), 'local', 'utf-8');
    writeFileSync(
      join(localFacetedRoot, 'compositions', 'coding.yaml'),
      ['name: coding', 'persona: local-coder', 'policies:', '  - coding', 'knowledge:', '  - architecture'].join('\n'),
      'utf-8',
    );

    const outputPath = join(homeDir, '.codex', 'skills', 'coding', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (local)', 'Codex']),
      input: async (prompt, defaultValue) =>
        prompt.includes('overrides global definition') ? '  YeS  ' : defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: outputPath });
    expect(existsSync(outputPath)).toBe(true);
  });

  it('should reject unsupported commands without skill subcommand', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const { runFacetCli } = await loadCliModule();
    const invalidInvocations = [
      { args: ['install'], message: 'Unsupported command: install' },
      { args: ['update'], message: 'Unsupported command: update' },
      { args: ['list'], message: 'Unsupported command: list' },
    ];

    for (const invocation of invalidInvocations) {
      await expect(runFacetCli(invocation.args, {
        cwd: workspaceDir,
        homeDir,
        select: async () => 'unused',
        input: async (_prompt, defaultValue) => defaultValue,
      })).rejects.toThrow(invocation.message);
    }
  });
});
