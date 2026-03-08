要求に沿って、まずタスク指示書・ポリシー・レポート一式を読み、次に実装差分と実コードを突合し、最後に `npm test` と `npm run build` を実行して検証します。まず参照すべきコンテキストファイルを確認します。
参照先を確認しました。次に、`order.md`・完全版ポリシー・ナレッジを読み、続いてレポート群の未解決指摘（REJECT/finding）を横断検索して検証観点を固定します。
要件照合の前に、レポート群を横断して未解決指摘が残っていないかを機械的に確認します。`finding_id`・`REJECT`・`未対応`を全件検索して、必要なファイルだけ深掘りします。
最新状態の判断に使うため、レポートディレクトリの現行 `.md` を全件読みます。そのうえで、過去タイムスタンプ版にあるREJECTが現行で解消済みかを追跡します。
レポートは現行版で全レビューが APPROVE になっていることを確認しました。次に実コードを独立検証するため、変更ファイル一覧・削除有無を確認してから、要件ごとの実装箇所を読み込みます。
次に、要件充足の根拠行を確定するため、新規/更新テストとCLI統合テストを読みます。あわせて削除スコープ（ファイル削除・機能除去）がないことを差分から確認します。
実装根拠の読み込みは完了したので、ここから実行検証に入ります。まず `npm test` と `npm run build` を実行し、その後 `npm pack` と実CLI（`facet compose`）の初回起動を隔離HOMEで確認します。
テスト・ビルド・`npm pack` は通過しました。最後に、隔離した `HOME` で実際に `facet compose` を起動し、初回初期化・デフォルト出力CWD・生成内容を手動で確認します。
# 最終検証結果

## 結果: APPROVE

## 要件充足チェック

タスク指示書から要件を抽出し、各要件を実コードで個別に検証する。

