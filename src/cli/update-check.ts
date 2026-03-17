import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import updateNotifier from 'update-notifier';

interface PackageInfo {
  readonly name: string;
  readonly version: string;
}

async function readPackageInfo(): Promise<PackageInfo> {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDirectoryPath = dirname(currentFilePath);
  const packageJsonPath = resolve(currentDirectoryPath, '../../package.json');
  const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonContent) as unknown;

  if (typeof packageJson !== 'object' || packageJson === null) {
    throw new Error('package.json must be an object');
  }

  const { name, version } = packageJson as Record<string, unknown>;
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('package.json name is required');
  }
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('package.json version is required');
  }

  return { name, version };
}

export async function checkForUpdates(): Promise<void> {
  try {
    const pkg = await readPackageInfo();
    updateNotifier({ pkg }).notify();
  } catch {
    process.emitWarning('Failed to check for updates.');
  }
}
