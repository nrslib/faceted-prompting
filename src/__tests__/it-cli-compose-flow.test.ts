import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

describe('facet compose integration flow', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should propagate selected composition and custom output path across init -> resolve -> compose -> output', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const composeRoot = join(facetedRoot, 'compositions');

    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
    mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
    mkdirSync(composeRoot, { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a release engineer.', 'utf-8');
    writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), 'System architecture notes.', 'utf-8');
    writeFileSync(join(facetsRoot, 'policies', 'quality.md'), 'Never hide errors.', 'utf-8');
    writeFileSync(
      join(composeRoot, 'release.yaml'),
      [
        'name: release',
        'persona: coder',
        'knowledge:',
        '  - architecture',
        'policies:',
        '  - quality',
        'instruction: Summarize release impact.',
        'order:',
        '  - persona',
        '  - knowledge',
        '  - policies',
        '  - instruction',
      ].join('\n'),
      'utf-8',
    );

    const outputDir = join(workspaceDir, 'out');
    mkdirSync(outputDir, { recursive: true });

    const { runFacetCli } = await loadCliModule();
    let selectCallCount = 0;
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async (candidates) => {
        selectCallCount++;
        if (selectCallCount === 1) {
          expect(candidates).toContain('release');
          return 'release';
        }
        return 'Combined (single file)';
      },
      input: async (_prompt, defaultValue) => {
        expect(defaultValue).toBe(workspaceDir);
        return outputDir;
      },
    });
    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }
    expect(result.path.startsWith(outputDir)).toBe(true);
    expect(existsSync(result.path)).toBe(true);

    const generated = readFileSync(result.path, 'utf-8');
    const systemIndex = generated.indexOf('You are a release engineer.');
    const knowledgeIndex = generated.indexOf('System architecture notes.');
    const policyIndex = generated.indexOf('Never hide errors.');
    const instructionIndex = generated.indexOf('Summarize release impact.');

    expect(systemIndex).toBeGreaterThanOrEqual(0);
    expect(knowledgeIndex).toBeGreaterThan(systemIndex);
    expect(policyIndex).toBeGreaterThan(systemIndex);
    expect(knowledgeIndex).toBeLessThan(policyIndex);
    expect(instructionIndex).toBeGreaterThan(policyIndex);
  });

  it('should reject unsupported commands', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['unknown'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Unsupported command: unknown');
  });

  it('should reject when command is missing', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli([], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Usage: facet <command>');
  });

  it('should fail compose command when config file is malformed', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    mkdirSync(facetedRoot, { recursive: true });
    const configPath = join(facetedRoot, 'config.yaml');
    writeFileSync(configPath, 'version: [1\n', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow(`Invalid faceted config file: ${configPath}`);
  });

  it('should initialize faceted home on first run and write output to cwd when input is blank', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    let selectCallCount = 0;
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async (candidates) => {
        selectCallCount++;
        if (selectCallCount === 1) {
          expect(candidates).toContain('coding');
          return 'coding';
        }
        return 'Split (system + user)';
      },
      input: async (_prompt, defaultValue) => {
        expect(defaultValue).toBe(workspaceDir);
        return '   ';
      },
    });

    expect(existsSync(join(homeDir, '.faceted', 'config.yaml'))).toBe(true);
    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }
    expect(result.path).toBe(join(workspaceDir, 'coding.prompt.md'));

    const generated = readFileSync(result.path, 'utf-8');
    expect(generated).toContain('# System Prompt');
    expect(generated).toContain('You are a helpful coding assistant.');
  });

  it('should reject when no compose definitions are available', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const compositionsDir = join(facetedRoot, 'compositions');
    mkdirSync(compositionsDir, { recursive: true });
    mkdirSync(join(compositionsDir, 'coding.yaml'), { recursive: true });
    mkdirSync(join(compositionsDir, 'frontend.yaml'), { recursive: true });
    mkdirSync(join(compositionsDir, 'backend.yaml'), { recursive: true });
    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('No compose definitions found');
  });

  it('should reject unknown compose definition selections', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const composeRoot = join(facetedRoot, 'compositions');
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(composeRoot, { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a release engineer.', 'utf-8');
    writeFileSync(
      join(composeRoot, 'release.yaml'),
      [
        'name: release',
        'persona: coder',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'not-a-candidate',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Unknown compose definition selected: not-a-candidate');
  });

  it('should reject writing outside output directory when compose name is unsafe', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const composeRoot = join(facetedRoot, 'compositions');

    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(composeRoot, { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a release engineer.', 'utf-8');
    writeFileSync(
      join(composeRoot, 'release.yaml'),
      [
        'name: ../escape',
        'persona: coder',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'release',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Invalid compose definition name');
  });

  it('should reject facet reference paths outside faceted root', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const composeRoot = join(facetedRoot, 'compositions');
    const outsideDir = mkdtempSync(join(tmpdir(), 'facet-outside-'));
    tempDirs.push(outsideDir);

    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(composeRoot, { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    writeFileSync(join(outsideDir, 'secret.md'), 'sensitive', 'utf-8');
    writeFileSync(
      join(composeRoot, 'release.yaml'),
      [
        'name: release',
        `persona: ${join(outsideDir, 'secret.md')}`,
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'release',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('allowed facets directory');
  });

  it('should reject symlinked facet files even when located under allowed root', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'facet-outside-'));
    tempDirs.push(workspaceDir, homeDir, outsideDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const composeRoot = join(facetedRoot, 'compositions');
    const personaRoot = join(facetsRoot, 'persona');

    mkdirSync(personaRoot, { recursive: true });
    mkdirSync(composeRoot, { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    const outsidePersonaPath = join(outsideDir, 'outside-persona.md');
    writeFileSync(outsidePersonaPath, 'Outside persona', 'utf-8');
    symlinkSync(outsidePersonaPath, join(personaRoot, 'linked.md'));
    writeFileSync(
      join(composeRoot, 'release.yaml'),
      [
        'name: release',
        'persona: linked',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'release',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Symbolic links are not allowed');
  });

  it('should cancel overwrite when output file exists and answer is not y/yes', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const composeRoot = join(facetedRoot, 'compositions');
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(composeRoot, { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a release engineer.', 'utf-8');
    writeFileSync(
      join(composeRoot, 'release.yaml'),
      [
        'name: release',
        'persona: coder',
      ].join('\n'),
      'utf-8',
    );

    const outputDir = join(workspaceDir, 'out');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, 'release.prompt.md');
    writeFileSync(outputPath, 'existing content', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'release',
      input: async (prompt) => {
        if (prompt.startsWith('Output directory')) {
          return outputDir;
        }
        return 'n';
      },
    })).rejects.toThrow(`Output file exists and overwrite was cancelled: ${outputPath}`);

    expect(readFileSync(outputPath, 'utf-8')).toBe('existing content');
  });

  it('should overwrite existing output file only when answer is y/yes', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const composeRoot = join(facetedRoot, 'compositions');
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(composeRoot, { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a release engineer.', 'utf-8');
    writeFileSync(
      join(composeRoot, 'release.yaml'),
      [
        'name: release',
        'persona: coder',
      ].join('\n'),
      'utf-8',
    );

    const outputDir = join(workspaceDir, 'out');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, 'release.prompt.md');
    writeFileSync(outputPath, 'existing content', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'release',
      input: async (prompt) => {
        if (prompt.startsWith('Output directory')) {
          return outputDir;
        }
        return 'yes';
      },
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }
    expect(result.path).toBe(outputPath);
    expect(readFileSync(outputPath, 'utf-8')).toContain('You are a release engineer.');
  });

  it('should reject writing to a symlinked output file', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const composeRoot = join(facetedRoot, 'compositions');

    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(composeRoot, { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a release engineer.', 'utf-8');
    writeFileSync(
      join(composeRoot, 'release.yaml'),
      [
        'name: release',
        'persona: coder',
      ].join('\n'),
      'utf-8',
    );

    const outputDir = join(workspaceDir, 'out');
    mkdirSync(outputDir, { recursive: true });
    const outsideTargetPath = join(workspaceDir, 'outside-target.md');
    writeFileSync(outsideTargetPath, 'outside', 'utf-8');
    symlinkSync(outsideTargetPath, join(outputDir, 'release.prompt.md'));

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'release',
      input: async (prompt) => {
        if (prompt.startsWith('Output directory')) {
          return outputDir;
        }
        return 'y';
      },
    })).rejects.toThrow('Symbolic links are not allowed for output file');
  });

  it('should reject symlinked compose definition files', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    const outsideDir = mkdtempSync(join(tmpdir(), 'facet-outside-'));
    tempDirs.push(workspaceDir, homeDir, outsideDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const composeRoot = join(facetedRoot, 'compositions');

    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(composeRoot, { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a release engineer.', 'utf-8');
    const outsideComposePath = join(outsideDir, 'outside-release.yaml');
    writeFileSync(outsideComposePath, ['name: release', 'persona: coder'].join('\n'), 'utf-8');
    symlinkSync(outsideComposePath, join(composeRoot, 'release.yaml'));

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'release',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('Symbolic links are not allowed');
  });
});
