/**
 * Context truncation for knowledge and policy facets.
 *
 * When facet content exceeds a character limit, it is trimmed and
 * annotated with source-path metadata so the LLM can consult the
 * original file.
 */

interface TrimResult {
  readonly content: string;
  readonly truncated: boolean;
}

/** Trim content to a maximum character length. */
export function trimContextContent(
  content: string,
  maxChars: number,
): TrimResult {
  if (content.length <= maxChars) {
    return { content, truncated: false };
  }
  return {
    content: `${content.slice(0, maxChars)}\n...TRUNCATED...`,
    truncated: true,
  };
}

/** Standard notice appended to knowledge and policy blocks. */
export function renderConflictNotice(): string {
  return 'If prompt content conflicts with source files, source files take precedence.';
}

/** Build truncation warning lines for a given facet type. */
function buildTruncationNotice(
  label: string,
  message: string,
  sourcePath: string,
): string[] {
  return ['', `${label} ${message} Source: ${sourcePath}`];
}

/** Build source attribution line. */
function buildSourceAttribution(label: string, sourcePath: string): string[] {
  return ['', `${label} Source: ${sourcePath}`];
}

/** Prepare a knowledge facet for inclusion in a prompt. */
export function prepareKnowledgeContent(
  content: string,
  maxChars: number,
  sourcePath?: string,
): string {
  const prepared = trimContextContent(content, maxChars);
  const lines: string[] = [prepared.content];

  if (prepared.truncated && sourcePath) {
    lines.push(
      ...buildTruncationNotice(
        'Knowledge is truncated. You MUST consult the source files before making decisions.',
        '',
        sourcePath,
      ),
    );
  }

  if (sourcePath) {
    lines.push(...buildSourceAttribution('Knowledge', sourcePath));
  }

  lines.push('', renderConflictNotice());
  return lines.join('\n');
}

/** Prepare a policy facet for inclusion in a prompt. */
export function preparePolicyContent(
  content: string,
  maxChars: number,
  sourcePath?: string,
): string {
  const prepared = trimContextContent(content, maxChars);
  const lines: string[] = [prepared.content];

  if (prepared.truncated && sourcePath) {
    lines.push(
      ...buildTruncationNotice(
        'Policy is authoritative. If truncated, you MUST read the full policy file and follow it strictly.',
        '',
        sourcePath,
      ),
    );
  }

  if (sourcePath) {
    lines.push(...buildSourceAttribution('Policy', sourcePath));
  }

  lines.push('', renderConflictNotice());
  return lines.join('\n');
}
