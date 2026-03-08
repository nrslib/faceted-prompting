対象は Report Directory の最新レビューレポートに基づく修正なので、まず `.takt/runs/20260308-010700-cli/context/task` とレポート配置を確認し、`{レポート名}.*` の履歴を2件ずつ読んで修正対象を確定します。
タスク指示ファイルは `order.md` のみ確認できたため、次に同ランのレポートディレクトリを探索して、最新 + 履歴2件の読み込み対象を特定します。
次に、実装判断の根拠になる `order.md` とポリシー全文を先に読み、その後レビュー系 `*-review.md` について最新と履歴2件ずつを確認して `new/reopened/persists` を抽出します。
これから `*-review.md` をすべて読み、各レポート名ごとに `.{timestamp}` の最新2件も追って `family_tag` 単位で修正対象を統合します。抽出後に対象ファイルへ修正を入れます。
現在の未解決は `test-coverage` と `arbitrary-file-write` の2 family_tag です。続けて各 `*-review.md.*` の最新2件を確認し、再発傾向と同族指摘を取りこぼさないよう統合します。
履歴確認の結果、今回修正すべき open 指摘は `test-coverage`（QAREV-002/TREV-003を統合）と `arbitrary-file-write`（SEC-005）の2系統です。これから該当実装 `src/cli/index.ts` と `src/output/index.ts`、既存テストを読み、最小差分で修正と回帰テストを追加します。
テスト不足は既存 `it-cli-compose-flow` に追記すれば解消可能です。SEC-005 については `writeComposeOutput` を原子的 open/write に変更し、同 family_tag の再発防止として専用テストを追加します。先に既存スクリプトを確認して、修正後に `npm run build` と `npm test` を実行します。
これから編集に入ります。`SEC-005` は `writeComposeOutput` を `openSync`（`O_NOFOLLOW` 付き）へ変更して原子的に書き込み、CLI側の事前 `lstat` を除去して重複チェックを一元化します。あわせて `test-coverage` と `arbitrary-file-write` 用に回帰テストを追加します。
CLI側は既存ファイル確認時の事前 `lstat` を外し、上書き可否だけを判定して `writeComposeOutput` に `overwrite` を明示的に渡す形へ変更しました。続いて出力モジュールを原子的 open/write に置き換えます。
次に `test-coverage` の指摘統合対応として、`it-cli-compose-flow` に上書き確認の `拒否/許可` 2ケースを追加し、既存の symlink 出力テストも新しい書き込み経路に合わせて更新します。
`arbitrary-file-write` の再発防止要件を満たすため、出力モジュール単体で `overwrite: true` 時に symlink を拒否できることを検証する新規テストを追加します。
単体テストの後始末が失敗時にも確実に走るように、追加した `writeComposeOutput` テストを `try/finally` に調整します。 հետո build/test実行に進みます。
修正とテスト追加は完了しました。これから指定どおり `npm run build` と `npm test` を順に実行して、型チェックと全テストの通過を確認します。
ビルド失敗原因は `src/cli/index.ts` の import から `lstatSync` を外してしまった点です。`ensurePathWithinRoots` で必要なので復元し、再度ビルドとテストを実行します。
修正は通しで完了し、ビルドと全テストも通過しました。最後に差分確認を行い、レビュー指摘との対応関係（family_tag統合、再発防止テスト追加、収束ゲート件数）を整理して報告します。
## 作業結果
- Report Directory の最新レビューと各 `*-review.md.*` 最新2件を確認し、open 指摘を `family_tag` で統合して修正しました。
- 対応した open 指摘:
  - `test-coverage`（`QAREV-002` と `TREV-003` を統合対応）
  - `arbitrary-file-write`（`SEC-005`）

## 変更内容
- `test-coverage` 対応:
  - [`src/__tests__/it-cli-compose-flow.test.ts:300`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts:300) に上書き確認フローの回帰テストを追加
  - 追加ケース:
    - 既存ファイル + `n` で上書き拒否
    - 既存ファイル + `yes` で上書き成功
  - 既存の symlink 出力テストも新フローに合わせて更新（上書き確認で `y` を返し、書き込み段で拒否を検証）
- `arbitrary-file-write` 対応:
  - [`src/output/index.ts:24`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts:24) の `writeComposeOutput` を `openSync` + `O_NOFOLLOW` ベースに変更し、非原子的な `lstatSync -> writeFileSync` を除去
  - `overwrite` を明示引数化し、`O_EXCL` / `O_TRUNC` を切り替え
  - `ELOOP` を symlink 拒否エラーへ変換
- CLI 配線更新:
  - [`src/cli/index.ts:198`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:198) で上書き確認結果を `overwrite` として `writeComposeOutput` に渡すよう変更
- `arbitrary-file-write` の再発防止テスト追加:
  - [`src/__tests__/output-directory.test.ts:23`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/output-directory.test.ts:23)
  - `overwrite: true` でも symlink 出力ファイルを拒否することを検証

## ビルド結果
- 実行コマンド: `npm run build`
- 結果: 成功（`tsc` エラーなし）

## テスト結果
- 実行コマンド: `npm test`
- 結果: 成功（`14 passed`, `161 passed`, 失敗 0）

## 収束ゲート
| 指標 | 件数 |
|------|------|
| new（今回修正） | 3 |
| reopened（再発修正） | 0 |
| persists（前回から継続、今回未着手） | 0 |

## 証拠
- 確認したレビュー:
  - `.takt/runs/20260308-010700-cli/reports/qa-review.md`（new: `QAREV-002`）
  - `.takt/runs/20260308-010700-cli/reports/testing-review.md`（new: `TREV-003`）
  - `.takt/runs/20260308-010700-cli/reports/security-review.md`（new: `SEC-005`）
  - 各 `*-review.md.*` を timestamp 降順で2件確認し、`reopened/persists` 傾向を確認
- 主要修正箇所:
  - [`src/output/index.ts:50`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts:50) `O_NOFOLLOW` を使った原子的 open/write
  - [`src/cli/index.ts:204`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:204) 上書き確認と `overwrite` 配線
- 追加回帰テスト:
  - [`src/__tests__/it-cli-compose-flow.test.ts:320`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts:320)
  - [`src/__tests__/it-cli-compose-flow.test.ts:336`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/it-cli-compose-flow.test.ts:336)
  - [`src/__tests__/output-directory.test.ts:24`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/output-directory.test.ts:24)