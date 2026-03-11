import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

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

function findNearestExistingAncestor(path: string): string {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`No existing ancestor found for path: ${path}`);
    }
    current = parent;
  }
  return current;
}

export function ensurePathAncestorsAndRealPathWithinHome(
  path: string,
  homeDir: string,
  label: string,
): { resolvedPath: string; homeRealPath: string } {
  const { resolvedPath, homeRealPath } = ensurePathWithinHome(path, homeDir, label);
  const resolvedHomeDir = resolve(homeDir);

  let current = resolvedPath;
  while (isWithinRoot(current, resolvedHomeDir)) {
    if (existsSync(current)) {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in ${label} path: ${current}`);
      }
    }

    if (current === resolvedHomeDir) {
      break;
    }
    current = dirname(current);
  }

  const existingAncestor = findNearestExistingAncestor(resolvedPath);
  const ancestorRealPath = realpathSync(existingAncestor);
  if (!isWithinRoot(ancestorRealPath, homeRealPath)) {
    throw new Error(`${label} must resolve inside home directory: ${resolvedPath}`);
  }

  return { resolvedPath, homeRealPath };
}
