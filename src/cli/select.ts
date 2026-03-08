import { stdin as input, stdout as output } from 'node:process';
import { emitKeypressEvents } from 'node:readline';

type SelectInput = NodeJS.ReadStream & {
  setRawMode: (mode: boolean) => void;
};

function renderCandidates(candidates: string[], selectedIndex: number, out: NodeJS.WriteStream): void {
  out.write('\nChoose composition with Up/Down and Enter:\n');
  for (let index = 0; index < candidates.length; index += 1) {
    const marker = index === selectedIndex ? '>' : ' ';
    out.write(`${marker} ${candidates[index]}\n`);
  }
}

export async function selectInteractiveFromIO(
  candidates: string[],
  inStream: SelectInput,
  outStream: NodeJS.WriteStream,
): Promise<string> {
  if (candidates.length === 1) {
    return candidates[0]!;
  }

  if (!inStream.isTTY) {
    throw new Error('Interactive selection requires a TTY');
  }

  emitKeypressEvents(inStream);
  inStream.setRawMode(true);
  inStream.resume();

  let selectedIndex = 0;
  renderCandidates(candidates, selectedIndex, outStream);

  return new Promise((resolve, reject) => {
    const handleKeyPress = (_str: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Selection cancelled by user'));
        return;
      }

      if (key.name === 'up') {
        selectedIndex = selectedIndex === 0 ? candidates.length - 1 : selectedIndex - 1;
        renderCandidates(candidates, selectedIndex, outStream);
        return;
      }

      if (key.name === 'down') {
        selectedIndex = selectedIndex === candidates.length - 1 ? 0 : selectedIndex + 1;
        renderCandidates(candidates, selectedIndex, outStream);
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

export async function selectInteractive(candidates: string[]): Promise<string> {
  return selectInteractiveFromIO(candidates, input as SelectInput, output);
}
