import { loadComposeDefinition } from '../compose-definition.js';
import type { ComposeDefinition } from '../types.js';
import { isNonInteractiveMode } from './compose-options.js';
import { getSkillPaths, resolveCompositionDefinitionPathByName, selectCompositionDefinitionPath } from './skill-commands.js';
import type { ComposeCliOptions, FacetCliOptions } from './types.js';

function requireCompositionName(composeOptions: ComposeCliOptions): string {
  if (!composeOptions.composition) {
    throw new Error('Non-interactive compose requires --composition');
  }

  return composeOptions.composition;
}

function validateNonInteractiveComposeOptions(params: {
  composeOptions: ComposeCliOptions;
  definition: ComposeDefinition;
}): void {
  if (params.definition.template) {
    if (params.composeOptions.outputMode) {
      throw new Error('Template-backed compose does not support --split or --combined');
    }
    return;
  }

  if (!params.composeOptions.outputMode) {
    throw new Error('Non-interactive standard compose requires --split or --combined');
  }
}

export async function resolveComposeDefinition(params: {
  options: FacetCliOptions;
  composeOptions: ComposeCliOptions;
}): Promise<{
  facetedRoots: readonly string[];
  facetsRoots: readonly string[];
  definitionPath: string;
  definition: ComposeDefinition;
}> {
  const {
    facetedRoots,
    facetsRoots,
    compositionsDirs,
    localCompositionsDir,
    globalCompositionsDir,
  } = getSkillPaths(params.options.cwd, params.options.homeDir);
  const nonInteractive = isNonInteractiveMode(params.composeOptions);

  const definitionPath = nonInteractive
    ? resolveCompositionDefinitionPathByName({
      compositionName: requireCompositionName(params.composeOptions),
      compositionDefinitionDirs: compositionsDirs,
      localCompositionsDir,
      globalCompositionsDir,
    }).definitionPath
    : (await selectCompositionDefinitionPath({
      options: params.options,
      compositionDefinitionDirs: compositionsDirs,
      localCompositionsDir,
      globalCompositionsDir,
      cancelAction: 'Compose',
    })).definitionPath;

  const definition = await loadComposeDefinition(definitionPath);
  if (nonInteractive) {
    validateNonInteractiveComposeOptions({
      composeOptions: params.composeOptions,
      definition,
    });
  }

  return {
    facetedRoots,
    facetsRoots,
    definitionPath,
    definition,
  };
}
