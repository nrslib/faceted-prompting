依頼内容に沿って、まず `.takt/runs/20260308-010700-cli/context/task` の指示書と Report Directory を確認し、最新レビューレポートと直近履歴（各 `{レポート名}.*` 最大2件）を読み取って修正対象を確定します。続けて該当実装・再発防止テストを追加し、最後に型チェックとテストを実行します。
タスク定義ファイルとポリシー本文をこれから読み、修正対象の `Report Directory` を特定します。続けてレビュー履歴の最新＋直近2件をレポート名ごとに抽出します。
`reports` ディレクトリを特定したので、最新レポート群と `{report}.*` 履歴を収集して、`new/reopened/persists` と `family_tag` を整理します。
これから各レビューレポート（`*-review.md`）を開き、同名の履歴 `*.md.*` をタイムスタンプ降順で最大2件ずつ確認します。重複 `family_tag` を統合して修正対象を確定します。
修正対象は `ARCH-001 / REQ-NEW-* / SEC-* / TREV-001` の5系統で確定しました。次に実装ファイルを読み、`family_tag` 単位でまとめて修正し、各タグに対応する回帰テストを追加します。
実装方針を確定しました。`resolve.ts` から compose定義ロード責務を分離し、CLI側で参照パス境界チェックを追加、出力ファイル名の検証・出力先逸脱防止、さらに上下キー選択UIと回帰テスト（順序・セキュリティ・選択UI）を追加します。
対象コードの把握が終わったので、これから実編集に入ります。最初に `resolve.ts` から compose定義ローダーを新規モジュールへ切り出し、CLI import を更新してアーキテクチャ指摘を解消します。
次に `src/cli/index.ts` と `src/output/index.ts` にセキュリティ修正を入れます。具体的には参照パスの許可ルート検証と、`name` を使う出力ファイル名の検証・ディレクトリ逸脱チェックを追加します。
対話UI要件の修正として、`src/cli/runner.ts` を番号入力から上下キー選択に置き換えます。テスト可能にするため、IO注入可能な選択関数として切り出して実装します。
続けてテストを更新します。`compose-definition` モジュール分離に合わせた参照先変更と、レビュー指摘の回帰テスト（順序検証強化・セキュリティ境界・上下キー選択）を追加します。
最後に README の要件不足を補います。compose定義YAML例、上下キー選択の対話手順、初期化済み環境での再実行挙動を追記します。
実装とテスト追加が完了したため、これから `npm run build` と `npm test` を実行して完了条件を検証します。エラーが出た場合はその場で修正します。
## 作業結果
- Report Directory の最新レビュー（`ai/architect/qa/requirements/security/testing`）と履歴（`{report}.md.*` 最大2件）を確認し、`new` 指摘 6 件をすべて修正しました。
- 同一 `family_tag` は統合対応し、各 `family_tag` に対して回帰テストを追加しました。

## 変更内容
- `design-violation`:
  - `loadComposeDefinition` 一式を [`src/compose-definition.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose-definition.ts) に分離し、[`src/resolve.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/resolve.ts) を参照解決責務へ限定。
  - 回帰テスト: [`src/__tests__/module-boundary.test.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/module-boundary.test.ts)
- `req-gap`:
  - 上下キー選択 UI を [`src/cli/select.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/select.ts) として実装し、[`src/cli/runner.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/runner.ts) から利用。
  - README に compose YAML 例・対話手順・再実行時挙動を追記: [`README.md`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md)
  - 回帰テスト: [`src/__tests__/cli-select.test.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/cli-select.test.ts)
- `path-traversal`:
  - compose `name` の安全文字検証を追加（`../` 等を拒否）: [`src/cli/index.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts)
  - 出力ファイルのディレクトリ逸脱チェックを追加: [`src/output/index.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts)
  - 回帰テスト: [`src/__tests__/it-cli-compose-flow.test.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts)
- `data-exposure`:
  - YAML 参照パスを `facetsRoot` 配下に制限する境界チェックを追加: [`src/cli/index.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts)
  - 回帰テスト: [`src/__tests__/it-cli-compose-flow.test.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts)
- `test-coverage`:
  - 統合テストに `knowledge < policy` の直接検証を追加。
  - `userMessageOrder` のユニット回帰を追加: [`src/__tests__/compose.test.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/compose.test.ts)

## ビルド結果
- `npm run build` 成功（`tsc` 完了、エラーなし）

## テスト結果
- 実行コマンド: `npm test`
- 結果: `13` files passed, `145` tests passed, 失敗 `0`

## 収束ゲート
| 指標 | 件数 |
|------|------|
| new（今回修正） | 6 |
| reopened（再発修正） | 0 |
| persists（前回から継続、今回未着手） | 0 |

## 証拠
- 確認レポート: `.takt/runs/20260308-010700-cli/reports/*-review.md` と `*.md.*`（存在するものを降順2件）。
- 主要修正差分:
  - `resolve` から compose 定義ロード責務を分離（`src/compose-definition.ts` 新規、`src/resolve.ts` 縮小）。
  - CLI 参照/出力のパス境界チェック追加（`src/cli/index.ts`, `src/output/index.ts`）。
  - 上下キー選択 UI 実装（`src/cli/select.ts`, `src/cli/runner.ts`）。
  - README 要件追記（`README.md`）。
- 回帰テスト追加/更新:
  - `src/__tests__/module-boundary.test.ts`
  - `src/__tests__/cli-select.test.ts`
  - `src/__tests__/it-cli-compose-flow.test.ts`
  - `src/__tests__/compose.test.ts`