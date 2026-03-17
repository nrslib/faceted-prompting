import { describe, expect, it } from 'vitest';
import { runMain } from '../cli/runner.js';

describe('runner', () => {
  it('should print generated path when runFacetCli returns path result', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;

    await runMain(['compose'], {
      checkForUpdates: async () => {},
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
      checkForUpdates: async () => {},
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

  it('should print text output when runFacetCli returns text result', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;

    await runMain(['init'], {
      checkForUpdates: async () => {},
      runFacetCli: async () => ({
        kind: 'text',
        text: 'Initialized: /tmp/home/.faceted',
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

    expect(stdout).toEqual(['Initialized: /tmp/home/.faceted\n']);
    expect(stderr).toEqual([]);
    expect(exitCode).toBeUndefined();
  });

  it('should print failure message and set exit code when runFacetCli throws', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;

    await runMain(['install', 'skill'], {
      checkForUpdates: async () => {},
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

  it('should invoke update check before running facet cli', async () => {
    const callOrder: string[] = [];
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;

    await runMain(['compose'], {
      checkForUpdates: () => {
        callOrder.push('checkForUpdates');
        return Promise.resolve();
      },
      runFacetCli: async () => {
        callOrder.push('runFacetCli');
        return {
          kind: 'text',
          text: 'ok',
        };
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

    expect(callOrder).toEqual(['checkForUpdates', 'runFacetCli']);
    expect(stdout).toEqual(['ok\n']);
    expect(stderr).toEqual([]);
    expect(exitCode).toBeUndefined();
  });

  it('should continue running facet cli when update check throws synchronously', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;

    await runMain(['compose'], {
      checkForUpdates: () => {
        throw new Error('sync update failure');
      },
      runFacetCli: async () => ({
        kind: 'text',
        text: 'ok',
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

    expect(stdout).toEqual(['ok\n']);
    expect(stderr).toContain('update check failed: sync update failure\n');
    expect(exitCode).toBeUndefined();
  });

  it('should continue running facet cli when update check rejects asynchronously', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;

    await runMain(['compose'], {
      checkForUpdates: async () => {
        throw new Error('async update failure');
      },
      runFacetCli: async () => ({
        kind: 'text',
        text: 'ok',
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

    await Promise.resolve();

    expect(stdout).toEqual(['ok\n']);
    expect(stderr).toContain('update check failed: async update failure\n');
    expect(exitCode).toBeUndefined();
  });

  it('should run facet cli without waiting for update check completion', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let exitCode: number | undefined;
    let resolveUpdateCheck: (() => void) | undefined;
    let runFacetCliCalled = false;

    await runMain(['compose'], {
      checkForUpdates: () => new Promise<void>(resolve => {
        resolveUpdateCheck = resolve;
      }),
      runFacetCli: async () => {
        runFacetCliCalled = true;
        return {
          kind: 'text',
          text: 'ok',
        };
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

    expect(runFacetCliCalled).toBe(true);
    expect(stdout).toEqual(['ok\n']);
    expect(stderr).toEqual([]);
    expect(exitCode).toBeUndefined();

    resolveUpdateCheck?.();
  });
});
