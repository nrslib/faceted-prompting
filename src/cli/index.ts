import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compose } from '../compose.js';
import { loadComposeDefinition } from '../compose-definition.js';
import { readFacetedConfig } from '../config/index.js';
import { initializeFacetedHome } from '../init/index.js';
import { formatComposedOutput, resolveOutputDirectory, writeComposeOutput } from '../output/index.js';
import { buildFacetSet, ensureSafeDefinitionName, listCompositionDefinitions } from './skill-renderer.js';
import {
  getSkillPaths,
  runInstallSkillCommand,
  runListSkillCommand,
  runUninstallSkillCommand,
  runUpdateSkillCommand,
} from './skill-commands.js';
import type { FacetCliOptions, FacetCliResult } from './types.js';

function shouldOverwrite(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

function ensureCommand(command: string | undefined): string {
  if (!command) {
    throw new Error('Unsupported command: (none)');
  }
  return command;
}

function ensureSkillSubcommand(command: string, subcommand: string | undefined): void {
  if (subcommand !== 'skill') {
    throw new Error(`Unsupported command: ${command}`);
  }
}

async function runComposeCommand(options: FacetCliOptions): Promise<FacetCliResult> {
  const { facetsRoot, compositionsDir } = getSkillPaths(options.homeDir);

  const definitionMap = listCompositionDefinitions(compositionsDir);
  const candidates = Object.keys(definitionMap).sort();
  if (candidates.length === 0) {
    throw new Error(`No compose definitions found in ${compositionsDir}`);
  }

  const selected = await options.select(candidates);
  const definitionPath = definitionMap[selected];
  if (!definitionPath) {
    throw new Error(`Unknown compose definition selected: ${selected}`);
  }

  const definition = await loadComposeDefinition(definitionPath);
  const definitionDir = dirname(definitionPath);

  const facetSet = buildFacetSet({
    definitionDir,
    facetsRoot,
    definition,
  });

  const composed = compose(facetSet, {
    contextMaxChars: 8000,
    userMessageOrder: definition.order,
  });

  const outputInput = await options.input('Output directory', options.cwd);
  const outputDir = resolveOutputDirectory(outputInput, options.cwd);
  const outputFileName = `${ensureSafeDefinitionName(definition.name)}.prompt.md`;
  const outputCandidatePath = resolve(outputDir, outputFileName);
  let overwrite = false;

  if (existsSync(outputCandidatePath)) {
    const overwriteAnswer = await options.input(
      `Output file exists. Overwrite? (${outputCandidatePath})`,
      'n',
    );

    if (!shouldOverwrite(overwriteAnswer)) {
      throw new Error(`Output file exists and overwrite was cancelled: ${outputCandidatePath}`);
    }
    overwrite = true;
  }

  const outputPath = await writeComposeOutput({
    outputDir,
    fileName: outputFileName,
    content: formatComposedOutput(composed),
    overwrite,
  });

  return {
    kind: 'path',
    path: outputPath,
  };
}

export async function runFacetCli(
  args: string[],
  options: FacetCliOptions,
): Promise<FacetCliResult> {
  const command = ensureCommand(args[0]);
  const subcommand = args[1];

  await initializeFacetedHome({ homeDir: options.homeDir });
  await readFacetedConfig(options.homeDir);

  if (command === 'compose') {
    return runComposeCommand(options);
  }

  if (command === 'install') {
    ensureSkillSubcommand(command, subcommand);
    return runInstallSkillCommand(options);
  }

  if (command === 'update') {
    ensureSkillSubcommand(command, subcommand);
    return runUpdateSkillCommand(options);
  }

  if (command === 'uninstall') {
    ensureSkillSubcommand(command, subcommand);
    return runUninstallSkillCommand(options);
  }

  if (command === 'list') {
    ensureSkillSubcommand(command, subcommand);
    return runListSkillCommand(options);
  }

  throw new Error(`Unsupported command: ${command}`);
}
