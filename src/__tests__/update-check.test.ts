import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import updateNotifier from 'update-notifier';
import { checkForUpdates } from '../cli/update-check.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('update-notifier', () => ({
  default: vi.fn(),
}));

const mockReadFile = vi.mocked(readFile);
const mockUpdateNotifier = vi.mocked(updateNotifier);
let mockEmitWarning: ReturnType<typeof vi.spyOn>;

describe('checkForUpdates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEmitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
  });

  it('should initialize update-notifier with package name and version then call notify', async () => {
    const notify = vi.fn();
    mockReadFile.mockResolvedValue(
      JSON.stringify({ name: 'faceted-prompting', version: '0.2.1' }),
    );
    mockUpdateNotifier.mockReturnValue({ notify } as ReturnType<typeof updateNotifier>);

    await checkForUpdates();

    expect(mockUpdateNotifier).toHaveBeenCalledWith({
      pkg: {
        name: 'faceted-prompting',
        version: '0.2.1',
      },
    });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('should emit warning when package.json cannot be parsed', async () => {
    mockReadFile.mockResolvedValue('{');

    await expect(checkForUpdates()).resolves.toBeUndefined();
    expect(mockUpdateNotifier).not.toHaveBeenCalled();
    expect(mockEmitWarning).toHaveBeenCalledWith('Failed to check for updates.');
  });

  it('should emit warning when package name is missing', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ version: '0.2.1' }));

    await expect(checkForUpdates()).resolves.toBeUndefined();
    expect(mockUpdateNotifier).not.toHaveBeenCalled();
    expect(mockEmitWarning).toHaveBeenCalledWith('Failed to check for updates.');
  });

  it('should emit warning when package name is empty', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ name: '', version: '0.2.1' }));

    await expect(checkForUpdates()).resolves.toBeUndefined();
    expect(mockUpdateNotifier).not.toHaveBeenCalled();
    expect(mockEmitWarning).toHaveBeenCalledWith('Failed to check for updates.');
  });

  it('should emit warning when package version is missing', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'faceted-prompting' }));

    await expect(checkForUpdates()).resolves.toBeUndefined();
    expect(mockUpdateNotifier).not.toHaveBeenCalled();
    expect(mockEmitWarning).toHaveBeenCalledWith('Failed to check for updates.');
  });

  it('should emit warning when package version is empty', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'faceted-prompting', version: '' }));

    await expect(checkForUpdates()).resolves.toBeUndefined();
    expect(mockUpdateNotifier).not.toHaveBeenCalled();
    expect(mockEmitWarning).toHaveBeenCalledWith('Failed to check for updates.');
  });

  it('should emit warning when update-notifier initialization fails', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ name: 'faceted-prompting', version: '0.2.1' }),
    );
    mockUpdateNotifier.mockImplementation(() => {
      throw new Error('notifier init failed');
    });

    await expect(checkForUpdates()).resolves.toBeUndefined();
    expect(mockEmitWarning).toHaveBeenCalledWith('Failed to check for updates.');
  });

  it('should emit warning when notify fails', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ name: 'faceted-prompting', version: '0.2.1' }),
    );
    mockUpdateNotifier.mockReturnValue({
      notify: () => {
        throw new Error('notify failed');
      },
    } as ReturnType<typeof updateNotifier>);

    await expect(checkForUpdates()).resolves.toBeUndefined();
    expect(mockEmitWarning).toHaveBeenCalledWith('Failed to check for updates.');
  });
});
