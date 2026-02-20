/**
 * Facet reference resolution utilities.
 *
 * Resolves facet names / paths / content from candidate directories.
 * Directory construction is delegated to the caller.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

/**
 * Check if a spec looks like a resource path (vs. a facet name).
 * Paths start with './', '../', '/', '~' or end with '.md'.
 */
export function isResourcePath(spec: string): boolean {
  return (
    spec.startsWith('./') ||
    spec.startsWith('../') ||
    spec.startsWith('/') ||
    spec.startsWith('~') ||
    spec.endsWith('.md')
  );
}

/**
 * Resolve a facet name to its file path by scanning candidate directories.
 *
 * @returns Absolute file path if found, undefined otherwise.
 */
export function resolveFacetPath(
  name: string,
  candidateDirs: readonly string[],
): string | undefined {
  for (const dir of candidateDirs) {
    const filePath = join(dir, `${name}.md`);
    if (existsSync(filePath)) return filePath;
  }
  return undefined;
}

/**
 * Resolve a facet name to its file content via candidate directories.
 */
export function resolveFacetByName(
  name: string,
  candidateDirs: readonly string[],
): string | undefined {
  const filePath = resolveFacetPath(name, candidateDirs);
  if (!filePath) return undefined;
  return readFileSync(filePath, 'utf-8');
}

/** Resolve a resource spec to an absolute file path. */
export function resolveResourcePath(spec: string, baseDir: string): string {
  if (spec.startsWith('./')) return join(baseDir, spec.slice(2));
  if (spec.startsWith('/')) return spec;
  return join(baseDir, spec);
}

/**
 * Resolve a resource spec to its file content.
 * If the spec ends with .md and the file exists, returns file content.
 * Otherwise returns the spec as-is (treated as inline content).
 */
export function resolveResourceContent(
  spec: string,
  baseDir: string,
): string {
  if (spec.endsWith('.md')) {
    const resolved = resolveResourcePath(spec, baseDir);
    if (existsSync(resolved)) return readFileSync(resolved, 'utf-8');
  }
  return spec;
}

/**
 * Resolve a reference to content.
 * Looks up ref in resolvedMap first, then falls back to path/facet resolution.
 */
export function resolveRefToContent(
  ref: string,
  resolvedMap: Record<string, string> | undefined,
  baseDir: string,
  candidateDirs?: readonly string[],
): string | undefined {
  const mapped = resolvedMap?.[ref];
  if (mapped) return mapped;

  if (isResourcePath(ref)) {
    return resolveResourceContent(ref, baseDir);
  }

  if (candidateDirs) {
    const facetContent = resolveFacetByName(ref, candidateDirs);
    if (facetContent !== undefined) return facetContent;
  }

  return resolveResourceContent(ref, baseDir);
}

/** Resolve multiple references to content strings. */
export function resolveRefList(
  refs: string | string[] | undefined,
  resolvedMap: Record<string, string> | undefined,
  baseDir: string,
  candidateDirs?: readonly string[],
): string[] | undefined {
  if (refs == null) return undefined;
  const list = Array.isArray(refs) ? refs : [refs];
  const contents: string[] = [];
  for (const ref of list) {
    const content = resolveRefToContent(ref, resolvedMap, baseDir, candidateDirs);
    if (content) contents.push(content);
  }
  return contents.length > 0 ? contents : undefined;
}

/** Resolve a section map (each value resolved to file content or inline). */
export function resolveSectionMap(
  raw: Record<string, string> | undefined,
  baseDir: string,
): Record<string, string> | undefined {
  if (!raw) return undefined;
  const resolved: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    resolved[name] = resolveResourceContent(value, baseDir);
  }
  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

/** Extract display name from persona path (e.g., "coder.md" -> "coder"). */
export function extractPersonaDisplayName(personaPath: string): string {
  return basename(personaPath, '.md');
}
