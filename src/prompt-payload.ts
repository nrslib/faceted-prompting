import { compose } from './compose.js';
import type { ComposeDefinition, ComposedPromptPayload, ComposeOptions, CopyFiles } from './types.js';
import { buildFacetSetFromResolvedSections, resolveDefinitionSections } from './cli/skill-renderer.js';
import type { ResolvedDefinitionSections } from './cli/skill-types.js';

function buildCopyFiles(resolved: ResolvedDefinitionSections): CopyFiles {
  return {
    persona: [resolved.persona.path],
    knowledge: resolved.knowledge.map(section => section.path),
    policies: resolved.policies.map(section => section.path),
    instructions: resolved.instructions
      .filter((instruction): instruction is { ref: string; body: string; path: string } => 'path' in instruction)
      .map(instruction => instruction.path),
    outputContracts: resolved.outputContracts.map(section => section.path),
  };
}

export function composePromptPayload(params: {
  definition: ComposeDefinition;
  definitionDir: string;
  facetsRoot?: string;
  facetsRoots?: readonly string[];
  facetedRoots?: readonly string[];
  composeOptions: ComposeOptions;
}): ComposedPromptPayload {
  const resolved = resolveDefinitionSections(params);
  const facetSet = buildFacetSetFromResolvedSections(resolved);
  const composed = compose(facetSet, {
    ...params.composeOptions,
    userMessageOrder: params.definition.order,
  });

  return {
    systemPrompt: composed.systemPrompt,
    userPrompt: composed.userMessage,
    copyFiles: buildCopyFiles(resolved),
  };
}
