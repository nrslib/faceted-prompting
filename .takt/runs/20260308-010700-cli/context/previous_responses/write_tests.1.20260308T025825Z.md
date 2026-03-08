指定どおり、まず `.takt/runs/20260308-010700-cli/context/task/order.md` と同一 Report Directory 内のレポートを読み、今回のテスト作成対象を確定します。その後、既存テストパターンを確認してテストファイルのみ追加します。
基準仕様とポリシーは確認できました。次に同じ Report Directory の `plan.md` と既存の `test-scope.md` / `test-decisions.md` を読み、今回のテスト対象を固定します。
計画レポート上は既にテスト候補が示されています。現行リポジトリの実テスト内容を確認し、未充足のケースだけをテストファイルに追加します（本番コードは触りません）。
既存テストはかなり充実しています。抜けを見極めるため、CLI実装本体を確認し、まだ担保されていない振る舞い（特に初回起動とデフォルト出力経路）に絞って追加テストを作成します。
これからテストファイルのみ更新します。追加するのは、`facet compose` 初回起動フロー（自動初期化 + CWDデフォルト出力）と、設定/定義ローダーの境界ケースを検証する単体テストです。
`it-cli-compose-flow.test.ts` に初回起動 + デフォルトCWD出力の結合テストを追加します。残りの編集は `apply_patch` ツールで実施します。
追加した3ファイルのテストを先に実行して妥当性を確認します。通過後にレポート（scope/decisions）を更新して完了報告します。
## 作業結果
- 指示どおり、プロダクションコードは変更せず、テストのみ追加しました。
- 追加したテストで以下を固定しました。
  - 初回 `facet compose` 実行時の自動初期化 + 空入力時の出力先CWD適用（結合）
  - `~/.faceted/config.yaml` の初期内容（`skillPaths` 含む）
  - compose定義YAMLの未知キーをFail Fastで拒否
- 実行結果: `npm test -- src/__tests__/compose-definition.test.ts src/__tests__/init.test.ts src/__tests__/it-cli-compose-flow.test.ts` は全件成功（3 files / 19 tests passed）。
- レポートも更新済みです。  
  - [test-scope.md](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/reports/test-scope.md)  
  - [test-decisions.md](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/reports/test-decisions.md)

## 変更内容
- 変更: [src/__tests__/it-cli-compose-flow.test.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts)
  - `should initialize faceted home on first run and write output to cwd when input is blank`
- 変更: [src/__tests__/init.test.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/init.test.ts)
  - `should initialize config with extensible skillPaths field`
- 変更: [src/__tests__/compose-definition.test.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/compose-definition.test.ts)
  - `should reject unknown compose definition keys`