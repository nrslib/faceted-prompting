import { describe, expect, it } from 'vitest';
import { resolveDefinitionSections } from '../cli/skill-renderer.js';

describe('skill renderer regression', () => {
  it('should fail when facet roots are not provided', () => {
    expect(() =>
      resolveDefinitionSections({
        definition: {
          name: 'coding',
          persona: 'coder',
        },
        definitionDir: '/tmp',
        facetsRoots: [],
      }),
    ).toThrow('Facet roots are required');
  });
});
