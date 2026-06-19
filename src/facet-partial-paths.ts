import { join } from 'node:path';
import type { FacetKind } from './types.js';

export const FACET_PARTIAL_KINDS = [
  'instructions',
  'policies',
  'knowledge',
  'output-contracts',
] as const satisfies readonly Exclude<FacetKind, 'personas'>[];

export type FacetPartialKind = (typeof FACET_PARTIAL_KINDS)[number];

export function isFacetPartialKind(kind: string): kind is FacetPartialKind {
  return FACET_PARTIAL_KINDS.some(facetPartialKind => facetPartialKind === kind);
}

export function facetPartialsFacetDir(kind: FacetPartialKind): string {
  return `partials/${kind}`;
}

export function facetPartialsDir(facetsRoot: string, kind: FacetPartialKind): string {
  return join(facetsRoot, facetPartialsFacetDir(kind));
}

export function facetPartialKindFromPath(path: string): FacetPartialKind | undefined {
  const segments = path.split(/[\\/]+/u);
  const partialsIndex = segments.lastIndexOf('partials');
  if (partialsIndex < 0) {
    return undefined;
  }

  const kind = segments[partialsIndex + 1];
  if (!kind || !isFacetPartialKind(kind)) {
    return undefined;
  }
  return kind;
}
