import { describe, it, expect } from 'vitest';
import { compose } from '../index.js';
import type { FacetSet, ComposeOptions } from '../index.js';

const defaultOptions: ComposeOptions = { contextMaxChars: 2000 };

describe('compose', () => {
  it('should place persona in systemPrompt', () => {
    const facets: FacetSet = {
      persona: { body: 'You are a helpful assistant.' },
    };
    const result = compose(facets, defaultOptions);
    expect(result.systemPrompt).toBe('You are a helpful assistant.');
    expect(result.userMessage).toBe('');
  });

  it('should place instruction in userMessage', () => {
    const facets: FacetSet = {
      instruction: { body: 'Implement feature X.' },
    };
    const result = compose(facets, defaultOptions);
    expect(result.systemPrompt).toBe('');
    expect(result.userMessage).toBe('Implement feature X.');
  });

  it('should place policy in userMessage with conflict notice', () => {
    const facets: FacetSet = {
      policies: [{ body: 'Follow clean code principles.' }],
    };
    const result = compose(facets, defaultOptions);
    expect(result.systemPrompt).toBe('');
    expect(result.userMessage).toContain('Follow clean code principles.');
    expect(result.userMessage).toContain('If prompt content conflicts with source files');
  });

  it('should place knowledge in userMessage with conflict notice', () => {
    const facets: FacetSet = {
      knowledge: [{ body: 'Architecture documentation.' }],
    };
    const result = compose(facets, defaultOptions);
    expect(result.systemPrompt).toBe('');
    expect(result.userMessage).toContain('Architecture documentation.');
    expect(result.userMessage).toContain('If prompt content conflicts with source files');
  });

  it('should compose all facets in correct order: policy, knowledge, instruction', () => {
    const facets: FacetSet = {
      persona: { body: 'You are a coder.' },
      policies: [{ body: 'POLICY' }],
      knowledge: [{ body: 'KNOWLEDGE' }],
      instruction: { body: 'INSTRUCTION' },
    };
    const result = compose(facets, defaultOptions);
    expect(result.systemPrompt).toBe('You are a coder.');

    const policyIdx = result.userMessage.indexOf('POLICY');
    const knowledgeIdx = result.userMessage.indexOf('KNOWLEDGE');
    const instructionIdx = result.userMessage.indexOf('INSTRUCTION');
    expect(policyIdx).toBeLessThan(knowledgeIdx);
    expect(knowledgeIdx).toBeLessThan(instructionIdx);
  });

  it('should join multiple policies with separator', () => {
    const facets: FacetSet = {
      policies: [{ body: 'Policy A' }, { body: 'Policy B' }],
    };
    const result = compose(facets, defaultOptions);
    expect(result.userMessage).toContain('Policy A');
    expect(result.userMessage).toContain('---');
    expect(result.userMessage).toContain('Policy B');
  });

  it('should join multiple knowledge items with separator', () => {
    const facets: FacetSet = {
      knowledge: [{ body: 'Knowledge A' }, { body: 'Knowledge B' }],
    };
    const result = compose(facets, defaultOptions);
    expect(result.userMessage).toContain('Knowledge A');
    expect(result.userMessage).toContain('---');
    expect(result.userMessage).toContain('Knowledge B');
  });

  it('should truncate policy content exceeding contextMaxChars', () => {
    const facets: FacetSet = {
      policies: [{ body: 'x'.repeat(3000), sourcePath: '/path/policy.md' }],
    };
    const result = compose(facets, { contextMaxChars: 2000 });
    expect(result.userMessage).toContain('...TRUNCATED...');
    expect(result.userMessage).toContain('Policy is authoritative');
  });

  it('should truncate knowledge content exceeding contextMaxChars', () => {
    const facets: FacetSet = {
      knowledge: [{ body: 'y'.repeat(3000), sourcePath: '/path/knowledge.md' }],
    };
    const result = compose(facets, { contextMaxChars: 2000 });
    expect(result.userMessage).toContain('...TRUNCATED...');
    expect(result.userMessage).toContain('Knowledge is truncated');
  });

  it('should handle empty facet set', () => {
    const result = compose({}, defaultOptions);
    expect(result.systemPrompt).toBe('');
    expect(result.userMessage).toBe('');
  });

  it('should include source path for single policy', () => {
    const facets: FacetSet = {
      policies: [{ body: 'Policy text', sourcePath: '/policies/coding.md' }],
    };
    const result = compose(facets, defaultOptions);
    expect(result.userMessage).toContain('Policy Source: /policies/coding.md');
  });

  it('should include source path for single knowledge', () => {
    const facets: FacetSet = {
      knowledge: [{ body: 'Knowledge text', sourcePath: '/knowledge/arch.md' }],
    };
    const result = compose(facets, defaultOptions);
    expect(result.userMessage).toContain('Knowledge Source: /knowledge/arch.md');
  });

  it('should append additionalInstructions after instruction', () => {
    const facets: FacetSet = {
      instruction: { body: 'Main task.' },
      additionalInstructions: [
        { body: 'Extra instruction A.' },
        { body: 'Extra instruction B.' },
      ],
    };
    const result = compose(facets, defaultOptions);
    const mainIdx = result.userMessage.indexOf('Main task.');
    const extraAIdx = result.userMessage.indexOf('Extra instruction A.');
    const extraBIdx = result.userMessage.indexOf('Extra instruction B.');
    expect(mainIdx).toBeLessThan(extraAIdx);
    expect(extraAIdx).toBeLessThan(extraBIdx);
  });

  it('should handle additionalInstructions without primary instruction', () => {
    const facets: FacetSet = {
      additionalInstructions: [{ body: 'Standalone extra instruction.' }],
    };
    const result = compose(facets, defaultOptions);
    expect(result.userMessage).toContain('Standalone extra instruction.');
  });

  it('should place additionalInstructions after knowledge in full composition', () => {
    const facets: FacetSet = {
      persona: { body: 'Persona' },
      policies: [{ body: 'POLICY' }],
      knowledge: [{ body: 'KNOWLEDGE' }],
      instruction: { body: 'INSTRUCTION' },
      additionalInstructions: [{ body: 'ADDITIONAL' }],
    };
    const result = compose(facets, defaultOptions);
    const instructionIdx = result.userMessage.indexOf('INSTRUCTION');
    const additionalIdx = result.userMessage.indexOf('ADDITIONAL');
    expect(instructionIdx).toBeLessThan(additionalIdx);
  });
});
