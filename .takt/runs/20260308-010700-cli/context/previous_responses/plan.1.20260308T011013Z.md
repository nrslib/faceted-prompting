依頼内容に沿って、まず必須の参照資料を読み込みます。`.takt/runs/20260308-010700-cli/context/task` 配下を列挙し、`order.md` の「参照資料」セクションを起点に、指定されたファイルだけを確認して実装方針を固めます。
タスク指示書は `order.md` のみでした。次に `order.md` 本文を読み、そこで指定される「参照資料」を特定したうえで、その資料だけを順番に確認します。
`order.md` から参照資料を特定できました。続けて、実行履歴として指定されているレポートディレクトリの有無を確認し、その後に参照対象コード（`src/*.ts`, `README.md`, `package.json`）を読みます。
参照対象のコア実装は確認できました。次に `README.md` と `package.json`、CLI入口になり得る `src/index.ts` を確認し、要件とのギャップを具体化します。
要件判定の根拠を出すため、既存テストと設定（特に `tsconfig`）も確認します。CLI新設時の配置・公開範囲の既存パターンをここで確定します。
ナレッジはトリミングされているため、指定されたソース（`plan.1...md`）を直接確認します。計画方針がポリシー違反にならないよう、先に制約を確定します。
外部参照として指定された `/Users/nrs/work/git/takt` も確認します。対話UI実装の作法を拾うため、CLI入力処理の実装箇所を検索して参照パターンを特定します。
現状の差分を正確に示すため、主要ファイルの行番号付き内容を取得します。これで「要件ごとの変更要/不要」を根拠付きで判定します。
外部参照実装の根拠行も取っておきます。`takt` 側の対話UIで再利用すべき最小パターン（選択・入力・binラッパー）を行番号付きで固めます。
**調査結果**
- 参照資料は [`order.md`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/context/task/order.md) のみ存在し、指定ファイルはすべて確認済みです。
- 実行履歴として指定された `reports` ディレクトリは空でした（`plan.md` など未生成）。
- 現状はライブラリ実装のみで、CLIエントリ/初期化/設定管理は未実装です（[`package.json:8`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/package.json:8), [`README.md:16`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md:16), [`src/index.ts:8`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/index.ts:8)）。

**要件ごとの判定（変更要/不要）**
- `facet compose` CLI追加: 変更要。`bin` 未定義でCLI起動不可（[`package.json:8`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/package.json:8)）。
- npmグローバル配布対応: 変更要。`bin` ラッパー追加が必要（参考: [`/Users/nrs/work/git/takt/bin/takt:1`](/Users/nrs/work/git/takt/bin/takt:1)）。
- `~/.faceted/config.yaml` 読み書き: 変更要。設定モジュール不在。
- 初回起動時初期化（config/ディレクトリ/テンプレート）: 変更要。初期化処理不在。
- facets配置 (`persona/knowledge/policies` + compose定義): 変更要。現状 `FileDataEngine` は `personas/policies/knowledge/...` 前提（[`src/data-engine.ts:16`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/data-engine.ts:16)）。
- YAML compose定義（`name`必須/`description`任意）: 変更要。定義型・ローダー不在（[`src/types.ts:31`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/types.ts:31)）。
- personaを順序制御対象外: 一部不要/一部変更要。`compose()` 自体は既に persona を system 固定で順序対象外（[`src/compose.ts:21`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose.ts:21)）だが、YAML定義側の検証は未実装。
- 出力先デフォルトCWD + 対話で変更: 変更要。出力モジュール不在。
- 後方互換レイヤーなし: 変更不要（新規CLI追加で達成可能）。
- 将来のスキルパス設定拡張余地: 変更要。config型にプレースホルダ項目追加が必要。
- README追記: 変更要。CLI利用説明未記載（[`README.md:16`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md:16)）。

**設計方針**
- 構成は機能別に分割し、`src/cli`, `src/config`, `src/init`, `src/output` を新設（1責務/1モジュール）。
- 公開API境界を維持し、CLI内部実装は [`src/index.ts`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/index.ts) へ re-export しない。
- 対話UIは `takt` の作法を踏襲:  
  - 矢印キー選択ループ（参考: [`/Users/nrs/work/git/takt/src/shared/prompt/select.ts:99`](/Users/nrs/work/git/takt/src/shared/prompt/select.ts:99)）  
  - 単行入力は `readline` ベース（参考: [`/Users/nrs/work/git/takt/src/shared/prompt/confirm.ts:26`](/Users/nrs/work/git/takt/src/shared/prompt/confirm.ts:26)）
- 既存 `compose()` を中心にし、CLI側で `FacetSet` を構築して渡す。配置ルールを二重実装しない。

**Coder向け実装ガイドライン**
- 参照すべき既存パターン:
  - persona/system・policy+knowledge+instruction/user の最終配置: [`src/compose.ts:20`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose.ts:20)
  - 参照解決ヘルパ（name/path/md判定）: [`src/resolve.ts:33`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/resolve.ts:33), [`src/resolve.ts:111`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/resolve.ts:111)
  - FS DataEngine の first-match/list パターン: [`src/data-engine.ts:81`](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/data-engine.ts:81)
- 変更対象（想定）:
  - 既存: `package.json`, `README.md`, `src/types.ts`, `src/resolve.ts`, `src/data-engine.ts`（必要最小限）, `src/index.ts`（CLIは非公開維持のため基本変更不要）
  - 新規: `bin/facet`, `src/cli/*`, `src/config/*`, `src/init/*`, `src/output/*`, `src/__tests__/cli-compose.test.ts`, `src/__tests__/init.test.ts`, `src/__tests__/compose-definition.test.ts`
- 配線が必要な全箇所:
  - `package.json` の `bin` + `files` に `bin/` 追加
  - CLI実行ファイルから `config/init/load-define-compose/output` を順接続
  - 初期化処理から config生成・ディレクトリ生成・テンプレート投入を一括呼び出し
  - compose定義ローダーから `resolve` ヘルパを利用し `FacetSet` を返却
- テスト観点:
  - 初回起動時に `~/.faceted` 構成が作成されること
  - `name` 必須バリデーション
  - personaを順序指定に含めた場合の拒否
  - 出力先未入力時はCWD、入力時は上書き
- 注意すべきアンチパターン:
  - CLI層で直接 `compose` 以外の配置ロジックを再実装すること
  - `src/index.ts` からCLI内部関数を公開してAPI境界を壊すこと
  - 1ファイルにUI/設定/生成を混在させること（God module化）

**確認事項（1点）**
- compose定義ディレクトリ名は `~/.faceted/facets/compositions` で確定して進めてよいですか？（`order.md` の候補に合わせた推奨値）