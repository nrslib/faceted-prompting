import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

type ComposeDefinitionModule = {
  loadComposeDefinition: (definitionPath: string) => Promise<{
    name: string;
    description?: string;
    persona: string;
    template?: string;
    knowledge?: string[];
    policies?: string[];
    instruction?: string;
    order?: Array<'knowledge' | 'policies' | 'instruction'>;
  }>;
};

async function loadComposeDefinitionModule(): Promise<ComposeDefinitionModule> {
  const modulePath = pathToFileURL(resolve('src/compose-definition.ts')).href;
  return import(modulePath) as Promise<ComposeDefinitionModule>;
}

describe('loadComposeDefinition', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should throw when compose definition omits required name', async () => {
    const root = mkdtempSync(join(tmpdir(), 'facet-compose-def-'));
    tempDirs.push(root);

    const definitionPath = join(root, 'definition.yaml');
    writeFileSync(
      definitionPath,
      [
        'persona: coder',
        'knowledge:',
        '  - architecture',
        'policies:',
        '  - coding-policy',
      ].join('\n'),
      'utf-8',
    );

    const { loadComposeDefinition } = await loadComposeDefinitionModule();
    await expect(loadComposeDefinition(definitionPath)).rejects.toThrow('name');
  });

  it('should keep description optional and preserve non-persona order entries', async () => {
    const root = mkdtempSync(join(tmpdir(), 'facet-compose-def-'));
    tempDirs.push(root);

    mkdirSync(join(root, 'facets', 'persona'), { recursive: true });
    mkdirSync(join(root, 'facets', 'knowledge'), { recursive: true });
    mkdirSync(join(root, 'facets', 'policies'), { recursive: true });

    writeFileSync(join(root, 'facets', 'persona', 'coder.md'), 'You are a strict coder.', 'utf-8');
    writeFileSync(join(root, 'facets', 'knowledge', 'architecture.md'), 'Layered architecture rules.', 'utf-8');
    writeFileSync(join(root, 'facets', 'policies', 'quality.md'), 'No fallback defaults for required data.', 'utf-8');

    const definitionPath = join(root, 'definition.yaml');
    writeFileSync(
      definitionPath,
      [
        'name: release-note',
        'persona: coder',
        'knowledge:',
        '  - architecture',
        'policies:',
        '  - quality',
        'instruction: Prepare release notes.',
        'order:',
        '  - persona',
        '  - policies',
        '  - knowledge',
        '  - instruction',
      ].join('\n'),
      'utf-8',
    );

    const { loadComposeDefinition } = await loadComposeDefinitionModule();
    const loaded = await loadComposeDefinition(definitionPath);
    expect(loaded.name).toBe('release-note');
    expect(loaded.description).toBeUndefined();
    expect(loaded.persona).toBe('coder');
    expect(loaded.order).toEqual(['policies', 'knowledge', 'instruction']);
  });

  it('should parse YAML block scalar instruction', async () => {
    const root = mkdtempSync(join(tmpdir(), 'facet-compose-def-'));
    tempDirs.push(root);

    const definitionPath = join(root, 'definition.yaml');
    writeFileSync(
      definitionPath,
      [
        'name: block-scalar',
        'persona: coder',
        'instruction: |',
        '  Keep implementation simple.',
        '  Avoid fallback defaults.',
      ].join('\n'),
      'utf-8',
    );

    const { loadComposeDefinition } = await loadComposeDefinitionModule();
    const loaded = await loadComposeDefinition(definitionPath);
    expect(loaded.instruction).toContain('Keep implementation simple.');
    expect(loaded.instruction).toContain('Avoid fallback defaults.');
  });

  it('should parse optional template field', async () => {
    const root = mkdtempSync(join(tmpdir(), 'facet-compose-def-'));
    tempDirs.push(root);

    const definitionPath = join(root, 'definition.yaml');
    writeFileSync(
      definitionPath,
      [
        'name: template-based',
        'persona: coder',
        'template: starter-kit',
      ].join('\n'),
      'utf-8',
    );

    const { loadComposeDefinition } = await loadComposeDefinitionModule();
    const loaded = await loadComposeDefinition(definitionPath);
    expect(loaded.template).toBe('starter-kit');
  });

  it('should reject non-string template field', async () => {
    const root = mkdtempSync(join(tmpdir(), 'facet-compose-def-'));
    tempDirs.push(root);

    const definitionPath = join(root, 'definition.yaml');
    writeFileSync(
      definitionPath,
      [
        'name: template-based',
        'persona: coder',
        'template:',
        '  key: value',
      ].join('\n'),
      'utf-8',
    );

    const { loadComposeDefinition } = await loadComposeDefinitionModule();
    await expect(loadComposeDefinition(definitionPath)).rejects.toThrow('template must be a scalar string');
  });

  it('should reject unknown compose definition keys', async () => {
    const root = mkdtempSync(join(tmpdir(), 'facet-compose-def-'));
    tempDirs.push(root);

    const definitionPath = join(root, 'definition.yaml');
    writeFileSync(
      definitionPath,
      [
        'name: release-note',
        'persona: coder',
        'unexpected: value',
      ].join('\n'),
      'utf-8',
    );

    const { loadComposeDefinition } = await loadComposeDefinitionModule();
    await expect(loadComposeDefinition(definitionPath)).rejects.toThrow('Unknown compose definition key');
  });
});
