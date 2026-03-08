## decomposition

---

{
  "parts": [
    {
      "id": "part-1",
      "title": "Facet Compose CLI実装（単一パート）",
      "instruction": "分解判断: **1パートで実装**。理由は、`facet compose` は CLI入口・定義ロード/検証・faceted-prompting compose 呼び出し・`~/.faceted` 初期化が相互依存し、共有型/エラー契約/出力形式を横断するため。分割すると仕様ずれと競合リスクが高い。\n\n**担当ファイル（作成・変更対象）**\n- `.takt/runs/20260308-010700-cli/context/task/order.md` に実装対象として明示されたファイル一式\n- 既存テストに対応する実装側ファイル（`src/__tests__/compose-definition.test.ts`、`src/__tests__/init.test.ts`、`src/__tests__/it-cli-compose-flow.test.ts` が期待するモジュール）\n\n**参照専用ファイル（変更禁止）**\n- `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/reports/plan.md`\n- `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/reports/coder-scope.md`\n- `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/.takt/runs/20260308-010700-cli/reports/coder-decisions.md`\n- `.takt/runs/20260308-010700-cli/context/task/` 配下の仕様ファイル（`order.md` 含む）\n\n**実装内容**\n- `order.md` と `plan.md` に従い、`facet compose` CLI の実行フローを実装する。\n- compose定義YAMLの読み込み/検証を Fail Fast で実装し、不正入力は明示エラーにする（サイレントフォールバック禁止）。\n- `~/.faceted` 初期化処理を実装し、必要なファイル/ディレクトリ状態を保証する。\n- faceted-prompting の `compose(...)` 実行結果を CLI 出力契約に沿って整形する。\n- 追加済み既存テストが通ることを前提に、テスト期待に一致する挙動を実装する（このパートではテスト実行しない）。\n\n**完了基準**\n- 担当ファイル内で `order.md` 指定の機能が実装済み。\n- 追加済み3テストの期待挙動（compose定義検証、初期化、CLI composeフロー）を満たすコードになっている。\n- 担当外ファイルを変更していない。\n- テスト実行・ビルド実行は行っていない。"
    }
  ]
}

---

## part-1: Facet Compose CLI実装（単一パート）
依頼内容を実装タスクとして把握しました。まず `order.md` と参照レポートを確認し、変更対象ファイルを特定してから、指定範囲内で `facet compose` 実装を進めます。
仕様ファイル群を確認したところ、参照指定されていた `coder-scope.md` と `coder-decisions.md` は存在しないため、`order.md` と `plan.md` を主軸に実装します。次に対象ソースと既存テストの期待値を読み込みます。
対象テストと既存実装をこれから精読し、必要最小限の差分だけを入れます。特に `compose-definition`・`init`・`it-cli-compose-flow` の期待を先に固定します。
実装方針を固定します。既存API互換を保ちつつ、追加テストの期待を満たす最小構成で以下を一括実装します。  

1. `src/types.ts` / `src/compose.ts`
- compose 定義用の型（`ComposeDefinition` と `ComposeOrderEntry`）を追加。
- `compose()` は既定順序を維持しつつ、`options.userMessageOrder` がある場合だけ user 側の並びを切替可能に拡張。

2. `src/resolve.ts`
- `loadComposeDefinition(definitionPath)` を追加。
- YAML を fail-fast で読み込み検証（`name` 必須、`description` 任意、`persona` 必須、`order` は `knowledge|policies|instruction` のみ採用し `persona` は除外）。
- 不正型や未知キーは明示エラーにします（サイレント補正なし）。

3. `src/init/index.ts` と `src/config/index.ts`
- `initializeFacetedHome({ homeDir })` を新規実装。
- `~/.faceted/config.yaml` がなければ生成、既存なら保持（上書きしない）。
- 必須ディレクトリ `facets/{persona,knowledge,policies,compositions}` を idempotent に作成。
- 最小テンプレートを未存在時のみ投入。

4. `src/cli/index.ts` と `src/output/index.ts`
- `runFacetCli(['compose'], { cwd, homeDir, select, input })` を実装。
- フロー: 初期化 → compositions列挙 → 選択 → 定義ロード → facet解決 → `compose(...)` → 出力先入力（既定CWD）→ ファイル書込み。
- 不足ファイル/不正定義は明示エラーで停止。

5. 配布エントリ
- `package.json` に `bin` と `files`（`bin/facet`）を追加。
- `bin/facet` と `src/cli/runner.ts` を追加して `facet compose` 実行可能にする。

次にこの内容でファイルを追加・更新します。
これから型定義と `compose()` の拡張を先に入れます。既存テスト互換のため既定順序は維持し、CLI経由時のみ順序指定が効く形にします。
次に `~/.faceted` 初期化とCLI本体を追加します。テスト期待に合わせて idempotent 初期化、compositions 探索、明示エラー、出力整形を実装します。
主要実装は反映できたので、いま差分を精査して要件漏れ（特に fail-fast 条件とファイル範囲）を確認します。
新規追加ファイルも確認します。続けて `src/cli`・`src/init` などの実装内容と import 整合を最終点検します。
実装を指定範囲で反映しました。`facet compose` の実行フロー、compose定義のFail Fast検証、`~/.faceted` 初期化、出力整形まで実装済みです。

変更ファイル:
- [src/resolve.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/resolve.ts)
- [src/init/index.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/init/index.ts)
- [src/config/index.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/config/index.ts)
- [src/cli/index.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts)
- [src/cli/runner.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/runner.ts)
- [src/output/index.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/index.ts)
- [src/compose.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose.ts)
- [src/types.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/types.ts)
- [src/index.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/index.ts)
- [package.json](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/package.json)
- [bin/facet](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/bin/facet)
- [README.md](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md)

実装ポイント:
- `loadComposeDefinition(definitionPath)` を追加し、`name` 必須・`description` 任意・`persona` 必須を検証。
- `order` から `persona` を除外し、`knowledge|policies|instruction` のみ保持。
- `initializeFacetedHome({ homeDir })` で `~/.faceted/config.yaml` と `facets/{persona,knowledge,policies,compositions}` を冪等作成。
- `runFacetCli(['compose'], ...)` で `init -> definition選択 -> resolve -> compose -> 出力` を接続。
- 不正選択・不足ファイル・不正YAMLは明示エラーで停止（サイレントフォールバックなし）。
- `compose()` は既定順序を維持しつつ、`userMessageOrder` 指定時のみ順序変更可能に拡張。
- npmグローバル実行用に `facet` bin エントリを追加。

制約どおり、テスト実行・ビルド実行は行っていません。