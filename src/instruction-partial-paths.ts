import { join } from 'node:path';

export const INSTRUCTION_PARTIALS_FACET_DIR = 'partials/instructions';

export function instructionPartialsDir(facetsRoot: string): string {
  return join(facetsRoot, INSTRUCTION_PARTIALS_FACET_DIR);
}
