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
    select: (candidates: string[]) => Promise<string>;
    input: (prompt: string, defaultValue: string) => Promise<string>;
  }) => Promise<
    | { kind: 'path'; path: string }
    | { kind: 'text'; text: string }
  >;
};

async function loadCliModule(): Promise<CliModule> {
  const modulePath = pathToFileURL(resolve('src/cli/index.ts')).href;
  return import(modulePath) as Promise<CliModule>;
}

function createFacetedFixture(homeDir: string): {
  facetedRoot: string;
  facetsRoot: string;
  compositionsRoot: string;
} {
  const facetedRoot = join(homeDir, '.faceted');
  const facetsRoot = join(facetedRoot, 'facets');
  const compositionsRoot = join(facetsRoot, 'compositions');

  mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
  mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
  mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
  mkdirSync(compositionsRoot, { recursive: true });

  writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
  writeFileSync(join(facetsRoot, 'persona', 'reviewer.md'), 'You are a review agent.', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'coding.md'), 'Never hide errors.', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'reviewing.md'), 'Review thoroughly.', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), 'Architecture reference.', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'quality.md'), 'Quality reference.', 'utf-8');
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
  writeFileSync(
    join(compositionsRoot, 'review.yaml'),
    [
      'name: review',
      'description: Review workflow',
      'persona: reviewer',
      'policies:',
      '  - reviewing',
      'knowledge:',
      '  - quality',
    ].join('\n'),
    'utf-8',
  );

  return { facetedRoot, facetsRoot, compositionsRoot };
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

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should install Claude Code skill in inline mode and register it in skills.yaml', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const skillOutputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');

    const { runFacetCli } = await loadCliModule();

    await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding', 'Claude Code', 'Inline']),
      input: async (prompt, defaultValue) => {
        if (prompt.toLowerCase().includes('output')) {
          return skillOutputPath;
        }
        return defaultValue;
      },
    });

    const skillsConfigPath = join(homeDir, '.faceted', 'skills.yaml');
    expect(existsSync(skillsConfigPath)).toBe(true);

    const skillsConfig = readFileSync(skillsConfigPath, 'utf-8');
    expect(skillsConfig).toContain('cc:');
    expect(skillsConfig).toContain('coding:');
    expect(skillsConfig).toContain('source: coding.yaml');
    expect(skillsConfig).toContain('mode: inline');
    expect(skillsConfig).toContain(`output: ${skillOutputPath}`);
    expect(skillsConfig).toContain('user-invocable: true');

    expect(existsSync(skillOutputPath)).toBe(true);
    const generated = readFileSync(skillOutputPath, 'utf-8');
    expect(generated).toContain('---\nname: coding');
    expect(generated).toContain('## Persona');
    expect(generated).toContain('You are a coding agent.');
    expect(generated).toContain('## Policies');
    expect(generated).toContain('Never hide errors.');
    expect(generated).toContain('## Knowledge');
    expect(generated).toContain('Architecture reference.');
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
      select: createSelectStub(['coding', 'Claude Code', 'Inline']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({
      kind: 'path',
      path: defaultSkillOutputPath,
    });

    expect(existsSync(defaultSkillOutputPath)).toBe(true);

    const skillsConfigPath = join(homeDir, '.faceted', 'skills.yaml');
    const skillsConfig = readFileSync(skillsConfigPath, 'utf-8');
    expect(skillsConfig).toContain(`output: ${defaultSkillOutputPath}`);
  });

  it('should install Claude Code skill in reference mode without embedding facet bodies', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    const { facetsRoot } = createFacetedFixture(homeDir);

    const skillOutputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    const expectedPersonaPath = join(facetsRoot, 'persona', 'coder.md');
    const expectedPolicyPath = join(facetsRoot, 'policies', 'coding.md');
    const expectedKnowledgePath = join(facetsRoot, 'knowledge', 'architecture.md');

    const { runFacetCli } = await loadCliModule();

    await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding', 'Claude Code', 'Reference']),
      input: async (prompt, defaultValue) => {
        if (prompt.toLowerCase().includes('output')) {
          return skillOutputPath;
        }
        return defaultValue;
      },
    });

    const generated = readFileSync(skillOutputPath, 'utf-8');
    expect(generated).toContain(expectedPersonaPath);
    expect(generated).toContain(expectedPolicyPath);
    expect(generated).toContain(expectedKnowledgePath);
    expect(generated).not.toContain('You are a coding agent.');
    expect(generated).not.toContain('Never hide errors.');
    expect(generated).not.toContain('Architecture reference.');
  });

  it('should update all installed skills and switch mode to reference', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    const { facetsRoot } = createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const codingSkillOutputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    const reviewSkillOutputPath = join(homeDir, '.claude', 'skills', 'review', 'SKILL.md');
    mkdirSync(dirname(codingSkillOutputPath), { recursive: true });
    mkdirSync(dirname(reviewSkillOutputPath), { recursive: true });
    writeFileSync(codingSkillOutputPath, 'old inline content', 'utf-8');
    writeFileSync(reviewSkillOutputPath, 'old reference content', 'utf-8');
    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: inline',
        `    output: ${codingSkillOutputPath}`,
        '  review:',
        '    source: review.yaml',
        '    mode: reference',
        `    output: ${reviewSkillOutputPath}`,
        '    cc:',
        '      user-invocable: true',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await runFacetCli(['update', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['All', 'Switch to Reference']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    const updatedSkillsConfig = readFileSync(join(facetedRoot, 'skills.yaml'), 'utf-8');
    expect(updatedSkillsConfig).toContain('coding:');
    expect(updatedSkillsConfig).toContain('review:');
    expect(updatedSkillsConfig).not.toContain('mode: inline');
    expect(updatedSkillsConfig.match(/mode: reference/g)).toHaveLength(2);

    const updatedCoding = readFileSync(codingSkillOutputPath, 'utf-8');
    expect(updatedCoding).toContain(join(facetsRoot, 'persona', 'coder.md'));
    expect(updatedCoding).not.toContain('old inline content');

    const updatedReview = readFileSync(reviewSkillOutputPath, 'utf-8');
    expect(updatedReview).toContain(join(facetsRoot, 'persona', 'reviewer.md'));
    expect(updatedReview).not.toContain('old reference content');
  });

  it('should update selected skill and keep current mode when requested', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const skillOutputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    mkdirSync(dirname(skillOutputPath), { recursive: true });
    writeFileSync(skillOutputPath, 'old inline content', 'utf-8');
    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: inline',
        `    output: ${skillOutputPath}`,
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await runFacetCli(['update', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (cc: inline)', 'Keep current']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    const updatedSkillsConfig = readFileSync(join(facetedRoot, 'skills.yaml'), 'utf-8');
    expect(updatedSkillsConfig).toContain('mode: inline');

    const generated = readFileSync(skillOutputPath, 'utf-8');
    expect(generated).toContain('You are a coding agent.');
    expect(generated).toContain('Never hide errors.');
    expect(generated).not.toContain('old inline content');
  });

  it('should uninstall selected skill and remove generated file', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const skillOutputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    mkdirSync(dirname(skillOutputPath), { recursive: true });
    writeFileSync(skillOutputPath, 'generated content', 'utf-8');
    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: inline',
        `    output: ${skillOutputPath}`,
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await runFacetCli(['uninstall', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (cc: inline)']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    const updatedSkillsConfig = readFileSync(join(facetedRoot, 'skills.yaml'), 'utf-8');
    expect(updatedSkillsConfig).not.toContain('coding:');
    expect(existsSync(skillOutputPath)).toBe(false);
  });

  it('should reject install when unsupported target is selected', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding', 'Cursor', 'Inline']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Unsupported skill target: Cursor');
  });

  it('should reject install when compose definition name is unsafe', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    const { compositionsRoot } = createFacetedFixture(homeDir);
    writeFileSync(
      join(compositionsRoot, 'unsafe.yaml'),
      [
        'name: ../unsafe',
        'description: Unsafe definition name',
        'persona: coder',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['unsafe', 'Claude Code', 'Inline']),
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
      select: createSelectStub(['coding', 'Claude Code', 'Inline']),
      input: async (prompt, defaultValue) =>
        prompt.toLowerCase().includes('output') ? outsidePath : defaultValue,
    })).rejects.toThrow(`Skill output path must be inside home directory: ${outsidePath}`);
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
      select: createSelectStub(['coding', 'Claude Code', 'Inline']),
      input: async (prompt, defaultValue) =>
        prompt.toLowerCase().includes('output') ? symlinkPath : defaultValue,
    })).rejects.toThrow(`Symbolic links are not allowed for skill output file: ${symlinkPath}`);
  });

  it('should reject install when skills registry path points to a symbolic link', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const registryTargetPath = join(facetedRoot, 'skills-target.yaml');
    const registrySymlinkPath = join(facetedRoot, 'skills.yaml');
    writeFileSync(registryTargetPath, 'cc: {}\n', 'utf-8');
    symlinkSync(registryTargetPath, registrySymlinkPath);

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding', 'Claude Code', 'Inline']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow(
      `Symbolic links are not allowed for skills registry file: ${registrySymlinkPath}`,
    );
  });

  it('should reject uninstall when output path in registry is outside home directory', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const outsidePath = join(tmpdir(), 'outside-skill.md');
    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: inline',
        `    output: ${outsidePath}`,
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['uninstall', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (cc: inline)']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow(`Skill output path must be inside home directory: ${outsidePath}`);
  });

  it('should reject update when output path in registry is outside home directory', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const outsidePath = join(tmpdir(), 'outside-update-skill.md');
    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: inline',
        `    output: ${outsidePath}`,
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['update', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (cc: inline)', 'Keep current']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow(`Skill output path must be inside home directory: ${outsidePath}`);
  });

  it('should reject update when output path in registry is a symbolic link', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const targetPath = join(homeDir, '.claude', 'skills', 'coding', 'actual.md');
    const symlinkPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    mkdirSync(dirname(symlinkPath), { recursive: true });
    writeFileSync(targetPath, 'existing', 'utf-8');
    symlinkSync(targetPath, symlinkPath);

    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: inline',
        `    output: ${symlinkPath}`,
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['update', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (cc: inline)', 'Keep current']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow(`Symbolic links are not allowed for skill output file: ${symlinkPath}`);
  });

  it('should reject install, update, uninstall, and list without skill subcommand', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const { runFacetCli } = await loadCliModule();
    const invalidInvocations = [
      { args: ['install'], message: 'Unsupported command: install' },
      { args: ['update'], message: 'Unsupported command: update' },
      { args: ['update', 'foo'], message: 'Unsupported command: update' },
      { args: ['uninstall'], message: 'Unsupported command: uninstall' },
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

  it('should reject list when skills config contains unknown fields', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: inline',
        '    output: ~/.claude/skills/coding/SKILL.md',
        '    unexpected: true',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['list', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Invalid skills config field: cc.coding.unexpected');
  });

  it('should reject list when skills config has invalid mode', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: toggle',
        '    output: ~/.claude/skills/coding/SKILL.md',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['list', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Invalid skills config field: cc.coding.mode');
  });

  it('should reject list when skills config output is not a string', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: inline',
        '    output: 12345',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['list', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Invalid skills config field: cc.coding.output');
  });

  it('should list installed skills grouped by target', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    writeFileSync(
      join(facetedRoot, 'skills.yaml'),
      [
        'cc:',
        '  coding:',
        '    source: coding.yaml',
        '    mode: inline',
        '    output: ~/.claude/skills/coding/SKILL.md',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['list', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => {
        throw new Error('select should not be used for list command');
      },
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({
      kind: 'text',
      text: [
        'cc',
        '- coding (mode: inline, source: coding.yaml, output: ~/.claude/skills/coding/SKILL.md)',
      ].join('\n'),
    });
  });
});
