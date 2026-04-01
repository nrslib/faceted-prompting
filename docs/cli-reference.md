# CLI Reference

The `facet` CLI provides commands for initializing facet data, composing prompts, and installing skills from faceted definitions.

## Installation

```bash
npm install -g faceted-prompting
```

## Initialization

`facet init` creates `~/.faceted/` with the following structure:

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

Only the directory structure and config are created during initialization. Sample facets, compositions, and templates are pulled separately via `facet pull-sample`.

## Commands

### `facet init`

Create local config and empty facet directories.

```bash
facet init
```

### `facet pull-sample`

Fetch sample coding facets, compositions, and templates from TAKT on GitHub and install them into `~/.faceted/`.

```bash
facet pull-sample
```

If any target files already exist, `pull-sample` asks for confirmation and overwrites them only when you answer `y` or `yes`.

### `facet compose`

Compose prompts using auto-detected project context.

```bash
facet compose
```

**Flow (interactive):**

1. Detects related files from the working tree and selects a context (`coding` / `frontend` / `backend`)
2. Prompts for output directory (default: current working directory)
3. Prompts for output mode:
   - **Combined** — writes `{name}.md` (single file with system + user sections)
   - **Split** — writes `{name}.system.md` and `{name}.user.md`
4. If the target file exists, prompts for overwrite confirmation

The compose context always includes the `coder` persona, `coding` and `ai-antipattern` policies, and `architecture` knowledge. When frontend- or backend-related files are detected, additional knowledge facets are included.

**Non-interactive mode:**

When any of the following options are specified, compose runs without prompts:

```bash
facet compose --composition <name> --split --output ./out --overwrite
```

| Option | Description |
|--------|-------------|
| `--composition <name>` | Select a composition definition by name |
| `--split` | Output as split files (system + user) |
| `--combined` | Output as a single combined file |
| `--output <dir>` | Output directory (default: current working directory) |
| `--overwrite` | Overwrite existing files without confirmation |

`--split` and `--combined` are mutually exclusive. For standard (non-template) compose, one of them is required in non-interactive mode. Template-backed compose does not support `--split` or `--combined`.

### `facet install skill`

Install a skill with facets to a target platform.

```bash
facet install skill
```

**Flow:**

1. Scans `~/.faceted/compositions/` for available definitions
2. Prompts to select a composition
3. Prompts to select a target:
   - **Claude Code** — installs to `~/.claude/skills/{name}/SKILL.md`
   - **Codex** — installs to `~/.agents/skills/{name}/SKILL.md` (configurable via `install.targets.codex.roots` in `config.yaml`)
4. Copies facet files and generates the skill document

When a composition definition includes a `template` field, install still targets Claude Code or Codex, but it copies the template directory structure and injects facet tokens (`{{facet:persona}}`, `{{facet:knowledges}}`, `{{facet:policies}}`, `{{facet:instructions}}`).

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
instructions:                # Optional: instruction facet names, paths, or inline text
  - review-changes
template: issue-worktree     # Optional: template directory name
order:                       # Optional: user-message section order
  - policies
  - knowledge
  - instructions
```

### Field resolution

- **Facet names** (e.g., `coder`) are resolved from `~/.faceted/facets/{kind}/{name}.md`
- **File paths** starting with `./`, `../`, `/`, `~` or ending with `.md` are resolved directly
- **Scope references** (`@owner/repo/name`) are resolved from `~/.faceted/repertoire/`
- **Inline text** (for `instructions` only) is used directly without file lookup
