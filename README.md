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
