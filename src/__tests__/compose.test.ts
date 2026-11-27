/**
 * Unit tests for faceted-prompting compose module.
 */

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
      instructions: [{ body: 'Implement feature X.' }],
    };

    const result = compose(facets, defaultOptions);

    expect(result.systemPrompt).toBe('');
    expect(result.userMessage).toBe('Implement feature X.');
  });

  it('should compose every instruction from the instructions array', () => {
    const facets: FacetSet = {
      instructions: [
        { body: 'Review the plan.' },
        { body: 'Implement the change.' },
      ],
    };

    const result = compose(facets, defaultOptions);

    expect(result.userMessage).toBe('Review the plan.\n\nImplement the change.');
  });

  it('should place policy in userMessage', () => {
    const facets: FacetSet = {
      policies: [{ body: 'Follow clean code principles.' }],
    };

    const result = compose(facets, defaultOptions);

    expect(result.systemPrompt).toBe('');
    expect(result.userMessage).toBe('Follow clean code principles.');
  });

  it('should place knowledge in userMessage', () => {
    const facets: FacetSet = {
      knowledge: [{ body: 'Architecture documentation.' }],
    };

    const result = compose(facets, defaultOptions);

    expect(result.systemPrompt).toBe('');
    expect(result.userMessage).toBe('Architecture documentation.');
  });

  it('should place output contracts in userMessage', () => {
    const facets: FacetSet = {
      outputContracts: [{ body: 'Return a markdown report.' }],
    };

    const result = compose(facets, defaultOptions);

    expect(result.systemPrompt).toBe('');
    expect(result.userMessage).toBe('Return a markdown report.');
  });

  it('should compose all facets in correct order: knowledge, instructions, output contracts, policies', () => {
    const facets: FacetSet = {
      persona: { body: 'You are a coder.' },
      policies: [{ body: 'POLICY' }],
      knowledge: [{ body: 'KNOWLEDGE' }],
      instructions: [{ body: 'INSTRUCTION' }],
      outputContracts: [{ body: 'OUTPUT CONTRACT' }],
    };

    const result = compose(facets, defaultOptions);

    expect(result.systemPrompt).toBe('You are a coder.');

    const policyIdx = result.userMessage.indexOf('POLICY');
    const knowledgeIdx = result.userMessage.indexOf('KNOWLEDGE');
    const instructionIdx = result.userMessage.indexOf('INSTRUCTION');
    const outputContractIdx = result.userMessage.indexOf('OUTPUT CONTRACT');

    expect(knowledgeIdx).toBeLessThan(instructionIdx);
    expect(instructionIdx).toBeLessThan(outputContractIdx);
    expect(outputContractIdx).toBeLessThan(policyIdx);
  });

  it('should honor userMessageOrder when provided', () => {
    const facets: FacetSet = {
      policies: [{ body: 'POLICY' }],
      knowledge: [{ body: 'KNOWLEDGE' }],
      instructions: [{ body: 'INSTRUCTION' }],
      outputContracts: [{ body: 'OUTPUT CONTRACT' }],
    };

    const result = compose(facets, {
      contextMaxChars: 2000,
      userMessageOrder: ['output-contracts', 'knowledge', 'policies', 'instructions'],
    });

    const outputContractIdx = result.userMessage.indexOf('OUTPUT CONTRACT');
    const knowledgeIdx = result.userMessage.indexOf('KNOWLEDGE');
    const policyIdx = result.userMessage.indexOf('POLICY');
    const instructionIdx = result.userMessage.indexOf('INSTRUCTION');

    expect(outputContractIdx).toBeLessThan(knowledgeIdx);
    expect(knowledgeIdx).toBeLessThan(policyIdx);
    expect(policyIdx).toBeLessThan(instructionIdx);
  });

  it('should join multiple policies with separator', () => {
    const facets: FacetSet = {
      policies: [
        { body: 'Policy A' },
        { body: 'Policy B' },
      ],
    };

    const result = compose(facets, defaultOptions);

    expect(result.userMessage).toContain('Policy A');
    expect(result.userMessage).toContain('---');
    expect(result.userMessage).toContain('Policy B');
  });

  it('should join multiple knowledge items with separator', () => {
    const facets: FacetSet = {
      knowledge: [
        { body: 'Knowledge A' },
        { body: 'Knowledge B' },
      ],
    };

    const result = compose(facets, defaultOptions);

    expect(result.userMessage).toContain('Knowledge A');
    expect(result.userMessage).toContain('---');
    expect(result.userMessage).toContain('Knowledge B');
  });

  it('should truncate policy content exceeding contextMaxChars', () => {
    const longPolicy = 'x'.repeat(3000);
    const facets: FacetSet = {
      policies: [{ body: longPolicy, sourcePath: '/path/policy.md' }],
    };

    const result = compose(facets, { contextMaxChars: 2000 });

    expect(result.userMessage).toBe(`${longPolicy.slice(0, 2000)}\n...TRUNCATED...\n\nPolicy Source: /path/policy.md`);
  });

  it('should truncate knowledge content exceeding contextMaxChars', () => {
    const longKnowledge = 'y'.repeat(3000);
    const facets: FacetSet = {
      knowledge: [{ body: longKnowledge, sourcePath: '/path/knowledge.md' }],
    };

    const result = compose(facets, { contextMaxChars: 2000 });

    expect(result.userMessage).toBe(`${longKnowledge.slice(0, 2000)}\n...TRUNCATED...\n\nKnowledge Source: /path/knowledge.md`);
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

    expect(result.userMessage).toBe('Policy text\n\nPolicy Source: /policies/coding.md');
  });

  it('should include source path for single knowledge', () => {
    const facets: FacetSet = {
      knowledge: [{ body: 'Knowledge text', sourcePath: '/knowledge/arch.md' }],
    };

    const result = compose(facets, defaultOptions);

    expect(result.userMessage).toBe('Knowledge text\n\nKnowledge Source: /knowledge/arch.md');
  });

  it('should omit generated source paths while retaining source lines in the facet body', () => {
    const policy = 'Knowledge Source: example-knowledge.md\nPolicy Source: example-policy.md';
    const knowledge = 'Architecture reference. '.repeat(5);
    const contextMaxChars = policy.length;
    const facets: FacetSet = {
      knowledge: [{ body: knowledge, sourcePath: '/knowledge/arch.md' }],
      policies: [{ body: policy, sourcePath: '/policies/coding.md' }],
    };

    const result = compose(facets, {
      contextMaxChars,
      includeSourcePaths: false,
      userMessageOrder: ['policies', 'knowledge'],
    });

    expect(result.userMessage).toBe(`${policy}\n\n${knowledge.slice(0, contextMaxChars)}\n...TRUNCATED...`);
  });
});
