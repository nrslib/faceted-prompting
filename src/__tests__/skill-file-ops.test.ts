import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeSkillFile } from '../cli/skill-file-ops.js';

describe('skill file operations module surface', () => {
  it('should expose only the write operation for skill output files', async () => {
    const modulePath = pathToFileURL(resolve('src/cli/skill-file-ops.ts')).href;
    const skillFileOps = await import(modulePath) as Record<string, unknown>;

    expect(skillFileOps.writeSkillFile).toBeTypeOf('function');
    expect(skillFileOps).not.toHaveProperty('removeSkillFile');
  });
});

describe('writeSkillFile', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('should write a skill file inside an allowed external root', () => {
    const allowedRoot = mkdtempSync(join(tmpdir(), 'skill-file-ops-root-'));
    tempDirs.push(allowedRoot);

    const outputPath = join(allowedRoot, 'team', 'coding', 'SKILL.md');
    writeSkillFile(outputPath, '# skill\n', [allowedRoot]);

    expect(readFileSync(outputPath, 'utf-8')).toBe('# skill\n');
  });

  it('should reject a skill output path whose parent ancestor is a symbolic link', () => {
    const allowedRoot = mkdtempSync(join(tmpdir(), 'skill-file-ops-root-'));
    tempDirs.push(allowedRoot);

    const realDir = join(allowedRoot, 'real');
    const linkedDir = join(allowedRoot, 'linked');
    mkdirSync(realDir, { recursive: true });
    symlinkSync(realDir, linkedDir);

    expect(() => writeSkillFile(join(linkedDir, 'coding', 'SKILL.md'), '# skill\n', [allowedRoot])).toThrow(
      `Symbolic links are not allowed in Skill output path path: ${linkedDir}`,
    );
  });

  it('should reject a skill output path whose existing ancestor resolves outside the allowed root', async () => {
    const allowedRoot = mkdtempSync(join(tmpdir(), 'skill-file-ops-root-'));
    const escapedRealPath = mkdtempSync(join(tmpdir(), 'skill-file-ops-outside-'));
    tempDirs.push(allowedRoot, escapedRealPath);

    const existingAncestor = join(allowedRoot, 'team');
    const outputPath = join(existingAncestor, 'coding', 'SKILL.md');
    mkdirSync(existingAncestor, { recursive: true });

    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        realpathSync: vi.fn((path: Parameters<typeof actual.realpathSync>[0]) => {
          if (path === existingAncestor) {
            return escapedRealPath;
          }
          return actual.realpathSync(path);
        }),
      };
    });

    const { ensurePathAncestorsAndRealPathWithinAllowedRoots } = await import('../cli/path-guard.js');

    expect(() =>
      ensurePathAncestorsAndRealPathWithinAllowedRoots(outputPath, [allowedRoot], 'Skill output path')).toThrow(
      `Skill output path must resolve inside allowed roots: ${outputPath}`,
    );
  });
});
