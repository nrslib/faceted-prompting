import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderSkillDocument, resolveDefinitionSections } from '../cli/skill-renderer.js';

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

  it('should render output contracts before policies by default', () => {
    const rendered = renderSkillDocument({
      definition: {
        name: 'coding',
        persona: 'coder',
      },
      mode: 'inline',
      persona: { ref: 'coder', body: 'Persona body', path: '/facets/persona/coder.md' },
      knowledge: [{ ref: 'architecture', body: 'Knowledge body', path: '/facets/knowledge/architecture.md' }],
      instructions: [{ ref: 'literal', body: 'Instruction body' }],
      outputContracts: [{ ref: 'review-report', body: 'Output contract body', path: '/facets/output-contracts/review-report.md' }],
      policies: [{ ref: 'coding', body: 'Policy body', path: '/facets/policies/coding.md' }],
    });

    expect(rendered).toContain('## Output Contracts');
    expect(rendered.indexOf('## Knowledge')).toBeLessThan(rendered.indexOf('## Instructions'));
    expect(rendered.indexOf('## Instructions')).toBeLessThan(rendered.indexOf('## Output Contracts'));
    expect(rendered.indexOf('## Output Contracts')).toBeLessThan(rendered.indexOf('## Policies'));
  });

  it('should render reference output contracts with their source paths', () => {
    const rendered = renderSkillDocument({
      definition: {
        name: 'coding',
        persona: 'coder',
        order: ['output-contracts', 'policies'],
      },
      mode: 'reference',
      persona: { ref: 'coder', body: 'Persona body', path: '/facets/persona/coder.md' },
      knowledge: [],
      instructions: [],
      outputContracts: [{ ref: 'review-report', body: 'Output contract body', path: '/facets/output-contracts/review-report.md' }],
      policies: [{ ref: 'coding', body: 'Policy body', path: '/facets/policies/coding.md' }],
    });

    expect(rendered).toContain('## Output Contracts');
    expect(rendered).toContain('### review-report');
    expect(rendered).toContain('/facets/output-contracts/review-report.md');
    expect(rendered).not.toContain('Output contract body');
    expect(rendered.indexOf('## Output Contracts')).toBeLessThan(rendered.indexOf('## Policies'));
  });

  it('should fail fast for scope references when repertoire roots are unavailable', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'facet-renderer-'));
    const facetsRoot = join(rootDir, 'facets');
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'Persona body.', 'utf-8');

    expect(() =>
      resolveDefinitionSections({
        definition: {
          name: 'coding',
          persona: 'coder',
          outputContracts: ['@acme/report-pack/review-report'],
        },
        definitionDir: rootDir,
        facetsRoots: [facetsRoot],
      }),
    ).toThrow('scope reference requires repertoire roots');
    rmSync(rootDir, { recursive: true, force: true });
  });
});
