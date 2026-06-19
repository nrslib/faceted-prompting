import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { composePromptPayload } from '../prompt-payload.js';
import type { ComposeDefinition, CopyFiles } from '../types.js';

type FacetResolverCase = {
  readonly key: 'persona' | 'knowledge' | 'policies' | 'instructions' | 'outputContracts';
  readonly scopeDirectory: 'personas' | 'knowledge' | 'policies' | 'instructions' | 'output-contracts';
  readonly refName: string;
  readonly body: string;
};

const facetResolverCases: readonly FacetResolverCase[] = [
  {
    key: 'persona',
    scopeDirectory: 'personas',
    refName: 'persona',
    body: 'You are a definition-local coding agent.',
  },
  {
    key: 'knowledge',
    scopeDirectory: 'knowledge',
    refName: 'knowledge',
    body: 'Use the definition-local architecture guide.',
  },
  {
    key: 'policies',
    scopeDirectory: 'policies',
    refName: 'policies',
    body: 'Follow the definition-local coding policy.',
  },
  {
    key: 'instructions',
    scopeDirectory: 'instructions',
    refName: 'instructions',
    body: 'Perform the definition-local instruction.',
  },
  {
    key: 'outputContracts',
    scopeDirectory: 'output-contracts',
    refName: 'output-contracts',
    body: 'Return the definition-local report contract.',
  },
];

function buildDefinitionWithFacetRef(facetKey: FacetResolverCase['key'], ref: string): ComposeDefinition {
  switch (facetKey) {
    case 'persona':
      return {
        name: 'coding',
        persona: ref,
      };
    case 'knowledge':
      return {
        name: 'coding',
        persona: 'coder',
        knowledge: [ref],
      };
    case 'policies':
      return {
        name: 'coding',
        persona: 'coder',
        policies: [ref],
      };
    case 'instructions':
      return {
        name: 'coding',
        persona: 'coder',
        instructions: [ref],
      };
    case 'outputContracts':
      return {
        name: 'coding',
        persona: 'coder',
        outputContracts: [ref],
      };
  }
}

