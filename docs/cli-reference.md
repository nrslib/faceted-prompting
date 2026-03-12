# CLI Reference

The `facet` CLI provides commands for composing prompts and installing skills from faceted definitions.

## Installation

```bash
npm install -g faceted-prompting
```

## Initialization

On first run, `facet` creates `~/.faceted/` with the following structure:

```
~/.faceted/
├── config.yaml                  # Global configuration
├── facets/
│   ├── persona/                 # Persona Markdown files
│   ├── knowledge/               # Knowledge files
│   ├── policies/                # Policy/rules files
│   └── compositions/            # Compose definition YAML files
├── templates/                   # Skill install templates
└── repertoire/                  # Installed scope packages
```

Sample facets (`coder`, `coding`, `ai-antipattern`, `architecture`) and a sample template (`issue-worktree`) are created during initialization.

## Commands

### `facet compose`

Compose prompts using auto-detected project context.

```bash
facet compose
```

**Flow:**

1. Detects related files from the working tree and selects a context (`coding` / `frontend` / `backend`)
2. Prompts for output directory (default: current working directory)
3. Prompts for output mode:
   - **Combined** — writes `{name}.md` (single file with system + user sections)
   - **Split** — writes `{name}.system.md` and `{name}.user.md`
4. If the target file exists, prompts for overwrite confirmation

The compose context always includes the `coder` persona, `coding` and `ai-antipattern` policies, and `architecture` knowledge. When frontend- or backend-related files are detected, additional knowledge facets are included.

### `facet install skill`

Install a skill with facets to a target platform.

```bash
facet install skill
```

**Flow:**

1. Scans `~/.faceted/compositions/` for available definitions
2. Prompts to select a composition
3. Detects available install targets:
   - **Claude Code** — installs to `~/.claude/skills/{name}/SKILL.md`
   - **Codex** — installs to `~/.codex/skills/{name}/SKILL.md`
   - **Template** — applies a multi-file template (if the definition has a `template` field)
4. Prompts to select a target
5. Copies facet files and generates the skill document

**Template-based install:**

When a composition definition includes a `template` field, the install copies the template directory structure and injects facet tokens (`{{facet:persona}}`, `{{facet:knowledges}}`, `{{facet:policies}}`, `{{facet:instructions}}`).

## Compose Definition Format

Definitions are YAML files in `~/.faceted/compositions/`:

```yaml
name: code-review           # Required: skill name
description: Code review     # Optional: description
persona: reviewer            # Required: persona facet name or path
knowledge:                   # Optional: knowledge facet names or paths
  - architecture
  - api-design
policies:                    # Optional: policy facet names or paths
  - coding
  - security
instruction: Review changes. # Optional: inline text or file path
template: issue-worktree     # Optional: template directory name
order:                       # Optional: user-message section order
  - policies
  - knowledge
  - instruction
```

### Field resolution

- **Facet names** (e.g., `coder`) are resolved from `~/.faceted/facets/{kind}/{name}.md`
- **File paths** starting with `./`, `../`, `/`, `~` or ending with `.md` are resolved directly
- **Scope references** (`@owner/repo/name`) are resolved from `~/.faceted/repertoire/`
- **Inline text** (for `instruction` only) is used directly without file lookup
