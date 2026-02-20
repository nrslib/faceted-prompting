import { describe, it, expect } from 'vitest';
import {
  trimContextContent,
  renderConflictNotice,
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
    const result = trimContextContent('a'.repeat(150), 100);
    expect(result.content).toBe('a'.repeat(100) + '\n...TRUNCATED...');
    expect(result.truncated).toBe(true);
  });

  it('should not truncate content at exact limit', () => {
    const exact = 'b'.repeat(100);
    const result = trimContextContent(exact, 100);
    expect(result.content).toBe(exact);
    expect(result.truncated).toBe(false);
  });
});

describe('renderConflictNotice', () => {
  it('should return the standard conflict notice', () => {
    expect(renderConflictNotice()).toBe('If prompt content conflicts with source files, source files take precedence.');
  });
});

describe('prepareKnowledgeContent', () => {
  it('should append conflict notice without sourcePath', () => {
    const result = prepareKnowledgeContent('knowledge text', 2000);
    expect(result).toContain('knowledge text');
    expect(result).toContain('If prompt content conflicts with source files');
    expect(result).not.toContain('Knowledge Source:');
  });

  it('should append source path when provided', () => {
    const result = prepareKnowledgeContent('knowledge text', 2000, '/path/to/knowledge.md');
    expect(result).toContain('Knowledge Source: /path/to/knowledge.md');
  });

  it('should append truncation notice when truncated with sourcePath', () => {
    const result = prepareKnowledgeContent('x'.repeat(3000), 2000, '/path/to/knowledge.md');
    expect(result).toContain('...TRUNCATED...');
    expect(result).toContain('Knowledge is truncated. You MUST consult the source files before making decisions.');
  });

  it('should not include truncation notice when truncated without sourcePath', () => {
    const result = prepareKnowledgeContent('x'.repeat(3000), 2000);
    expect(result).toContain('...TRUNCATED...');
    expect(result).not.toContain('Knowledge is truncated');
  });
});

describe('preparePolicyContent', () => {
  it('should append conflict notice without sourcePath', () => {
    const result = preparePolicyContent('policy text', 2000);
    expect(result).toContain('policy text');
    expect(result).toContain('If prompt content conflicts with source files');
    expect(result).not.toContain('Policy Source:');
  });

  it('should append source path when provided', () => {
    const result = preparePolicyContent('policy text', 2000, '/path/to/policy.md');
    expect(result).toContain('Policy Source: /path/to/policy.md');
  });

  it('should append authoritative notice when truncated with sourcePath', () => {
    const result = preparePolicyContent('y'.repeat(3000), 2000, '/path/to/policy.md');
    expect(result).toContain('...TRUNCATED...');
    expect(result).toContain('Policy is authoritative. If truncated, you MUST read the full policy file and follow it strictly.');
  });

  it('should not include authoritative notice when truncated without sourcePath', () => {
    const result = preparePolicyContent('y'.repeat(3000), 2000);
    expect(result).toContain('...TRUNCATED...');
    expect(result).not.toContain('Policy is authoritative');
  });
});
