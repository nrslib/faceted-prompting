import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('cli', () => {
  let originalArgv: string[];
  let exitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalArgv = process.argv;
    exitSpy = vi.fn();
    vi.spyOn(process, 'exit').mockImplementation(exitSpy as unknown as (code?: number | string | null | undefined) => never);
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.resetModules();
  });

  it('should display help and exit with 0 for --help', async () => {
    process.argv = ['node', 'facet', '--help'];
    
    const { main } = await import('../cli.js');
    main();
    
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should display help and exit with 0 for -h', async () => {
    process.argv = ['node', 'facet', '-h'];
    
    const { main } = await import('../cli.js');
    main();
    
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should display version and exit with 0 for --version', async () => {
    process.argv = ['node', 'facet', '--version'];
    
    const { main } = await import('../cli.js');
    main();
    
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should display version and exit with 0 for -v', async () => {
    process.argv = ['node', 'facet', '-v'];
    
    const { main } = await import('../cli.js');
    main();
    
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should display error and exit with 1 for unknown flag', async () => {
    process.argv = ['node', 'facet', '--unknown'];
    
    const { main } = await import('../cli.js');
    main();
    
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should display error and exit with 1 for no arguments', async () => {
    process.argv = ['node', 'facet'];
    
    const { main } = await import('../cli.js');
    main();
    
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
