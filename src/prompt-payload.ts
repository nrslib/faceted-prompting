import { compose } from './compose.js';
import type { ComposeDefinition, ComposedPromptPayload, ComposeOptions, CopyFiles } from './types.js';
import { buildFacetSet, resolveDefinitionSections } from './cli/skill-renderer.js';

function buildCopyFiles(params: {
  definition: ComposeDefinition;
  definitionDir: string;
  facetsRoot?: string;
  facetsRoots?: readonly string[];
}): CopyFiles {
  const resolved = resolveDefinitionSections(params);

  return {
    persona: [resolved.persona.path],
    knowledge: resolved.knowledge.map(section => section.path),
    policies: resolved.policies.map(section => section.path),
    instructions: resolved.instructions
      .filter((instruction): instruction is { ref: string; body: string; path: string } => 'path' in instruction)
      .map(instruction => instruction.path),
  };
}

export function composePromptPayload(params: {
  definition: ComposeDefinition;
  definitionDir: string;
  facetsRoot?: string;
  facetsRoots?: readonly string[];
  composeOptions: ComposeOptions;
}): ComposedPromptPayload {
  const facetSet = buildFacetSet(params);
  const composed = compose(facetSet, {
    ...params.composeOptions,
    userMessageOrder: params.definition.order,
  });

  return {
    systemPrompt: composed.systemPrompt,
    userPrompt: composed.userMessage,
    copyFiles: buildCopyFiles(params),
  };
}
