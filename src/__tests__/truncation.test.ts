/**
 * Unit tests for faceted-prompting truncation module.
 */

import { describe, it, expect } from 'vitest';
import {
  trimContextContent,
  prepareKnowledgeContent,
  preparePolicyContent,
} from '../index.js';

describe('trimContextContent', () => {
  it('should return content unchanged when under limit', () => {
    const result = trimContextContent('short content', 100);
    expect(result.content).toBe('short content');
    expect(result.truncated).toBe(false);
  });

  it('should truncate content exceeding limit', () => {
    const longContent = 'a'.repeat(150);
    const result = trimContextContent(longContent, 100);
    expect(result.content).toBe('a'.repeat(100) + '\n...TRUNCATED...');
    expect(result.truncated).toBe(true);
  });

  it('should not truncate content at exact limit', () => {
    const exactContent = 'b'.repeat(100);
    const result = trimContextContent(exactContent, 100);
    expect(result.content).toBe(exactContent);
    expect(result.truncated).toBe(false);
  });
});

describe('prepareKnowledgeContent', () => {
  it('should return the original content without sourcePath', () => {
    const result = prepareKnowledgeContent('knowledge text', 2000);
    expect(result).toBe('knowledge text');
  });

  it('should append source path when provided', () => {
    const result = prepareKnowledgeContent('knowledge text', 2000, '/path/to/knowledge.md');
    expect(result).toBe('knowledge text\n\nKnowledge Source: /path/to/knowledge.md');
  });

  it('should append the truncation marker and source path', () => {
    const longContent = 'x'.repeat(3000);
    const result = prepareKnowledgeContent(longContent, 2000, '/path/to/knowledge.md');
    expect(result).toBe(`${longContent.slice(0, 2000)}\n...TRUNCATED...\n\nKnowledge Source: /path/to/knowledge.md`);
  });

  it('should append only the truncation marker without sourcePath', () => {
    const longContent = 'x'.repeat(3000);
    const result = prepareKnowledgeContent(longContent, 2000);
    expect(result).toBe(`${longContent.slice(0, 2000)}\n...TRUNCATED...`);
  });
});

describe('preparePolicyContent', () => {
  it('should return the original content without sourcePath', () => {
    const result = preparePolicyContent('policy text', 2000);
    expect(result).toBe('policy text');
  });

  it('should append source path when provided', () => {
    const result = preparePolicyContent('policy text', 2000, '/path/to/policy.md');
    expect(result).toBe('policy text\n\nPolicy Source: /path/to/policy.md');
  });

  it('should append the truncation marker and source path', () => {
    const longContent = 'y'.repeat(3000);
    const result = preparePolicyContent(longContent, 2000, '/path/to/policy.md');
    expect(result).toBe(`${longContent.slice(0, 2000)}\n...TRUNCATED...\n\nPolicy Source: /path/to/policy.md`);
  });

  it('should append only the truncation marker without sourcePath', () => {
    const longContent = 'y'.repeat(3000);
    const result = preparePolicyContent(longContent, 2000);
    expect(result).toBe(`${longContent.slice(0, 2000)}\n...TRUNCATED...`);
  });
});
