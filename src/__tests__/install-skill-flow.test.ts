import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectDirectoryFiles, copyDirectoryTree, ensureRegenerationTargetDir } from '../cli/install-skill/flow.js';

describe('collectDirectoryFiles', () => {
  it('should collect nested files as relative paths', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-flow-'));

    try {
      mkdirSync(join(workspaceDir, 'a', 'b'), { recursive: true });
      writeFileSync(join(workspaceDir, 'root.md'), 'root', 'utf-8');
      writeFileSync(join(workspaceDir, 'a', 'child.md'), 'child', 'utf-8');
      writeFileSync(join(workspaceDir, 'a', 'b', 'deep.md'), 'deep', 'utf-8');

      const files = collectDirectoryFiles(workspaceDir).sort();

      expect(files).toEqual([
        'a/b/deep.md',
        'a/child.md',
        'root.md',
      ]);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should skip symbolic links', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-flow-'));

    try {
      const realFilePath = join(workspaceDir, 'real.md');
      const symlinkPath = join(workspaceDir, 'linked.md');
      writeFileSync(realFilePath, 'real', 'utf-8');
      symlinkSync(realFilePath, symlinkPath);

      const files = collectDirectoryFiles(workspaceDir);

      expect(files).toEqual(['real.md']);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should return an empty array when directory has no files', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-flow-'));

    try {
      mkdirSync(join(workspaceDir, 'empty', 'nested'), { recursive: true });

      const files = collectDirectoryFiles(workspaceDir);

      expect(files).toEqual([]);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });
});

describe('copyDirectoryTree', () => {
  it('should reject writing when destination file is a symbolic link', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-flow-'));

    try {
      const sourceDir = join(workspaceDir, 'source');
      const outputDir = join(workspaceDir, 'output');
      const sourceFilePath = join(sourceDir, 'prompt.yaml');
      const outsideTargetPath = join(workspaceDir, 'outside-target.yaml');
      const outputSymlinkPath = join(outputDir, 'prompt.yaml');
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(sourceFilePath, 'template', 'utf-8');
      writeFileSync(outsideTargetPath, 'outside', 'utf-8');
      symlinkSync(outsideTargetPath, outputSymlinkPath);

      expect(() => copyDirectoryTree(sourceDir, outputDir)).toThrow(
        `Symbolic links are not allowed for output file: ${outputSymlinkPath}`,
      );
      expect(readFileSync(outsideTargetPath, 'utf-8')).toBe('outside');
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should clean temporary files when destination file is a symbolic link', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-flow-'));

    try {
      const sourceDir = join(workspaceDir, 'source');
      const outputDir = join(workspaceDir, 'output');
      const outsideTargetPath = join(workspaceDir, 'outside-target.yaml');
      const outputSymlinkPath = join(outputDir, 'prompt.yaml');
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(sourceDir, 'prompt.yaml'), 'template', 'utf-8');
      writeFileSync(outsideTargetPath, 'outside', 'utf-8');
      symlinkSync(outsideTargetPath, outputSymlinkPath);

      expect(() => copyDirectoryTree(sourceDir, outputDir)).toThrow();

      const tempFiles = readdirSync(outputDir).filter(name => name.includes('.prompt.yaml.') && name.endsWith('.tmp'));
      expect(tempFiles).toEqual([]);
      expect(readFileSync(outsideTargetPath, 'utf-8')).toBe('outside');
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should reject writing when destination parent path is a symbolic link', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-flow-'));

    try {
      const sourceDir = join(workspaceDir, 'source');
      const outputDir = join(workspaceDir, 'output');
      const outsideDir = join(workspaceDir, 'outside');
      const sourceNestedDir = join(sourceDir, 'nested');
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });
      mkdirSync(outsideDir, { recursive: true });
      mkdirSync(sourceNestedDir, { recursive: true });
      writeFileSync(join(sourceNestedDir, 'prompt.yaml'), 'template', 'utf-8');
      symlinkSync(outsideDir, join(outputDir, 'nested'));

      expect(() => copyDirectoryTree(sourceDir, outputDir)).toThrow(
        `Symbolic links are not allowed in Output directory path: ${join(outputDir, 'nested')}`,
      );
      expect(readFileSync(join(sourceNestedDir, 'prompt.yaml'), 'utf-8')).toBe('template');
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should overwrite existing files without leaving temporary files', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-flow-'));

    try {
      const sourceDir = join(workspaceDir, 'source');
      const outputDir = join(workspaceDir, 'output');
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(sourceDir, 'prompt.yaml'), 'template', 'utf-8');
      writeFileSync(join(outputDir, 'prompt.yaml'), 'old', 'utf-8');

      copyDirectoryTree(sourceDir, outputDir);

      expect(readFileSync(join(outputDir, 'prompt.yaml'), 'utf-8')).toBe('template');
      const tempFiles = readdirSync(outputDir).filter(name => name.startsWith('.prompt.yaml.') && name.endsWith('.tmp'));
      expect(tempFiles).toEqual([]);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });
});

describe('ensureRegenerationTargetDir', () => {
  it('should reject symlink target directory even when target is outside cwd', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-flow-'));
    const outsideBaseDir = mkdtempSync(join(tmpdir(), 'facet-flow-outside-'));

    try {
      const realTargetDir = join(outsideBaseDir, 'real');
      const targetDirSymlink = join(outsideBaseDir, 'target-link');
      mkdirSync(realTargetDir, { recursive: true });
      symlinkSync(realTargetDir, targetDirSymlink);

      await expect(ensureRegenerationTargetDir({
        targetDir: targetDirSymlink,
        options: {
          cwd: workspaceDir,
          input: async () => 'n',
          select: async () => '',
        },
        promptLabel: 'Target directory',
      })).rejects.toThrow(`Symbolic links are not allowed for Target directory: ${targetDirSymlink}`);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
      rmSync(outsideBaseDir, { recursive: true, force: true });
    }
  });

  it('should reject symlink ancestor for missing target directory outside cwd', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-flow-'));
    const outsideBaseDir = mkdtempSync(join(tmpdir(), 'facet-flow-outside-'));

    try {
      const realRootDir = join(outsideBaseDir, 'real-root');
      const linkedRootDir = join(outsideBaseDir, 'linked-root');
      const nestedTargetDir = join(linkedRootDir, 'nested-target');
      mkdirSync(realRootDir, { recursive: true });
      symlinkSync(realRootDir, linkedRootDir);

      await expect(ensureRegenerationTargetDir({
        targetDir: nestedTargetDir,
        options: {
          cwd: workspaceDir,
          input: async () => 'n',
          select: async () => '',
        },
        promptLabel: 'Target directory',
      })).rejects.toThrow(`Symbolic links are not allowed in Target directory path: ${linkedRootDir}`);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
      rmSync(outsideBaseDir, { recursive: true, force: true });
    }
  });
});