function copyFilesForFacet(copyFiles: CopyFiles, facetKey: FacetResolverCase['key']): readonly string[] {
  switch (facetKey) {
    case 'persona':
      return copyFiles.persona;
    case 'knowledge':
      return copyFiles.knowledge;
    case 'policies':
      return copyFiles.policies;
    case 'instructions':
      return copyFiles.instructions;
    case 'outputContracts':
      return copyFiles.outputContracts;
  }
}

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
    mkdirSync(join(facetsRoot, 'output-contracts'), { recursive: true });

    const personaPath = join(facetsRoot, 'persona', 'coder.md');
    const knowledgePath = join(facetsRoot, 'knowledge', 'architecture.md');
    const policyPath = join(facetsRoot, 'policies', 'coding.md');
    const instructionPath = join(facetsRoot, 'instructions', 'task.md');
    const outputContractPath = join(facetsRoot, 'output-contracts', 'report.md');

    writeFileSync(personaPath, 'You are a coding agent.', 'utf-8');
    writeFileSync(knowledgePath, 'Architecture reference.', 'utf-8');
    writeFileSync(policyPath, 'Never hide errors.', 'utf-8');
    writeFileSync(instructionPath, 'Implement the requested change.', 'utf-8');
    writeFileSync(outputContractPath, 'Write the report with Findings first.', 'utf-8');

    const payload = composePromptPayload({
      definition: {
        name: 'coding',
        persona: 'coder',
        knowledge: ['architecture'],
        policies: ['coding'],
        instructions: ['task'],
        outputContracts: ['report'],
        order: ['policies', 'knowledge', 'instructions', 'output-contracts'],
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
    expect(payload.userPrompt).toContain('Write the report with Findings first.');
    expect(payload.copyFiles).toEqual({
      persona: [realpathSync(personaPath)],
      knowledge: [realpathSync(knowledgePath)],
      policies: [realpathSync(policyPath)],
      instructions: [realpathSync(instructionPath)],
      outputContracts: [realpathSync(outputContractPath)],
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
      outputContracts: [],
    });
  });

  for (const facetCase of facetResolverCases) {
    it(`should resolve ${facetCase.key} from definition-relative file paths`, () => {
      const rootDir = mkdtempSync(join(tmpdir(), 'facet-payload-'));
      tempDirs.push(rootDir);

      const definitionDir = join(rootDir, 'compositions');
      const resourceDir = join(definitionDir, 'resources');
      const facetsRoot = join(rootDir, 'facets');
      mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
      mkdirSync(resourceDir, { recursive: true });

      const facetPath = join(resourceDir, `${facetCase.refName}.md`);
      writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
      writeFileSync(facetPath, facetCase.body, 'utf-8');

      const payload = composePromptPayload({
        definition: buildDefinitionWithFacetRef(facetCase.key, `./resources/${facetCase.refName}.md`),
        definitionDir,
        facetsRoot,
        composeOptions: {
          contextMaxChars: 8000,
        },
      });

      const prompt = facetCase.key === 'persona' ? payload.systemPrompt : payload.userPrompt;
      expect(prompt).toContain(facetCase.body);
      expect(copyFilesForFacet(payload.copyFiles, facetCase.key)).toEqual([realpathSync(facetPath)]);
    });
  }

  for (const facetCase of facetResolverCases) {
    it(`should resolve ${facetCase.key} from repertoire scope references`, () => {
      const rootDir = mkdtempSync(join(tmpdir(), 'facet-payload-'));
      tempDirs.push(rootDir);

      const facetedRoot = join(rootDir, '.faceted');
      const facetsRoot = join(facetedRoot, 'facets');
      const scopedFacetRoot = join(
        facetedRoot,
        'repertoire',
        '@acme',
        'report-pack',
        'facets',
        facetCase.scopeDirectory,
      );
      mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
      mkdirSync(scopedFacetRoot, { recursive: true });

      const facetPath = join(scopedFacetRoot, `${facetCase.refName}.md`);
      writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
      writeFileSync(facetPath, facetCase.body, 'utf-8');

      const payload = composePromptPayload({
        definition: buildDefinitionWithFacetRef(facetCase.key, `@acme/report-pack/${facetCase.refName}`),
        definitionDir: rootDir,
        facetedRoots: [facetedRoot],
        facetsRoot,
        composeOptions: {
          contextMaxChars: 8000,
        },
      });

      const prompt = facetCase.key === 'persona' ? payload.systemPrompt : payload.userPrompt;
      expect(prompt).toContain(facetCase.body);
      expect(copyFilesForFacet(payload.copyFiles, facetCase.key)).toEqual([realpathSync(facetPath)]);
    });
  }

  it('should reject public API scope references when repertoire roots are not provided', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'facet-payload-'));
    tempDirs.push(rootDir);

    const facetsRoot = join(rootDir, 'facets');
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');

    expect(() =>
      composePromptPayload({
        definition: {
          name: 'coding',
          persona: 'coder',
          outputContracts: ['@acme/report-pack/review-report'],
        },
        definitionDir: rootDir,
        facetsRoot,
        composeOptions: {
          contextMaxChars: 8000,
        },
      }),
    ).toThrow('scope reference requires repertoire roots');
  });

  for (const facetCase of facetResolverCases) {
    it(`should reject ${facetCase.key} file paths outside the definition directory and facets roots`, () => {
      const rootDir = mkdtempSync(join(tmpdir(), 'facet-payload-'));
      tempDirs.push(rootDir);

      const definitionDir = join(rootDir, 'compositions');
      const facetsRoot = join(rootDir, 'facets');
      const outsidePath = join(rootDir, `${facetCase.refName}.md`);
      mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
      mkdirSync(definitionDir, { recursive: true });

      writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
      writeFileSync(outsidePath, facetCase.body, 'utf-8');

      expect(() =>
        composePromptPayload({
          definition: buildDefinitionWithFacetRef(facetCase.key, `../${facetCase.refName}.md`),
          definitionDir,
          facetsRoot,
          composeOptions: {
            contextMaxChars: 8000,
          },
        }),
      ).toThrow('must be inside allowed facets directory');
    });
  }

});
