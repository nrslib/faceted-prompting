import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isResourcePath,
  resolveFacetPath,
  resolveFacetByName,
  resolveResourcePath,
  resolveResourceContent,
  resolveRefToContent,
  resolveRefList,
  resolveSectionMap,
  extractPersonaDisplayName,
} from '../index.js';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('isResourcePath', () => {
  it('should return true for relative path with ./', () => {
    expect(isResourcePath('./file.md')).toBe(true);
  });

  it('should return true for parent-relative path', () => {
    expect(isResourcePath('../file.md')).toBe(true);
  });

  it('should return true for absolute path', () => {
    expect(isResourcePath('/absolute/path.md')).toBe(true);
  });

  it('should return true for home-relative path', () => {
    expect(isResourcePath('~/file.md')).toBe(true);
  });

  it('should return true for .md extension', () => {
    expect(isResourcePath('some-file.md')).toBe(true);
  });

  it('should return false for a plain facet name', () => {
    expect(isResourcePath('coding')).toBe(false);
  });
});

describe('resolveFacetPath', () => {
  it('should return the first existing file path', () => {
    mockExistsSync.mockImplementation((p) => p === '/dir1/coding.md');
    expect(resolveFacetPath('coding', ['/dir1', '/dir2'])).toBe('/dir1/coding.md');
  });

  it('should skip non-existing and find in later dirs', () => {
    mockExistsSync.mockImplementation((p) => p === '/dir2/coding.md');
    expect(resolveFacetPath('coding', ['/dir1', '/dir2'])).toBe('/dir2/coding.md');
  });

  it('should return undefined when not found', () => {
    mockExistsSync.mockReturnValue(false);
    expect(resolveFacetPath('missing', ['/dir1'])).toBeUndefined();
  });

  it('should return undefined for empty candidate list', () => {
    expect(resolveFacetPath('anything', [])).toBeUndefined();
  });
});

describe('resolveFacetByName', () => {
  it('should return file content when facet exists', () => {
    mockExistsSync.mockImplementation((p) => p === '/dir/coder.md');
    mockReadFileSync.mockReturnValue('You are a coder.');
    expect(resolveFacetByName('coder', ['/dir'])).toBe('You are a coder.');
  });

  it('should return undefined when facet does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(resolveFacetByName('missing', ['/dir'])).toBeUndefined();
  });
});

describe('resolveResourcePath', () => {
  it('should resolve ./ relative to baseDir', () => {
    expect(resolveResourcePath('./policies/coding.md', '/project/pieces')).toBe(
      join('/project/pieces', 'policies/coding.md'),
    );
  });

  it('should return absolute path unchanged', () => {
    expect(resolveResourcePath('/absolute/path.md', '/project')).toBe('/absolute/path.md');
  });

  it('should resolve plain name relative to baseDir', () => {
    expect(resolveResourcePath('coding.md', '/project/pieces')).toBe(
      join('/project/pieces', 'coding.md'),
    );
  });
});

describe('resolveResourceContent', () => {
  it('should read file content for .md spec when file exists', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('file content');
    expect(resolveResourceContent('./policy.md', '/dir')).toBe('file content');
  });

  it('should return spec as-is for .md spec when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(resolveResourceContent('./policy.md', '/dir')).toBe('./policy.md');
  });

  it('should return spec as-is for non-.md spec', () => {
    expect(resolveResourceContent('inline content', '/dir')).toBe('inline content');
  });
});

describe('resolveRefToContent', () => {
  it('should return mapped content when found in resolvedMap', () => {
    expect(resolveRefToContent('coding', { coding: 'mapped content' }, '/dir')).toBe('mapped content');
  });

  it('should resolve resource path when ref is a resource path', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('file content');
    expect(resolveRefToContent('./policy.md', undefined, '/dir')).toBe('file content');
  });

  it('should try facet resolution via candidateDirs when ref is a name', () => {
    mockExistsSync.mockImplementation((p) => p === '/facets/coding.md');
    mockReadFileSync.mockReturnValue('facet content');
    expect(resolveRefToContent('coding', undefined, '/dir', ['/facets'])).toBe('facet content');
  });
});

describe('resolveRefList', () => {
  it('should return undefined for undefined refs', () => {
    expect(resolveRefList(undefined, undefined, '/dir')).toBeUndefined();
  });

  it('should handle single string ref', () => {
    expect(resolveRefList('inline', { inline: 'content' }, '/dir')).toEqual(['content']);
  });

  it('should handle array of refs', () => {
    expect(resolveRefList(['a', 'b'], { a: 'content A', b: 'content B' }, '/dir')).toEqual(['content A', 'content B']);
  });
});

describe('resolveSectionMap', () => {
  it('should return undefined for undefined input', () => {
    expect(resolveSectionMap(undefined, '/dir')).toBeUndefined();
  });

  it('should resolve each entry in the map', () => {
    expect(resolveSectionMap({ key1: 'inline value', key2: 'another value' }, '/dir')).toEqual({
      key1: 'inline value',
      key2: 'another value',
    });
  });
});

describe('extractPersonaDisplayName', () => {
  it('should extract name from .md path', () => {
    expect(extractPersonaDisplayName('coder.md')).toBe('coder');
  });

  it('should extract name from full path', () => {
    expect(extractPersonaDisplayName('/path/to/architect.md')).toBe('architect');
  });

  it('should return name unchanged if no .md extension', () => {
    expect(extractPersonaDisplayName('coder')).toBe('coder');
  });
});
