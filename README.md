# faceted-prompting

[Faceted Prompting 解説記事](https://nrslib.com/faceted-prompting)

Structured prompt composition for LLMs — decompose prompts into reusable facets and compose them into LLM-ready messages.

faceted-prompting separates prompt concerns into distinct facets (persona, policy, knowledge, instruction), each with a defined role and message placement. This keeps prompts modular, testable, and maintainable as they grow in complexity.

## Why Faceted Prompting

**Separation of concerns** — Each facet has a single responsibility. Persona defines *who* the agent is, policies define *how* it should behave, knowledge provides *what it needs to know*, and instructions define *what to do*. Changes to one facet don't affect others.

**Deterministic placement** — Persona always goes to the system prompt. Policies, knowledge, and instructions always go to the user message. This placement rule is enforced by the library, not left to convention.

**Composable** — Facets are plain Markdown files. Mix and match personas, policies, and knowledge across different workflows. Share them as repertoire packages via `@owner/repo/facet-name` scope references.

**Framework-independent** — Zero dependencies on any specific AI framework. Use it with Claude, OpenAI, or any LLM provider.

## Facet Kinds

| Facet | Placement | Role |
|-------|-----------|------|
| **Persona** | System prompt | WHO — agent identity and character |
| **Policy** | User message | HOW — rules, standards, constraints |
| **Knowledge** | User message | WHAT TO KNOW — domain context, architecture |
| **Instruction** | User message | WHAT TO DO — the specific task |

## Install

```bash
npm install faceted-prompting
```

Global CLI:

```bash
npm install -g faceted-prompting
facet compose
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
    instruction: { body: 'Implement a retry function with exponential backoff.' },
  },
  { contextMaxChars: 8000 },
);

// result.systemPrompt → "You are a senior TypeScript developer."
// result.userMessage  → policies + knowledge + instruction (in order)
```

### As a CLI

```bash
# Compose prompts with auto-detected context
facet compose

# Install a skill to Claude Code or Codex
facet install skill
```

First run initializes `~/.faceted/`:

```
~/.faceted/
├── config.yaml
├── facets/
│   ├── persona/          # Persona Markdown files
│   ├── knowledge/        # Domain knowledge files
│   ├── policies/         # Policy/rules files
│   └── compositions/     # Compose definition YAML files
└── templates/            # Skill templates
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `facet compose` | Auto-detect context, compose prompts, and write to files |
| `facet install skill` | Install a skill with facets to a target (Claude Code, Codex, template) |

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
instruction: Summarize release impact.
order:
  - knowledge
  - policies
  - instruction
```

- `name` and `persona` are required.
- `order` controls user-message section order (default: `policies` → `knowledge` → `instruction`).
- `instruction` can be a facet file reference or inline text.

## Scope References

Reference facets from installed repertoire packages using `@owner/repo/facet-name` syntax:

```yaml
persona: "@nrslib/takt-fullstack/expert-coder"
knowledge:
  - "@nrslib/takt-fullstack/architecture"
```

Scope references resolve to `~/.faceted/repertoire/@{owner}/{repo}/facets/{kind}/{name}.md`.

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
~/.faceted/                     # Global config (created on first run)
├── config.yaml
├── facets/
│   ├── persona/
│   ├── knowledge/
│   ├── policies/
│   └── compositions/
├── templates/                  # Skill install templates
└── repertoire/                 # Installed repertoire packages
```

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
