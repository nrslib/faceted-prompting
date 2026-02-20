# faceted-prompting

Compose structured LLM prompts from **persona**, **policy**, **knowledge**, and **instruction** facets.

## Install

```bash
npm install faceted-prompting
```

## Overview

Faceted Prompting organises LLM prompt content into distinct **facets**, each with a clear role:

| Facet | Role | Placement |
|-------|------|-----------|
| **Persona** | WHO the LLM should be | `systemPrompt` |
| **Policy** | HOW it should behave (rules, constraints) | `userMessage` |
| **Knowledge** | WHAT it should know (context, docs) | `userMessage` |
| **Instruction** | WHAT it should do (the task) | `userMessage` |

The `compose()` function assembles these facets into an LLM-ready `{ systemPrompt, userMessage }` pair.

## Quick Start

```typescript
import { compose } from 'faceted-prompting';
import type { FacetSet, ComposeOptions } from 'faceted-prompting';

const facets: FacetSet = {
  persona: { body: 'You are an expert TypeScript developer.' },
  policies: [{ body: 'Follow clean code principles. No any types.' }],
  knowledge: [{ body: 'The project uses ESM and Node 18+.' }],
  instruction: { body: 'Refactor the auth module to use async/await.' },
};

const options: ComposeOptions = { contextMaxChars: 8000 };
const { systemPrompt, userMessage } = compose(facets, options);
```

## DataEngine

Load facets from the filesystem using `FileDataEngine`:

```typescript
import { FileDataEngine } from 'faceted-prompting';

const engine = new FileDataEngine('/path/to/facets');

// Directory structure:
// /path/to/facets/personas/coder.md
// /path/to/facets/policies/clean-code.md
// /path/to/facets/knowledge/architecture.md

const persona = await engine.resolve('personas', 'coder');
const keys = await engine.list('policies');
```

Use `CompositeDataEngine` to chain multiple sources (first-match-wins):

```typescript
import { CompositeDataEngine, FileDataEngine } from 'faceted-prompting';

const composite = new CompositeDataEngine([
  new FileDataEngine('./project/.facets'),   // project-local (priority)
  new FileDataEngine('~/.facets'),           // user global
  new FileDataEngine('/usr/share/facets'),   // system defaults
]);
```

## Template Engine

Render Markdown templates with conditionals and variable substitution:

```typescript
import { renderTemplate } from 'faceted-prompting';

const template = '{{#if hasTests}}Run tests first.{{else}}Write tests.{{/if}} Task: {{task}}';
const result = renderTemplate(template, { hasTests: true, task: 'Fix the bug' });
// → "Run tests first. Task: Fix the bug"
```

## API

### Core

- **`compose(facets, options)`** — Compose facets into `{ systemPrompt, userMessage }`
- **`renderTemplate(template, vars)`** — Process conditionals and substitute variables
- **`escapeTemplateChars(str)`** — Escape `{}` to prevent template injection

### DataEngine

- **`FileDataEngine(root)`** — Filesystem-backed facet resolution
- **`CompositeDataEngine(engines)`** — Chain multiple engines (first-match-wins)

### Truncation

- **`trimContextContent(content, maxChars)`** — Trim with truncation marker
- **`prepareKnowledgeContent(content, maxChars, sourcePath?)`** — Prepare knowledge block
- **`preparePolicyContent(content, maxChars, sourcePath?)`** — Prepare policy block

### Resolution

- **`resolveFacetPath(name, dirs)`** — Find facet file in candidate directories
- **`resolveFacetByName(name, dirs)`** — Load facet content by name
- **`resolvePersona(raw, sections, pieceDir, dirs?)`** — Resolve persona reference

## License

MIT
