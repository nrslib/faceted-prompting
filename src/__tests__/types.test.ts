/**
 * Unit tests for faceted-prompting type definitions.
 *
 * Verifies that types are correctly exported and usable.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type {
  FacetKind,
  FacetContent,
  FacetSet,
  ComposedPrompt,
  ComposeDefinition,
  ComposeOrderEntry,
  ComposeOptions,
} from '../index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function parseVersion(version: string): readonly [number, number, number] {
  const parts = version.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid version: ${version}`);
  }

  return parts.map(part => {
    const value = Number.parseInt(part, 10);
    if (!Number.isInteger(value)) {
      throw new Error(`Invalid version: ${version}`);
    }

    return value;
  }) as [number, number, number];
}

function isAtLeastVersion(version: string, minimum: string): boolean {
  const currentParts = parseVersion(version);
  const minimumParts = parseVersion(minimum);

  for (let index = 0; index < currentParts.length; index += 1) {
    if (currentParts[index] > minimumParts[index]) {
      return true;
    }
    if (currentParts[index] < minimumParts[index]) {
      return false;
    }
  }

  return true;
}

describe('FacetKind type', () => {
  it('should accept valid facet kinds', () => {
    const kinds: FacetKind[] = [
      'personas',
      'policies',
      'knowledge',
      'instructions',
      'output-contracts',
    ];
    expect(kinds).toHaveLength(5);
  });
});

describe('FacetContent interface', () => {
  it('should accept body with sourcePath', () => {
    const content: FacetContent = {
      body: 'You are a helpful assistant.',
      sourcePath: '/path/to/persona.md',
    };
    expect(content.body).toBe('You are a helpful assistant.');
    expect(content.sourcePath).toBe('/path/to/persona.md');
  });

  it('should accept body without sourcePath', () => {
    const content: FacetContent = {
      body: 'Inline content',
    };
    expect(content.body).toBe('Inline content');
    expect(content.sourcePath).toBeUndefined();
  });
});

describe('FacetSet interface', () => {
  it('should accept a complete facet set', () => {
    const set: FacetSet = {
      persona: { body: 'You are a coder.' },
      policies: [{ body: 'Follow clean code.' }],
      knowledge: [{ body: 'Architecture docs.' }],
      instructions: [{ body: 'Implement the feature.' }],
      outputContracts: [{ body: 'Write a structured report.' }],
    };
    expect(set.persona?.body).toBe('You are a coder.');
    expect(set.policies).toHaveLength(1);
    expect(set.outputContracts?.[0]?.body).toBe('Write a structured report.');
  });

  it('should accept a partial facet set', () => {
    const set: FacetSet = {
      instructions: [{ body: 'Do the task.' }],
    };
    expect(set.persona).toBeUndefined();
    expect(set.instructions?.[0]?.body).toBe('Do the task.');
  });
});

describe('ComposedPrompt interface', () => {
  it('should hold systemPrompt and userMessage', () => {
    const prompt: ComposedPrompt = {
      systemPrompt: 'You are a coder.',
      userMessage: 'Implement feature X.',
    };
    expect(prompt.systemPrompt).toBe('You are a coder.');
    expect(prompt.userMessage).toBe('Implement feature X.');
  });
});

describe('ComposeOptions interface', () => {
  it('should hold contextMaxChars', () => {
    const options: ComposeOptions = {
      contextMaxChars: 2000,
      userMessageOrder: ['knowledge', 'instructions', 'output-contracts', 'policies'],
    };
    expect(options.contextMaxChars).toBe(2000);
    expect(options.userMessageOrder).toEqual(['knowledge', 'instructions', 'output-contracts', 'policies']);
  });
});

describe('ComposeDefinition public types', () => {
  it('should expose compose definition and order entry from the package root', () => {
    const order: ComposeOrderEntry[] = ['knowledge', 'instructions', 'output-contracts', 'policies'];
    const definition: ComposeDefinition = {
      name: 'coding',
      persona: 'coder',
      outputContracts: ['review-report'],
      order,
    };

    expect(definition.outputContracts).toEqual(['review-report']);
    expect(definition.order).toEqual(order);
  });
});

describe('runtime dependency contract', () => {
  it('should keep yaml outside the vulnerable production range', () => {
    const packageLock = JSON.parse(
      readFileSync(resolve(repoRoot, 'package-lock.json'), 'utf8'),
    ) as {
      packages: {
        '': { dependencies: { yaml: string } };
        'node_modules/yaml': { version: string };
      };
    };

    expect(packageLock.packages[''].dependencies.yaml).toBe('^2.8.3');
    expect(isAtLeastVersion(packageLock.packages['node_modules/yaml'].version, '2.8.3')).toBe(true);
  });
});
