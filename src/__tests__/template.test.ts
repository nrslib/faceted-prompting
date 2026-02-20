import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../index.js';
import { processConditionals, substituteVariables } from '../template.js';

describe('processConditionals', () => {
  it('should include truthy block content', () => {
    expect(processConditionals('{{#if showGreeting}}Hello!{{/if}}', { showGreeting: true })).toBe('Hello!');
  });

  it('should exclude falsy block content', () => {
    expect(processConditionals('{{#if showGreeting}}Hello!{{/if}}', { showGreeting: false })).toBe('');
  });

  it('should handle else branch when truthy', () => {
    expect(processConditionals('{{#if isAdmin}}Admin panel{{else}}User panel{{/if}}', { isAdmin: true })).toBe('Admin panel');
  });

  it('should handle else branch when falsy', () => {
    expect(processConditionals('{{#if isAdmin}}Admin panel{{else}}User panel{{/if}}', { isAdmin: false })).toBe('User panel');
  });

  it('should treat non-empty string as truthy', () => {
    expect(processConditionals('{{#if name}}Name: provided{{/if}}', { name: 'Alice' })).toBe('Name: provided');
  });

  it('should treat empty string as falsy', () => {
    expect(processConditionals('{{#if name}}Name: provided{{/if}}', { name: '' })).toBe('');
  });

  it('should treat undefined variable as falsy', () => {
    expect(processConditionals('{{#if missing}}exists{{else}}missing{{/if}}', {})).toBe('missing');
  });

  it('should handle multiline content in blocks', () => {
    expect(processConditionals('{{#if hasContent}}line1\nline2\nline3{{/if}}', { hasContent: true })).toBe('line1\nline2\nline3');
  });
});

describe('substituteVariables', () => {
  it('should replace variable with string value', () => {
    expect(substituteVariables('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('should replace true with string "true"', () => {
    expect(substituteVariables('Value: {{flag}}', { flag: true })).toBe('Value: true');
  });

  it('should replace false with empty string', () => {
    expect(substituteVariables('Value: {{flag}}', { flag: false })).toBe('Value: ');
  });

  it('should replace undefined variable with empty string', () => {
    expect(substituteVariables('Value: {{missing}}', {})).toBe('Value: ');
  });

  it('should handle multiple variables', () => {
    expect(substituteVariables('{{greeting}} {{name}}!', { greeting: 'Hello', name: 'World' })).toBe('Hello World!');
  });
});

describe('renderTemplate', () => {
  it('should process conditionals and then substitute variables', () => {
    expect(renderTemplate('{{#if hasName}}Name: {{name}}{{else}}Anonymous{{/if}}', { hasName: true, name: 'Alice' })).toBe('Name: Alice');
  });

  it('should handle template with no conditionals', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('should handle template with no variables', () => {
    expect(renderTemplate('Static text', {})).toBe('Static text');
  });
});
