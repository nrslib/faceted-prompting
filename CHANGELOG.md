# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- `composePromptPayload()` API for composing prompts with copy-file metadata
- `ComposedPromptPayload` and `CopyFiles` types

### Changed
- Skill install flow uses `composePromptPayload()` for centralized file resolution
- `copyFacetFiles()` accepts `CopyFiles` instead of `SkillSections`
- `facet compose` auto-detects project context (coding/frontend/backend) from working tree
- Skill install flow simplified to template-based integration

## [0.1.0] - 2026-02-14

### Added
- Core `compose()` function with facet placement rules (persona → system prompt, policies/knowledge/instruction → user message)
- `FacetSet`, `FacetContent`, `ComposedPrompt`, `ComposeOptions` types
- `FileDataEngine` and `CompositeDataEngine` for file-system backed facet retrieval
- `renderTemplate()` with `{{variable}}` substitution and `{{#if}}` conditionals
- `escapeTemplateChars()` for template injection prevention
- `trimContextContent()`, `prepareKnowledgeContent()`, `preparePolicyContent()` for context truncation
- Facet reference resolution (`resolveFacetPath`, `resolveFacetByName`, `resolveResourcePath`, etc.)
- `@owner/repo/facet-name` scope reference parsing and validation
- `facet compose` CLI command
- `facet install skill` CLI command with Claude Code, Codex, and template targets
- `~/.faceted/` initialization with sample facets and templates
- Compose definition YAML format with configurable section ordering
