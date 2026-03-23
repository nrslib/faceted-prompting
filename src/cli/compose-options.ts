import type { ComposeCliOptions } from './types.js';

function requireOptionValue(
  args: readonly string[],
  index: number,
  optionName: '--composition' | '--output',
): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}`);
  }
  return value;
}

export function parseComposeOptions(args: readonly string[]): ComposeCliOptions {
  let composition: string | undefined;
  let outputMode: ComposeCliOptions['outputMode'];
  let output: string | undefined;
  let overwrite = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) {
      throw new Error('Unsupported compose argument: undefined');
    }

    if (arg === '--composition') {
      composition = requireOptionValue(args, index, '--composition');
      index += 1;
      continue;
    }

    if (arg === '--output') {
      output = requireOptionValue(args, index, '--output');
      index += 1;
      continue;
    }

    if (arg === '--split') {
      if (outputMode === 'combined') {
        throw new Error('Cannot specify both --split and --combined');
      }
      outputMode = 'split';
      continue;
    }

    if (arg === '--combined') {
      if (outputMode === 'split') {
        throw new Error('Cannot specify both --split and --combined');
      }
      outputMode = 'combined';
      continue;
    }

    if (arg === '--overwrite') {
      overwrite = true;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unsupported compose option: ${arg}`);
    }

    throw new Error(`Unsupported compose argument: ${arg}`);
  }

  return {
    composition,
    outputMode,
    output,
    overwrite: overwrite || undefined,
  };
}

export function isNonInteractiveMode(options: ComposeCliOptions): boolean {
  return options.composition !== undefined
    || options.outputMode !== undefined
    || options.output !== undefined
    || options.overwrite === true;
}
