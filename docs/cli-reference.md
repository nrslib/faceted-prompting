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
│   ├── instructions/            # Instruction files
│   └── output-contracts/        # Output/report format files
├── compositions/                # Compose definition YAML files
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

When a composition definition includes a `template` field, install still targets Claude Code or Codex, but it copies the template directory structure and injects facet tokens (`{{facet:persona}}`, `{{facet:knowledges}}`, `{{facet:policies}}`, `{{facet:instructions}}`, `{{facet:outputContracts}}`).

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
instructions:                # Optional: instruction facet names, paths, or scope refs
  - review-changes
output-contracts:            # Optional: output contract facet names, paths, or scope refs
  - review-report
template: issue-worktree     # Optional: template directory name
order:                       # Optional: user-message section order
  - knowledge
  - instructions
  - output-contracts
  - policies
```

### Field resolution

- **Facet names** (e.g., `coder`) are resolved from the configured facets roots at `facets/{kind}/{name}.md`
- **File paths** starting with `./`, `../`, `/`, `~` or ending with `.md` are resolved relative to the compose definition directory for relative paths
- **File path boundaries** require the real path to stay inside the compose definition directory or configured facets roots; symlinks and paths outside those roots fail
- **Scope references** (`@owner/repo/name`) require repertoire roots and resolve from `~/.faceted/repertoire/`
- **Inline instructions** are kept as prompt content when an instruction entry is not resolved as a facet name or file path

If `order` is omitted, the user-message section order is `knowledge`, `instructions`, `output-contracts`, then `policies`. The YAML key is `output-contracts`; the TypeScript API exposes it as `outputContracts`.

### Facet Partial Includes

File-backed instruction, policy, knowledge, and output-contract facet files may include shared Markdown partials with this syntax:

```md
{{include:instructions/review-common}}
```

`{{include:instructions/review-common}}` resolves to `facets/partials/instructions/review-common.md` and expands in place before the composed prompt is written. Supported include kinds are `instructions`, `policies`, `knowledge`, and `output-contracts`. Repertoire partials use `{{include:<kind>/@owner/repo/<name>}}` and resolve from `repertoire/@owner/repo/facets/partials/<kind>/<name>.md`. Shortened forms such as `{{include:review-common}}` are rejected.

When both local and global faceted roots are available, partials follow local-first resolution: `.faceted/facets/partials/<kind>/` is checked before `~/.faceted/facets/partials/<kind>/`. Missing includes, empty include names, shortened syntax, cyclic include chains, paths that escape the allowed roots, and partial paths that resolve to directories or other non-file targets stop the command with an explicit error. Inline instruction text does not expand include tokens. The partial source paths are included in `composePromptPayload().copyFiles.facetPartials` only when includes are used; `copyFiles.instructionPartials` remains available for instruction partial compatibility.
