import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

type CliModule = {
  runFacetCli: (
    args: string[],
    options: {
      cwd: string;
      homeDir: string;
      select: (candidates: string[]) => Promise<string>;
      input: (prompt: string, defaultValue: string) => Promise<string>;
    },
  ) => Promise<{ kind: 'path'; path: string } | { kind: 'text'; text: string }>;
};

type SelectDecision = string | ((candidates: string[]) => string);

async function loadCliModule(): Promise<CliModule> {
  const modulePath = pathToFileURL(resolve('src/cli/index.ts')).href;
  return import(modulePath) as Promise<CliModule>;
}

function createSelectStub(decisions: readonly SelectDecision[]) {
  const queue = [...decisions];
  return async (candidates: string[]): Promise<string> => {
    const next = queue.shift();
    if (!next) {
      throw new Error(`Unexpected select call: ${candidates.join(', ')}`);
    }

    const picked = typeof next === 'function' ? next(candidates) : next;
    expect(candidates).toContain(picked);
    return picked;
  };
}

function createFacetedFixture(homeDir: string): {
  facetedRoot: string;
  facetsRoot: string;
  compositionsRoot: string;
  templatesRoot: string;
} {
  const facetedRoot = join(homeDir, '.faceted');
  const facetsRoot = join(facetedRoot, 'facets');
  const compositionsRoot = join(facetsRoot, 'compositions');
  const templatesRoot = join(facetedRoot, 'templates');

  mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
  mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
  mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
  mkdirSync(compositionsRoot, { recursive: true });
  mkdirSync(templatesRoot, { recursive: true });

  writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), 'Architecture reference.', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'quality.md'), 'Quality reference.', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'coding.md'), 'Never hide errors.', 'utf-8');

  writeFileSync(
    join(compositionsRoot, 'plain.yaml'),
    [
      'name: plain-skill',
      'persona: coder',
      'knowledge:',
      '  - architecture',
      'policies:',
      '  - coding',
      'instruction: Keep changes small and explicit.',
    ].join('\n'),
    'utf-8',
  );

  writeFileSync(
    join(compositionsRoot, 'templated.yaml'),
    [
      'name: templated-skill',
      'persona: coder',
      'knowledge:',
      '  - architecture',
      'policies:',
      '  - coding',
      'instruction: Keep changes small and explicit.',
      'template: starter-kit',
    ].join('\n'),
    'utf-8',
  );

  writeFileSync(
    join(compositionsRoot, 'templated-no-instruction.yaml'),
    [
      'name: templated-no-instruction-skill',
      'persona: coder',
      'knowledge:',
      '  - architecture',
      'policies:',
      '  - coding',
      'template: starter-kit',
    ].join('\n'),
    'utf-8',
  );

  const templateRoot = join(templatesRoot, 'starter-kit');
  mkdirSync(templateRoot, { recursive: true });
  writeFileSync(
    join(templateRoot, 'SKILL.md'),
    [
      '# Starter Skill',
      '',
      'persona={{facet:persona}}',
      'knowledge={{facet:knowledges}}',
      'policies={{facet:policies}}',
      'instructions={{facet:instructions}}',
    ].join('\n'),
    'utf-8',
  );
  writeFileSync(join(templateRoot, 'README.md'), 'template file', 'utf-8');

  return { facetedRoot, facetsRoot, compositionsRoot, templatesRoot };
}

