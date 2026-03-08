import { homedir } from 'node:os';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { runFacetCli } from './index.js';
import { selectInteractive } from './select.js';

async function inputInteractive(prompt: string, defaultValue: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(`${prompt} [${defaultValue}]: `)).trim();
    return answer.length > 0 ? answer : defaultValue;
  } finally {
    rl.close();
  }
}

export async function main(argv: string[]): Promise<void> {
  const result = await runFacetCli(argv, {
    cwd: process.cwd(),
    homeDir: homedir(),
    select: selectInteractive,
    input: inputInteractive,
  });

  output.write(`Generated: ${result.outputPath}\n`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`facet compose failed: ${message}\n`);
  process.exitCode = 1;
});
