import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  ) => Promise<{ kind: 'path'; path: string } | { kind: 'paths'; paths: readonly string[] } | { kind: 'text'; text: string }>;
};

async function loadCliModule(): Promise<CliModule> {
  const modulePath = pathToFileURL(resolve('src/cli/index.ts')).href;
  return import(modulePath) as Promise<CliModule>;
}

function writeBaseFacets(facetedRoot: string): { facetsRoot: string; compositionsRoot: string; templatesRoot: string } {
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
  writeFileSync(join(facetsRoot, 'instructions', 'implement.md'), 'Implement directly.', 'utf-8');

  return { facetsRoot, compositionsRoot, templatesRoot };
}

describe('facet compose output-contracts integration flow', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should compose output-contracts from definition-relative file paths', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const { compositionsRoot } = writeBaseFacets(facetedRoot);
    mkdirSync(join(compositionsRoot, 'contracts'), { recursive: true });
    writeFileSync(join(compositionsRoot, 'contracts', 'report.md'), 'Return a local contract report.', 'utf-8');
    writeFileSync(
      join(compositionsRoot, 'local-output.yaml'),
      [
        'name: local-output',
        'persona: coder',
        'knowledge:',
        '  - architecture',
        'instructions:',
        '  - implement',
        'output-contracts:',
        '  - ./contracts/report.md',
        'policies:',
        '  - coding',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose', '--composition', 'local-output', '--combined'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => {
        throw new Error('Unexpected select call');
      },
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for output-contracts compose command');
    }
    const generated = readFileSync(result.path, 'utf-8');
    expect(generated).toContain('Return a local contract report.');
    expect(generated.indexOf('Implement directly.')).toBeLessThan(generated.indexOf('Return a local contract report.'));
    expect(generated.indexOf('Return a local contract report.')).toBeLessThan(generated.indexOf('Never hide errors.'));
  });

  it('should compose scoped output-contracts in standard compose output', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const { compositionsRoot } = writeBaseFacets(facetedRoot);
    const scopedContractDir = join(facetedRoot, 'repertoire', '@acme', 'report-pack', 'facets', 'output-contracts');
    mkdirSync(scopedContractDir, { recursive: true });
    writeFileSync(join(scopedContractDir, 'review-report.md'), 'Return a scoped standard compose report.', 'utf-8');
    writeFileSync(
      join(compositionsRoot, 'scoped-standard.yaml'),
      [
        'name: scoped-standard',
        'persona: coder',
        'instructions:',
        '  - implement',
        'output-contracts:',
        '  - "@acme/report-pack/review-report"',
        'policies:',
        '  - coding',
      ].join('\n'),
      'utf-8',
    );

    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose', '--composition', 'scoped-standard', '--combined'], {
      cwd: workspaceDir,
      homeDir,
      select: async () => {
        throw new Error('Unexpected select call');
      },
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result.kind).toBe('path');
    if (result.kind !== 'path') {
      throw new Error('Expected path result for scoped standard compose command');
    }
    const generated = readFileSync(result.path, 'utf-8');
    expect(generated).toContain('Return a scoped standard compose report.');
    expect(generated.indexOf('Implement directly.')).toBeLessThan(
      generated.indexOf('Return a scoped standard compose report.'),
    );
    expect(generated.indexOf('Return a scoped standard compose report.')).toBeLessThan(
      generated.indexOf('Never hide errors.'),
    );
  });

  it('should apply scoped output-contracts to template-backed compose output', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-workspace-'));
    const homeDir = mkdtempSync(join(tmpdir(), 'facet-home-'));
    tempDirs.push(workspaceDir, homeDir);

    const facetedRoot = join(homeDir, '.faceted');
    const { compositionsRoot, templatesRoot } = writeBaseFacets(facetedRoot);
    const scopedContractDir = join(facetedRoot, 'repertoire', '@acme', 'report-pack', 'facets', 'output-contracts');
    mkdirSync(scopedContractDir, { recursive: true });
    writeFileSync(join(scopedContractDir, 'review-report.md'), 'Return a scoped contract report.', 'utf-8');

    const templateRoot = join(templatesRoot, 'starter-kit');
    mkdirSync(templateRoot, { recursive: true });
    writeFileSync(
      join(templateRoot, 'SKILL.md'),
      ['persona={{facet:persona}}', 'output={{facet:outputContracts}}'].join('\n'),
      'utf-8',
    );
    writeFileSync(
      join(compositionsRoot, 'scoped-template.yaml'),
      [
        'name: scoped-template',
        'persona: coder',
        'output-contracts:',
        '  - "@acme/report-pack/review-report"',
        'template: starter-kit',
      ].join('\n'),
      'utf-8',
    );

    const outputDir = join(workspaceDir, 'rendered');
    const { runFacetCli } = await loadCliModule();
    const result = await runFacetCli(['compose', '--composition', 'scoped-template', '--output', outputDir], {
      cwd: workspaceDir,
      homeDir,
      select: async () => {
        throw new Error('Unexpected select call');
      },
      input: async (_prompt, defaultValue) => defaultValue,
    });

    expect(result).toEqual({ kind: 'path', path: outputDir });
    const renderedSkillPath = join(outputDir, 'SKILL.md');
    expect(existsSync(renderedSkillPath)).toBe(true);
    const rendered = readFileSync(renderedSkillPath, 'utf-8');
    expect(rendered).toContain('Return a scoped contract report.');
    expect(rendered).not.toContain('{{facet:outputContracts}}');
  });
});
