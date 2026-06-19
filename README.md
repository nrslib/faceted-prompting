# faceted-prompting

[Faceted Prompting 解説記事](https://nrslib.com/faceted-prompting)

Structured prompt composition for LLMs — decompose prompts into reusable facets and compose them into LLM-ready messages.

faceted-prompting separates prompt concerns into distinct facets (persona, policy, knowledge, instruction, output contracts), each with a defined role and message placement. This keeps prompts modular, testable, and maintainable as they grow in complexity.

## Why Faceted Prompting

**Separation of concerns** — Each facet has a single responsibility. Persona defines *who* the agent is, policies define *how* it should behave, knowledge provides *what it needs to know*, instructions define *what to do*, and output contracts define *how to answer*. Changes to one facet don't affect others.

**Deterministic placement** — Persona always goes to the system prompt. Policies, knowledge, instructions, and output contracts always go to the user message. This placement rule is enforced by the library, not left to convention.

**Composable** — Facets are plain Markdown files. Mix and match personas, policies, knowledge, instructions, and output contracts across different workflows. Share them as repertoire packages via `@owner/repo/facet-name` scope references.

**Framework-independent** — Zero dependencies on any specific AI framework. Use it with Claude, OpenAI, or any LLM provider.

## Facet Kinds

| Facet | Placement | Role |
|-------|-----------|------|
| **Persona** | System prompt | WHO — agent identity and character |
| **Policy** | User message | HOW — rules, standards, constraints |
| **Knowledge** | User message | WHAT TO KNOW — domain context, architecture |
| **Instruction** | User message | WHAT TO DO — the specific task |
| **Output contracts** | User message | HOW TO ANSWER — output/report format |

## Install

```bash
npm install faceted-prompting
```

Global CLI:

```bash
npm install -g faceted-prompting
facet init
facet pull-sample
```

## Quick Start

### As a library

```typescript
import { compose } from 'faceted-prompting';

const result = compose(
  {
    persona: { body: 'You are a senior TypeScript developer.' },
    policies: [{ body: 'Follow clean code principles. No any types.' }],
    knowledge: [{ body: 'The project uses Vitest for testing.' }],
    instructions: [{ body: 'Implement a retry function with exponential backoff.' }],
    outputContracts: [{ body: 'Return a concise implementation report with test results.' }],
  },
  { contextMaxChars: 8000 },
);

// result.systemPrompt → "You are a senior TypeScript developer."
// result.userMessage  → knowledge + instructions + output contracts + policies (in order)
```

### As a CLI

```bash
# Create local .faceted/ in current directory
facet init

# Initialize global ~/.faceted/ and pull sample facets
facet init global

# Pull sample facets from TAKT on GitHub
facet pull-sample

# Compose prompts with auto-detected context
facet compose

# Install a skill to Claude Code or Codex
facet install skill
```

`facet init` creates `.faceted/` in the current directory with config and empty directories. `facet init global` initializes `~/.faceted/` and pulls sample facets. Run `facet pull-sample` to update sample facets, compositions, and templates:

```
.faceted/                       # Local (per-project)
├── config.yaml
├── facets/
│   ├── persona/
│   ├── knowledge/
│   ├── policies/
│   ├── instructions/
│   ├── partials/
│   │   ├── instructions/
│   │   ├── policies/
│   │   ├── knowledge/
│   │   └── output-contracts/
│   └── output-contracts/
├── compositions/
└── templates/

~/.faceted/                     # Global (fallback)
├── config.yaml
├── facets/
│   ├── persona/          # Persona Markdown files
│   ├── knowledge/        # Domain knowledge files
│   ├── policies/         # Policy/rules files
│   ├── instructions/     # Instruction files
│   ├── partials/
│   │   ├── instructions/ # Reusable Markdown partials by facet kind
│   │   ├── policies/
│   │   ├── knowledge/
│   │   └── output-contracts/
│   └── output-contracts/ # Output/report format files
├── compositions/         # Compose definition YAML files
└── templates/            # Skill templates
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `facet init` | Create local `.faceted/` in current directory |
| `facet init global` | Initialize global `~/.faceted/` and pull sample facets |
| `facet pull-sample` | Pull sample coding facets from TAKT on GitHub |
| `facet compose` | Auto-detect context, compose prompts, and write to files |
| `facet install skill` | Install a skill with facets to Claude Code or Codex |

See the [CLI Reference](./docs/cli-reference.md) for details.

## Compose Definition

Place definition files in `~/.faceted/compositions/*.yaml`:

```yaml
name: release
description: Release summary composition
persona: coder
knowledge:
  - architecture
policies:
  - quality
instructions:
  - release-summary
output-contracts:
  - concise-report
order:
  - knowledge
  - instructions
  - output-contracts
  - policies
```

- `name` and `persona` are required.
- `order` controls user-message section order (default: `knowledge` -> `instructions` -> `output-contracts` -> `policies`).
- `instructions` is a list of instruction facet names, Markdown file paths, scope references, or inline Markdown text.
- `output-contracts` is a list of facet names, file paths, or scope references and is exposed as `outputContracts` in the TypeScript API.
- Relative file paths are resolved from the compose definition directory. Real paths must stay inside that directory or the configured facets roots; symlinks and paths outside those roots fail.

File-backed instruction, policy, knowledge, and output-contract facet files can include shared Markdown partials:

```md
Review the change for mergeable quality.

{{include:instructions/review-common}}
```

The include above resolves to `facets/partials/instructions/review-common.md` and expands at the include site before prompt composition. Supported include kinds are `instructions`, `policies`, `knowledge`, and `output-contracts`. The syntax is `{{include:<kind>/<name>}}` for local/global partials and `{{include:<kind>/@owner/repo/<name>}}` for repertoire partials under `repertoire/@owner/repo/facets/partials/<kind>/<name>.md`; shortened forms such as `{{include:review-common}}` are invalid.

Facet partials use the same local-first layering as facets: `.faceted/facets/partials/<kind>/` is checked before `~/.faceted/facets/partials/<kind>/`. Missing includes, empty include names, shortened syntax, cyclic include chains, paths that escape the allowed roots, and partial paths that resolve to directories or other non-file targets fail with explicit errors. Include tokens inside inline instruction text are not expanded. `composePromptPayload().copyFiles.facetPartials` is present only when included partial paths exist; `copyFiles.instructionPartials` is retained for compatibility with existing instruction partial consumers.

## Scope References

Reference facets from installed repertoire packages using `@owner/repo/facet-name` syntax:

```yaml
persona: "@nrslib/takt-fullstack/expert-coder"
knowledge:
  - "@nrslib/takt-fullstack/architecture"
```

Scope references require repertoire roots and resolve to `~/.faceted/repertoire/@{owner}/{repo}/facets/{kind}/{name}.md`.

## API

### `compose(facets, options)`

Core composition function. Takes a `FacetSet` and `ComposeOptions`, returns a `ComposedPrompt` with `systemPrompt` and `userMessage`.

### `composePromptPayload(params)`

Higher-level API that composes prompts from a `ComposeDefinition` and also returns `copyFiles` metadata listing the source file paths used.

### `FileDataEngine`

File-system backed facet loader. Reads `{root}/{kind}/{key}.md`.

```typescript
import { FileDataEngine } from 'faceted-prompting';

const engine = new FileDataEngine('./prompts');
const persona = await engine.resolve('personas', 'coder');
```

### `CompositeDataEngine`

Chains multiple `DataEngine` instances with first-match-wins resolution. Useful for layering project-level facets over global defaults.

```typescript
import { FileDataEngine, CompositeDataEngine } from 'faceted-prompting';

const engine = new CompositeDataEngine([
  new FileDataEngine('./project/facets'),   // project-level (wins)
  new FileDataEngine('~/.faceted/facets'),   // global fallback
]);
```

### `renderTemplate(template, vars)`

Minimal template engine with `{{variable}}` substitution and `{{#if var}}...{{else}}...{{/if}}` conditionals.

### `escapeTemplateChars(str)`

Escapes curly braces to full-width Unicode equivalents to prevent template injection in user-supplied content.

See the [API Reference](./docs/api-reference.md) for the full API surface.

## Project Structure

```
.faceted/                       # Local (per-project, created by `facet init`)
├── config.yaml
├── facets/
│   ├── persona/
│   ├── knowledge/
│   ├── policies/
│   ├── instructions/
│   └── output-contracts/
├── compositions/
└── templates/

~/.faceted/                     # Global (fallback, created by `facet init global`)
├── config.yaml
├── facets/
│   ├── persona/
│   ├── knowledge/
│   ├── policies/
│   ├── instructions/
│   └── output-contracts/
├── compositions/
├── templates/                  # Skill install templates
└── repertoire/                 # Installed repertoire packages
```

Facet resolution is local-first: local `.faceted/facets/` is checked before global `~/.faceted/facets/`.

## Documentation

| Document | Description |
|----------|-------------|
| [Concepts](./docs/concepts.md) | Faceted Prompting design methodology |
| [CLI Reference](./docs/cli-reference.md) | All commands and options |
| [API Reference](./docs/api-reference.md) | Library API surface |
| [Changelog](./CHANGELOG.md) | Version history |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT — See [LICENSE](./LICENSE) for details.
