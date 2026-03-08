import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { removeSkillFile, writeSkillFile } from '../cli/skill-file-ops.js';
import { writeSkillsRegistry } from '../cli/skill-registry.js';

describe('skill file safety', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should replace skill file atomically without leaving temp files', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'skill-file-home-'));
    tempDirs.push(homeDir);

    const outputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, 'old', 'utf-8');
    const oldInode = statSync(outputPath).ino;

    writeSkillFile(outputPath, 'new content', homeDir);

    expect(readFileSync(outputPath, 'utf-8')).toBe('new content');
    expect(statSync(outputPath).ino).not.toBe(oldInode);

    const parentEntries = readdirSync(dirname(outputPath));
    expect(parentEntries.filter(entry => entry.includes('.tmp'))).toHaveLength(0);
  });

  it('should replace skills.yaml atomically without leaving temp files', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'skill-registry-home-'));
    tempDirs.push(homeDir);

    const skillsPath = join(homeDir, '.faceted', 'skills.yaml');
    mkdirSync(dirname(skillsPath), { recursive: true });
    writeFileSync(skillsPath, 'cc:\n  old:\n    source: old.yaml\n    mode: inline\n    output: old\n', 'utf-8');
    const oldInode = statSync(skillsPath).ino;

    writeSkillsRegistry(
      skillsPath,
      {
        cc: {
          coding: {
            source: 'coding.yaml',
            mode: 'inline',
            output: join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md'),
          },
        },
      },
      homeDir,
    );

    const rendered = readFileSync(skillsPath, 'utf-8');
    expect(rendered).toContain('coding:');
    expect(rendered).toContain('source: coding.yaml');
    expect(statSync(skillsPath).ino).not.toBe(oldInode);

    const parentEntries = readdirSync(dirname(skillsPath));
    expect(parentEntries.filter(entry => entry.includes('.tmp'))).toHaveLength(0);
  });

  it('should remove skill file without leaving quarantine files', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'skill-remove-home-'));
    tempDirs.push(homeDir);

    const outputPath = join(homeDir, '.claude', 'skills', 'coding', 'SKILL.md');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, 'generated', 'utf-8');

    removeSkillFile(outputPath, homeDir);

    expect(() => statSync(outputPath)).toThrow();
    const parentEntries = readdirSync(dirname(outputPath));
    expect(parentEntries.filter(entry => entry.includes('.delete'))).toHaveLength(0);
  });
});
