依頼内容に従って、まず `.takt/runs/20260308-010700-cli/context/task/order.md` と Report Directory の最新レビュー群を確認し、`new/reopened` 指摘を一覧化してから修正に入ります。続けて policy/knowledge の原本も開いて、制約に反しない形で実装します。
`context/report` は存在しないため、実行履歴のレポート配置場所を特定します。次に run 配下を走査して、`{レポート名}.*` の履歴を含むディレクトリを見つけます。
レポート場所は `.takt/runs/.../reports` でした。これから `order.md` と fix用 policy/knowledge の原文を読み、対象レビューレポート名を確定したうえで、各 `{レポート名}.*` の最新2件を確認します。
policy と knowledge が長文なので、残り部分を通読して実装禁止事項を取りこぼさないようにします。その後、`*-review.md` ごとに最新2履歴を読み、`family_tag` 単位で修正対象を確定します。
レビューファイルの現在版を先に横断確認し、どの `family_tag` が `new/reopened` かを抽出します。次に各レポートのタイムスタンプ版を2件まで遡って persists 傾向を照合します。
レビュー現況を整理すると、現行で未解決なのは `security-review` の `path-traversal / arbitrary-file-write` と `testing-review` の `test-coverage` です。これから関連実装 (`src/cli/index.ts`, `src/output/index.ts`, `src/init/index.ts`, テスト群) を確認して、同 family_tag の潜在箇所も含めて修正します。
修正方針を確定しました。次に `path-traversal` は実体パス検証（`realpath/lstat`）へ置換、`arbitrary-file-write` は出力時の symlink 拒否と親ディレクトリ境界検証を追加し、同時に `test-coverage` で要求されたテンプレート生成/非上書きテストを拡充します。実装前に実行スクリプトを確認します。
実装計画を確定しました。  
1. `src/cli/index.ts` の読取境界チェックを文字列比較から実体パス検証へ変更し、許可ルート配下判定時に symlink 迂回を防止します。  
2. `src/output/index.ts` で出力時に `fileName` のパストラバーサル拒否、既存出力ファイルの symlink 拒否、親ディレクトリの実体パス境界検証を追加します。  
3. `src/__tests__/it-cli-compose-flow.test.ts` に symlink 経由の読取拒否・書込拒否の回帰テストを追加し、`path-traversal`/`arbitrary-file-write` を family_tag 単位で閉じます。  
4. `src/__tests__/init.test.ts` に「4テンプレート生成」「再実行時のテンプレート非上書き」テストを追加して `TREV-002` を解消します。  
5. 最後に `npm run build` と `npm run test` を実行し、結果を収束ゲート形式で報告します。
これから `src/cli/index.ts` と `src/output/index.ts` を編集します。具体的には、読取/書込の両方で `realpath` と `lstat` を使った実体パス検証に置き換え、symlink を経由した境界回避を拒否する実装へ変更します。
次に回帰テストを拡張します。`it-cli-compose-flow` に「symlink 読取拒否」と「symlink 出力拒否」を追加し、`init.test` 追加分と合わせて `family_tag` ごとの再発防止を満たします。
`path-traversal` の潜在箇所として、compose 定義 YAML 自体の読み込み経路（`compositions` 内 symlink）も同じ family_tag で対策します。`listCompositionDefinitions` 側でも実体パス検証を入れて閉じます。
実装とテスト追加が完了したので、これから必須の `npm run build`（型チェック）と `npm run test` を実行して結果を確認します。
## 作業結果
- Report Directory の最新レビューと履歴（各 `*-review.md.*` を最大2件）を確認し、`new` 指摘 3件（`SEC-003`, `SEC-004`, `TREV-002`）を修正しました。
- `path-traversal` / `arbitrary-file-write` は symlink・実体パス検証まで含めて修正し、同 family_tag の潜在箇所（compose定義読込経路）も同時に対処しました。
- `test-coverage` は init テンプレート生成/非上書きの回帰テストを追加して再発防止を実装しました。

## 変更内容
- セキュリティ修正（読取境界・symlink拒否）
  - [`src/cli/index.ts:29`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:29)
  - `ensurePathWithinRoots` を `lstatSync` + `realpathSync` ベースに変更し、symlink と許可ルート外実体パスを拒否。
  - facet参照だけでなく compose定義ファイル列挙時にも同検証を適用。
- セキュリティ修正（書込境界・symlink拒否）
  - [`src/output/index.ts:24`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts:24)
  - 出力ファイル名のパスセグメント禁止、親ディレクトリ実体パス境界チェック、既存symlink出力ファイル拒否、書込後実体パス再検証を追加。
- 再発防止テスト追加（test-coverage）
  - [`src/__tests__/init.test.ts:38`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/init.test.ts:38)
  - 初回4テンプレート生成の検証、再実行時テンプレート非上書き検証を追加。
- セキュリティ回帰テスト追加
  - [`src/__tests__/it-cli-compose-flow.test.ts:165`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts:165)
  - symlink facet読取拒否、symlink出力ファイル拒否、symlink compose定義拒否の3ケースを追加。

## ビルド結果
- `npm run build` 実行: 成功（`tsc` 終了コード 0）

## テスト結果
- 実行コマンド: `npm run test`
- 結果: 成功（13 files / 150 tests passed）

## 収束ゲート
| 指標 | 件数 |
|------|------|
| new（今回修正） | 3 |
| reopened（再発修正） | 0 |
| persists（前回から継続、今回未着手） | 0 |

## 証拠
- 参照レポート（最新）: `security-review.md`, `testing-review.md` で `new` を確認。
- 履歴確認: `security-review.md.20260308T014759Z`, `testing-review.md.20260308T014804Z` を含む各 `*-review.md.*` を timestamp 降順で確認。
- 実装修正確認: [`src/cli/index.ts:29`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:29), [`src/output/index.ts:24`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts:24)
- テスト追加確認: [`src/__tests__/init.test.ts:38`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/init.test.ts:38), [`src/__tests__/it-cli-compose-flow.test.ts:165`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts:165)
- 実行ログ要点: `npm run build` 成功、`npm run test` で `150 passed` を確認。