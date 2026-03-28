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
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

type CliModule = {
  runFacetCli: (
    args: string[],
    options: {
      cwd: string;
      homeDir: string;
      select: (candidates: string[], prompt?: string) => Promise<string>;
      input: (prompt: string, defaultValue: string) => Promise<string>;
    },
  ) => Promise<{ kind: 'path'; path: string } | { kind: 'text'; text: string }>;
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

function createFacetedFixture(homeDir: string): void {
  const facetedRoot = join(homeDir, '.faceted');
  const facetsRoot = join(facetedRoot, 'facets');
  const compositionsRoot = join(facetedRoot, 'compositions');
  const templatesRoot = join(facetedRoot, 'templates');

  mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
  mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
  mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
  mkdirSync(join(facetsRoot, 'instructions'), { recursive: true });
  mkdirSync(compositionsRoot, { recursive: true });
  mkdirSync(templatesRoot, { recursive: true });

  writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), 'Architecture reference.', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'coding.md'), 'Never hide errors.', 'utf-8');
  writeFileSync(join(facetsRoot, 'instructions', 'keep-changes-small.md'), 'Keep changes small and explicit.', 'utf-8');

  writeFileSync(
    join(compositionsRoot, 'templated.yaml'),
    [
      'name: templated-skill',
      'persona: coder',
      'knowledge:',
      '  - architecture',
      'policies:',
      '  - coding',
      'instructions:',
      '  - keep-changes-small',
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
}

describe('facet install template-backed skill integration flow', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should install template-backed skill through normal install flow', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const skillOutputPath = join(homeDir, '.agents', 'skills', 'templated-skill', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)', 'Codex']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: skillOutputPath });
    expect(readFileSync(skillOutputPath, 'utf-8')).toMatch(/^---\nname: templated-skill\n---\n/m);
    expect(readFileSync(skillOutputPath, 'utf-8')).toContain('You are a coding agent.');
    expect(readFileSync(skillOutputPath, 'utf-8')).not.toContain('/facets/persona/coder.md');
    expect(readFileSync(join(homeDir, '.agents', 'skills', 'templated-skill', 'README.md'), 'utf-8')).toBe(
      'template file',
    );
    expect(existsSync(join(homeDir, '.agents', 'skills', 'templated-skill', 'facets', 'persona', 'coder.md'))).toBe(
      true,
    );
  });

  it('should confirm overwrite before replacing existing template-backed skill directory', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const skillDir = join(homeDir, '.agents', 'skills', 'templated-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'stale.txt'), 'stale', 'utf-8');
    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)', 'Codex']),
      input: async (prompt, defaultValue) => {
        if (prompt.toLowerCase().includes('replace') || prompt.toLowerCase().includes('overwrite')) {
          return 'n';
        }
        return defaultValue;
      },
    })).rejects.toThrow(`Target directory exists and overwrite was cancelled: ${skillDir}`);
  });

  it('should reject template-backed install when target directory path includes a symbolic link ancestor', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    const realCodexDir = join(homeDir, '.agents-real');
    const codexLinkDir = join(homeDir, '.agents');
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    mkdirSync(realCodexDir, { recursive: true });
    symlinkSync(realCodexDir, codexLinkDir);

    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)', 'Codex']),
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow(`Symbolic links are not allowed in Target directory path: ${codexLinkDir}`);
  });

  it('should reject template-backed install when output path is outside selected target directory', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const disallowedOutputPath = join(homeDir, 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    await expect(runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)', 'Codex']),
      input: async (prompt, defaultValue) =>
        prompt.toLowerCase().includes('output') ? disallowedOutputPath : defaultValue,
    })).rejects.toThrow(`Skill output path must be inside target directory: ${join(homeDir, '.agents', 'skills')}`);
  });

  it('should install template-backed skill even when composition has no instruction', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const skillOutputPath = join(homeDir, '.agents', 'skills', 'templated-no-instruction-skill', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();

    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated-no-instruction (global)', 'Codex']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: skillOutputPath });
    expect(readFileSync(skillOutputPath, 'utf-8')).toMatch(/^---\nname: templated-no-instruction-skill\n---\n/m);
    expect(readFileSync(skillOutputPath, 'utf-8')).toContain('instructions=');
    expect(readFileSync(skillOutputPath, 'utf-8')).not.toContain('{{facet:instructions}}');
  });

  it('should fallback to global template when local composition references missing template', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    createFacetedFixture(homeDir);

    const localFacetedRoot = join(workspaceDir, '.faceted');
    mkdirSync(join(localFacetedRoot, 'facets', 'persona'), { recursive: true });
    mkdirSync(join(localFacetedRoot, 'compositions'), { recursive: true });
    writeFileSync(join(localFacetedRoot, 'facets', 'persona', 'local-coder.md'), 'Local persona', 'utf-8');
    writeFileSync(
      join(localFacetedRoot, 'compositions', 'templated.yaml'),
      [
        'name: templated-skill',
        'persona: local-coder',
        'knowledge:',
        '  - architecture',
        'policies:',
        '  - coding',
        'template: starter-kit',
      ].join('\n'),
      'utf-8',
    );

    const skillOutputPath = join(homeDir, '.agents', 'skills', 'templated-skill', 'SKILL.md');
    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['install', 'skill'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (local)', 'Codex']),
      input: async (prompt, defaultValue) =>
        prompt.includes('overrides global definition') ? 'y' : defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: skillOutputPath });
    expect(readFileSync(skillOutputPath, 'utf-8')).toContain('Local persona');
    expect(existsSync(join(homeDir, '.agents', 'skills', 'templated-skill', 'README.md'))).toBe(true);
  });
});
