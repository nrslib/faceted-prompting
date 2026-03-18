import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { loadComposeDefinition } from '../compose-definition.js';
import { getFacetedRoot } from '../config/index.js';
import {
  buildSkillSections,
  ensureSafeDefinitionName,
  listCompositionDefinitions,
} from './skill-renderer.js';
import type { FacetCliOptions, FacetCliResult } from './types.js';
import { shouldOverwrite } from './install-skill/flow.js';
import { runSkillDeployInstall } from './install-skill/modes.js';

export function getSkillPaths(cwd: string, homeDir: string): {
  readonly facetedRoots: readonly string[];
  readonly facetsRoots: readonly string[];
  readonly compositionsDirs: readonly string[];
} {
  const globalFacetedRoot = getFacetedRoot(homeDir);
  const localFacetedRoot = getFacetedRoot(cwd);
  const facetedRoots = existsSync(localFacetedRoot)
    ? Array.from(new Set([localFacetedRoot, globalFacetedRoot]))
    : [globalFacetedRoot];

  return {
    facetedRoots,
    facetsRoots: facetedRoots.map(facetedRoot => join(facetedRoot, 'facets')),
    compositionsDirs: facetedRoots.map(facetedRoot => join(facetedRoot, 'compositions')),
  };
}

function resolveCompositionSource(
  definitionPath: string,
  localCompositionsDir: string | undefined,
): 'local' | 'global' {
  if (
    localCompositionsDir &&
    resolve(definitionPath).startsWith(`${resolve(localCompositionsDir)}${sep}`)
  ) {
    return 'local';
  }

  return 'global';
}

function hasGlobalCompositionShadow(
  compositionName: string,
  globalCompositionsDir: string,
): boolean {
  if (
    existsSync(join(globalCompositionsDir, `${compositionName}.yaml`)) ||
    existsSync(join(globalCompositionsDir, `${compositionName}.yml`))
  ) {
    return true;
  }
  return false;
}

export async function selectCompositionDefinitionPath(params: {
  options: FacetCliOptions;
  compositionDefinitionDirs: readonly string[];
  localCompositionsDir: string | undefined;
  globalCompositionsDir: string;
  cancelAction: 'Install' | 'Compose';
}): Promise<{ definitionPath: string }> {
  const definitionMap = listCompositionDefinitions(params.compositionDefinitionDirs);
  const compositionCandidates = Object.keys(definitionMap)
    .sort()
    .map(name => {
      const definitionPath = definitionMap[name];
      if (!definitionPath) {
        throw new Error(`Unknown compose definition: ${name}`);
      }
      const source = resolveCompositionSource(definitionPath, params.localCompositionsDir);
      return source === 'local' ? `${name} (local)` : `${name} (global)`;
    });

  if (compositionCandidates.length === 0) {
    throw new Error(`No compose definitions found in ${params.compositionDefinitionDirs.join(', ')}`);
  }

  const selectedLabel = await params.options.select(
    compositionCandidates,
    'Choose composition with Up/Down and Enter:',
  );
  const selectedComposition = selectedLabel.replace(/ \((local|global)\)$/u, '');
  const definitionPath = definitionMap[selectedComposition];
  if (!definitionPath) {
    throw new Error(`Unknown compose definition selected: ${selectedComposition}`);
  }

  if (
    resolveCompositionSource(definitionPath, params.localCompositionsDir) === 'local' &&
    hasGlobalCompositionShadow(selectedComposition, params.globalCompositionsDir)
  ) {
    const approved = await params.options.input(
      `Local composition "${selectedComposition}" overrides global definition. Continue? [y/N]`,
      'n',
    );
    if (!shouldOverwrite(approved)) {
      throw new Error(`${params.cancelAction} was cancelled for local composition: ${selectedComposition}`);
    }
  }

  return { definitionPath };
}

export async function runInstallSkillCommand(options: FacetCliOptions): Promise<FacetCliResult> {
  const { facetedRoots, facetsRoots, compositionsDirs } = getSkillPaths(options.cwd, options.homeDir);
  const localFacetedRoot = getFacetedRoot(options.cwd);
  const globalFacetedRoot = getFacetedRoot(options.homeDir);
  const localCompositionsDir = existsSync(localFacetedRoot) ? join(localFacetedRoot, 'compositions') : undefined;
  const globalCompositionsDir = join(globalFacetedRoot, 'compositions');

  const { definitionPath } = await selectCompositionDefinitionPath({
    options,
    compositionDefinitionDirs: compositionsDirs,
    localCompositionsDir,
    globalCompositionsDir,
    cancelAction: 'Install',
  });

  const definition = await loadComposeDefinition(definitionPath);
  const safeSkillName = ensureSafeDefinitionName(definition.name);
  const definitionDir = dirname(definitionPath);
  const sections = buildSkillSections({
    definition,
    definitionDir,
    facetsRoots,
  });

  return (await runSkillDeployInstall({
    options,
    facetedRoots,
    definitionDir,
    facetsRoots,
    safeSkillName,
    definition,
    sections,
  })).result;
}
