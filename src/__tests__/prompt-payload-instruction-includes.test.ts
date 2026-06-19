import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { composePromptPayload } from '../prompt-payload.js';

describe('composePromptPayload instruction partial includes', () => {
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

  function createBasicFacets(rootDir: string): string {
    const facetsRoot = join(rootDir, 'facets');
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(join(facetsRoot, 'instructions'), { recursive: true });
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
    return facetsRoot;
  }

  function createPayload(params: {
    rootDir: string;
    facetsRoot: string;
    instructions: readonly string[];
  }) {
    return composePromptPayload({
      definition: {
        name: 'coding',
        persona: 'coder',
        instructions: params.instructions,
      },
      definitionDir: params.rootDir,
      facetsRoot: params.facetsRoot,
      composeOptions: {
        contextMaxChars: 8000,
      },
    });
  }

  it('should expand instruction partial includes at the include site and preserve source metadata', () => {
    const rootDir = createRootDir();
    const facetsRoot = createBasicFacets(rootDir);
    mkdirSync(join(facetsRoot, 'partials/instructions'), { recursive: true });

    const instructionPath = join(facetsRoot, 'instructions', 'review-coding.md');
    const partialPath = join(facetsRoot, 'partials/instructions', 'review-common.md');
    writeFileSync(
      instructionPath,
      [
        'Review whether the current change is mergeable quality.',
        '',
        '{{include:instructions/review-common}}',
        '',
        'Check coding-specific risks.',
      ].join('\n'),
      'utf-8',
    );
    writeFileSync(partialPath, 'Open Knowledge and Policy source paths.', 'utf-8');

    const payload = createPayload({ rootDir, facetsRoot, instructions: ['review-coding'] });

    expect(payload.userPrompt).toContain([
      'Review whether the current change is mergeable quality.',
      '',
      'Open Knowledge and Policy source paths.',
      '',
      'Check coding-specific risks.',
    ].join('\n'));
    expect(payload.userPrompt).not.toContain('{{include:instructions/review-common}}');
    expect(payload.copyFiles.instructionPartials).toEqual([realpathSync(partialPath)]);
    expect(payload.copyFiles.instructions).toEqual([realpathSync(instructionPath)]);
  });

  it('should keep inline instruction text as prompt content without include expansion', () => {
    const rootDir = createRootDir();
    const facetsRoot = createBasicFacets(rootDir);
    mkdirSync(join(facetsRoot, 'partials/instructions'), { recursive: true });
    writeFileSync(
      join(facetsRoot, 'partials/instructions', 'review-common.md'),
      'This partial must not be expanded from inline text.',
      'utf-8',
    );

    const inlineInstruction = 'Review inline text. {{include:instructions/review-common}}';
    const plainInlineInstruction = 'Review the README updates.';
    const payload = createPayload({
      rootDir,
      facetsRoot,
      instructions: [inlineInstruction, plainInlineInstruction],
    });

    expect(payload.userPrompt).toContain(inlineInstruction);
    expect(payload.userPrompt).toContain(plainInlineInstruction);
    expect(payload.userPrompt).not.toContain('This partial must not be expanded from inline text.');
    expect(payload.copyFiles.instructions).toEqual([]);
    expect(payload.copyFiles.instructionPartials).toBeUndefined();
  });

  it('should fail when an instruction entry is a missing file path', () => {
    const rootDir = createRootDir();
    const facetsRoot = createBasicFacets(rootDir);
    const missingInstructionPath = join(facetsRoot, 'instructions', 'missing.md');

    expect(() =>
      createPayload({
        rootDir,
        facetsRoot,
        instructions: [missingInstructionPath],
      }),
    ).toThrow(/Missing instruction facet[\s\S]*missing\.md/u);

    expect(() =>
      createPayload({
        rootDir,
        facetsRoot,
        instructions: ['review.md'],
      }),
    ).toThrow(/Missing instruction facet[\s\S]*review\.md/u);
  });

  it('should include nested instruction partial paths in copy metadata', () => {
    const rootDir = createRootDir();
    const facetsRoot = createBasicFacets(rootDir);
    mkdirSync(join(facetsRoot, 'partials/instructions'), { recursive: true });

    const instructionPath = join(facetsRoot, 'instructions', 'review-coding.md');
    const commonPath = join(facetsRoot, 'partials/instructions', 'review-common.md');
    const evidencePath = join(facetsRoot, 'partials/instructions', 'review-evidence.md');
    writeFileSync(instructionPath, 'Before\n{{include:instructions/review-common}}\nAfter', 'utf-8');
    writeFileSync(commonPath, 'Common start\n{{include:instructions/review-evidence}}\nCommon end', 'utf-8');
    writeFileSync(evidencePath, 'Review execution evidence.', 'utf-8');

    const payload = createPayload({ rootDir, facetsRoot, instructions: ['review-coding'] });

    expect(payload.userPrompt).toContain([
      'Before',
      'Common start',
      'Review execution evidence.',
      'Common end',
      'After',
    ].join('\n'));
    expect(payload.copyFiles.instructionPartials).toEqual([
      realpathSync(commonPath),
      realpathSync(evidencePath),
    ]);
  });

  it('should prefer local instruction partials over global instruction partials', () => {
    const rootDir = createRootDir();
    const localFacetsRoot = join(rootDir, 'local', 'facets');
    const globalFacetsRoot = join(rootDir, 'global', 'facets');
    mkdirSync(join(localFacetsRoot, 'partials/instructions'), { recursive: true });
    mkdirSync(join(globalFacetsRoot, 'persona'), { recursive: true });
    mkdirSync(join(globalFacetsRoot, 'instructions'), { recursive: true });
    mkdirSync(join(globalFacetsRoot, 'partials/instructions'), { recursive: true });

    writeFileSync(join(globalFacetsRoot, 'persona', 'coder.md'), 'You are a global coding agent.', 'utf-8');
    writeFileSync(
      join(globalFacetsRoot, 'instructions', 'review-coding.md'),
      'Use this review procedure:\n{{include:instructions/review-common}}',
      'utf-8',
    );
    writeFileSync(
      join(globalFacetsRoot, 'partials/instructions', 'review-common.md'),
      'Global common review text.',
      'utf-8',
    );
    writeFileSync(
      join(localFacetsRoot, 'partials/instructions', 'review-common.md'),
      'Local common review text.',
      'utf-8',
    );

    const payload = composePromptPayload({
      definition: {
        name: 'coding',
        persona: 'coder',
        instructions: ['review-coding'],
      },
      definitionDir: rootDir,
      facetsRoots: [localFacetsRoot, globalFacetsRoot],
      composeOptions: {
        contextMaxChars: 8000,
      },
    });

    expect(payload.userPrompt).toContain('Local common review text.');
    expect(payload.userPrompt).not.toContain('Global common review text.');
  });

  it('should resolve scoped instruction partial includes from repertoire', () => {
    const rootDir = createRootDir();
    const facetedRoot = join(rootDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const partialPath = join(
      facetedRoot,
      'repertoire',
      '@acme',
      'review-pack',
      'facets',
      'partials/instructions',
      'review-common.md',
    );
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(join(facetsRoot, 'instructions'), { recursive: true });
    mkdirSync(dirname(partialPath), { recursive: true });
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
    writeFileSync(
      join(facetsRoot, 'instructions', 'review-coding.md'),
      'Review.\n{{include:instructions/@acme/review-pack/review-common}}',
      'utf-8',
    );
    writeFileSync(partialPath, 'Shared repertoire review procedure.', 'utf-8');

    const payload = composePromptPayload({
      definition: {
        name: 'coding',
        persona: 'coder',
        instructions: ['review-coding'],
      },
      definitionDir: rootDir,
      facetsRoot,
      composeOptions: {
        contextMaxChars: 8000,
      },
    });

    expect(payload.userPrompt).toContain('Shared repertoire review procedure.');
    expect(payload.copyFiles.instructionPartials).toEqual([realpathSync(partialPath)]);
  });

  it('should not allow repertoire roots for regular facet file references', () => {
    const rootDir = createRootDir();
    const facetedRoot = join(rootDir, '.faceted');
    const facetsRoot = join(facetedRoot, 'facets');
    const partialPath = join(
      facetedRoot,
      'repertoire',
      '@acme',
      'review-pack',
      'facets',
      'partials/instructions',
      'review-common.md',
    );
    const policyPath = join(
      facetedRoot,
      'repertoire',
      '@acme',
      'review-pack',
      'facets',
      'policies',
      'repertoire-policy.md',
    );
    mkdirSync(join(facetsRoot, 'persona'), { recursive: true });
    mkdirSync(join(facetsRoot, 'instructions'), { recursive: true });
    mkdirSync(dirname(partialPath), { recursive: true });
    mkdirSync(dirname(policyPath), { recursive: true });
    writeFileSync(join(facetsRoot, 'persona', 'coder.md'), 'You are a coding agent.', 'utf-8');
    writeFileSync(
      join(facetsRoot, 'instructions', 'review-coding.md'),
      'Review.\n{{include:instructions/@acme/review-pack/review-common}}',
      'utf-8',
    );
    writeFileSync(partialPath, 'Shared repertoire review procedure.', 'utf-8');
    writeFileSync(policyPath, 'Do not resolve this as a regular facet.', 'utf-8');

    const payload = composePromptPayload({
      definition: {
        name: 'coding',
        persona: 'coder',
        instructions: ['review-coding'],
      },
      definitionDir: rootDir,
      facetsRoot,
      composeOptions: {
        contextMaxChars: 8000,
      },
    });
    expect(payload.userPrompt).toContain('Shared repertoire review procedure.');

    expect(() =>
      composePromptPayload({
        definition: {
          name: 'coding',
          persona: 'coder',
          policies: [policyPath],
        },
        definitionDir: join(rootDir, 'compositions'),
        facetsRoot,
        composeOptions: {
          contextMaxChars: 8000,
        },
      }),
    ).toThrow(/policy facet[\s\S]*inside allowed facets directory/u);
  });

  it('should fail when a scoped instruction partial include is missing', () => {
    const rootDir = createRootDir();
    const facetsRoot = createBasicFacets(rootDir);
    writeFileSync(
      join(facetsRoot, 'instructions', 'review-coding.md'),
      'Review.\n{{include:instructions/@acme/review-pack/missing-common}}',
      'utf-8',
    );

    expect(() =>
      createPayload({ rootDir, facetsRoot, instructions: ['review-coding'] }),
    ).toThrow(/Missing instruction include[\s\S]*@acme\/review-pack\/missing-common/u);
  });

  it('should fail when an unscoped instruction partial include is missing from all roots', () => {
    const rootDir = createRootDir();
    const localFacetsRoot = join(rootDir, 'local', 'facets');
    const globalFacetsRoot = join(rootDir, 'global', 'facets');
    mkdirSync(join(globalFacetsRoot, 'persona'), { recursive: true });
    mkdirSync(join(globalFacetsRoot, 'instructions'), { recursive: true });
    writeFileSync(join(globalFacetsRoot, 'persona', 'coder.md'), 'You are a global coding agent.', 'utf-8');
    writeFileSync(
      join(globalFacetsRoot, 'instructions', 'review-coding.md'),
      'Review.\n{{include:instructions/missing-common}}',
      'utf-8',
    );

    expect(() =>
      composePromptPayload({
        definition: {
          name: 'coding',
          persona: 'coder',
          instructions: ['review-coding'],
        },
        definitionDir: rootDir,
        facetsRoots: [localFacetsRoot, globalFacetsRoot],
        composeOptions: {
          contextMaxChars: 8000,
        },
      }),
    ).toThrow(/Missing instruction include[\s\S]*local[\s\S]*missing-common\.md[\s\S]*global[\s\S]*missing-common\.md/u);
  });

  it('should fail when an instruction partial include name is empty', () => {
    const rootDir = createRootDir();
    const facetsRoot = createBasicFacets(rootDir);
    writeFileSync(join(facetsRoot, 'instructions', 'empty.md'), 'Before {{include:}} After', 'utf-8');
    writeFileSync(join(facetsRoot, 'instructions', 'blank.md'), 'Before {{include: }} After', 'utf-8');

    expect(() => createPayload({ rootDir, facetsRoot, instructions: ['empty'] })).toThrow(
      /Invalid instruction include[\s\S]*missing include name/u,
    );
    expect(() => createPayload({ rootDir, facetsRoot, instructions: ['blank'] })).toThrow(
      /Invalid instruction include[\s\S]*missing include name/u,
    );
  });

  it('should fail when an instruction partial include uses the short syntax', () => {
    const rootDir = createRootDir();
    const facetsRoot = createBasicFacets(rootDir);
    writeFileSync(join(facetsRoot, 'instructions', 'review-coding.md'), 'Review.\n{{include:review-common}}', 'utf-8');

    expect(() =>
      createPayload({ rootDir, facetsRoot, instructions: ['review-coding'] }),
    ).toThrow(/Invalid instruction include "review-common"[\s\S]*\{\{include:instructions\/<name>\}\}/u);
  });

  it('should fail with the include chain when instruction partial includes are cyclic', () => {
    const rootDir = createRootDir();
    const facetsRoot = createBasicFacets(rootDir);
    mkdirSync(join(facetsRoot, 'partials/instructions'), { recursive: true });

    writeFileSync(join(facetsRoot, 'instructions', 'review-coding.md'), '{{include:instructions/first}}', 'utf-8');
    writeFileSync(join(facetsRoot, 'partials/instructions', 'first.md'), '{{include:instructions/second}}', 'utf-8');
    writeFileSync(join(facetsRoot, 'partials/instructions', 'second.md'), '{{include:instructions/first}}', 'utf-8');

    expect(() =>
      createPayload({ rootDir, facetsRoot, instructions: ['review-coding'] }),
    ).toThrow(/Cyclic instruction include[\s\S]*instructions\/first[\s\S]*instructions\/second[\s\S]*instructions\/first/u);
  });

  it('should leave include syntax in non-instruction facets unchanged', () => {
    const rootDir = createRootDir();
    const facetsRoot = createBasicFacets(rootDir);
    mkdirSync(join(facetsRoot, 'policies'), { recursive: true });

    writeFileSync(join(facetsRoot, 'policies', 'coding.md'), 'Policy {{include:instructions/common}}.', 'utf-8');
    writeFileSync(join(facetsRoot, 'instructions', 'do-the-work.md'), 'Do the work.', 'utf-8');

    const payload = composePromptPayload({
      definition: {
        name: 'coding',
        persona: 'coder',
        policies: ['coding'],
        instructions: ['do-the-work'],
      },
      definitionDir: rootDir,
      facetsRoot,
      composeOptions: {
        contextMaxChars: 8000,
      },
    });

    expect(payload.userPrompt).toContain('Policy {{include:instructions/common}}.');
    expect(payload.userPrompt).toContain('Do the work.');
  });
});
