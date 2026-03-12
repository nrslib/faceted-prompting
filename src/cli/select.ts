import { stdin as input, stdout as output } from 'node:process';
import { emitKeypressEvents } from 'node:readline';

type SelectInput = NodeJS.ReadStream & {
  setRawMode: (mode: boolean) => void;
};

function renderMenu(candidates: string[], selectedIndex: number, prompt: string): string[] {
  const lines: string[] = [prompt];
  for (let index = 0; index < candidates.length; index += 1) {
    const marker = index === selectedIndex ? '\x1B[36m❯\x1B[0m' : ' ';
    lines.push(`${marker} ${candidates[index]}`);
  }
  return lines;
}

function drawMenu(out: NodeJS.WriteStream, lines: string[]): void {
  out.write(lines.join('\n') + '\n');
}

function redrawMenu(out: NodeJS.WriteStream, lines: string[], prevLineCount: number): void {
  out.write(`\x1B[${prevLineCount}A`); // move cursor up
  out.write('\x1B[J');                  // clear from cursor to end
  drawMenu(out, lines);
}

export async function selectInteractiveFromIO(
  candidates: string[],
  inStream: SelectInput,
  outStream: NodeJS.WriteStream,
  prompt = 'Choose option with Up/Down and Enter:',
): Promise<string> {
  if (!inStream.isTTY) {
    throw new Error('Interactive selection requires a TTY');
  }

  emitKeypressEvents(inStream);
  inStream.setRawMode(true);
  inStream.resume();

  let selectedIndex = 0;
  let prevLineCount = 0;

  const lines = renderMenu(candidates, selectedIndex, prompt);
  outStream.write('\n');
  drawMenu(outStream, lines);
  prevLineCount = lines.length;

  return new Promise((resolve, reject) => {
    const handleKeyPress = (_str: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Selection cancelled by user'));
        return;
      }

      if (key.name === 'up') {
        selectedIndex = selectedIndex === 0 ? candidates.length - 1 : selectedIndex - 1;
        const newLines = renderMenu(candidates, selectedIndex, prompt);
        redrawMenu(outStream, newLines, prevLineCount);
        prevLineCount = newLines.length;
        return;
      }

      if (key.name === 'down') {
        selectedIndex = selectedIndex === candidates.length - 1 ? 0 : selectedIndex + 1;
        const newLines = renderMenu(candidates, selectedIndex, prompt);
        redrawMenu(outStream, newLines, prevLineCount);
        prevLineCount = newLines.length;
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        const selected = candidates[selectedIndex];
        cleanup();
        resolve(selected!);
      }
    };

    const cleanup = (): void => {
      inStream.off('keypress', handleKeyPress);
      inStream.setRawMode(false);
      outStream.write('\n');
    };

    inStream.on('keypress', handleKeyPress);
  });
}

export async function selectInteractive(candidates: string[], prompt?: string): Promise<string> {
  return selectInteractiveFromIO(candidates, input as SelectInput, output, prompt);
}
