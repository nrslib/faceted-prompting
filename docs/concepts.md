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

Faceted Prompting separates prompts into four distinct facets, each with a defined role and placement rule.

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
│  Policy (HOW)                   │
│  ─────────────────              │
│  Knowledge (WHAT TO KNOW)       │
│  ─────────────────              │
│  Instruction (WHAT TO DO)       │
│                                 │
└─────────────────────────────────┘
```

Persona goes to the system prompt because it defines the agent's persistent identity. Policies, knowledge, and instructions go to the user message because they are task-specific context that may change between requests.

The order of sections within the user message is configurable via the `order` field in compose definitions.

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
    instruction: { body: 'Review the authentication middleware.' },
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
└── instructions/
    └── review.md
```

The `FileDataEngine` resolves facets from this structure using the convention `{root}/{kind}/{key}.md`. The `CompositeDataEngine` layers multiple directories with first-match-wins resolution, enabling project-level facets to override global defaults.

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
instruction: Review the latest changes for quality and security issues.
order:
  - policies
  - knowledge
  - instruction
```

The `instruction` field can be inline text or a path to a Markdown file. Facet names are resolved against the facets directory; file paths (starting with `./`, `../`, `/`, `~`, or ending with `.md`) are resolved directly.

## Scope References

Facets from external packages can be referenced using the `@owner/repo/facet-name` format:

```yaml
persona: "@nrslib/takt-fullstack/expert-coder"
knowledge:
  - "@nrslib/takt-fullstack/architecture"
```

Scope references resolve to files in the repertoire directory:

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
