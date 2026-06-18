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

  function createRootDir(): string {
    const rootDir = mkdtempSync(join(tmpdir(), 'facet-payload-'));
    tempDirs.push(rootDir);
    return rootDir;
  }

  it('should return prompts and copy-files from a compose definition without changing copyFiles shape', () => {
    const rootDir = createRootDir();

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
        instructions: ['task'],
        order: ['policies', 'knowledge', 'instructions'],
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

  it('should resolve compose payload facets from the first matching facets root', () => {
    const rootDir = createRootDir();
    const localFacetsRoot = join(rootDir, 'local', 'facets');
    const globalFacetsRoot = join(rootDir, 'global', 'facets');

    mkdirSync(join(localFacetsRoot, 'instructions'), { recursive: true });
    mkdirSync(join(globalFacetsRoot, 'persona'), { recursive: true });
    mkdirSync(join(globalFacetsRoot, 'instructions'), { recursive: true });

    const personaPath = join(globalFacetsRoot, 'persona', 'coder.md');
    const localInstructionPath = join(localFacetsRoot, 'instructions', 'task.md');
    const globalInstructionPath = join(globalFacetsRoot, 'instructions', 'task.md');

    writeFileSync(personaPath, 'You are a global coding agent.', 'utf-8');
    writeFileSync(localInstructionPath, 'Local instruction.', 'utf-8');
    writeFileSync(globalInstructionPath, 'Global instruction.', 'utf-8');

    const payload = composePromptPayload({
      definition: {
        name: 'coding',
        persona: 'coder',
        instructions: ['task'],
      },
      definitionDir: rootDir,
      facetsRoots: [localFacetsRoot, globalFacetsRoot],
      composeOptions: {
        contextMaxChars: 8000,
      },
    });

    expect(payload.systemPrompt).toContain('You are a global coding agent.');
    expect(payload.userPrompt).toContain('Local instruction.');
    expect(payload.userPrompt).not.toContain('Global instruction.');
    expect(payload.copyFiles).toEqual({
      persona: [realpathSync(personaPath)],
      knowledge: [],
      policies: [],
      instructions: [realpathSync(localInstructionPath)],
    });
  });
});
