import { basename, join } from 'node:path';
import { INSTRUCTION_PARTIALS_FACET_DIR } from '../../instruction-partial-paths.js';

function scopedInstructionPartialSegments(sourcePath: string): readonly string[] | undefined {
  const segments = sourcePath.split(/[\\/]+/u);
  const repertoireIndex = segments.lastIndexOf('repertoire');
  if (repertoireIndex < 0) {
    return undefined;
  }

  const owner = segments[repertoireIndex + 1];
  const repo = segments[repertoireIndex + 2];
  const facets = segments[repertoireIndex + 3];
  const partials = segments[repertoireIndex + 4];
  const instructions = segments[repertoireIndex + 5];
  const fileName = segments[repertoireIndex + 6];
  if (
    !owner?.startsWith('@') ||
    !repo ||
    facets !== 'facets' ||
    partials !== 'partials' ||
    instructions !== 'instructions' ||
    !fileName
  ) {
    return undefined;
  }

  return [owner, repo, facets, ...INSTRUCTION_PARTIALS_FACET_DIR.split('/'), fileName];
}

export function instructionPartialTargetPath(params: {
  sourcePath: string;
  targetDir: string;
  instructionPartialsDir: string;
}): string {
  const scopedSegments = scopedInstructionPartialSegments(params.sourcePath);
  if (scopedSegments) {
    return join(params.targetDir, 'repertoire', ...scopedSegments);
  }
  return join(params.instructionPartialsDir, basename(params.sourcePath));
}
