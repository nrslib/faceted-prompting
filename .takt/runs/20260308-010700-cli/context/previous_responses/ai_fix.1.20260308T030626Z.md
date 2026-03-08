対象のレポートとタスク指示書を一次情報として確認し、指摘された不備をゼロベースで特定します。まず `.takt/runs/.../context/task` と Report Directory の内容を読み、修正対象ファイルを確定します。
レポートディレクトリを確認できたので、次に `order.md`・最新の `ai_review` レポート・このムーブメントの policy/knowledge 原文を開いて、修正対象を確定します。
`ai_review` の参照先パスが異なっていたため、レポート本体の正しい配置を再特定してから指摘内容を読みます。
修正対象抽出のため、`reports` ディレクトリを直接一覧し、今回参照すべき `ai_review` レポート名を確定します。
レビュー指摘の2件（`AIREV-009`, `AIREV-010`）について、対象ファイルを行番号付きで開き、実在確認のために grep も実行します。確認後に最小差分で修正します。
問題は再現可能な形で存在していました。これから `src/cli/index.ts` で symlink 判定順序を修正し、`src/__tests__/output-directory.test.ts` の説明コメントを削除します。
修正を適用したので、指摘箇所の再検索で消し込みを確認したうえで、`npm test` を実行して回帰を検証します。
テストとビルドは通過しました。最終報告用に変更後の行番号を確認し、指摘ごとの「確認結果→修正内容」を具体的に整理します。
## 確認したファイル
- [`.takt/runs/20260308-010700-cli/reports/ai-review.md`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/reports/ai-review.md)
- [`src/cli/index.ts:203`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:203)
- [`src/cli/index.ts:209`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:209)
- [`src/__tests__/it-cli-compose-flow.test.ts:323`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts:323)
- [`src/__tests__/output-directory.test.ts:7`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/output-directory.test.ts:7)
- [`src/__tests__/output-directory.test.ts:10`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/output-directory.test.ts:10)
- [`src/__tests__/output-directory.test.ts:13`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/output-directory.test.ts:13)

## 実行した検索
- `rg -n "overwrite|symlink|Symbolic link|Given|When|Then|writeComposeOutput" src/cli/index.ts src/__tests__/it-cli-compose-flow.test.ts src/__tests__/output-directory.test.ts`  
  - AIREV-009/AIREV-010 の該当箇所が実在することを確認。
- `rg -n "Output file exists\\. Overwrite\\?|Symbolic links are not allowed for output file|Given|When|Then" src/cli/index.ts src/__tests__/output-directory.test.ts src/__tests__/it-cli-compose-flow.test.ts`  
  - 修正後に `Given/When/Then` コメントが消えていること、および symlink エラーメッセージ経路が残っていることを確認。

## 修正内容
- AIREV-009: [`src/cli/index.ts:203`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:203) を確認した結果、既存ファイル時に上書き確認が先行し、symlink拒否より先にキャンセルエラーへ進む問題が存在したため、`existsSync(outputCandidatePath)` ブロック内で上書き確認前に `lstatSync(...).isSymbolicLink()` を検査して即時エラーに修正しました（`Symbolic links are not allowed for output file`）。
- AIREV-010: [`src/__tests__/output-directory.test.ts:7`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/output-directory.test.ts:7), [`:10`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/output-directory.test.ts:10), [`:13`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/output-directory.test.ts:13) を確認した結果、`Given/When/Then` 説明コメントが存在したため削除しました。

## テスト結果
- `npm test`  
  - 14ファイル/158テストすべて成功。
- `npm run build`  
  - `tsc` 成功。