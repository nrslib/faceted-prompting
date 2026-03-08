要求を確認しました。まず指定どおり `.takt/runs/20260308-010700-cli/context/task` と `order.md`、および Report Directory の履歴を先に読み、参照資料の実在確認と要件のソース確定から進めます。
`order.md` の内容を基準仕様として確認しました。次に「参照資料（最優先）」として指定された既存コード群と、実行履歴として指定された `reports` を読み、要件ごとの変更要否をコード行で確定します。
実行履歴を確認したところ、過去イテレーションで実装案と決定が記録されています。ここから現行コードの実態を照合するため、参照資料に指定された `takt` 側CLI実装と、このリポジトリの指定ファイルを読み込みます。
参照資料の `takt` 側は確認できました。続いて現リポジトリ全体の構成と、CLI関連の実装有無を列挙して、要件ごとの「変更要/不要」を確定します。
レビューは全て APPROVE ですが、今回のムーブメントでは現行コード根拠で再計画が必要なので、CLI/初期化/定義解決の実装本体とナレッジ制約ファイルを読み、要件単位で変更要否を再判定します。
CLI本体と初期化・定義ローダー・出力処理は実装済みでした。次に型定義と既存テストを確認し、要件の「name必須/description任意/persona順序対象外」などを満たしている根拠行を揃えます。
テストとビルドを実行し、現行HEADで `npm test` / `npm run build` は通過を確認しました。最後に要件差分を整理して、Coder向けに「変更要/不要」と具体的な実装ガイドラインを確定します。
**調査結果（参照資料の読込完了）**
- タスク仕様: [`order.md`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/context/task/order.md)
- 実行履歴（primary history）: [`reports/plan.md`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/reports/plan.md) を含む各 review を確認し、最新は全て `APPROVE`
- 参照実装（対話UI作法）: [`/Users/nrs/work/git/takt/src/shared/prompt/select.ts`](/Users/nrs/work/git/takt/src/shared/prompt/select.ts), [`/Users/nrs/work/git/takt/src/shared/prompt/confirm.ts`](/Users/nrs/work/git/takt/src/shared/prompt/confirm.ts), [`/Users/nrs/work/git/takt/bin/takt`](/Users/nrs/work/git/takt/bin/takt)

**要件別判定（変更要/不要）**
- `facet compose` CLI配布: **不要（実装済み）**  
  根拠: [`package.json:8`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/package.json:8), [`bin/facet:1`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/bin/facet:1), [`src/cli/runner.ts:17`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/runner.ts:17)
- 初回起動初期化（`~/.faceted/config.yaml` + ディレクトリ + テンプレート）: **不要（実装済み）**  
  根拠: [`src/init/index.ts:26`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/init/index.ts:26), [`src/config/index.ts:20`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/config/index.ts:20), [`src/init/index.ts:5`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/init/index.ts:5)
- compose定義（`name`必須/`description`任意/persona順序対象外）: **不要（実装済み）**  
  根拠: [`src/compose-definition.ts:53`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose-definition.ts:53), [`src/compose-definition.ts:45`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose-definition.ts:45), [`src/compose-definition.ts:25`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose-definition.ts:25)
- persona→system、他→user、順序適用: **不要（実装済み）**  
  根拠: [`src/compose.ts:16`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose.ts:16), [`src/compose.ts:22`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose.ts:22), [`src/cli/index.ts:188`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:188)
- 出力先デフォルトCWD + 対話入力で変更: **不要（実装済み）**  
  根拠: [`src/cli/index.ts:193`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:193), [`src/output/index.ts:5`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts:5)
- composeディレクトリ名（Open Question）: **`compositions` で確定済み**  
  根拠: [`src/init/index.ts:5`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/init/index.ts:5), [`README.md:35`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md:35), [`src/__tests__/init.test.ts:35`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/init.test.ts:35)

**設計方針（Coder向け）**
- 追加実装は最小化し、基本は**現状実装維持**で回帰防止に集中。
- 対話UIパターンは `takt` の「選択はraw key入力、入力はreadline」方針を踏襲済みなので、同流儀を崩さない。
- `compose` の責務分離を維持し、CLI側で並び順を再実装しない（`definition.order -> compose(options.userMessageOrder)` 配線を唯一経路にする）。

**配線影響点（新パラメータ系）**
- `order` 読込: [`src/compose-definition.ts:92`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose-definition.ts:92)
- 型定義: [`src/types.ts:46`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/types.ts:46), [`src/types.ts:58`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/types.ts:58)
- 合成適用: [`src/cli/index.ts:190`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:190), [`src/compose.ts:22`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose.ts:22)

**注意すべきアンチパターン**
- `src/index.ts` からCLI/初期化/出力の内部実装をexportしない（公開API汚染防止）。
- facet解決ロジックを複数箇所に重複実装しない（`buildFacetSet`/`resolveFacetRef`集約を維持）。
- `compositions` 命名を再度 `composes` に揺らさない（初期化・README・テスト全連鎖で破綻）。

**検証状況**
- `npm test`: 14 files / 155 tests passed
- `npm run build`: passed

このため、次ムーブメント（write_tests / implement）は「新規実装」ではなく、既存差分の微調整が必要になった場合のみ最小修正する方針が妥当です。