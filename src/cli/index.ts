import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeGlobalFaceted,
  initializeLocalFaceted,
  listPullSampleTargetPaths,
  pullSampleFacets,
} from '../init/index.js';
import {
  runComposeCommand,
} from './compose-command.js';
import { parseComposeOptions } from './compose-options.js';
import {
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
    return runComposeCommand(options, parseComposeOptions(args.slice(1)));
  }

  if (command === 'install') {
    ensureSkillSubcommand(command, subcommand);
    return runInstallSkillCommand(options);
  }

  throw new Error(`Unsupported command: ${command}`);
}
