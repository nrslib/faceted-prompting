import { homedir } from 'node:os';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { runFacetCli } from './index.js';
import { selectInteractive } from './select.js';

async function inputInteractive(prompt: string, defaultValue: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const renderedPrompt = prompt.includes('[y/N]') || prompt.includes('[Y/n]')
      ? `${prompt}: `
      : `${prompt} [${defaultValue}]: `;
    const answer = (await rl.question(renderedPrompt)).trim();
    return answer.length > 0 ? answer : defaultValue;
  } finally {
    rl.close();
  }
}

export interface RunnerDependencies {
  readonly runFacetCli: typeof runFacetCli;
  readonly writeStdout: (message: string) => void;
  readonly writeStderr: (message: string) => void;
  readonly setExitCode: (code: number) => void;
}

function defaultDependencies(): RunnerDependencies {
  return {
    runFacetCli,
    writeStdout: message => {
      output.write(message);
    },
    writeStderr: message => {
      process.stderr.write(message);
    },
    setExitCode: code => {
      process.exitCode = code;
    },
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runMain(
  argv: string[],
  dependencies: RunnerDependencies = defaultDependencies(),
): Promise<void> {
  try {
    const result = await dependencies.runFacetCli(argv, {
      cwd: process.cwd(),
      homeDir: homedir(),
      select: selectInteractive,
      input: inputInteractive,
    });

    if (result.kind === 'path') {
      dependencies.writeStdout(`Generated: ${result.path}\n`);
      return;
    }

    if (result.kind === 'paths') {
      dependencies.writeStdout(`Generated:\n${result.paths.map(path => `- ${path}`).join('\n')}\n`);
      return;
    }

    dependencies.writeStdout(`${result.text}\n`);
  } catch (error: unknown) {
    dependencies.writeStderr(`facet command failed: ${toErrorMessage(error)}\n`);
    dependencies.setExitCode(1);
  }
}

export async function main(argv: string[]): Promise<void> {
  await runMain(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main(process.argv.slice(2));
}
