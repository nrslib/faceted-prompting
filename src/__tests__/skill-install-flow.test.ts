import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  dispatchInstallFlow,
  ensureInstallFlowSelection,
  shouldOverwrite,
  ensureDirectoryExists,
} from '../cli/install-skill/flow.js';
import { applyFacetTokensToPath, parseScanDepth } from '../cli/install-skill/facets.js';
import type { FacetPathMap } from '../cli/install-skill/facets.js';

describe('install skill flow dispatcher', () => {
  it('should dispatch to file placement handler when file placement mode is selected', async () => {
    const result = await dispatchInstallFlow({
      selection: ensureInstallFlowSelection('File placement'),
      onSkillDeploy: async () => 'deploy' as const,
      onFilePlacement: async () => 'placement' as const,
      onTemplateApply: async () => 'template' as const,
    });

    expect(result).toBe('placement');
  });

  it('should dispatch to template apply handler when template apply mode is selected', async () => {
    const result = await dispatchInstallFlow({
      selection: ensureInstallFlowSelection('Template apply'),
      onSkillDeploy: async () => 'deploy' as const,
      onFilePlacement: async () => 'placement' as const,
      onTemplateApply: async () => 'template' as const,
    });

    expect(result).toBe('template');
  });

  it('should dispatch to skill deploy handler when skill deploy mode is selected', async () => {
    const result = await dispatchInstallFlow({
      selection: ensureInstallFlowSelection('Skill deploy'),
      onSkillDeploy: async () => 'deploy' as const,
      onFilePlacement: async () => 'placement' as const,
      onTemplateApply: async () => 'template' as const,
    });

    expect(result).toBe('deploy');
  });

  it('should return the callback result directly without intermediate capture', async () => {
    const expected = { kind: 'path' as const, path: '/output' };

    const result = await dispatchInstallFlow({
      selection: ensureInstallFlowSelection('File placement'),
      onSkillDeploy: async () => ({ kind: 'text' as const, text: 'wrong' }),
      onFilePlacement: async () => expected,
      onTemplateApply: async () => ({ kind: 'text' as const, text: 'wrong' }),
    });

    expect(result).toBe(expected);
  });
});

describe('shouldOverwrite', () => {
  it('should accept "y" as overwrite confirmation', () => {
    expect(shouldOverwrite('y')).toBe(true);
  });

  it('should accept "yes" as overwrite confirmation', () => {
    expect(shouldOverwrite('yes')).toBe(true);
  });

  it('should accept uppercase "Y" as overwrite confirmation', () => {
    expect(shouldOverwrite('Y')).toBe(true);
  });

  it('should accept "YES" with leading/trailing whitespace', () => {
    expect(shouldOverwrite('  YES  ')).toBe(true);
  });

  it('should reject "n" as overwrite cancellation', () => {
    expect(shouldOverwrite('n')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(shouldOverwrite('')).toBe(false);
  });
});

describe('parseScanDepth', () => {
  it('should parse valid positive integer', () => {
    expect(parseScanDepth('3')).toBe(3);
  });

  it('should parse zero', () => {
    expect(parseScanDepth('0')).toBe(0);
  });

  it('should reject negative values', () => {
    expect(() => parseScanDepth('-1')).toThrow('Invalid scan depth: -1');
  });

  it('should reject non-numeric strings', () => {
    expect(() => parseScanDepth('abc')).toThrow('Invalid scan depth: abc');
  });

  it('should reject empty string', () => {
    expect(() => parseScanDepth('')).toThrow('Invalid scan depth: ');
  });
});

describe('ensureDirectoryExists', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should not throw when directory exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ensure-dir-'));
    tempDirs.push(dir);

    expect(() => ensureDirectoryExists(dir, 'Test')).not.toThrow();
  });

  it('should throw when path does not exist', () => {
    expect(() => ensureDirectoryExists('/nonexistent-path-xyz', 'Test')).toThrow(
      'Test does not exist: /nonexistent-path-xyz',
    );
  });

  it('should throw when path is a file instead of directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ensure-dir-'));
    tempDirs.push(dir);
    const filePath = join(dir, 'file.txt');
    writeFileSync(filePath, 'content', 'utf-8');

    expect(() => ensureDirectoryExists(filePath, 'Test')).toThrow('Test does not exist');
  });
});

describe('applyFacetTokensToPath', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createFacetPaths(rootDir: string): FacetPathMap {
    return {
      persona: join(rootDir, 'facets', 'persona', 'coder.md'),
      knowledges: [join(rootDir, 'facets', 'knowledge', 'arch.md')],
      policies: [join(rootDir, 'facets', 'policies', 'coding.md')],
    };
  }

  it('should correctly replace tokens across consecutive calls without lastIndex drift', () => {
    const dir = mkdtempSync(join(tmpdir(), 'regex-safety-'));
    tempDirs.push(dir);

    writeFileSync(join(dir, 'a.md'), 'no tokens here', 'utf-8');
    writeFileSync(join(dir, 'b.md'), 'persona={{facet:persona}}', 'utf-8');
    writeFileSync(join(dir, 'c.md'), 'no tokens here either', 'utf-8');
    writeFileSync(join(dir, 'd.md'), 'policies={{facet:policies}}', 'utf-8');

    const facets = createFacetPaths(dir);

    applyFacetTokensToPath({
      rootDir: dir,
      maxDepth: 0,
      facets,
      excludeDirs: [],
    });

    expect(readFileSync(join(dir, 'b.md'), 'utf-8')).toContain('/facets/persona/coder.md');
    expect(readFileSync(join(dir, 'd.md'), 'utf-8')).toContain('/facets/policies/coding.md');
    expect(readFileSync(join(dir, 'a.md'), 'utf-8')).toBe('no tokens here');
    expect(readFileSync(join(dir, 'c.md'), 'utf-8')).toBe('no tokens here either');
  });

  it('should skip directories listed in excludeDirs at root level', () => {
    const dir = mkdtempSync(join(tmpdir(), 'exclude-dirs-'));
    tempDirs.push(dir);

    mkdirSync(join(dir, 'facets'), { recursive: true });
    writeFileSync(join(dir, 'root.md'), 'persona={{facet:persona}}', 'utf-8');
    writeFileSync(join(dir, 'facets', 'inner.md'), 'persona={{facet:persona}}', 'utf-8');

    const facets = createFacetPaths(dir);

    applyFacetTokensToPath({
      rootDir: dir,
      maxDepth: Number.MAX_SAFE_INTEGER,
      facets,
      excludeDirs: ['facets'],
    });

    expect(readFileSync(join(dir, 'root.md'), 'utf-8')).toContain('/facets/persona/coder.md');
    expect(readFileSync(join(dir, 'facets', 'inner.md'), 'utf-8')).toBe('persona={{facet:persona}}');
  });

  it('should not skip excluded directory name in nested directories', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nested-exclude-'));
    tempDirs.push(dir);

    mkdirSync(join(dir, 'sub', 'facets'), { recursive: true });
    writeFileSync(join(dir, 'sub', 'facets', 'nested.md'), 'persona={{facet:persona}}', 'utf-8');

    const facets = createFacetPaths(dir);

    applyFacetTokensToPath({
      rootDir: dir,
      maxDepth: Number.MAX_SAFE_INTEGER,
      facets,
      excludeDirs: ['facets'],
    });

    expect(readFileSync(join(dir, 'sub', 'facets', 'nested.md'), 'utf-8')).toContain(
      '/facets/persona/coder.md',
    );
  });
});
