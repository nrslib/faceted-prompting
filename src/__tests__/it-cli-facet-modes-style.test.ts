import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('it-cli-facet-modes test style', () => {
  it('does not include Given/When/Then inline comments', () => {
    const targetPath = resolve('src/__tests__/it-cli-facet-modes.test.ts');
    const content = readFileSync(targetPath, 'utf-8');
    expect(content).not.toMatch(/^\s*\/\/\s*(Given|When|Then)(\s*\/\s*Then)?\s*$/m);
  });
});
