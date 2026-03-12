import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { composePromptPayload } from '../prompt-payload.js';

describe('composePromptPayload', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should return prompts and copy-files from a compose definition', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'facet-payload-'));
    tempDirs.push(rootDir);

    const facetsRoot = join(rootDir, 'facets');
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(join(facetsRoot, 'knowledge'), { recursive: true });
    mkdirSync(join(facetsRoot, 'policies'), { recursive: true });
    mkdirSync(join(facetsRoot, 'instructions'), { recursive: true });

    const personaPath = join(facetsRoot, 'persona', 'coder.md');
    const knowledgePath = join(facetsRoot, 'knowledge', 'architecture.md');
    const policyPath = join(facetsRoot, 'policies', 'coding.md');
    const instructionPath = join(facetsRoot, 'instructions', 'task.md');

    writeFileSync(personaPath, 'You are a coding agent.', 'utf-8');
    writeFileSync(knowledgePath, 'Architecture reference.', 'utf-8');
    writeFileSync(policyPath, 'Never hide errors.', 'utf-8');
    writeFileSync(instructionPath, 'Implement the requested change.', 'utf-8');

    const payload = composePromptPayload({
      definition: {
        name: 'coding',
        persona: 'coder',
        knowledge: ['architecture'],
        policies: ['coding'],
        instruction: 'facets/instructions/task.md',
        order: ['policies', 'knowledge', 'instruction'],
      },
      definitionDir: rootDir,
      facetsRoot,
      composeOptions: {
        contextMaxChars: 8000,
      },
    });

    expect(payload.systemPrompt).toContain('You are a coding agent.');
    expect(payload.userPrompt).toContain('Never hide errors.');
    expect(payload.userPrompt).toContain('Architecture reference.');
    expect(payload.userPrompt).toContain('Implement the requested change.');
    expect(payload.copyFiles).toEqual({
      persona: [realpathSync(personaPath)],
      knowledge: [realpathSync(knowledgePath)],
      policies: [realpathSync(policyPath)],
      instructions: [realpathSync(instructionPath)],
    });
  });

  it('should omit literal instructions from copy-files', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'facet-payload-'));
    tempDirs.push(rootDir);

    const facetsRoot = join(rootDir, 'facets');
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');

    const payload = composePromptPayload({
      definition: {
        name: 'coding',
        persona: 'coder',
        instruction: 'Do the work.',
      },
      definitionDir: rootDir,
      facetsRoot,
      composeOptions: {
        contextMaxChars: 8000,
      },
    });

    expect(payload.copyFiles.instructions).toEqual([]);
    expect(payload.userPrompt).toContain('Do the work.');
  });
});
