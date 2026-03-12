import { describe, expect, it } from 'vitest';
import { runMain } from '../cli/runner.js';

describe('runner', () => {
  it('should print generated path when runFacetCli returns path result', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;

    await runMain(['compose'], {
      runFacetCli: async () => ({
        kind: 'path',
        path: '/tmp/out.prompt.md',
      }),
      writeStdout: message => {
        stdout.push(message);
      },
      writeStderr: message => {
        stderr.push(message);
      },
      setExitCode: code => {
        exitCode = code;
      },
    });

    expect(stdout).toEqual(['Generated: /tmp/out.prompt.md\n']);
    expect(stderr).toEqual([]);
    expect(exitCode).toBeUndefined();
  });

  it('should print generated paths when runFacetCli returns paths result', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;

    await runMain(['compose'], {
      runFacetCli: async () => ({
        kind: 'paths',
        paths: ['/tmp/coding.system.md', '/tmp/coding.user.md'],
      }),
      writeStdout: message => {
        stdout.push(message);
      },
      writeStderr: message => {
        stderr.push(message);
      },
      setExitCode: code => {
        exitCode = code;
      },
    });

    expect(stdout).toEqual(['Generated:\n- /tmp/coding.system.md\n- /tmp/coding.user.md\n']);
    expect(stderr).toEqual([]);
    expect(exitCode).toBeUndefined();
  });

  it('should print failure message and set exit code when runFacetCli throws', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;

    await runMain(['install', 'skill'], {
      runFacetCli: async () => {
        throw new Error('boom');
      },
      writeStdout: message => {
        stdout.push(message);
      },
      writeStderr: message => {
        stderr.push(message);
      },
      setExitCode: code => {
        exitCode = code;
      },
    });

    expect(stdout).toEqual([]);
    expect(stderr).toEqual(['facet command failed: boom\n']);
    expect(exitCode).toBe(1);
  });
});
