import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensurePathAncestorsContainNoSymbolicLinks,
  ensurePathWithinHome,
  ensurePathWithinRoots,
  isWithinRoot,
} from '../cli/path-guard.js';

describe('path guard', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should reject paths outside home directory', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'path-guard-home-'));
    tempDirs.push(homeDir);

    const outsidePath = join(tmpdir(), 'outside-skill.md');
    expect(() => ensurePathWithinHome(outsidePath, homeDir, 'Skill output path')).toThrow(
      `Skill output path must be inside home directory: ${outsidePath}`,
    );
  });

  it('should reject symlink paths in allowed roots check', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'path-guard-root-'));
    tempDirs.push(rootDir);

    const targetPath = join(rootDir, 'target.md');
    const symlinkPath = join(rootDir, 'link.md');
    writeFileSync(targetPath, 'content', 'utf-8');
    symlinkSync(targetPath, symlinkPath);

    expect(() => ensurePathWithinRoots(symlinkPath, [rootDir], 'facet file')).toThrow(
      `Symbolic links are not allowed for facet file: ${symlinkPath}`,
    );
  });

  it('should match exact root and descendants only', () => {
    const root = '/tmp/root';

    expect(isWithinRoot('/tmp/root', root)).toBe(true);
    expect(isWithinRoot('/tmp/root/child', root)).toBe(true);
    expect(isWithinRoot('/tmp/root-sibling', root)).toBe(false);
  });

  it('should reject paths with symbolic link ancestors', () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'path-guard-symlink-'));
    tempDirs.push(baseDir);

    const realDir = join(baseDir, 'real');
    const linkDir = join(baseDir, 'link');
    mkdirSync(realDir, { recursive: true });
    symlinkSync(realDir, linkDir);

    expect(() => ensurePathAncestorsContainNoSymbolicLinks(join(linkDir, 'nested'), 'Output directory', baseDir)).toThrow(
      `Symbolic links are not allowed in Output directory path: ${linkDir}`,
    );
  });
});
