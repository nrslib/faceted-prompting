依頼内容に従い、このムーブメントではテストのみ追加します。まず指定どおり `.takt/runs/20260308-010700-cli/context/task/order.md` と、同一 Report Directory 内のレポートを確認して、計画済みの振る舞いをテストケースに落とし込みます。
参照対象を確認し、`task` には `order.md` のみ、Report Directory には `plan.md` があることを確認しました。次に `order.md`・`plan.md`・このムーブメントの全文ポリシーを読み、必要なテスト範囲を確定します。
計画とポリシーを読み込みました。これから既存テストの書式と対象モジュールを確認し、同じ命名・構造で失敗先行のテストを追加します。
ここからテスト作成に入ります。追加するのは `cli compose` フローの結合テスト、`~/.faceted` 初期化の単体テスト、compose定義YAMLの検証テストの3系統で、先に Report Directory の `test-scope.md` を作成して変更スコープを固定します。
編集はテストファイルのみ行います。既存の命名規約に合わせて3ファイルを新規作成し、単体2本＋結合1本で `facet compose` の計画済み振る舞いを先に固定します。
追加した3テストを見直し、非同期 `import(...).then(...)` を使ってしまった箇所を同期処理に直します。その後、テスト実行で構文不備がないことだけ確認します。
テストファイルの整合性修正は完了しました。最後に変更ファイルを確認し、決定ログ `test-decisions.md` を必要分だけ作成して作業結果をまとめます。
## 作業結果
- `plan.md` に基づき、実装前テストを3本追加しました（単体2本 + インテグレーション1本）。
- Report Directory にスコープ宣言と決定ログを作成しました。
- プロダクションコードは変更していません。
- テスト実行を試しましたが、環境上 `vitest` コマンド未検出で実行できませんでした（`sh: vitest: command not found`）。

## 変更内容
- 作成: [compose-definition.test.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/compose-definition.test.ts)
- 作成: [init.test.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/init.test.ts)
- 作成: [it-cli-compose-flow.test.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts)
- 作成: [test-scope.md](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/reports/test-scope.md)
- 作成: [test-decisions.md](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/reports/test-decisions.md)