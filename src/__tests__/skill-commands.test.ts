import { describe, expect, it } from 'vitest';
import type { SkillDocumentInput } from '../cli/skill-types.js';
import { buildSectionsWithCopiedPaths } from '../cli/install-skill/facets.js';

function createSections(): Omit<SkillDocumentInput, 'mode'> {
  return {
    definition: {
      name: 'plain-skill',
      persona: 'coder',
      knowledge: ['architecture'],
      policies: ['coding'],
    },
    persona: {
      ref: 'coder',
      body: 'You are a coding agent.',
      path: '/original/facets/persona/coder.md',
    },
    knowledge: [
      {
        ref: 'architecture',
        body: 'Architecture reference.',
        path: '/original/facets/knowledge/architecture.md',
      },
    ],
    policies: [
      {
        ref: 'coding',
        body: 'Never hide errors.',
        path: '/original/facets/policies/coding.md',
      },
    ],
    instructions: [
      {
        ref: 'literal',
        body: 'Keep changes small and explicit.',
      },
    ],
  };
}

describe('buildSectionsWithCopiedPaths', () => {
  it('should throw when copied knowledge facets count does not match source sections', () => {
    const sections = createSections();

    expect(() =>
      buildSectionsWithCopiedPaths(sections, {
        persona: '/target/facets/persona/coder.md',
        knowledges: [],
        policies: ['/target/facets/policies/coding.md'],
        instructions: ['/target/facets/instructions/plain-skill.md'],
      }),
    ).toThrow('Copied knowledge facet count mismatch');
  });

  it('should throw when copied policy facets count does not match source sections', () => {
    const sections = createSections();

    expect(() =>
      buildSectionsWithCopiedPaths(sections, {
        persona: '/target/facets/persona/coder.md',
        knowledges: ['/target/facets/knowledge/architecture.md'],
        policies: [],
        instructions: ['/target/facets/instructions/plain-skill.md'],
      }),
    ).toThrow('Copied policy facet count mismatch');
  });
});
