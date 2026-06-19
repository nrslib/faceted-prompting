# API Reference

All public API is exported from `faceted-prompting`:

```typescript
import { compose, FileDataEngine, renderTemplate } from 'faceted-prompting';
```

## Composition

### `compose(facets, options)`

Core composition function. Applies the facet placement rule:

- `persona` → `systemPrompt`
- `policies` + `knowledge` + `instructions` → `userMessage`

```typescript
function compose(facets: FacetSet, options: ComposeOptions): ComposedPrompt;
```

**Parameters:**

- `facets` — A `FacetSet` containing resolved facet contents
- `options.contextMaxChars` — Maximum character length for knowledge/policy content before truncation
- `options.userMessageOrder` — Optional section order (default: `['knowledge', 'instructions', 'policies']`)

**Returns:** `ComposedPrompt` with `systemPrompt` and `userMessage` strings.

### `composePromptPayload(params)`

Higher-level API that composes prompts from a `ComposeDefinition` and returns copy-file metadata.

```typescript
function composePromptPayload(params: {
  definition: ComposeDefinition;
  definitionDir: string;
  facetsRoot?: string;
  facetsRoots?: readonly string[];
  composeOptions: ComposeOptions;
}): ComposedPromptPayload;
```

Pass `facetsRoots` when composition should resolve facets from more than one root. Roots are checked in order, so callers should pass local roots before global roots. Use `facetsRoot` for single-root composition.

**Returns:** `ComposedPromptPayload` with `systemPrompt`, `userPrompt`, and `copyFiles` (file paths used for each facet kind). `copyFiles.instructions` includes instruction facet paths, and `copyFiles.instructionPartials` is present only when instruction partial paths are expanded from `{{include:instructions/<name>}}` or `{{include:instructions/@owner/repo/<name>}}`.

Instruction partial includes are expanded while resolving compose-definition instructions, before `compose()` receives the resolved `FacetSet`. A token such as `{{include:instructions/review-common}}` resolves to `facets/partials/instructions/review-common.md` under the first matching facets root. A token such as `{{include:instructions/@owner/repo/review-common}}` resolves from `repertoire/@owner/repo/facets/partials/instructions/review-common.md`. Missing partials, empty include names, invalid shortened syntax such as `{{include:review-common}}`, and cyclic include chains throw errors instead of leaving unresolved tokens in the prompt.

Instruction entries that do not resolve as facet names or file paths are treated as inline prompt content. Include tokens inside inline instruction text are not expanded, and inline instruction text is not listed in `copyFiles.instructions`.

## Types

### `FacetKind`

```typescript
type FacetKind = 'personas' | 'policies' | 'knowledge' | 'instructions' | 'output-contracts';
```

### `FacetContent`

```typescript
interface FacetContent {
  readonly body: string;
  readonly sourcePath?: string;
}
```

### `FacetSet`

```typescript
interface FacetSet {
  readonly persona?: FacetContent;
  readonly policies?: readonly FacetContent[];
  readonly knowledge?: readonly FacetContent[];
  readonly instructions?: readonly FacetContent[];
}
```

### `ComposedPrompt`

```typescript
interface ComposedPrompt {
  readonly systemPrompt: string;
  readonly userMessage: string;
}
```

### `ComposedPromptPayload`

```typescript
interface ComposedPromptPayload {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly copyFiles: CopyFiles;
}
```

### `CopyFiles`

```typescript
interface CopyFiles {
  readonly persona: readonly string[];
  readonly knowledge: readonly string[];
  readonly policies: readonly string[];
  readonly instructions: readonly string[];
  readonly instructionPartials?: readonly string[];
}
```

### `ComposeOptions`

```typescript
interface ComposeOptions {
  readonly contextMaxChars: number;
  readonly userMessageOrder?: readonly ComposeOrderEntry[];
}
```

### `ComposeDefinition`

```typescript
interface ComposeDefinition {
  readonly name: string;
  readonly description?: string;
  readonly persona: string;
  readonly template?: string;
  readonly knowledge?: readonly string[];
  readonly policies?: readonly string[];
  readonly instructions?: readonly string[];
  readonly order?: readonly ComposeOrderEntry[];
}
```

## Data Engine