describe('facet install 3-mode integration flow', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should place facet files only when file placement mode is selected', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const targetDir = join(workspaceDir, 'deploy-file-placement');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub([
        'plain',
        'File placement',
      ]),
      input: async (prompt, defaultValue) => {
        if (prompt.toLowerCase().includes('directory')) {
          return targetDir;
        }
        return defaultValue;
      },
    });

    expect(result).toEqual({ kind: 'path', path: targetDir });
    expect(readFileSync(join(targetDir, 'facets', 'persona', 'coder.md'), 'utf-8')).toContain(
      'You are a coding agent.',
    );
    expect(readFileSync(join(targetDir, 'facets', 'knowledge', 'architecture.md'), 'utf-8')).toContain(
      'Architecture reference.',
    );
    expect(readFileSync(join(targetDir, 'facets', 'policies', 'coding.md'), 'utf-8')).toContain(
      'Never hide errors.',
    );
    expect(existsSync(join(targetDir, 'SKILL.md'))).toBe(false);
  });

  it('should remove stale files on overwrite before regenerating in file placement mode', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    const { compositionsRoot } = createFacetedFixture(homeDir);

    const targetDir = join(workspaceDir, 'deploy-file-placement-overwrite');
    mkdirSync(join(targetDir, 'facets', 'knowledge'), { recursive: true });
    writeFileSync(join(targetDir, 'facets', 'knowledge', 'obsolete.md'), 'stale', 'utf-8');
    const { runFacetCli } = await loadCliModule();

    await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['plain', 'File placement']),
      input: async (prompt, defaultValue) => {
        const normalized = prompt.toLowerCase();
        if (normalized.includes('replace') || normalized.includes('overwrite')) {
          return 'y';
        }
        if (normalized.includes('directory')) {
          return targetDir;
        }
        return defaultValue;
      },
    });

    writeFileSync(
      join(compositionsRoot, 'plain.yaml'),
      [
        'name: plain-skill',
        'persona: coder',
        'knowledge:',
        '  - quality',
        'policies:',
        '  - coding',
        'instruction: Keep changes small and explicit.',
      ].join('\n'),
      'utf-8',
    );

    await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['plain', 'File placement']),
      input: async (prompt, defaultValue) => {
        const normalized = prompt.toLowerCase();
        if (normalized.includes('replace') || normalized.includes('overwrite')) {
          return 'y';
        }
        if (normalized.includes('directory')) {
          return targetDir;
        }
        return defaultValue;
      },
    });

    expect(existsSync(join(targetDir, 'facets', 'knowledge', 'obsolete.md'))).toBe(false);
    expect(readFileSync(join(targetDir, 'facets', 'knowledge', 'quality.md'), 'utf-8')).toContain(
      'Quality reference.',
    );
  });

  it('should reject overwrite in file placement mode when overwrite confirmation is declined', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const targetDir = join(workspaceDir, 'deploy-file-placement-cancel');
    mkdirSync(targetDir, { recursive: true });
    const staleFile = join(targetDir, 'keep.txt');
    writeFileSync(staleFile, 'keep', 'utf-8');
    const { runFacetCli } = await loadCliModule();

    await expect(
      runFacetCli(['install', 'skill'], {
        cwd: workspaceDir,
        homeDir,
        select: createSelectStub(['plain', 'File placement']),
        input: async (prompt, defaultValue) => {
          const normalized = prompt.toLowerCase();
          if (normalized.includes('directory')) {
            return targetDir;
          }
          if (normalized.includes('replace') || normalized.includes('overwrite')) {
            return 'n';
          }
          return defaultValue;
        },
      }),
    ).rejects.toThrow('Output directory exists and overwrite was cancelled');

    expect(readFileSync(staleFile, 'utf-8')).toBe('keep');
  });

  it('should apply facet placeholders only to matched files up to selected scan depth', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const targetDir = join(workspaceDir, 'template-apply-target');
    mkdirSync(join(targetDir, 'depth1'), { recursive: true });
    mkdirSync(join(targetDir, 'depth1', 'depth2'), { recursive: true });

    const rootFile = join(targetDir, 'root.md');
    const depth1File = join(targetDir, 'depth1', 'level1.md');
    const depth2File = join(targetDir, 'depth1', 'depth2', 'level2.md');
    const untouchedFile = join(targetDir, 'untouched.md');

    writeFileSync(rootFile, 'persona={{facet:persona}}', 'utf-8');
    writeFileSync(depth1File, 'policies={{facet:policies}}', 'utf-8');
    writeFileSync(depth2File, 'knowledge={{facet:knowledges}}', 'utf-8');
    writeFileSync(untouchedFile, 'this file has no placeholders', 'utf-8');

    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub([
        'plain',
        'Template apply',
      ]),
      input: async (prompt, defaultValue) => {
        const normalized = prompt.toLowerCase();
        if (normalized.includes('directory')) {
          return targetDir;
        }
        if (normalized.includes('depth')) {
          return '1';
        }
        return defaultValue;
      },
    });

    expect(result).toEqual({ kind: 'path', path: targetDir });

    const rootAfter = readFileSync(rootFile, 'utf-8');
    const depth1After = readFileSync(depth1File, 'utf-8');
    const depth2After = readFileSync(depth2File, 'utf-8');
    const untouchedAfter = readFileSync(untouchedFile, 'utf-8');

    expect(rootAfter).toContain('/facets/persona/coder.md');
    expect(depth1After).toContain('/facets/policies/coding.md');
    expect(depth2After).toContain('{{facet:knowledges}}');
    expect(untouchedAfter).toBe('this file has no placeholders');

    expect(readFileSync(join(targetDir, 'facets', 'persona', 'coder.md'), 'utf-8')).toContain(
      'You are a coding agent.',
    );
  });

  it('should require overwrite confirmation before replacing existing facets in template apply mode', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const targetDir = join(workspaceDir, 'template-apply-target-with-facets');
    mkdirSync(join(targetDir, 'facets', 'knowledge'), { recursive: true });
    const staleFacetFile = join(targetDir, 'facets', 'knowledge', 'stale.md');
    writeFileSync(staleFacetFile, 'stale facet', 'utf-8');
    const rootFile = join(targetDir, 'root.md');
    writeFileSync(rootFile, 'persona={{facet:persona}}', 'utf-8');

    const { runFacetCli } = await loadCliModule();

    await expect(
      runFacetCli(['install', 'skill'], {
        cwd: workspaceDir,
        homeDir,
        select: createSelectStub(['plain', 'Template apply']),
        input: async (prompt, defaultValue) => {
          const normalized = prompt.toLowerCase();
          if (normalized.includes('directory')) {
            return targetDir;
          }
          if (normalized.includes('depth')) {
            return '1';
          }
          if (normalized.includes('replace') || normalized.includes('overwrite')) {
            return 'n';
          }
          return defaultValue;
        },
      }),
    ).rejects.toThrow('Facets directory exists and overwrite was cancelled');

    expect(readFileSync(staleFacetFile, 'utf-8')).toBe('stale facet');
    expect(readFileSync(rootFile, 'utf-8')).toBe('persona={{facet:persona}}');
  });

  it('should remove stale facet files on overwrite before regenerating in skill deploy mode', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    const { compositionsRoot } = createFacetedFixture(homeDir);

    const targetDir = join(homeDir, '.claude', 'skills', 'plain-skill');
    const outputPath = join(targetDir, 'SKILL.md');

    const { runFacetCli } = await loadCliModule();
    await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['plain', 'Skill deploy', 'Claude Code', 'Reference']),
      input: async (prompt, defaultValue) => {
        if (prompt.toLowerCase().includes('output')) {
          return outputPath;
        }
        return defaultValue;
      },
    });

    mkdirSync(join(targetDir, 'facets', 'knowledge'), { recursive: true });
    writeFileSync(join(targetDir, 'facets', 'knowledge', 'obsolete.md'), 'stale', 'utf-8');

    writeFileSync(
      join(compositionsRoot, 'plain.yaml'),
      [
        'name: plain-skill',
        'persona: coder',
        'knowledge:',
        '  - quality',
        'policies:',
        '  - coding',
        'instruction: Keep changes small and explicit.',
      ].join('\n'),
      'utf-8',
    );

    await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['plain', 'Skill deploy', 'Claude Code', 'Reference']),
      input: async (prompt, defaultValue) => {
        const normalized = prompt.toLowerCase();
        if (normalized.includes('output')) {
          return outputPath;
        }
        if (normalized.includes('overwrite') || normalized.includes('replace')) {
          return 'y';
        }
        return defaultValue;
      },
    });

    expect(existsSync(join(targetDir, 'facets', 'knowledge', 'obsolete.md'))).toBe(false);
    expect(readFileSync(join(targetDir, 'facets', 'knowledge', 'quality.md'), 'utf-8')).toContain(
      'Quality reference.',
    );
  });

  it('should reject overwrite when target directory path includes a symbolic link ancestor', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'facet-outside-'));
    tempDirs.push(workspaceDir, homeDir, outsideDir);
    createFacetedFixture(homeDir);

    const symlinkedClaudeDir = join(homeDir, '.claude');
    const outsideClaudeDir = join(outsideDir, 'claude-link-target');
    mkdirSync(outsideClaudeDir, { recursive: true });
    rmSync(symlinkedClaudeDir, { recursive: true, force: true });
    symlinkSync(outsideClaudeDir, symlinkedClaudeDir);

    const targetDir = join(symlinkedClaudeDir, 'skills', 'plain-skill');
    const outputPath = join(targetDir, 'SKILL.md');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'stale.txt'), 'stale', 'utf-8');

    const { runFacetCli } = await loadCliModule();

    await expect(
      runFacetCli(['install', 'skill'], {
        cwd: workspaceDir,
        homeDir,
        select: createSelectStub(['plain', 'Skill deploy', 'Claude Code', 'Reference']),
        input: async (prompt, defaultValue) => {
          const normalized = prompt.toLowerCase();
          if (normalized.includes('output')) {
            return outputPath;
          }
          if (normalized.includes('replace') || normalized.includes('overwrite')) {
            return 'y';
          }
          return defaultValue;
        },
      }),
    ).rejects.toThrow('Symbolic links are not allowed in Target directory path');

    expect(readFileSync(join(targetDir, 'stale.txt'), 'utf-8')).toBe('stale');
  });

  it('should reject skill deploy when target directory does not exist and path includes a symbolic link ancestor', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'facet-outside-'));
    tempDirs.push(workspaceDir, homeDir, outsideDir);
    createFacetedFixture(homeDir);

    const symlinkedClaudeDir = join(homeDir, '.claude');
    const outsideClaudeDir = join(outsideDir, 'claude-link-target');
    mkdirSync(outsideClaudeDir, { recursive: true });
    rmSync(symlinkedClaudeDir, { recursive: true, force: true });
    symlinkSync(outsideClaudeDir, symlinkedClaudeDir);

    const outputPath = join(symlinkedClaudeDir, 'skills', 'plain-skill', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    await expect(
      runFacetCli(['install', 'skill'], {
        cwd: workspaceDir,
        homeDir,
        select: createSelectStub(['plain', 'Skill deploy', 'Claude Code', 'Reference']),
        input: async (prompt, defaultValue) => {
          if (prompt.toLowerCase().includes('output')) {
            return outputPath;
          }
          return defaultValue;
        },
      }),
    ).rejects.toThrow('Symbolic links are not allowed in Target directory path');

    expect(existsSync(join(outsideClaudeDir, 'skills', 'plain-skill'))).toBe(false);
  });

  it('should expand template files and replace facet tokens in skill deploy mode', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const targetSkillPath = join(homeDir, '.claude', 'skills', 'templated-skill', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated', 'Skill deploy', 'Claude Code', 'Reference']),
      input: async (prompt, defaultValue) => {
        if (prompt.toLowerCase().includes('output')) {
          return targetSkillPath;
        }
        return defaultValue;
      },
    });

    const generated = readFileSync(targetSkillPath, 'utf-8');
    expect(generated).toContain('/facets/persona/coder.md');
    expect(generated).toContain('/facets/knowledge/architecture.md');
    expect(generated).toContain('/facets/policies/coding.md');
    expect(generated).toContain('/facets/instructions/');
    expect(generated).not.toContain('{{facet:persona}}');
    expect(generated).not.toContain('{{facet:knowledges}}');
    expect(generated).not.toContain('{{facet:policies}}');
    expect(generated).not.toContain('{{facet:instructions}}');

    const copiedTemplateReadme = join(dirname(targetSkillPath), 'README.md');
    expect(readFileSync(copiedTemplateReadme, 'utf-8')).toBe('template file');
  });

  it('should fail fast when instructions placeholder exists but instruction facet is undefined', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const targetSkillPath = join(homeDir, '.claude', 'skills', 'templated-no-instruction-skill', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    await expect(
      runFacetCli(['install', 'skill'], {
        cwd: workspaceDir,
        homeDir,
        select: createSelectStub(['templated-no-instruction', 'Skill deploy', 'Claude Code', 'Reference']),
        input: async (prompt, defaultValue) => {
          if (prompt.toLowerCase().includes('output')) {
            return targetSkillPath;
          }
          return defaultValue;
        },
      }),
    ).rejects.toThrow('Missing instructions facet path for {{facet:instructions}} placeholder');
  });
});
