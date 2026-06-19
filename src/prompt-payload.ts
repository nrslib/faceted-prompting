import { compose } from './compose.js';
import type { ComposeDefinition, ComposedPromptPayload, ComposeOptions, CopyFiles } from './types.js';
import { buildFacetSetFromResolvedSections, resolveDefinitionSections } from './cli/skill-renderer.js';
import type { InstructionSection, ResolvedDefinitionSections } from './cli/skill-types.js';

function instructionFacetPath(instruction: InstructionSection): string | undefined {
  if ('path' in instruction) {
    return instruction.path;
  }
  return undefined;
}

function instructionPartialSourcePaths(instruction: InstructionSection): readonly string[] {
  if (!('sourcePaths' in instruction)) {
    return [];
  }
  return instruction.sourcePaths.filter(path => path !== instruction.path);
}

function dedupePaths(paths: readonly string[]): readonly string[] {
  return paths.reduce<readonly string[]>((deduped, path) =>
    deduped.includes(path) ? deduped : [...deduped, path],
  []);
}

function buildCopyFiles(resolved: ResolvedDefinitionSections): CopyFiles {
  const instructionPartials = dedupePaths(
    resolved.instructions.flatMap(instruction => instructionPartialSourcePaths(instruction)),
  );

  return {
    persona: [resolved.persona.path],
    knowledge: resolved.knowledge.map(section => section.path),
    policies: resolved.policies.map(section => section.path),
    instructions: dedupePaths(
      resolved.instructions
        .map(instruction => instructionFacetPath(instruction))
        .filter(path => path !== undefined),
    ),
    outputContracts: resolved.outputContracts.map(section => section.path),
    ...(instructionPartials.length > 0 ? { instructionPartials } : {}),
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
