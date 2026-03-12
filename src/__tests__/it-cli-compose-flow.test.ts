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
    | { kind: 'paths'; paths: string[] }
    | { kind: 'text'; text: string }
  >;
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

function writeDefaultFacetFixture(homeDir: string, persona = 'You are a coding agent.\n'): void {
  const facetsRoot = join(homeDir, '.faceted', 'facets');
  mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
  mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
  mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
  writeFileSync(join(facetsRoot, 'persona', 'coder.md'), persona, 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), 'Architecture reference.\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'frontend.md'), 'Frontend reference.\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'backend.md'), 'Backend reference.\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'coding.md'), 'Never hide errors.\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'ai-antipattern.md'), 'Do not add dead code.\n', 'utf-8');
}

describe('facet compose integration flow', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should auto-select frontend knowledge and include related files in the composed prompt', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');

    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
    mkdirSync(join(facetsRoot, 'policies'), { recursive: true });

    writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a release engineer.', 'utf-8');
    writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), 'System architecture notes.', 'utf-8');
    writeFileSync(join(facetsRoot, 'knowledge', 'frontend.md'), 'Frontend implementation notes.', 'utf-8');
    writeFileSync(join(facetsRoot, 'knowledge', 'backend.md'), 'Backend implementation notes.', 'utf-8');
    writeFileSync(join(facetsRoot, 'policies', 'coding.md'), 'Never hide errors.', 'utf-8');
    writeFileSync(join(facetsRoot, 'policies', 'ai-antipattern.md'), 'Do not add dead code.', 'utf-8');

    mkdirSync(join(workspaceDir, 'src'), { recursive: true });
    writeFileSync(
      join(workspaceDir, 'src', 'App.tsx'),
      'export function App() { return <main>Hello</main>; }\n',
      'utf-8',
    );

    const outputDir = join(workspaceDir, 'out');
    mkdirSync(outputDir, { recursive: true });

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'Combined (single file)',
      input: async (_prompt, defaultValue) => {
        expect(defaultValue).toBe(workspaceDir);
        return outputDir;
      },
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }
    expect(result.path).toBe(join(outputDir, 'frontend.md'));
    expect(existsSync(result.path)).toBe(true);

    const generated = readFileSync(result.path, 'utf-8');
    expect(generated).toContain('You are a release engineer.');
    expect(generated).toContain('System architecture notes.');
    expect(generated).toContain('Frontend implementation notes.');
    expect(generated).toContain('Never hide errors.');
    expect(generated).toContain('# Related Files');
    expect(generated).toContain('src/App.tsx');
    expect(generated).toContain('Source: src/App.tsx');
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

  it('should compose after init when required facets are prepared', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    const initResult = await runFacetCli(['init'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(initResult).toEqual({
      kind: 'text',
      text: `Initialized: ${join(homeDir, '.faceted')}`,
    });

    writeDefaultFacetFixture(homeDir, 'You are a prepared coding assistant.\n');
    writeFileSync(join(workspaceDir, 'server.ts'), 'export const server = true;\n', 'utf-8');

    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'Split (system + user)',
      input: async (_prompt, defaultValue) => {
        expect(defaultValue).toBe(workspaceDir);
        return '   ';
      },
    });

    expect(existsSync(join(homeDir, '.faceted', 'config.yaml'))).toBe(true);
    expect(result.kind).toBe('paths');
    if (result.kind !== 'paths') {
      throw new Error('Expected paths result for compose command');
    }
    expect(result.paths).toEqual([
      join(workspaceDir, 'coding.system.md'),
      join(workspaceDir, 'coding.user.md'),
    ]);

    const generatedSystem = readFileSync(result.paths[0]!, 'utf-8');
    const generatedUser = readFileSync(result.paths[1]!, 'utf-8');
    expect(generatedSystem).toContain('You are a prepared coding assistant.');
    expect(generatedUser).toContain('# Related Files');
    expect(generatedUser).toContain('server.ts');
  });

  it('should require init before compose', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow(`Missing faceted config: ${join(homeDir, '.faceted', 'config.yaml')}`);
  });

  it('should truncate related file content and keep source reference', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    writeFileSync(join(workspaceDir, 'long.ts'), `${'x'.repeat(2500)}\n`, 'utf-8');

    const { runFacetCli } = await loadCliModule();
    await runInit(runFacetCli, workspaceDir, homeDir);
    writeDefaultFacetFixture(homeDir);
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'Combined (single file)',
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }

    const generated = readFileSync(result.path, 'utf-8');
    expect(generated).toContain('...TRUNCATED...');
    expect(generated).toContain('Source: long.ts');
  });

  it('should cancel overwrite when output file exists and answer is not y/yes', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    writeFileSync(join(workspaceDir, 'server.ts'), 'export const server = true;\n', 'utf-8');

    const outputDir = join(workspaceDir, 'out');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, 'coding.md');
    writeFileSync(outputPath, 'existing content', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    await runInit(runFacetCli, workspaceDir, homeDir);
    writeDefaultFacetFixture(homeDir);
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'Combined (single file)',
      input: async (prompt) => {
        if (prompt.startsWith('Output directory')) {
          return outputDir;
        }
        expect(prompt).toContain('[y/N]');
        return 'n';
      },
    })).rejects.toThrow(`Output file exists and overwrite was cancelled: ${outputPath}`);

    expect(readFileSync(outputPath, 'utf-8')).toBe('existing content');
  });

  it('should overwrite existing output file only when answer is y/yes', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    writeFileSync(join(workspaceDir, 'server.ts'), 'export const server = true;\n', 'utf-8');

    const outputDir = join(workspaceDir, 'out');
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, 'coding.md');
    writeFileSync(outputPath, 'existing content', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    await runInit(runFacetCli, workspaceDir, homeDir);
    writeDefaultFacetFixture(homeDir);
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'Combined (single file)',
      input: async (prompt) => {
        if (prompt.startsWith('Output directory')) {
          return outputDir;
        }
        expect(prompt).toContain('[y/N]');
        return 'yes';
      },
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }
    expect(result.path).toBe(outputPath);
    expect(readFileSync(outputPath, 'utf-8')).toContain('server.ts');
  });

  it('should reject writing to a symlinked output file', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    writeFileSync(join(workspaceDir, 'server.ts'), 'export const server = true;\n', 'utf-8');

    const outputDir = join(workspaceDir, 'out');
    mkdirSync(outputDir, { recursive: true });
    const outsideTargetPath = join(workspaceDir, 'outside-target.md');
    writeFileSync(outsideTargetPath, 'outside', 'utf-8');
    symlinkSync(outsideTargetPath, join(outputDir, 'coding.md'));

    const { runFacetCli } = await loadCliModule();
    await runInit(runFacetCli, workspaceDir, homeDir);
    writeDefaultFacetFixture(homeDir);
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'Combined (single file)',
      input: async (prompt) => {
        if (prompt.startsWith('Output directory')) {
          return outputDir;
        }
        expect(prompt).toContain('[y/N]');
        return 'y';
      },
    })).rejects.toThrow('Symbolic links are not allowed for output file');
  });
});
