import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compose } from '../compose.js';
import { loadComposeDefinition } from '../compose-definition.js';
import { formatCombinedOutput, resolveOutputDirectory, writeComposeOutput } from '../output/index.js';
import type { ComposeDefinition } from '../types.js';
import {
  buildFacetSet,
  buildSkillSections,
  ensureSafeDefinitionName,
} from './skill-renderer.js';
import {
  getSkillPaths,
  selectCompositionDefinitionPath,
} from './skill-commands.js';
import type { FacetCliOptions, FacetCliResult } from './types.js';
import {
  collectDirectoryFiles,
  copyDirectoryTree,
  ensureTemplateDirectoryFromRoots,
  shouldOverwrite,
} from './install-skill/flow.js';
import { applyFacetTokensToFiles, buildInlineFacetTokenValues } from './install-skill/facets.js';
import { ensurePathAncestorsContainNoSymbolicLinks, ensurePathIsNotSymbolicLink } from './path-guard.js';

function buildComposeOutputPlans(params: {
  safeName: string;
  systemPrompt: string;
  userMessage: string;
  splitSystem: boolean;
}): Array<{ fileName: string; content: string }> {
  if (params.splitSystem) {
    return [
      {
        fileName: `${params.safeName}.system.md`,
        content: `${params.systemPrompt}\n`,
      },
      {
        fileName: `${params.safeName}.user.md`,
        content: `${params.userMessage}\n`,
      },
    ];
  }

  return [
    {
      fileName: `${params.safeName}.md`,
      content: formatCombinedOutput({
        systemPrompt: params.systemPrompt,
        userMessage: params.userMessage,
      }),
    },
  ];
}

async function confirmOverwriteForExistingPaths(params: {
  options: FacetCliOptions;
  existingPaths: readonly string[];
  promptMessage: string;
  cancelMessage: string;
}): Promise<boolean> {
  if (params.existingPaths.length === 0) {
    return false;
  }

  const overwriteAnswer = await params.options.input(
    `${params.promptMessage} (${params.existingPaths.join(', ')}) [y/N]`,
    'n',
  );
  if (!shouldOverwrite(overwriteAnswer)) {
    throw new Error(`${params.cancelMessage}: ${params.existingPaths.join(', ')}`);
  }
  return true;
}

async function runTemplateBackedCompose(params: {
  options: FacetCliOptions;
  facetedRoots: readonly string[];
  facetsRoots: readonly string[];
  definitionPath: string;
  definition: ComposeDefinition;
}): Promise<FacetCliResult> {
  const templateName = params.definition.template;
  if (!templateName) {
    throw new Error(`Template-backed compose requires template: ${params.definition.name}`);
  }

  const templateDir = ensureTemplateDirectoryFromRoots(params.facetedRoots, templateName, dirname(params.definitionPath));
  const outputInput = await params.options.input('Output directory', params.options.cwd);
  const outputDir = resolveOutputDirectory(outputInput, params.options.cwd);

  ensurePathIsNotSymbolicLink(outputDir, 'Output directory');
  ensurePathAncestorsContainNoSymbolicLinks(outputDir, 'Output directory', params.options.cwd);
  mkdirSync(outputDir, { recursive: true });

  const templateRelativePaths = collectDirectoryFiles(templateDir);
  const templateOutputPaths = templateRelativePaths.map(relativePath => resolve(outputDir, relativePath));
  await confirmOverwriteForExistingPaths({
    options: params.options,
    existingPaths: templateOutputPaths.filter(path => existsSync(path)),
    promptMessage: 'Output files exist. Overwrite?',
    cancelMessage: 'Output files exist and overwrite was cancelled',
  });

  copyDirectoryTree(templateDir, outputDir);

  const sections = buildSkillSections({
    definition: params.definition,
    definitionDir: dirname(params.definitionPath),
    facetsRoots: params.facetsRoots,
  });

  applyFacetTokensToFiles({
    filePaths: templateOutputPaths.filter(path => existsSync(path)),
    tokenValues: buildInlineFacetTokenValues(sections),
    rootDir: outputDir,
  });

  return {
    kind: 'path',
    path: outputDir,
  };
}

async function runStandardCompose(params: {
  options: FacetCliOptions;
  facetsRoots: readonly string[];
  definitionPath: string;
  definition: ComposeDefinition;
}): Promise<FacetCliResult> {
  const safeName = ensureSafeDefinitionName(params.definition.name);

  const facetSet = buildFacetSet({
    definitionDir: dirname(params.definitionPath),
    facetsRoots: params.facetsRoots,
    definition: params.definition,
  });

  const composed = compose(facetSet, {
    contextMaxChars: 2000,
    userMessageOrder: params.definition.order,
  });

  const splitSelection = await params.options.select(
    ['Combined (single file)', 'Split (system + user)'],
    'Choose output mode with Up/Down and Enter:',
  );
  const outputPlans = buildComposeOutputPlans({
    safeName,
    systemPrompt: composed.systemPrompt,
    userMessage: composed.userMessage,
    splitSystem: splitSelection === 'Split (system + user)',
  });
  const outputInput = await params.options.input('Output directory', params.options.cwd);
  const outputDir = resolveOutputDirectory(outputInput, params.options.cwd);

  const existingPaths = outputPlans
    .map(plan => resolve(outputDir, plan.fileName))
    .filter(path => existsSync(path));
  const overwrite = await confirmOverwriteForExistingPaths({
    options: params.options,
    existingPaths,
    promptMessage: 'Output file exists. Overwrite?',
    cancelMessage: 'Output file exists and overwrite was cancelled',
  });

  const outputPaths: string[] = [];
  for (const plan of outputPlans) {
    outputPaths.push(await writeComposeOutput({
      outputDir,
      fileName: plan.fileName,
      content: plan.content,
      overwrite,
    }));
  }

  if (outputPaths.length === 1) {
    return {
      kind: 'path',
      path: outputPaths[0]!,
    };
  }

  return {
    kind: 'paths',
    paths: outputPaths,
  };
}

export async function runComposeCommand(options: FacetCliOptions): Promise<FacetCliResult> {
  const { facetedRoots, facetsRoots, compositionsDirs } = getSkillPaths(options.cwd, options.homeDir);
  const localCompositionsDir = facetedRoots.length > 1 ? resolve(facetedRoots[0]!, 'compositions') : undefined;
  const globalCompositionsDir = resolve(facetedRoots[facetedRoots.length - 1]!, 'compositions');

  const { definitionPath } = await selectCompositionDefinitionPath({
    options,
    compositionDefinitionDirs: compositionsDirs,
    localCompositionsDir,
    globalCompositionsDir,
    cancelAction: 'Compose',
  });

  const definition = await loadComposeDefinition(definitionPath);

  if (definition.template) {
    return runTemplateBackedCompose({
      options,
      facetedRoots,
      facetsRoots,
      definitionPath,
      definition,
    });
  }

  return runStandardCompose({
    options,
    facetsRoots,
    definitionPath,
    definition,
  });
}
