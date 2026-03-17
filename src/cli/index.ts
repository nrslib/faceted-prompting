import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { compose } from '../compose.js';
import {
  initializeGlobalFaceted,
  initializeLocalFaceted,
  listPullSampleTargetPaths,
  pullSampleFacets,
} from '../init/index.js';
import { formatCombinedOutput, resolveOutputDirectory, writeComposeOutput } from '../output/index.js';
import { resolveComposeContext } from './compose-context.js';
import { buildFacetSet, ensureSafeDefinitionName } from './skill-renderer.js';
import {
  getSkillPaths,
  runInstallSkillCommand,
} from './skill-commands.js';
import type { FacetCliOptions, FacetCliResult } from './types.js';
import { shouldOverwrite } from './install-skill/flow.js';

const USAGE = [
  'Usage: facet <command>',
  '',
  'Commands:',
  '  init                 Initialize local faceted home (.faceted under cwd)',
  '  init global          Initialize global faceted home (~/.faceted) and pull sample facets',
  '  pull-sample          Pull sample coding facets from TAKT on GitHub',
  '  compose              Compose facets into a prompt file',
  '  install skill        Install a skill from a composition',
].join('\n');

function ensureCommand(command: string | undefined): string {
  if (!command) {
    throw new Error(USAGE);
  }
  return command;
}

function ensureSkillSubcommand(command: string, subcommand: string | undefined): void {
  if (subcommand !== 'skill') {
    throw new Error(`Unsupported command: ${command}`);
  }
}

async function runComposeCommand(options: FacetCliOptions): Promise<FacetCliResult> {
  const { facetsRoots, facetedRoots } = getSkillPaths(options.cwd, options.homeDir);
  const composeContext = resolveComposeContext(options.cwd);
  const definition = {
    name: composeContext.name,
    persona: 'coder',
    policies: ['coding', 'ai-antipattern'],
    knowledge: composeContext.knowledgeRefs,
    instruction: composeContext.relatedInstruction,
    order: ['policies', 'knowledge', 'instruction'] as const,
  };
  const definitionDir = facetedRoots[0];
  if (!definitionDir) {
    throw new Error('Faceted root is required');
  }

  const facetSet = buildFacetSet({
    definitionDir,
    facetsRoots,
    definition,
  });

  const composed = compose(facetSet, {
    contextMaxChars: 2000,
    userMessageOrder: definition.order,
  });

  const splitSelection = await options.select(
    ['Combined (single file)', 'Split (system + user)'],
    'Choose output mode with Up/Down and Enter:',
  );
  const splitSystem = splitSelection === 'Split (system + user)';

  const outputInput = await options.input('Output directory', options.cwd);
  const outputDir = resolveOutputDirectory(outputInput, options.cwd);
  const safeName = ensureSafeDefinitionName(definition.name);
  const outputPlans = splitSystem
    ? [
        {
          fileName: `${safeName}.system.md`,
          content: `${composed.systemPrompt}\n`,
        },
        {
          fileName: `${safeName}.user.md`,
          content: `${composed.userMessage}\n`,
        },
      ]
    : [
        {
          fileName: `${safeName}.md`,
          content: formatCombinedOutput(composed),
        },
      ];
  const existingPaths = outputPlans
    .map(plan => resolve(outputDir, plan.fileName))
    .filter(path => existsSync(path));
  let overwrite = false;

  if (existingPaths.length > 0) {
    const overwriteAnswer = await options.input(
      `Output file exists. Overwrite? (${existingPaths.join(', ')}) [y/N]`,
      'n',
    );

    if (!shouldOverwrite(overwriteAnswer)) {
      throw new Error(`Output file exists and overwrite was cancelled: ${existingPaths.join(', ')}`);
    }
    overwrite = true;
  }

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

export async function runFacetCli(
  args: string[],
  options: FacetCliOptions,
): Promise<FacetCliResult> {
  const command = ensureCommand(args[0]);
  const subcommand = args[1];

  if (command === 'init') {
    if (subcommand === undefined) {
      await initializeLocalFaceted({ cwd: options.cwd });
      return {
        kind: 'text',
        text: `Initialized: ${resolve(options.cwd, '.faceted')}`,
      };
    }

    if (subcommand === 'global') {
      await initializeGlobalFaceted({ homeDir: options.homeDir });
      return {
        kind: 'text',
        text: `Initialized global with sample facets: ${resolve(options.homeDir, '.faceted')}`,
      };
    }

    throw new Error(`Unsupported command: ${command} ${subcommand}`);
  }

  if (command === 'pull-sample') {
    const overlappingPaths = listPullSampleTargetPaths(options.homeDir).filter(path => existsSync(path));
    let overwrite = false;

    if (overlappingPaths.length > 0) {
      const overwriteAnswer = await options.input(
        `Pull sample will overwrite existing files. Continue? (${overlappingPaths.join(', ')}) [y/N]`,
        'n',
      );
      if (!shouldOverwrite(overwriteAnswer)) {
        throw new Error(`Pull sample was cancelled: ${overlappingPaths.join(', ')}`);
      }
      overwrite = true;
    }

    await pullSampleFacets({ homeDir: options.homeDir, overwrite });
    return {
      kind: 'text',
      text: `Pulled sample: ${resolve(options.homeDir, '.faceted')}`,
    };
  }

  if (command !== 'compose' && command !== 'install') {
    throw new Error(`Unsupported command: ${command}`);
  }

  if (command === 'compose') {
    return runComposeCommand(options);
  }

  if (command === 'install') {
    ensureSkillSubcommand(command, subcommand);
    return runInstallSkillCommand(options);
  }

  throw new Error(`Unsupported command: ${command}`);
}
