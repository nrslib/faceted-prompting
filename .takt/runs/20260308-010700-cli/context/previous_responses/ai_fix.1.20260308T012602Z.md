依頼内容に従い、まず `.takt/runs/20260308-010700-cli/context/task` と Report Directory の一次情報を確認し、指摘事項をゼロベースで特定します。続けて対象ファイルを実際に開き、検索で実在確認してから修正・テストまで実行します。
コンテキスト配下を確認できました。次に `order.md` と `reports` を読み、AI Review の具体的な指摘ファイルと修正対象を確定します。
ポリシー全文を確認しました。次に `ai-review.md` の指摘を1件ずつ抽出し、対象ファイルを実際に開いて現状との差分を確認します。
レビュー指摘4件に対して、まず該当ファイルを全て開いて事実確認します。その後 `rg` で問題箇所の存在を検索で裏取りしてから修正に入ります。
該当ファイルの現状を確認し、4件とも再現可能であることを把握しました。次に検索で問題箇所を明示し、既存テスト構成を確認してリグレッションテストを追加します。
これから4点を同時に修正します。`resolve.ts` は実YAMLパーサへ置換、`index.ts` は公開エクスポートを整理、`config/index.ts` は未使用公開関数を削除、`cli/index.ts` は `isResourcePath` 再利用に統一します。合わせてYAML回帰テストを追加します。
YAMLローダー置換を適用しました。続けて公開API整理・重複関数統一・未使用export削除、および回帰テスト追加を行います。
実装変更は反映できたので、`grep` で重複・未使用の消し込みを再確認したうえで `npm run build` と `npm test` を実行して検証します。
ビルドとテストは `tsc`/`vitest` 未導入で失敗したため、依存関係をインストールして再実行します。
## 確認したファイル
- [`src/resolve.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/resolve.ts:224)
- [`src/index.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/index.ts:9)
- [`src/config/index.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/config/index.ts:1)
- [`src/cli/index.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:6)
- [`src/__tests__/compose-definition.test.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/compose-definition.test.ts:102)
- [`package.json`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/package.json:46)
- [`package-lock.json`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/package-lock.json:12)

## 実行した検索
- `rg -n "parseComposeYaml|loadComposeDefinition|isPathLike|isResourcePath|readConfigYaml|ComposeDefinition|ComposeOrderEntry" src`  
  AIREV-001〜004 の該当実装位置を確認。
- `rg --files src/__tests__ | sort`  
  既存テスト構成を確認。
- `rg -n "function isPathLike|readConfigYaml|loadComposeDefinition,|ComposeDefinition,|ComposeOrderEntry," src/index.ts src/cli/index.ts src/config/index.ts src/resolve.ts`  
  修正後に重複/不要exportが消えていることを確認。
- `git status --short`  
  変更ファイルを確認。

## 修正内容
- AIREV-001: [`src/resolve.ts:267`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/resolve.ts:267) を確認した結果、独自行パーサ `parseComposeYaml` が存在したため、`yaml` パッケージによる実YAMLパース (`parse`) に置換。  
  型検証 (`ensureRequiredString` / `ensureOptionalString` / `ensureStringList`) と未知キー検証を追加し、`|` ブロックスカラーを正しく処理可能に修正。
- AIREV-002: [`src/index.ts:9`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/index.ts:9) と [`src/index.ts:40`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/index.ts:40) を確認した結果、`ComposeDefinition` / `ComposeOrderEntry` / `loadComposeDefinition` が公開exportされていたため削除。CLI内部用途に限定。
- AIREV-003: [`src/config/index.ts:1`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/config/index.ts:1) を確認した結果、未使用の公開関数 `readConfigYaml` が存在したため削除し、不要import (`readFileSync`) も削除。
- AIREV-004: [`src/cli/index.ts:6`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:6) と [`src/cli/index.ts:31`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts:31) を確認した結果、`isPathLike` が `isResourcePath` と重複していたため、`isPathLike` を削除して `isResourcePath` に統一。
- 回帰テスト追加: [`src/__tests__/compose-definition.test.ts:102`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/__tests__/compose-definition.test.ts:102) に、YAMLブロックスカラー (`instruction: |`) の読込テストを追加。
- 依存追加: [`package.json:46`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/package.json:46) に `yaml` を追加し、`package-lock.json` を更新。

## テスト結果
- `npm run build`  
  成功（TypeScriptビルド通過）。
- `npm test`  
  成功（`11` files / `139` tests passed）。