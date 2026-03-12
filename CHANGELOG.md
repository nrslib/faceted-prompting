# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.2.1] - 2026-03-12

### Changed
- `facet init` はディレクトリ構造と config のみ作成し、サンプル compositions/templates は生成しないよう変更。サンプルの取得は `facet pull-sample` に一本化

### Internal
- `typescript-eslint` を追加し ESLint flat config (`eslint.config.js`) を導入
- 未使用変数・import の除去（`facetPaths`, `copiedFacetPaths`, `afterEach`）
- CI を `verify:release` スクリプトに統一し、`pack:check` / `smoke:pack` による publish 前検証を追加
- `prepublishOnly` を `verify:release` に変更、`prepack` で build を実行するよう整理

## [0.2.0] - 2026-03-12

### Added
- `facet init` command for standalone initialization of `~/.faceted/` directory structure
- `facet pull-sample` command to fetch sample coding facets from TAKT on GitHub
- `facet compose` がワーキングツリーからプロジェクトコンテキスト（coding/frontend/backend）を自動検出
- `composePromptPayload()` API — プロンプト合成とコピー対象ファイルのメタデータを一括取得
- `ComposedPromptPayload` / `CopyFiles` 型を追加
- `traced-config` による設定バリデーションとレイヤード優先度解決

### Changed
- `facet compose` / `facet install skill` の実行前に `facet init` が必須に
- `setup` コマンドを `pull-sample` に置換 — サンプルファセットをバンドルではなく GitHub から取得する方式に変更
- `facet install skill` のターゲットから Template を削除し、Claude Code / Codex のみに
- スキルインストールフローを `composePromptPayload()` ベースに統合し簡素化

### Internal
- ドキュメント整備: README 全面リライト、CLI/API/Concepts リファレンス、CONTRIBUTING.md 追加
- init, compose, setup, skill install, config, facet modes のテストカバレッジを追加

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
