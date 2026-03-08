# faceted-prompting

Structured prompt composition for LLMs using the Faceted Prompting pattern.

## Overview

Faceted Prompting organizes LLM prompts into distinct facets:

| Facet | Role | Placement |
|-------|------|-----------|
| **Persona** | WHO — defines the agent's identity | System prompt |
| **Policy** | HOW — coding standards, rules | User message |
| **Knowledge** | WHAT TO KNOW — domain context | User message |
| **Instruction** | WHAT TO DO — the task itself | User message |

## Install

```bash
npm install faceted-prompting
```

Global CLI:

```bash
npm install -g faceted-prompting
facet compose
```

First run initializes `~/.faceted`:

- `~/.faceted/config.yaml`
- `~/.faceted/facets/persona`
- `~/.faceted/facets/knowledge`
- `~/.faceted/facets/policies`
- `~/.faceted/facets/compositions`

## `facet compose` Usage

1. Run `facet compose`.
2. Select a composition with `↑` / `↓` and press `Enter`.
3. Confirm output directory (default: current working directory) or type another path.
4. If `{name}.prompt.md` already exists, confirm overwrite (`y`/`yes` to overwrite).
5. Generated prompt file is written as `{name}.prompt.md`.

When `~/.faceted` is already initialized, `facet compose` reuses existing config/templates and does not overwrite files.

### Compose Definition YAML

Place definition files in `~/.faceted/facets/compositions/*.yaml`.

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

- `name` is required.
- `description` is optional.
- `order` applies only to user-message sections (`knowledge`, `policies`, `instruction`).
- `persona` is always used for `systemPrompt` and is not order-controlled.

## Quick Start

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

// result.systemPrompt → persona content
// result.userMessage  → policy + knowledge + instruction (in order)
```

## API

### `compose(facets, options)`

Composes a `FacetSet` into a `ComposedPrompt` with `systemPrompt` and `userMessage`.

### `FileDataEngine`

File-system backed facet loader. Reads `{root}/{kind}/{key}.md`.

```typescript
import { FileDataEngine } from 'faceted-prompting';

const engine = new FileDataEngine('./prompts');
const persona = await engine.resolve('personas', 'coder');
```

### `CompositeDataEngine`

Chains multiple engines with first-match-wins resolution.

### `renderTemplate(template, vars)`

Minimal template engine supporting `{{#if}}...{{else}}...{{/if}}` and `{{variable}}` substitution.

### `escapeTemplateChars(str)`

Escapes curly braces to prevent template injection.

## License

MIT
