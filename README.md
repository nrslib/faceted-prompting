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
2. `facet compose` detects related files from the current working tree and automatically selects `coding` / `frontend` / `backend`.
3. Confirm output directory (default: current working directory) or type another path.
4. Choose output mode:
   - `Combined (single file)` writes `{name}.md`
   - `Split (system + user)` writes `{name}.system.md` and `{name}.user.md`
5. If the target file already exists, confirm overwrite (`y`/`yes` to overwrite).

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

`facet compose` itself no longer asks you to choose one of these definitions interactively. The CLI always includes `coder` + `coding` + `ai-antipattern` + `architecture`, then adds `frontend` / `backend` knowledge when related files indicate those areas.

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
