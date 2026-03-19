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

function writeCodingComposition(compositionsRoot: string): void {
  mkdirSync(compositionsRoot, { recursive: true });
  writeFileSync(
    join(compositionsRoot, 'coding.yaml'),
    [
      'name: coding',
      'description: Coding workflow',
      'persona: coder',
      'policies:',
      '  - coding',
      '  - ai-antipattern',
      'knowledge:',
      '  - architecture',
      'instructions:',
      '  - keep-changes-small',
    ].join('\n'),
    'utf-8',
  );
}

function writeDefaultFacetFixture(homeDir: string, persona = 'You are a coding agent.\n'): void {
  const facetedRoot = join(homeDir, '.faceted');
  const facetsRoot = join(facetedRoot, 'facets');
  mkdirSync(facetedRoot, { recursive: true });
  writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
  mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
  mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
  mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
  mkdirSync(join(facetsRoot, 'instructions'), { recursive: true });
  writeFileSync(join(facetsRoot, 'persona', 'coder.md'), persona, 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), 'Architecture reference.\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'frontend.md'), 'Frontend reference.\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'backend.md'), 'Backend reference.\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'coding.md'), 'Never hide errors.\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'ai-antipattern.md'), 'Do not add dead code.\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'instructions', 'keep-changes-small.md'), 'Keep changes small and explicit.\n', 'utf-8');
  writeCodingComposition(join(facetedRoot, 'compositions'));
}

function writeFacetFilesUnderFacetedRoot(
  facetedRoot: string,
  contents: {
    persona: string;
    codingPolicy: string;
    aiAntipatternPolicy: string;
    architecture: string;
    frontend: string;
    backend: string;
    keepChangesSmall?: string;
  },
): void {
  const facetsRoot = join(facetedRoot, 'facets');
  mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
  mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
  mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
  mkdirSync(join(facetsRoot, 'instructions'), { recursive: true });
  writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'persona', 'coder.md'), contents.persona, 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), contents.architecture, 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'frontend.md'), contents.frontend, 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'backend.md'), contents.backend, 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'coding.md'), contents.codingPolicy, 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'ai-antipattern.md'), contents.aiAntipatternPolicy, 'utf-8');
  writeFileSync(join(facetsRoot, 'instructions', 'keep-changes-small.md'), contents.keepChangesSmall ?? 'Keep changes small and explicit.\n', 'utf-8');
  writeCodingComposition(join(facetedRoot, 'compositions'));
}

function writeTemplateCompositionFixture(homeDir: string): void {
  const facetedRoot = join(homeDir, '.faceted');
  const facetsRoot = join(facetedRoot, 'facets');
  const compositionsRoot = join(facetedRoot, 'compositions');
  const templateRoot = join(facetedRoot, 'templates', 'starter-kit');

  mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
  mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
  mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
  mkdirSync(join(facetsRoot, 'instructions'), { recursive: true });
  mkdirSync(compositionsRoot, { recursive: true });
  mkdirSync(templateRoot, { recursive: true });

  writeFileSync(join(facetedRoot, 'config.yaml'), 'version: 1\n', 'utf-8');
  writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a template coding agent.', 'utf-8');
  writeFileSync(join(facetsRoot, 'knowledge', 'architecture.md'), 'Template architecture knowledge.', 'utf-8');
  writeFileSync(join(facetsRoot, 'policies', 'coding.md'), 'Template coding policy.', 'utf-8');
  writeFileSync(join(facetsRoot, 'instructions', 'keep-deterministic.md'), 'Keep template output deterministic.', 'utf-8');

  writeFileSync(
    join(compositionsRoot, 'templated.yaml'),
    [
      'name: templated',
      'persona: coder',
      'knowledge:',
      '  - architecture',
      'policies:',
      '  - coding',
      'instructions:',
      '  - keep-deterministic',
      'template: starter-kit',
    ].join('\n'),
    'utf-8',
  );

  writeFileSync(
    join(templateRoot, 'prompt.yaml'),
    [
      'persona: |',
      '  {{facet:persona}}',
      'knowledge: |',
      '  {{facet:knowledges}}',
      'policies: |',
      '  {{facet:policies}}',
      'instruction: |',
      '  {{facet:instructions}}',
    ].join('\n'),
    'utf-8',
  );
  writeFileSync(join(templateRoot, 'README.md'), 'template file', 'utf-8');
}

