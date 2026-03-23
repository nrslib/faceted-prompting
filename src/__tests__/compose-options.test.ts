import { describe, expect, it } from 'vitest';
import {
  isNonInteractiveMode,
  parseComposeOptions,
} from '../cli/compose-options.js';

describe('parseComposeOptions', () => {
  it('should parse combined mode options for non-interactive compose', () => {
    const options = parseComposeOptions([
      '--composition',
      'coding',
      '--combined',
      '--output',
      './out',
      '--overwrite',
    ]);

    expect(options).toEqual({
      composition: 'coding',
      outputMode: 'combined',
      output: './out',
      overwrite: true,
    });
  });

  it('should parse split mode without optional output flags', () => {
    const options = parseComposeOptions([
      '--composition',
      'coding',
      '--split',
    ]);

    expect(options).toEqual({
      composition: 'coding',
      outputMode: 'split',
    });
  });

  it('should reject unknown compose options', () => {
    expect(() => parseComposeOptions(['--unknown'])).toThrow(
      'Unsupported compose option: --unknown',
    );
  });

  it('should reject missing values for valued options', () => {
    expect(() => parseComposeOptions(['--composition'])).toThrow(
      'Missing value for --composition',
    );
    expect(() => parseComposeOptions(['--output'])).toThrow(
      'Missing value for --output',
    );
  });

  it('should reject conflicting split and combined flags', () => {
    expect(() =>
      parseComposeOptions([
        '--composition',
        'coding',
        '--split',
        '--combined',
      ]),
    ).toThrow('Cannot specify both --split and --combined');
  });
});

describe('isNonInteractiveMode', () => {
  it('should return true when a composition is explicitly provided', () => {
    expect(isNonInteractiveMode({ composition: 'coding' })).toBe(true);
  });

  it('should return true when split mode is explicitly provided', () => {
    expect(isNonInteractiveMode({ outputMode: 'split' })).toBe(true);
  });

  it('should return true when combined mode is explicitly provided', () => {
    expect(isNonInteractiveMode({ outputMode: 'combined' })).toBe(true);
  });

  it('should return true when overwrite is explicitly provided', () => {
    expect(isNonInteractiveMode({ overwrite: true })).toBe(true);
  });

  it('should return false when no compose options are provided', () => {
    expect(isNonInteractiveMode({})).toBe(false);
  });
});
