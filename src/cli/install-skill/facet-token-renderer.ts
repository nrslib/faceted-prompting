type FacetPlaceholderKey = 'persona' | 'knowledges' | 'policies' | 'instructions';

export type FacetTokenValues = Record<FacetPlaceholderKey, string>;

const FACET_TOKEN_PATTERN =
  /{{\s*facet:(persona|knowledges|policies|instructions)(?:\s*\|\s*indent:(none))?\s*}}/g;
const FACET_TOKEN_TEST =
  /{{\s*facet:(persona|knowledges|policies|instructions)(?:\s*\|\s*indent:(none))?\s*}}/;

export function hasFacetToken(content: string): boolean {
  return FACET_TOKEN_TEST.test(content);
}

export function replaceFacetTokens(content: string, values: FacetTokenValues): string {
  return content.replaceAll(
    FACET_TOKEN_PATTERN,
    (
      _match: string,
      token: FacetPlaceholderKey,
      indentMode: 'none' | undefined,
      offset: number,
      source: string,
    ) => {
      const value = values[token];
      if (indentMode === 'none') {
        return value;
      }
      const lineIndent = detectPlaceholderLineIndent(source, offset);
      return applyAutoIndentToMultilineValue(value, lineIndent);
    },
  );
}

function detectPlaceholderLineIndent(source: string, offset: number): string {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  const linePrefix = source.slice(lineStart, offset);
  return /^\s*$/.test(linePrefix) ? linePrefix : '';
}

function applyAutoIndentToMultilineValue(value: string, lineIndent: string): string {
  if (lineIndent === '' || !value.includes('\n')) {
    return value;
  }

  const lines = value.split('\n');
  return lines
    .map((line, index) => {
      if (index === 0 || line === '') {
        return line;
      }
      return `${lineIndent}${line}`;
    })
    .join('\n');
}
