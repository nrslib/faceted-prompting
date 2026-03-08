/**
 * Facet composition — the core placement rule.
 *
 *   system prompt:  persona only    (WHO)
 *   user message:   policy + knowledge + instruction (HOW / WHAT TO KNOW / WHAT TO DO)
 *
 * This module has ZERO dependencies on TAKT internals.
 */

import type { FacetSet, ComposedPrompt, ComposeOptions } from './types.js';
import { prepareKnowledgeContent, preparePolicyContent } from './truncation.js';

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
  const order = options.userMessageOrder ?? ['policies', 'knowledge', 'instruction'];

  for (const entry of order) {
    if (entry === 'policies') {
      if (!facets.policies || facets.policies.length === 0) continue;
      const joined = facets.policies.map(p => p.body).join('\n\n---\n\n');
      const sourcePath = facets.policies.length === 1
        ? facets.policies[0]!.sourcePath
        : undefined;
      userParts.push(
        preparePolicyContent(joined, options.contextMaxChars, sourcePath),
      );
      continue;
    }

    if (entry === 'knowledge') {
      if (!facets.knowledge || facets.knowledge.length === 0) continue;
      const joined = facets.knowledge.map(k => k.body).join('\n\n---\n\n');
      const sourcePath = facets.knowledge.length === 1
        ? facets.knowledge[0]!.sourcePath
        : undefined;
      userParts.push(
        prepareKnowledgeContent(joined, options.contextMaxChars, sourcePath),
      );
      continue;
    }

    if (entry === 'instruction' && facets.instruction) {
      userParts.push(facets.instruction.body);
    }
  }

  return {
    systemPrompt,
    userMessage: userParts.join('\n\n'),
  };
}
