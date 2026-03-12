import { dirname, join } from 'node:path';
import { loadComposeDefinition } from '../compose-definition.js';
import { getFacetedRoot } from '../config/index.js';
import {
  buildSkillSections,
  ensureSafeDefinitionName,
  listCompositionDefinitions,
} from './skill-renderer.js';
import type { FacetCliOptions, FacetCliResult } from './types.js';
import { runSkillDeployInstall } from './install-skill/modes.js';

export function getSkillPaths(homeDir: string): {
  readonly facetedRoot: string;
  readonly facetsRoot: string;
  readonly compositionsDir: string;
} {
  const facetedRoot = getFacetedRoot(homeDir);
  return {
    facetedRoot,
    facetsRoot: join(facetedRoot, 'facets'),
    compositionsDir: join(facetedRoot, 'compositions'),
  };
}

export async function runInstallSkillCommand(options: FacetCliOptions): Promise<FacetCliResult> {
  const { facetedRoot, facetsRoot, compositionsDir } = getSkillPaths(options.homeDir);

  const definitionMap = listCompositionDefinitions(compositionsDir);
  const compositionCandidates = Object.keys(definitionMap).sort();
  if (compositionCandidates.length === 0) {
    throw new Error(`No compose definitions found in ${compositionsDir}`);
  }

  const selectedComposition = await options.select(
    compositionCandidates,
    'Choose composition with Up/Down and Enter:',
  );
  const definitionPath = definitionMap[selectedComposition];
  if (!definitionPath) {
    throw new Error(`Unknown compose definition selected: ${selectedComposition}`);
  }

  const definition = await loadComposeDefinition(definitionPath);
  const safeSkillName = ensureSafeDefinitionName(definition.name);
  const definitionDir = dirname(definitionPath);
  const sections = buildSkillSections({
    definition,
    definitionDir,
    facetsRoot,
  });

  return (await runSkillDeployInstall({
    options,
    facetedRoot,
    definitionDir,
    facetsRoot,
    safeSkillName,
    definition,
    sections,
  })).result;
}
