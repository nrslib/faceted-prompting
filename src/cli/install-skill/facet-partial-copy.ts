import { copyFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  facetPartialKindFromPath,
  facetPartialsFacetDir,
  isFacetPartialKind,
  type FacetPartialKind,
} from '../../facet-partial-paths.js';

function scopedFacetPartialSegments(sourcePath: string): readonly string[] | undefined {
  const segments = sourcePath.split(/[\\/]+/u);
  const repertoireIndex = segments.lastIndexOf('repertoire');
  if (repertoireIndex < 0) {
    return undefined;
  }

  const owner = segments[repertoireIndex + 1];
  const repo = segments[repertoireIndex + 2];
  const facets = segments[repertoireIndex + 3];
  const partials = segments[repertoireIndex + 4];
  const kind = segments[repertoireIndex + 5];
  const fileName = segments[repertoireIndex + 6];
  const trailing = segments[repertoireIndex + 7];
  if (
    !owner?.startsWith('@') ||
    !repo ||
    facets !== 'facets' ||
    partials !== 'partials' ||
    !kind ||
    !isFacetPartialKind(kind) ||
    !fileName ||
    trailing
  ) {
    return undefined;
  }

  return [owner, repo, facets, ...facetPartialsFacetDir(kind).split('/'), fileName];
}

function requireFacetPartialKind(sourcePath: string): FacetPartialKind {
  const kind = facetPartialKindFromPath(sourcePath);
  if (kind) {
    return kind;
  }
  throw new Error(`Facet partial source path must be inside facets/partials/<kind>: ${sourcePath}`);
}

export function facetPartialTargetPath(params: {
  sourcePath: string;
  targetDir: string;
}): string {
  const scopedSegments = scopedFacetPartialSegments(params.sourcePath);
  if (scopedSegments) {
    return join(params.targetDir, 'repertoire', ...scopedSegments);
  }

  const kind = requireFacetPartialKind(params.sourcePath);
  return join(params.targetDir, 'facets', facetPartialsFacetDir(kind), basename(params.sourcePath));
}

function dedupePaths(paths: readonly string[]): readonly string[] {
  return paths.reduce<readonly string[]>((deduped, path) =>
    deduped.includes(path) ? deduped : [...deduped, path],
  []);
}

export function copyFacetPartials(params: {
  targetDir: string;
  facetPartials?: readonly string[];
  instructionPartials?: readonly string[];
}): {
  facetPartialPaths: readonly string[];
  instructionPartialPaths: readonly string[];
} {
  const sourcePaths = dedupePaths([
    ...(params.facetPartials ?? []),
    ...(params.instructionPartials ?? []),
  ]);
  const facetPartialPaths = sourcePaths.map(path => {
    const targetPath = facetPartialTargetPath({
      sourcePath: path,
      targetDir: params.targetDir,
    });
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(path, targetPath);
    return targetPath;
  });

  return {
    facetPartialPaths,
    instructionPartialPaths: facetPartialPaths.filter(path => facetPartialKindFromPath(path) === 'instructions'),
  };
}
