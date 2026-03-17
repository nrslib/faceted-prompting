import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('init test style regression', () => {
  it('should keep Given/When/Then comments out of init.test.ts', () => {
    const initTestBody = readFileSync(resolve('src/__tests__/init.test.ts'), 'utf-8');
    expect(initTestBody).not.toMatch(/\/\/\s*(Given|When|Then)\b/u);
  });
});
