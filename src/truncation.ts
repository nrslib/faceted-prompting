/**
 * Context truncation for knowledge and policy facets.
 *
 * When facet content exceeds a character limit, it is trimmed and
 * annotated with source-path metadata so the LLM can consult the
 * original file.
 *
 * This module has ZERO dependencies on TAKT internals.
 */

interface PreparedContextBlock {
  readonly content: string;
  readonly truncated: boolean;
}

/**
 * Trim content to a maximum character length, appending a
 * "...TRUNCATED..." marker when truncation occurs.
 */
export function trimContextContent(
  content: string,
  maxChars: number,
): PreparedContextBlock {
  if (content.length <= maxChars) {
    return { content, truncated: false };
  }
  return {
    content: `${content.slice(0, maxChars)}\n...TRUNCATED...`,
    truncated: true,
  };
}

/**
 * Prepare a knowledge facet for inclusion in a prompt.
 *
 * Trims to maxChars and appends the source path if available.
 */
export function prepareKnowledgeContent(
  content: string,
  maxChars: number,
  sourcePath?: string,
): string {
  const trimmed = trimContextContent(content, maxChars).content;
  return sourcePath ? `${trimmed}\n\nKnowledge Source: ${sourcePath}` : trimmed;
}

/**
 * Prepare a policy facet for inclusion in a prompt.
 *
 * Trims to maxChars and appends the source path if available.
 */
export function preparePolicyContent(
  content: string,
  maxChars: number,
  sourcePath?: string,
): string {
  const trimmed = trimContextContent(content, maxChars).content;
  return sourcePath ? `${trimmed}\n\nPolicy Source: ${sourcePath}` : trimmed;
}
