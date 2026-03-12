import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolveOutputDirectory } from '../output/index.js';
import { writeComposeOutput } from '../output/index.js';

describe('resolveOutputDirectory', () => {
  it('should resolve relative input against default directory', () => {
    const defaultDirectory = resolve('/tmp/facet-workspace');
    const resolvedOutputDirectory = resolveOutputDirectory('./out', defaultDirectory);
    expect(resolvedOutputDirectory).toBe(resolve(defaultDirectory, './out'));
  });

  it('should keep absolute input path unchanged', () => {
    const defaultDirectory = resolve('/tmp/facet-workspace');
    const absoluteOutputDirectory = resolve('/tmp/custom-output');
    const resolvedOutputDirectory = resolveOutputDirectory(absoluteOutputDirectory, defaultDirectory);
    expect(resolvedOutputDirectory).toBe(absoluteOutputDirectory);
  });
});

describe('writeComposeOutput', () => {
  it('should reject symlinked output files when overwrite is true', async () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-output-'));
    try {
      const outsidePath = join(workspaceDir, 'outside.md');
      const outputDir = join(workspaceDir, 'out');
      const symlinkPath = join(outputDir, 'result.md');
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(outsidePath, 'outside', 'utf-8');
      symlinkSync(outsidePath, symlinkPath);

      await expect(writeComposeOutput({
        outputDir,
        fileName: 'result.md',
        content: 'updated',
        overwrite: true,
      })).rejects.toThrow('Symbolic links are not allowed for output file');
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });
});
