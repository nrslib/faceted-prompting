import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('module boundary', () => {
  it('should keep compose definition loading out of resolve module', async () => {
    const resolveModulePath = pathToFileURL(resolve('src/resolve.ts')).href;
    const composeDefinitionPath = pathToFileURL(resolve('src/compose-definition.ts')).href;

    const resolveModule = await import(resolveModulePath);
    const composeDefinitionModule = await import(composeDefinitionPath);

    expect('loadComposeDefinition' in resolveModule).toBe(false);
    expect(typeof composeDefinitionModule.loadComposeDefinition).toBe('function');
  });
});