| # | 要件（タスク指示書から抽出） | 充足 | 根拠（ファイル:行） |
|---|---------------------------|------|-------------------|
| 1 | `facet compose` を `facet` CLI で実行可能（bin配布） | ✅ | [package.json:8](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/package.json#L8), [bin/facet:1](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/bin/facet#L1), [src/cli/index.ts:159](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts#L159) |
| 2 | npmグローバルインストール前提の利用導線 | ✅ | [README.md:24](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md#L24), `npm pack` 実行成功（tarballに `bin/facet` と `dist/cli/*` 同梱確認） |
| 3 | 設定ファイル `~/.faceted/config.yaml` | ✅ | [src/config/index.ts:16](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/config/index.ts#L16), [src/config/index.ts:25](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/config/index.ts#L25) |
| 4 | 初回起動時の初期化（config + テンプレート投入） | ✅ | [src/cli/index.ts:165](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts#L165), [src/init/index.ts:26](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/init/index.ts#L26), [src/init/index.ts:37](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/init/index.ts#L37), [src/__tests__/init.test.ts:25](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/init.test.ts#L25) |
| 5 | facets配置（persona/knowledge/policies/compositions） | ✅ | [src/init/index.ts:5](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/init/index.ts#L5), [src/cli/index.ts:170](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts#L170), [README.md:35](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md#L35) |
| 6 | compose定義ディレクトリ名を `compositions` に確定 | ✅ | [src/cli/index.ts:170](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts#L170), [src/init/index.ts:5](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/init/index.ts#L5), [README.md:49](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md#L49) |
| 7 | 対話UI（選択 + 入力） | ✅ | [src/cli/select.ts:44](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/select.ts#L44), [src/cli/runner.ts:21](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/runner.ts#L21), [src/__tests__/cli-select.test.ts:35](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/cli-select.test.ts#L35) |
| 8 | 出力先デフォルトCWD、入力で変更可能 | ✅ | [src/cli/index.ts:198](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts#L198), [src/output/index.ts:5](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts#L5), [src/__tests__/it-cli-compose-flow.test.ts:113](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts#L113) |
| 9 | compose定義で `name` 必須、`description` 任意 | ✅ | [src/compose-definition.ts:53](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose-definition.ts#L53), [src/compose-definition.ts:87](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose-definition.ts#L87), [src/__tests__/compose-definition.test.ts:33](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/compose-definition.test.ts#L33), [src/__tests__/compose-definition.test.ts:54](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/compose-definition.test.ts#L54) |
| 10 | personaはsystem promptに対応し、順序制御対象外 | ✅ | [src/types.ts:50](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/types.ts#L50), [src/compose-definition.ts:25](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose-definition.ts#L25), [src/compose.ts:21](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose.ts#L21), [src/__tests__/compose-definition.test.ts:91](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/compose-definition.test.ts#L91) |
| 11 | YAMLはファイル参照方式に対応 | ✅ | [src/cli/index.ts:71](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts#L71), [src/cli/index.ts:142](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts#L142), [src/resolve.ts:33](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/resolve.ts#L33) |
| 12 | 既存レビュー指摘（ARCH-002/TREV-003/QAREV-002/SEC-005）の解消 | ✅ | [src/output/index.ts:50](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts#L50), [src/output/index.ts:57](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts#L57), [src/__tests__/it-cli-compose-flow.test.ts:293](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts#L293), [src/__tests__/it-cli-compose-flow.test.ts:336](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts#L336), [src/__tests__/output-directory.test.ts:24](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/output-directory.test.ts#L24) |
| 13 | `facet compose` 以外を主コマンドとして増やさない | ✅ | [src/cli/index.ts:161](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts#L161), [src/__tests__/it-cli-compose-flow.test.ts:99](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts#L99) |
| 14 | 将来拡張（スキルパス）を設定で扱える余地 | ✅ | [src/config/index.ts:5](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/config/index.ts#L5), [src/config/index.ts:10](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/config/index.ts#L10), [src/__tests__/init.test.ts:52](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/init.test.ts#L52) |

- ❌ が1件でもある場合は REJECT 必須
- 根拠なしの ✅ は無効（実コードで確認すること）
- 計画レポートの判断を鵜呑みにせず、要件ごとに独立照合する

## 検証サマリー
| 項目 | 状態 | 確認方法 |
|------|------|---------|
| テスト | ✅ | `npm test`（14 files / 161 tests passed） |
| ビルド | ✅ | `npm run build` 成功 |
| 動作確認 | ✅ | `npm pack` 成功、隔離 `HOME` で `node bin/facet compose` 実行し `~/.faceted/config.yaml`・必須ディレクトリ/テンプレート生成・デフォルトCWD出力を実確認 |

## 成果物
- 作成: `bin/facet`, `src/cli/*`, `src/config/*`, `src/init/*`, `src/output/*`, `src/compose-definition.ts`, `src/__tests__/cli-select.test.ts`, `src/__tests__/compose-definition.test.ts`, `src/__tests__/init.test.ts`, `src/__tests__/it-cli-compose-flow.test.ts`, `src/__tests__/module-boundary.test.ts`, `src/__tests__/output-directory.test.ts`
- 変更: `package.json`, `package-lock.json`, `README.md`, `src/types.ts`, `src/compose.ts`, `src/__tests__/compose.test.ts`
- 削除確認: `git diff --name-only --diff-filter=D` が空（根拠不明の削除なし）

# タスク完了サマリー

## タスク
`facet compose` CLI実装、`~/.faceted` 初期化、compose定義要件（`name`必須・`description`任意・persona順序対象外）、対話出力フロー、関連テスト/ドキュメントの達成可否を最終検証しました。

## 結果
完了

## 変更内容
| 種別 | ファイル | 概要 |
|------|---------|------|
| 作成 | `src/cli/index.ts` | `facet compose` 実行フロー（初期化→選択→出力→書込） |
| 作成 | `src/config/index.ts` | `~/.faceted/config.yaml` 読込/生成、`skillPaths` 型 |
| 作成 | `src/init/index.ts` | 初回ディレクトリ/テンプレート初期化 |
| 作成 | `src/output/index.ts` | 出力先解決と安全な書き込み |
| 作成 | `src/compose-definition.ts` | YAML定義の検証/ロード |
| 変更 | `src/compose.ts` | user message順序オプション対応 |
| 変更 | `src/types.ts` | compose定義/順序型追加 |
| 変更 | `package.json` | `facet` bin配布設定 |
| 変更 | `README.md` | CLI手順・初期化・定義仕様の追記 |
| 作成/変更 | `src/__tests__/*` | CLI統合・初期化・定義・上書き/安全性の回帰テスト |

## 確認コマンド
```bash
npm test
npm run build
```