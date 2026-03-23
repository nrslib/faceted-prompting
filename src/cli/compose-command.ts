import { resolveComposeDefinition } from './compose-definition-resolution.js';
import { runStandardCompose, runTemplateBackedCompose } from './compose-execution.js';
import type { ComposeCliOptions, FacetCliOptions, FacetCliResult } from './types.js';

export async function runComposeCommand(
  options: FacetCliOptions,
  composeOptions: ComposeCliOptions,
): Promise<FacetCliResult> {
  const resolved = await resolveComposeDefinition({
    options,
    composeOptions,
  });

  if (resolved.definition.template) {
    return runTemplateBackedCompose({
      options,
      facetedRoots: resolved.facetedRoots,
      facetsRoots: resolved.facetsRoots,
      definitionPath: resolved.definitionPath,
      definition: resolved.definition,
      composeOptions,
    });
  }

  return runStandardCompose({
    options,
    facetsRoots: resolved.facetsRoots,
    definitionPath: resolved.definitionPath,
    definition: resolved.definition,
    composeOptions,
  });
}