describe('facet compose integration flow', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should compose selected global composition in combined mode', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    writeDefaultFacetFixture(homeDir, 'You are a release engineer.\n');

    const outputDir = join(workspaceDir, 'out');
    mkdirSync(outputDir, { recursive: true });

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Combined (single file)']),
      input: async (_prompt, defaultValue) => {
        expect(defaultValue).toBe(workspaceDir);
        return outputDir;
      },
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }
    expect(result.path).toBe(join(outputDir, 'coding.md'));
    expect(existsSync(result.path)).toBe(true);

    const generated = readFileSync(result.path, 'utf-8');
    expect(generated).toContain('You are a release engineer.');
    expect(generated).toContain('Architecture reference.');
    expect(generated).toContain('Never hide errors.');
    expect(generated).toContain('Do not add dead code.');
    expect(generated).toContain('Keep changes small and explicit.');
  });

  it('should prefer local composition and local facets while falling back to global facets', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    writeFacetFilesUnderFacetedRoot(join(homeDir, '.faceted'), {
      persona: 'You are a global coder persona.\n',
      codingPolicy: 'Global coding policy.\n',
      aiAntipatternPolicy: 'Global AI antipattern policy.\n',
      architecture: 'Global architecture knowledge.\n',
      frontend: 'Global frontend knowledge.\n',
      backend: 'Global backend knowledge.\n',
    });

    const localFacetedRoot = join(workspaceDir, '.faceted');
    mkdirSync(join(localFacetedRoot, 'facets', 'persona'), { recursive: true });
    mkdirSync(join(localFacetedRoot, 'facets', 'policies'), { recursive: true });
    mkdirSync(join(localFacetedRoot, 'compositions'), { recursive: true });
    writeFileSync(join(localFacetedRoot, 'facets', 'persona', 'coder.md'), 'You are a local coder persona.\n', 'utf-8');
    writeFileSync(join(localFacetedRoot, 'facets', 'policies', 'coding.md'), 'Local coding policy.\n', 'utf-8');
    writeCodingComposition(join(localFacetedRoot, 'compositions'));

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (local)', 'Combined (single file)']),
      input: async (prompt, defaultValue) =>
        prompt.includes('overrides global definition') ? 'y' : defaultValue,
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }

    const generated = readFileSync(result.path, 'utf-8');
    expect(generated).toContain('You are a local coder persona.');
    expect(generated).toContain('Local coding policy.');
    expect(generated).toContain('Global AI antipattern policy.');
    expect(generated).toContain('Global architecture knowledge.');
  });

  it('should cancel compose when local composition shadow confirmation is declined', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    writeFacetFilesUnderFacetedRoot(join(homeDir, '.faceted'), {
      persona: 'You are a global coder persona.\n',
      codingPolicy: 'Global coding policy.\n',
      aiAntipatternPolicy: 'Global AI antipattern policy.\n',
      architecture: 'Global architecture knowledge.\n',
      frontend: 'Global frontend knowledge.\n',
      backend: 'Global backend knowledge.\n',
    });

    const localFacetedRoot = join(workspaceDir, '.faceted');
    mkdirSync(join(localFacetedRoot, 'facets', 'persona'), { recursive: true });
    mkdirSync(join(localFacetedRoot, 'facets', 'policies'), { recursive: true });
    mkdirSync(join(localFacetedRoot, 'compositions'), { recursive: true });
    writeFileSync(join(localFacetedRoot, 'facets', 'persona', 'coder.md'), 'You are a local coder persona.\n', 'utf-8');
    writeFileSync(join(localFacetedRoot, 'facets', 'policies', 'coding.md'), 'Local coding policy.\n', 'utf-8');
    writeCodingComposition(join(localFacetedRoot, 'compositions'));

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (local)']),
      input: async (prompt, defaultValue) =>
        prompt.includes('overrides global definition') ? 'n' : defaultValue,
    })).rejects.toThrow('Compose was cancelled for local composition: coding');

    expect(existsSync(join(workspaceDir, 'coding.md'))).toBe(false);
  });

  it('should compose with local facets when global faceted home is not initialized', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    writeFacetFilesUnderFacetedRoot(join(workspaceDir, '.faceted'), {
      persona: 'You are a local-only coder persona.\n',
      codingPolicy: 'Local-only coding policy.\n',
      aiAntipatternPolicy: 'Local-only AI antipattern policy.\n',
      architecture: 'Local-only architecture knowledge.\n',
      frontend: 'Local-only frontend knowledge.\n',
      backend: 'Local-only backend knowledge.\n',
    });

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (local)', 'Combined (single file)']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }

    const generated = readFileSync(result.path, 'utf-8');
    expect(generated).toContain('You are a local-only coder persona.');
    expect(generated).toContain('Local-only coding policy.');
    expect(generated).toContain('Local-only architecture knowledge.');
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

  it('should compose with local facets even when global config file is malformed', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const globalFacetedRoot = join(homeDir, '.faceted');
    mkdirSync(globalFacetedRoot, { recursive: true });
    writeFileSync(join(globalFacetedRoot, 'config.yaml'), 'version: [1\n', 'utf-8');

    writeFacetFilesUnderFacetedRoot(join(workspaceDir, '.faceted'), {
      persona: 'You are a local malformed-config fallback persona.\n',
      codingPolicy: 'Local malformed-config coding policy.\n',
      aiAntipatternPolicy: 'Local malformed-config AI policy.\n',
      architecture: 'Local malformed-config architecture knowledge.\n',
      frontend: 'Local malformed-config frontend knowledge.\n',
      backend: 'Local malformed-config backend knowledge.\n',
    });

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (local)', 'Combined (single file)']),
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }
    const generated = readFileSync(result.path, 'utf-8');
    expect(generated).toContain('You are a local malformed-config fallback persona.');
    expect(generated).toContain('Local malformed-config coding policy.');
  });

  it('should compose in split mode after init when definitions are prepared', async () => {
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
      text: `Initialized: ${join(workspaceDir, '.faceted')}`,
    });

    writeDefaultFacetFixture(homeDir, 'You are a prepared coding assistant.\n');

    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Split (system + user)']),
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
    expect(generatedUser).toContain('Never hide errors.');
    expect(generatedUser).toContain('Keep changes small and explicit.');
  });

  it('should reject compose when no composition definitions are found', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    await runInit(runFacetCli, workspaceDir, homeDir);

    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => 'unused',
      input: async (_prompt, defaultValue) => defaultValue,
    })).rejects.toThrow('No compose definitions found in');
  });

  it('should output template-backed composition files with facet tokens applied', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    writeTemplateCompositionFixture(homeDir);

    const outputDir = join(workspaceDir, 'templated-output');
    const inputPrompts: string[] = [];
    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        inputPrompts.push(prompt);
        expect(defaultValue).toBe(workspaceDir);
        return outputDir;
      },
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }

    const renderedPath = join(outputDir, 'prompt.yaml');
    expect(existsSync(renderedPath)).toBe(true);
    expect(readFileSync(renderedPath, 'utf-8')).toContain('You are a template coding agent.');
    expect(readFileSync(renderedPath, 'utf-8')).toContain('Template architecture knowledge.');
    expect(readFileSync(renderedPath, 'utf-8')).toContain('Template coding policy.');
    expect(readFileSync(renderedPath, 'utf-8')).toContain('Keep template output deterministic.');
    expect(existsSync(join(outputDir, 'README.md'))).toBe(true);
    expect(inputPrompts.some(prompt => prompt.includes('[y/N]'))).toBe(false);
  });

  it('should overwrite conflicting template-backed files only when answer is y/yes', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    writeTemplateCompositionFixture(homeDir);

    const outputDir = join(workspaceDir, 'templated-output');
    mkdirSync(outputDir, { recursive: true });
    const renderedPath = join(outputDir, 'prompt.yaml');
    writeFileSync(renderedPath, 'existing template output', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        if (prompt === 'Output directory') {
          expect(defaultValue).toBe(workspaceDir);
          return outputDir;
        }
        expect(prompt).toContain('Output files exist. Overwrite?');
        expect(prompt).toContain(renderedPath);
        expect(prompt).toContain('[y/N]');
        return 'yes';
      },
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }
    expect(result.path).toBe(outputDir);
    expect(readFileSync(renderedPath, 'utf-8')).toContain('You are a template coding agent.');
  });

  it('should cancel template-backed overwrite when conflict answer is not y/yes', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    writeTemplateCompositionFixture(homeDir);

    const outputDir = join(workspaceDir, 'templated-output');
    mkdirSync(outputDir, { recursive: true });
    const renderedPath = join(outputDir, 'prompt.yaml');
    writeFileSync(renderedPath, 'existing template output', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        if (prompt === 'Output directory') {
          expect(defaultValue).toBe(workspaceDir);
          return outputDir;
        }
        expect(prompt).toContain('Output files exist. Overwrite?');
        expect(prompt).toContain(renderedPath);
        expect(prompt).toContain('[y/N]');
        return 'n';
      },
    })).rejects.toThrow(`Output files exist and overwrite was cancelled: ${renderedPath}`);

    expect(readFileSync(renderedPath, 'utf-8')).toBe('existing template output');
  });

  it('should keep unrelated files in template-backed output directory', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    writeTemplateCompositionFixture(homeDir);

    const outputDir = join(workspaceDir, 'templated-output');
    mkdirSync(outputDir, { recursive: true });
    const unrelatedPath = join(outputDir, 'unrelated.txt');
    writeFileSync(unrelatedPath, 'keep me', 'utf-8');

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        if (prompt === 'Output directory') {
          expect(defaultValue).toBe(workspaceDir);
          return outputDir;
        }
        throw new Error(`Unexpected overwrite prompt: ${prompt}`);
      },
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for compose command');
    }
    expect(result.path).toBe(outputDir);
    expect(readFileSync(unrelatedPath, 'utf-8')).toBe('keep me');
    expect(existsSync(join(outputDir, 'prompt.yaml'))).toBe(true);
    expect(existsSync(join(outputDir, 'README.md'))).toBe(true);
  });

  it('should not replace facet tokens in unrelated existing files for template-backed compose', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    writeTemplateCompositionFixture(homeDir);

    const outputDir = join(workspaceDir, 'templated-output');
    mkdirSync(outputDir, { recursive: true });
    const unrelatedPath = join(outputDir, 'unrelated-with-token.md');
    const unrelatedContent = 'must stay: {{facet:persona}}';
    writeFileSync(unrelatedPath, unrelatedContent, 'utf-8');

    const { runFacetCli } = await loadCliModule();
    await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        if (prompt === 'Output directory') {
          expect(defaultValue).toBe(workspaceDir);
          return outputDir;
        }
        throw new Error(`Unexpected overwrite prompt: ${prompt}`);
      },
    });

    expect(readFileSync(unrelatedPath, 'utf-8')).toBe(unrelatedContent);
    expect(readFileSync(join(outputDir, 'prompt.yaml'), 'utf-8')).toContain('You are a template coding agent.');
  });

  it('should reject template-backed compose when output file path is a symlink', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    writeTemplateCompositionFixture(homeDir);

    const outputDir = join(workspaceDir, 'templated-output');
    mkdirSync(outputDir, { recursive: true });
    const outsideTargetPath = join(workspaceDir, 'outside-template-target.yaml');
    writeFileSync(outsideTargetPath, 'outside', 'utf-8');
    symlinkSync(outsideTargetPath, join(outputDir, 'prompt.yaml'));

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        if (prompt === 'Output directory') {
          expect(defaultValue).toBe(workspaceDir);
          return outputDir;
        }
        expect(prompt).toContain('Output files exist. Overwrite?');
        expect(prompt).toContain('[y/N]');
        return 'y';
      },
    })).rejects.toThrow(`Symbolic links are not allowed for output file: ${join(outputDir, 'prompt.yaml')}`);

    expect(readFileSync(outsideTargetPath, 'utf-8')).toBe('outside');
  });

  it('should reject template-backed compose when output directory path is a symlink', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);
    writeTemplateCompositionFixture(homeDir);

    const realOutputDir = join(workspaceDir, 'templated-output-real');
    const outputDirSymlink = join(workspaceDir, 'templated-output-link');
    mkdirSync(realOutputDir, { recursive: true });
    symlinkSync(realOutputDir, outputDirSymlink);

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        if (prompt === 'Output directory') {
          expect(defaultValue).toBe(workspaceDir);
          return outputDirSymlink;
        }
        throw new Error(`Unexpected prompt: ${prompt}`);
      },
    })).rejects.toThrow(`Symbolic links are not allowed for Output directory: ${outputDirSymlink}`);
  });

  it('should reject template-backed compose when output directory symlink is outside cwd', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    const outsideRootDir = mkdtempSync(join(tmpdir(), 'facet-outside-'));
    tempDirs.push(workspaceDir, homeDir, outsideRootDir);
    writeTemplateCompositionFixture(homeDir);

    const realOutputDir = join(outsideRootDir, 'templated-output-real');
    const outputDirSymlink = join(outsideRootDir, 'templated-output-link');
    mkdirSync(realOutputDir, { recursive: true });
    symlinkSync(realOutputDir, outputDirSymlink);

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        if (prompt === 'Output directory') {
          expect(defaultValue).toBe(workspaceDir);
          return outputDirSymlink;
        }
        throw new Error(`Unexpected prompt: ${prompt}`);
      },
    })).rejects.toThrow(`Symbolic links are not allowed for Output directory: ${outputDirSymlink}`);
  });

  it('should reject template-backed compose when missing output directory has symlink ancestor outside cwd', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    const outsideRootDir = mkdtempSync(join(tmpdir(), 'facet-outside-'));
    tempDirs.push(workspaceDir, homeDir, outsideRootDir);
    writeTemplateCompositionFixture(homeDir);

    const realOutputRootDir = join(outsideRootDir, 'templated-output-real');
    const outputRootSymlink = join(outsideRootDir, 'templated-output-link');
    const nestedOutputDir = join(outputRootSymlink, 'nested-output');
    mkdirSync(realOutputRootDir, { recursive: true });
    symlinkSync(realOutputRootDir, outputRootSymlink);

    const { runFacetCli } = await loadCliModule();
    await expect(runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        if (prompt === 'Output directory') {
          expect(defaultValue).toBe(workspaceDir);
          return nestedOutputDir;
        }
        throw new Error(`Unexpected prompt: ${prompt}`);
      },
    })).rejects.toThrow(`Symbolic links are not allowed in Output directory path: ${outputRootSymlink}`);
  });

  it('should cancel overwrite when output file exists and answer is not y/yes', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

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
      select: createSelectStub(['coding (global)', 'Combined (single file)']),
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
      select: createSelectStub(['coding (global)', 'Combined (single file)']),
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
    expect(readFileSync(outputPath, 'utf-8')).toContain('Never hide errors.');
  });

  it('should accept uppercase overwrite confirmation in both standard and template-backed compose', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const { runFacetCli } = await loadCliModule();
    await runInit(runFacetCli, workspaceDir, homeDir);
    writeDefaultFacetFixture(homeDir);
    writeTemplateCompositionFixture(homeDir);

    const standardOutputDir = join(workspaceDir, 'standard-out');
    mkdirSync(standardOutputDir, { recursive: true });
    const standardOutputPath = join(standardOutputDir, 'coding.md');
    writeFileSync(standardOutputPath, 'existing standard content', 'utf-8');

    const standardResult = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['coding (global)', 'Combined (single file)']),
      input: async (prompt) => {
        if (prompt.startsWith('Output directory')) {
          return standardOutputDir;
        }
        expect(prompt).toContain('Output file exists. Overwrite?');
        return ' Y ';
      },
    });

    expect(standardResult.kind).toBe('path');
    expect(readFileSync(standardOutputPath, 'utf-8')).not.toBe('existing standard content');
    expect(readFileSync(standardOutputPath, 'utf-8')).toContain('Do not add dead code.');

    const templateOutputDir = join(workspaceDir, 'template-out');
    mkdirSync(templateOutputDir, { recursive: true });
    const templateRenderedPath = join(templateOutputDir, 'prompt.yaml');
    writeFileSync(templateRenderedPath, 'existing template content', 'utf-8');

    const templateResult = await runFacetCli(['compose'], {
      cwd: workspaceDir,
      homeDir,
      select: createSelectStub(['templated (global)']),
      input: async (prompt, defaultValue) => {
        if (prompt === 'Output directory') {
          expect(defaultValue).toBe(workspaceDir);
          return templateOutputDir;
        }
        expect(prompt).toContain('Output files exist. Overwrite?');
        return ' Y ';
      },
    });

    expect(templateResult.kind).toBe('path');
    expect(readFileSync(templateRenderedPath, 'utf-8')).toContain('You are a template coding agent.');
  });

  it('should reject writing to a symlinked output file', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

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
      select: createSelectStub(['coding (global)', 'Combined (single file)']),
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