### `DataEngine` (interface)

Abstract interface for facet data retrieval.

```typescript
interface DataEngine {
  resolve(kind: FacetKind, key: string): Promise<FacetContent | undefined>;
  list(kind: FacetKind): Promise<string[]>;
}
```

### `FileDataEngine`

File-system backed implementation. Resolves facets from `{root}/{kind}/{key}.md`.

```typescript
const engine = new FileDataEngine('./facets');
const persona = await engine.resolve('personas', 'coder');
// Reads ./facets/personas/coder.md

const keys = await engine.list('policies');
// Returns ['coding', 'security'] for ./facets/policies/coding.md, security.md
```

### `CompositeDataEngine`

Chains multiple engines with first-match-wins resolution.

```typescript
const engine = new CompositeDataEngine([
  new FileDataEngine('./project/facets'),   // checked first
  new FileDataEngine('~/.faceted/facets'),  // fallback
]);
```

`resolve()` returns the first non-undefined result. `list()` returns deduplicated keys from all engines.

## Truncation

### `trimContextContent(content, maxChars)`

Trims content to a maximum character length, appending `...TRUNCATED...` when truncation occurs.

```typescript
function trimContextContent(content: string, maxChars: number): {
  content: string;
  truncated: boolean;
};
```

### `prepareKnowledgeContent(content, maxChars, sourcePath?)`

Prepares knowledge content for prompt inclusion. Adds truncation notice and source path metadata.

### `preparePolicyContent(content, maxChars, sourcePath?)`

Prepares policy content for prompt inclusion. Adds authoritative-source notice when truncated.

### `renderConflictNotice()`

Returns the standard notice: "If prompt content conflicts with source files, source files take precedence."

## Template

### `renderTemplate(template, vars)`

Renders a template string by processing conditionals then substituting variables.

```typescript
const result = renderTemplate(
  '{{#if debug}}Debug mode{{else}}Production{{/if}}: {{name}}',
  { debug: true, name: 'MyApp' },
);
// → "Debug mode: MyApp"
```

Supports:
- `{{variable}}` — replaced with the variable value (empty string if undefined/false)
- `{{#if variable}}...{{else}}...{{/if}}` — conditional blocks (no nesting)

### `escapeTemplateChars(str)`

Replaces `{` and `}` with full-width Unicode equivalents (`；`, `＜`) to prevent template injection.

```typescript
const safe = escapeTemplateChars(userInput);
// { → ；, } → ＜
```

## Resolve

### `isResourcePath(spec)`

Returns `true` if the spec looks like a file path (starts with `./`, `../`, `/`, `~` or ends with `.md`).

### `resolveFacetPath(name, candidateDirs)`

Scans candidate directories for `{name}.md` and returns the first match.

### `resolveFacetByName(name, candidateDirs)`

Like `resolveFacetPath` but returns the file content instead of the path.

### `resolveResourcePath(spec, pieceDir)`

Resolves a resource spec to an absolute path. Handles `~` (homedir), `/` (absolute), and `./` (relative to pieceDir) prefixes.

### `resolveResourceContent(spec, pieceDir)`

Resolves a spec to content. If it ends with `.md` and the file exists, returns file content. Otherwise returns the spec as-is (inline content).

### `resolvePersona(rawPersona, sections, pieceDir, candidateDirs?)`

Resolves a persona field to `{ personaSpec, personaPath }` using section maps, path resolution, and candidate directory lookup.

## Scope

### `isScopeRef(ref)`

Returns `true` if the string matches `@{owner}/{repo}/{facet-name}` format.

### `parseScopeRef(ref)`

Parses an `@scope` reference into `{ owner, repo, name }`. Validates and normalizes to lowercase.

### `resolveScopeRef(scopeRef, facetType, repertoireDir)`

Resolves a parsed scope reference to a file path: `{repertoireDir}/@{owner}/{repo}/facets/{facetType}/{name}.md`.

### `validateScopeOwner(owner)` / `validateScopeRepo(repo)` / `validateScopeFacetName(name)`

Validation functions for scope reference components. Owner and facet name must match `[a-z0-9][a-z0-9-]*`. Repo must match `[a-z0-9][a-z0-9._-]*`.
