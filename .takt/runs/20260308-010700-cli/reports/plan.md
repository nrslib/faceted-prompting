# タスク計画

## 元の要求
Implement using only the files in `.takt/runs/20260308-010700-cli/context/task`.  
Primary spec: `.takt/runs/20260308-010700-cli/context/task/order.md`.  
Use report files in Report Directory as primary execution history.  
Do not rely on previous response or conversation summary.

## 分析結果

### 目的
`facet compose` を中心としたCLI提供、`~/.faceted` 初期化、compose定義YAMLの検証・解決、対話選択と出力生成、関連テストとREADME整備が要件を満たしているかを、指定資料と現行実装で照合し、次ムーブメント向けの実装方針を確定する。

### 参照資料の調査結果（参照資料がある場合）
- 最優先仕様 `order.md` の要件を基準に確認。
- 外部参照 `/Users/nrs/work/git/takt` は、対話UI作法として「矢印選択（raw key handling）」と「入力（readline）」、および `bin` ラッパーから `dist` を呼ぶ構成を採用している。
- 現リポジトリは、`package.json` の `bin`、`bin/facet`、`src/cli/*`、`src/config/*`、`src/init/*`、`src/output/*`、`src/compose-definition.ts`、関連テスト群が存在し、要件に対応済み。
- 主要差異は未実装不足ではなく、既存実装の維持・回帰防止が主論点。`compositions` 命名もコード・README・テストで統一済み。

### スコープ
- 影響対象:
  - CLI入口/実行フロー: `bin/facet`, `src/cli/index.ts`, `src/cli/runner.ts`, `src/cli/select.ts`
  - 初期化/設定: `src/init/index.ts`, `src/config/index.ts`
  - 定義解決/合成連携: `src/compose-definition.ts`, `src/types.ts`, `src/compose.ts`, `src/resolve.ts`
  - 出力: `src/output/index.ts`
  - ドキュメント: `README.md`
  - テスト: `src/__tests__/it-cli-compose-flow.test.ts`, `init.test.ts`, `compose-definition.test.ts`, `cli-select.test.ts` ほか
- 非対象:
  - `facet compose` 以外の新規サブコマンド拡張
  - 後方互換レイヤー追加
  - 公開APIの不要な拡張

### 検討したアプローチ（設計判断がある場合）
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| 新規にCLI/初期化を再設計して全面置換 | 否 | 現行で要件を満たしており、変更は回帰リスク増のみ。 |
| 既存責務分離を維持し不足があれば最小差分修正 | 採 | `cli/config/init/output/compose-definition` の分離が明確で、要件適合と保守性を両立。 |
| `compose` の順序制御をCLI側で再実装 | 否 | ロジック重複になるため、`compose(options.userMessageOrder)` へ集約維持が妥当。 |
| compose定義ディレクトリ名を再検討 | 否 | `compositions` で実装・テスト・READMEが一致し、Open Questionは実質解消済み。 |

### 実装アプローチ
1. 現行実装を基準線とし、要件との差分が発生した場合のみ最小変更で対応する。  
2. 変更時は責務境界を維持する（CLIはオーケストレーションのみ、検証はローダー、合成は`compose`、書込は`output`）。  
3. `name`必須、`description`任意、`persona`順序対象外、デフォルトCWD出力、初期化冪等を必須不変条件として扱う。  
4. 回帰防止として既存統合・単体テストを更新/追加し、`npm test` と `npm run build` の通過を完了条件にする。  

## 実装ガイドライン（設計が必要な場合のみ）
- `compose` の配置規則（persona→system、他→user）は [`src/compose.ts`] のみを正とし、CLI側で同等ロジックを重複実装しない。
- compose定義検証は [`src/compose-definition.ts`] に集中させ、CLIでは再検証ロジックを増やさない。
- ファイルI/O安全性（path境界・symlink拒否）は [`src/cli/index.ts`] と [`src/output/index.ts`] の既存ガードを維持する。
- `src/index.ts` の公開APIにCLI内部実装を露出しない。
- 追加パラメータが必要な場合は、`types` → loader → CLI配線 → compose呼び出し → test の順で配線漏れなく更新する。
- 同一原因の不具合が見つかった場合は、同パターンを全体検索して同時修正範囲に含める。

## スコープ外（項目がある場合のみ）
| 項目 | 除外理由 |
|------|---------|
| `facet compose` 以外の主コマンド追加 | 要件で明示的に対象外。 |
| 後方互換のための旧仕様保持 | 要件で「後方互換レイヤーは作らない」と明記。 |
| ライブラリ公開APIの再設計 | 今回要件達成に不要でスコープ逸脱。 |

## 確認事項（あれば）
- なし（Open Questionの compose定義ディレクトリ名は、実装・テスト・READMEで `~/.faceted/facets/compositions` に収束済み）。