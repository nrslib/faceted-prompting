# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.4.0] - 2026-04-01

### Added
- `facet compose` に非対話モードを追加。`--composition`, `--split`/`--combined`, `--output`, `--overwrite` オプションでスクリプトやCI からの利用が可能に (#28)

### Changed
- スキルインストール先パスを設定ファイル (`config.yaml`) で管理するよう変更。`install.targets.codex.roots` で Codex のインストール先ディレクトリを指定可能に (#27)

### Internal
- `compose-command.ts` を `compose-definition-resolution.ts`, `compose-execution.ts`, `compose-options.ts` に分割リファクタリング
- TAKT quality gate 設定ファイルを追加
- CLI の不要な stdout 出力を除去

## [0.3.1] - 2026-03-19

### Changed
- **BREAKING:** `instruction`（単数・文字列）を `instructions`（複数形・配列）に統一。compose 定義 YAML の `instruction: "..."` は `instructions: ["..."]` に変更が必要
- デフォルトのユーザーメッセージ順序を `knowledge → instructions → policies` に変更。ポリシーが出力直前の制約として配置されるようになった
- `template` フィールドでパス指定（`./`, `../`, `~`, `/`）に対応。テンプレートをプロジェクトローカルに配置可能に

### Fixed
- macOS の symlink パス不一致によりローカル composition が正しく検出されない問題を修正

## [0.3.0] - 2026-03-18

### Added
- ローカル `.faceted/` ディレクトリのサポート。プロジェクトディレクトリ直下の `.faceted/` にファセットや compositions を配置でき、グローバル `~/.faceted/` へのフォールバック付きで先に解決される
- `facet init` がカレントディレクトリにローカル `.faceted/` を作成するよう変更。グローバル初期化は `facet init global` で実行
- テンプレートのファセットトークン (`{{facet:xxx}}`) が複数行の値を自動インデントするようになった。プレースホルダの行頭インデントに合わせて後続行にインデントが適用される。`{{facet:xxx | indent:none}}` で無効化可能 (#24)
- CLI 起動時にパッケージの新バージョンを自動チェックする update notifier を追加 (#18)

### Changed
- `facet compose` が composition 定義の `template` フィールドに基づくテンプレートベースの合成に対応。ローカル/グローバル両方の compositions ディレクトリからの選択が可能に (#20)
- ファセット解決がローカル優先の複数ルート (`facetsRoots`) に対応。ローカル `.faceted/facets/` → グローバル `~/.faceted/facets/` の順で first-match-wins (#20)
- テンプレートファイルコピー時のファイルレベル上書き確認とシンボリックリンクチェックによるセキュリティ強化 (#22)

### Internal
- `compose` コマンドを `compose-command.ts` に分離しモジュール化
- ファセットトークン処理を `facet-token-renderer.ts` / `facet-token-file-ops.ts` に分離
- テストカバレッジ追加: runner, path-guard, update-check, install-skill facets/flow, module-boundary, skill-renderer regression

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
