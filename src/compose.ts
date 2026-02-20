/**
 * Facet composition — the core placement rule.
 *
 *   system prompt:  persona only    (WHO)
 *   user message:   policy + knowledge + instruction (HOW / WHAT TO KNOW / WHAT TO DO)
 */

import type { FacetSet, ComposedPrompt, ComposeOptions } from './types.js';
import { prepareKnowledgeContent, preparePolicyContent } from './truncation.js';

/** Join multiple facet bodies with a separator. */
function joinBodies(facets: readonly { body: string }[]): string {
  return facets.map(f => f.body).join('\n\n---\n\n');
}

/** Extract sourcePath when there is exactly one facet (otherwise undefined). */
function singleSourcePath(
  facets: readonly { sourcePath?: string }[],
): string | undefined {
  if (facets.length === 1) return facets[0]!.sourcePath;
  return undefined;
}

/**
 * Compose facets into an LLM-ready prompt according to Faceted Prompting
 * placement rules.
 *
 * - persona → systemPrompt
 * - policy / knowledge / instruction → userMessage (in that order)
 */
export function compose(facets: FacetSet, options: ComposeOptions): ComposedPrompt {
  const systemPrompt = facets.persona?.body ?? '';

  const userParts: string[] = [];

  if (facets.policies && facets.policies.length > 0) {
    userParts.push(
      preparePolicyContent(
        joinBodies(facets.policies),
        options.contextMaxChars,
        singleSourcePath(facets.policies),
      ),
    );
  }

  if (facets.knowledge && facets.knowledge.length > 0) {
    userParts.push(
      prepareKnowledgeContent(
        joinBodies(facets.knowledge),
        options.contextMaxChars,
        singleSourcePath(facets.knowledge),
      ),
    );
  }

  if (facets.instruction) {
    userParts.push(facets.instruction.body);
  }

  return {
    systemPrompt,
    userMessage: userParts.join('\n\n'),
  };
}
