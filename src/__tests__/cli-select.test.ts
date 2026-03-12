import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

type SelectModule = {
  selectInteractiveFromIO: (
    candidates: string[],
    inStream: NodeJS.ReadStream & { setRawMode: (mode: boolean) => void },
    outStream: NodeJS.WriteStream,
    prompt?: string,
  ) => Promise<string>;
};

class FakeInput extends EventEmitter {
  isTTY = true;
  setRawMode = vi.fn();
  resume = vi.fn();
}

class FakeOutput {
  writes: string[] = [];

  write(chunk: string): boolean {
    this.writes.push(chunk);
    return true;
  }
}

async function loadSelectModule(): Promise<SelectModule> {
  const modulePath = pathToFileURL(resolve('src/cli/select.ts')).href;
  return import(modulePath) as Promise<SelectModule>;
}

describe('selectInteractiveFromIO', () => {
  it('should select item moved by arrow key input', async () => {
    const { selectInteractiveFromIO } = await loadSelectModule();
    const input = new FakeInput();
    const output = new FakeOutput();

    const promise = selectInteractiveFromIO(
      ['alpha', 'beta', 'gamma'],
      input as unknown as NodeJS.ReadStream & { setRawMode: (mode: boolean) => void },
      output as unknown as NodeJS.WriteStream,
    );

    input.emit('keypress', '', { name: 'down' });
    input.emit('keypress', '', { name: 'return' });

    await expect(promise).resolves.toBe('beta');
    expect(input.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(input.setRawMode).toHaveBeenNthCalledWith(2, false);
  });

  it('should reject when stream is not a tty', async () => {
    const { selectInteractiveFromIO } = await loadSelectModule();
    const input = new FakeInput();
    input.isTTY = false;
    const output = new FakeOutput();

    await expect(selectInteractiveFromIO(
      ['alpha', 'beta'],
      input as unknown as NodeJS.ReadStream & { setRawMode: (mode: boolean) => void },
      output as unknown as NodeJS.WriteStream,
    )).rejects.toThrow('requires a TTY');
  });

  it('should render custom prompt when provided', async () => {
    const { selectInteractiveFromIO } = await loadSelectModule();
    const input = new FakeInput();
    const output = new FakeOutput();

    const promise = selectInteractiveFromIO(
      ['Claude Code', 'Codex'],
      input as unknown as NodeJS.ReadStream & { setRawMode: (mode: boolean) => void },
      output as unknown as NodeJS.WriteStream,
      'Choose install target with Up/Down and Enter:',
    );

    input.emit('keypress', '', { name: 'return' });

    await expect(promise).resolves.toBe('Claude Code');
    expect(output.writes.join('')).toContain('Choose install target with Up/Down and Enter:');
  });
});
