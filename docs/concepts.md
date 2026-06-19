# Faceted Prompting

> 詳しい解説記事: [Faceted Prompting](https://nrslib.com/faceted-prompting)

Faceted Prompting is a methodology for structuring LLM prompts by decomposing them into independent, reusable facets. Each facet has a single responsibility and a deterministic placement in the final prompt.

## The Problem

As LLM prompts grow, they become monolithic blocks mixing identity, rules, context, and tasks into a single string. This creates several issues:

- **Hard to maintain** — changing one rule risks breaking unrelated parts of the prompt
- **Hard to reuse** — extracting a useful section requires manually untangling dependencies
- **Hard to test** — no clear boundaries for what each part of the prompt is responsible for
- **Inconsistent placement** — system prompt vs. user message decisions are ad-hoc

## The Solution: Facets

Faceted Prompting separates prompts into five distinct facets, each with a defined role and placement rule.

### Persona (WHO)

Defines the agent's identity, expertise, and character. Always placed in the **system prompt**.

```markdown
# persona/coder.md
You are a senior TypeScript developer with deep expertise in
Node.js, React, and testing frameworks. You write clean,
type-safe code and favor simplicity over cleverness.
```

### Policy (HOW)

Defines rules, standards, and constraints the agent must follow. Placed in the **user message**.

```markdown
# policies/coding.md
- Follow clean code principles
- No `any` types — use proper TypeScript types
- All public functions must have JSDoc comments
- Prefer composition over inheritance
```

### Knowledge (WHAT TO KNOW)

Provides domain context, architecture descriptions, and reference material. Placed in the **user message**.

```markdown
# knowledge/architecture.md
The project follows a hexagonal architecture pattern.
Core domain logic lives in src/domain/ and has no
external dependencies. Adapters in src/adapters/
handle I/O concerns.
```

### Instruction (WHAT TO DO)

The specific task for the agent to perform. Placed in the **user message**.

```markdown
Implement a retry function with exponential backoff.
It should accept a function, max retries, and initial delay.
```

### Output Contracts (HOW TO ANSWER)

Defines the expected response or report format. Placed in the **user message**.

```markdown
# output-contracts/review-report.md
Return findings first, ordered by severity.
Include a short test-results section.
```

## Placement Rule

The placement of each facet is deterministic and enforced by the library:

```
┌─────────────────────────────────┐
│         System Prompt           │
│                                 │
│  Persona (WHO)                  │
│                                 │
├─────────────────────────────────┤
│         User Message            │
│                                 │
│  Knowledge (WHAT TO KNOW)       │
│  ─────────────────              │
│  Instruction (WHAT TO DO)       │
│  ─────────────────              │
│  Output contracts (HOW TO ANSWER)│
│  ─────────────────              │
│  Policy (HOW)                   │
│                                 │
└─────────────────────────────────┘
```

Persona goes to the system prompt because it defines the agent's persistent identity. Policies, knowledge, instructions, and output contracts go to the user message because they are task-specific context that may change between requests.

The default user-message order is knowledge, instructions, output contracts, then policies. The order of sections within the user message is configurable via the `order` field in compose definitions.

## Composition

The `compose()` function takes a `FacetSet` (resolved facet contents) and produces a `ComposedPrompt` with `systemPrompt` and `userMessage` fields:

```typescript
import { compose } from 'faceted-prompting';

const result = compose(
  {
    persona: { body: 'You are a security auditor.' },
    policies: [
      { body: 'Flag all OWASP Top 10 vulnerabilities.' },
      { body: 'Rate severity as Critical/High/Medium/Low.' },
    ],
    knowledge: [{ body: 'The app uses Express.js with Passport auth.' }],
    instructions: [{ body: 'Review the authentication middleware.' }],
    outputContracts: [{ body: 'Return a severity-sorted review report.' }],
  },
  { contextMaxChars: 8000 },
);
```

Multiple policies or knowledge entries are joined with `---` separators. When content exceeds `contextMaxChars`, it is truncated and annotated with a source path so the LLM can consult the original file.

## Facets as Files

Facets are stored as plain Markdown files in a directory structure:

```
facets/
├── persona/
│   ├── coder.md
│   └── reviewer.md
├── policies/
│   ├── coding.md
│   └── security.md
├── knowledge/
│   ├── architecture.md
│   └── api-design.md
├── instructions/
│   └── review.md
├── partials/
│   └── instructions/
│       └── review-common.md
└── output-contracts/
    └── review-report.md
```

The `FileDataEngine` resolves facets from this structure using the convention `{root}/{kind}/{key}.md`. The `CompositeDataEngine` layers multiple directories with first-match-wins resolution, enabling project-level facets to override global defaults.

## Facet Partials

File-backed instruction, policy, knowledge, and output-contract facets can include reusable Markdown partials for shared text:

```markdown
# instructions/review.md
Review the change for mergeable quality.

{{include:instructions/review-common}}
```

The include resolves to `facets/partials/instructions/review-common.md` and expands at the include site before the final user message is composed. Facet partials are shared fragments for file-backed facets, not standalone facets resolved by name.

Partial includes are intentionally bounded:

- Only `instructions`, `policies`, `knowledge`, and `output-contracts` facets expand include tokens.
- The supported syntax is `{{include:<kind>/<name>}}` or `{{include:<kind>/@owner/repo/<name>}}`.
- Shortened syntax such as `{{include:<name>}}` is invalid.
- Empty include names are invalid.
- Missing partials fail with an explicit error.
- Cyclic include chains fail with an error that includes the chain.
- Partial paths that escape the allowed roots fail with an explicit error.
- Partial paths that resolve to directories or other non-file targets fail with an explicit error.
- Inline instruction text does not expand include tokens.

When local and global faceted roots are both present, facet partials use the same first-match rule as facets: local `.faceted/facets/partials/<kind>/` overrides global `~/.faceted/facets/partials/<kind>/`. Scoped partials resolve from `repertoire/@owner/repo/facets/partials/<kind>/<name>.md`. `composePromptPayload()` records included partial source paths in `copyFiles.facetPartials` only when includes are used, and keeps `copyFiles.instructionPartials` for compatibility with existing instruction partial consumers.

## Compose Definitions

A compose definition is a YAML file that declares which facets to use:

```yaml
name: code-review
persona: reviewer
knowledge:
  - architecture
  - api-design
policies:
  - coding
  - security
instructions:
  - review
output-contracts:
  - review-report
order:
  - knowledge
  - instructions
  - output-contracts
  - policies
```

The `instructions` field can contain facet names, file paths, scope references, or inline Markdown text. The `output-contracts` field can contain facet names, file paths, or scope references. Facet names are resolved against the configured facets roots. Relative file paths are resolved from the compose definition directory, and real paths must stay inside that directory or the configured facets roots. Symlinks and paths outside those roots fail. Instruction entries that do not resolve are kept as inline prompt content.

## Scope References

Facets from external packages can be referenced using the `@owner/repo/facet-name` format:

```yaml
persona: "@nrslib/takt-fullstack/expert-coder"
knowledge:
  - "@nrslib/takt-fullstack/architecture"
```

Scope references require repertoire roots and resolve to files in the repertoire directory:

```
~/.faceted/repertoire/@{owner}/{repo}/facets/{kind}/{name}.md
```

This enables sharing and reusing facets across teams and projects.

## Truncation

When knowledge or policy content exceeds the configured `contextMaxChars`, the library truncates the content and appends metadata:

- A `...TRUNCATED...` marker at the truncation point
- A notice instructing the LLM to consult the source file
- The source file path for reference

This ensures the LLM knows when context is incomplete and where to find the full content.

## Template Engine

The library includes a minimal template engine for prompt templates:

- `{{variable}}` — variable substitution
- `{{#if variable}}...{{else}}...{{/if}}` — conditional blocks (no nesting)

Template injection is prevented by `escapeTemplateChars()`, which replaces ASCII curly braces with full-width Unicode equivalents in user-supplied content.
