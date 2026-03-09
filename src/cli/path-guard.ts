import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export function isWithinRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`);
}

export function ensurePathWithinHome(
  path: string,
  homeDir: string,
  label: string,
): { resolvedPath: string; homeRealPath: string } {
  const resolvedPath = resolve(path);
  const resolvedHomeDir = resolve(homeDir);
  const homeRealPath = realpathSync(resolvedHomeDir);

  if (!isWithinRoot(resolvedPath, resolvedHomeDir)) {
    throw new Error(`${label} must be inside home directory: ${resolvedPath}`);
  }

  return { resolvedPath, homeRealPath };
}

export function ensurePathWithinRoots(path: string, roots: readonly string[], label: string): string {
  const resolvedPath = resolve(path);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Missing ${label}: ${resolvedPath}`);
  }

  const pathStat = lstatSync(resolvedPath);
  if (pathStat.isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed for ${label}: ${resolvedPath}`);
  }

  const realPath = realpathSync(resolvedPath);
  for (const root of roots) {
    const resolvedRoot = resolve(root);
    const realRoot = existsSync(resolvedRoot) ? realpathSync(resolvedRoot) : resolvedRoot;
    if (isWithinRoot(realPath, realRoot)) {
      return realPath;
    }
  }

  throw new Error(`${label} must be inside allowed facets directory: ${realPath}`);
}
