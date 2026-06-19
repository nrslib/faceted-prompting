import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyFacetTokensToFiles,
  applyFacetTokensToPath,
  buildInlineFacetTokenValues,
  copyFacetFiles,
} from '../cli/install-skill/facets.js';

function tokenValues() {
  return {
    persona: 'Persona Body',
    knowledges: 'Knowledge Body',
    policies: 'Policy Body',
    instructions: 'Instruction Body',
    outputContracts: 'Output Contract Body',
  };
}

function multilineTokenValues() {
  return {
    ...tokenValues(),
    persona: 'Persona Line 1\nPersona Line 2\nPersona Line 3',
  };
}

describe('applyFacetTokens*', () => {
  it('should apply the same token replacement result for scan mode and file-list mode', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const rootByScan = join(workspaceDir, 'scan-root');
      const rootByList = join(workspaceDir, 'list-root');
      mkdirSync(rootByScan, { recursive: true });
      mkdirSync(rootByList, { recursive: true });

      const templatedBody = [
        'persona: {{facet:persona}}',
        'knowledge: {{facet:knowledges}}',
        'policy: {{facet:policies}}',
        'instruction: {{facet:instructions}}',
        'output-contract: {{facet:outputContracts}}',
      ].join('\n');
      writeFileSync(join(rootByScan, 'prompt.yaml'), templatedBody, 'utf-8');
      writeFileSync(join(rootByList, 'prompt.yaml'), templatedBody, 'utf-8');
      writeFileSync(join(rootByScan, 'README.md'), 'no token', 'utf-8');
      writeFileSync(join(rootByList, 'README.md'), 'no token', 'utf-8');

      applyFacetTokensToPath({
        rootDir: rootByScan,
        maxDepth: Number.MAX_SAFE_INTEGER,
        tokenValues: tokenValues(),
        excludeDirs: [],
      });
      applyFacetTokensToFiles({
        filePaths: [join(rootByList, 'prompt.yaml'), join(rootByList, 'README.md')],
        tokenValues: tokenValues(),
        rootDir: rootByList,
      });

      expect(readFileSync(join(rootByScan, 'prompt.yaml'), 'utf-8')).toBe(
        readFileSync(join(rootByList, 'prompt.yaml'), 'utf-8'),
      );
      expect(readFileSync(join(rootByScan, 'prompt.yaml'), 'utf-8')).toContain(
        'output-contract: Output Contract Body',
      );
      expect(readFileSync(join(rootByList, 'README.md'), 'utf-8')).toBe('no token');
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should reject token replacement when target file path is a symbolic link', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const outputDir = join(workspaceDir, 'output');
      mkdirSync(outputDir, { recursive: true });
      const outsidePath = join(workspaceDir, 'outside.md');
      const symlinkPath = join(outputDir, 'prompt.yaml');
      writeFileSync(outsidePath, '{{facet:persona}}', 'utf-8');
      symlinkSync(outsidePath, symlinkPath);

      expect(() => applyFacetTokensToFiles({
        filePaths: [symlinkPath],
        tokenValues: tokenValues(),
        rootDir: outputDir,
      })).toThrow(`Symbolic links are not allowed in Output directory path: ${symlinkPath}`);
      expect(readFileSync(outsidePath, 'utf-8')).toBe('{{facet:persona}}');
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should keep placeholder indentation for multiline facet values by default', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const outputPath = join(workspaceDir, 'prompt.yaml');
      writeFileSync(
        outputPath,
        ['persona: |', '  {{facet:persona}}'].join('\n'),
        'utf-8',
      );

      applyFacetTokensToFiles({
        filePaths: [outputPath],
        tokenValues: multilineTokenValues(),
        rootDir: workspaceDir,
      });

      expect(readFileSync(outputPath, 'utf-8')).toBe(
        ['persona: |', '  Persona Line 1', '  Persona Line 2', '  Persona Line 3'].join('\n'),
      );
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should skip auto indentation when indent:none modifier is specified', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const outputPath = join(workspaceDir, 'prompt.yaml');
      writeFileSync(
        outputPath,
        ['persona: |', '  {{facet:persona | indent:none}}'].join('\n'),
        'utf-8',
      );

      applyFacetTokensToFiles({
        filePaths: [outputPath],
        tokenValues: multilineTokenValues(),
        rootDir: workspaceDir,
      });

      expect(readFileSync(outputPath, 'utf-8')).toBe(
        ['persona: |', '  Persona Line 1', 'Persona Line 2', 'Persona Line 3'].join('\n'),
      );
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should keep multiline values unchanged when placeholder line has no indentation', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const outputPath = join(workspaceDir, 'prompt.yaml');
      writeFileSync(
        outputPath,
        'persona={{facet:persona}}',
        'utf-8',
      );

      applyFacetTokensToFiles({
        filePaths: [outputPath],
        tokenValues: multilineTokenValues(),
        rootDir: workspaceDir,
      });

      expect(readFileSync(outputPath, 'utf-8')).toBe(
        'persona=Persona Line 1\nPersona Line 2\nPersona Line 3',
      );
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should not add whitespace to blank lines inside multiline facet values', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const outputPath = join(workspaceDir, 'prompt.yaml');
      writeFileSync(
        outputPath,
        ['persona: |', '  {{facet:persona}}'].join('\n'),
        'utf-8',
      );

      applyFacetTokensToFiles({
        filePaths: [outputPath],
        tokenValues: {
          ...tokenValues(),
          persona: 'Persona Line 1\n\nPersona Line 3',
        },
        rootDir: workspaceDir,
      });

      expect(readFileSync(outputPath, 'utf-8')).toBe(
        ['persona: |', '  Persona Line 1', '', '  Persona Line 3'].join('\n'),
      );
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should apply indentation independently for each placeholder line', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const outputPath = join(workspaceDir, 'prompt.yaml');
      writeFileSync(
        outputPath,
        ['top:', '  {{facet:persona}}', 'nested:', '    {{facet:persona}}'].join('\n'),
        'utf-8',
      );

      applyFacetTokensToFiles({
        filePaths: [outputPath],
        tokenValues: multilineTokenValues(),
        rootDir: workspaceDir,
      });

      expect(readFileSync(outputPath, 'utf-8')).toBe(
        [
          'top:',
          '  Persona Line 1',
          '  Persona Line 2',
          '  Persona Line 3',
          'nested:',
          '    Persona Line 1',
          '    Persona Line 2',
          '    Persona Line 3',
        ].join('\n'),
      );
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should keep token untouched when indent:auto modifier is explicitly specified', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const outputPath = join(workspaceDir, 'prompt.yaml');
      writeFileSync(
        outputPath,
        ['persona: |', '  {{facet:persona | indent:auto}}'].join('\n'),
        'utf-8',
      );

      applyFacetTokensToFiles({
        filePaths: [outputPath],
        tokenValues: multilineTokenValues(),
        rootDir: workspaceDir,
      });

      expect(readFileSync(outputPath, 'utf-8')).toBe(
        ['persona: |', '  {{facet:persona | indent:auto}}'].join('\n'),
      );
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should copy output-contracts facets into their facet directory', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const sourceDir = join(workspaceDir, 'source');
      const targetDir = join(workspaceDir, 'target');
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(targetDir, { recursive: true });

      const personaPath = join(sourceDir, 'coder.md');
      const outputContractPath = join(sourceDir, 'test-report.md');
      writeFileSync(personaPath, 'Persona Body', 'utf-8');
      writeFileSync(outputContractPath, 'Output Contract Body', 'utf-8');

      const copied = copyFacetFiles({
        targetDir,
        safeSkillName: 'report-skill',
        copyFiles: {
          persona: [personaPath],
          knowledge: [],
          policies: [],
          instructions: [],
          outputContracts: [outputContractPath],
        },
      });

      const copiedOutputContractPath = join(targetDir, 'facets', 'output-contracts', 'test-report.md');
      expect(copied.outputContracts).toEqual([copiedOutputContractPath]);
      expect(existsSync(copiedOutputContractPath)).toBe(true);
      expect(readFileSync(copiedOutputContractPath, 'utf-8')).toBe('Output Contract Body');
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should copy generic facet partials into the matching partials directory', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const sourceDir = join(workspaceDir, 'source');
      const sourcePartialsDir = join(sourceDir, 'facets', 'partials', 'policies');
      const targetDir = join(workspaceDir, 'target');
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(sourcePartialsDir, { recursive: true });
      mkdirSync(targetDir, { recursive: true });

      const personaPath = join(sourceDir, 'coder.md');
      const partialPath = join(sourcePartialsDir, 'coding-common.md');
      writeFileSync(personaPath, 'Persona Body', 'utf-8');
      writeFileSync(partialPath, 'Policy Partial Body', 'utf-8');

      const copied = copyFacetFiles({
        targetDir,
        safeSkillName: 'policy-skill',
        copyFiles: {
          persona: [personaPath],
          knowledge: [],
          policies: [],
          instructions: [],
          outputContracts: [],
          facetPartials: [partialPath],
        },
      });

      const copiedPartialPath = join(targetDir, 'facets', 'partials', 'policies', 'coding-common.md');
      expect(copied).toMatchObject({ facetPartials: [copiedPartialPath] });
      expect(existsSync(copiedPartialPath)).toBe(true);
      expect(readFileSync(copiedPartialPath, 'utf-8')).toBe('Policy Partial Body');
      expect(existsSync(join(targetDir, 'facets', 'partials', 'instructions', 'coding-common.md'))).toBe(false);
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should copy legacy instruction partial metadata into the instruction partials directory', () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), 'facet-facets-'));

    try {
      const sourceDir = join(workspaceDir, 'source');
      const sourcePartialsDir = join(sourceDir, 'facets', 'partials', 'instructions');
      const targetDir = join(workspaceDir, 'target');
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(sourcePartialsDir, { recursive: true });
      mkdirSync(targetDir, { recursive: true });

      const personaPath = join(sourceDir, 'coder.md');
      const partialPath = join(sourcePartialsDir, 'review-common.md');
      writeFileSync(personaPath, 'Persona Body', 'utf-8');
      writeFileSync(partialPath, 'Instruction Partial Body', 'utf-8');

      const copied = copyFacetFiles({
        targetDir,
        safeSkillName: 'instruction-skill',
        copyFiles: {
          persona: [personaPath],
          knowledge: [],
          policies: [],
          instructions: [],
          outputContracts: [],
          instructionPartials: [partialPath],
        },
      });

      const copiedPartialPath = join(targetDir, 'facets', 'partials', 'instructions', 'review-common.md');
      expect(copied).toMatchObject({
        facetPartials: [copiedPartialPath],
        instructionPartials: [copiedPartialPath],
      });
      expect(existsSync(copiedPartialPath)).toBe(true);
      expect(readFileSync(copiedPartialPath, 'utf-8')).toBe('Instruction Partial Body');
    } finally {
      rmSync(workspaceDir, { recursive: true, force: true });
    }
  });

  it('should build output-contracts token values from skill sections', () => {
    const values = buildInlineFacetTokenValues({
      definition: {
        name: 'report-skill',
        persona: 'coder',
        outputContracts: ['test-report', 'summary'],
      },
      persona: {
        ref: 'coder',
        body: 'Persona Body',
        path: '/facets/persona/coder.md',
      },
      knowledge: [],
      policies: [],
      instructions: [],
      outputContracts: [
        {
          ref: 'test-report',
          body: 'Test Report Contract',
          path: '/facets/output-contracts/test-report.md',
        },
        {
          ref: 'summary',
          body: 'Summary Contract',
          path: '/facets/output-contracts/summary.md',
        },
      ],
    });

    expect(values.outputContracts).toBe('Test Report Contract\nSummary Contract');
  });
});
