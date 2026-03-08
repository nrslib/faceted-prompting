## decomposition

---

{
  "parts": [
    {
      "id": "part-1",
      "title": "facet compose CLI一括実装（分解なし）",
      "instruction": "分解判断: **1パートで実装**。理由は、`facet compose`はCLIエントリ・初期化・設定・定義解決・出力生成・既存`compose`接続・型定義が相互依存し、共有型/解決ロジックを横断して変更が入るため。分割すると競合と整合性崩れのリスクが高い。\n\n担当ファイル（作成・変更対象）:\n- `package.json`\n- `README.md`\n- `src/compose.ts`\n- `src/types.ts`\n- `src/data-engine.ts`\n- `src/resolve.ts`\n- `src/cli/**`（新規含む）\n- `src/config/**`（新規）\n- `src/init/**`（新規）\n- `src/output/**`（新規）\n- `src/__tests__/cli-compose.test.ts`（新規）\n- `src/__tests__/init.test.ts`（新規/更新）\n- `src/__tests__/compose-definition.test.ts`（新規/更新）\n- `src/__tests__/compose.test.ts`（必要箇所更新）\n- `src/__tests__/it-cli-compose-flow.test.ts`（必要箇所更新）\n\n参照専用ファイル（変更禁止）:\n- `.takt/runs/20260308-010700-cli/context/task/order.md`\n- `.takt/runs/20260308-010700-cli/context/task/**`\n- `.takt/runs/20260308-010700-cli/reports/plan.md`\n- `.takt/runs/20260308-010700-cli/reports/coder-scope.md`\n- `.takt/runs/20260308-010700-cli/reports/coder-decisions.md`\n- `.takt/runs/20260308-010700-cli/context/knowledge/implement.1.20260308T025825Z.md`\n- `.takt/runs/20260308-010700-cli/context/policy/implement.1.20260308T025825Z.md`\n\n実装内容:\n- `facet`実行可能なCLI配布設定（`bin`）と`facet compose`サブコマンド実装。\n- 初回起動で`~/.faceted/config.yaml`生成＋必須ディレクトリ作成＋テンプレート投入。\n- compose定義YAML（`name`必須、`description`任意、personaは順序対象外）を型/解決ロジックへ反映。\n- 参照ファイル解決を`compose`処理へ接続し、persona→system、その他→userの生成を担保。\n- 出力先はデフォルトCWD、対話入力で変更可能に実装。\n- テストを実装と同一パートで更新し、既存テストがパスするよう実装する（このパート内ではテスト実行しない）。\n- Open Questionは`~/.faceted/facets/compositions`で統一して実装。\n\n完了基準:\n- 上記担当ファイル内で`facet compose`仕様を満たす実装が完了している。\n- 初回初期化、定義解決、出力生成、persona非順序制御、CLI対話フローをテストコードで担保済み。\n- 担当外ファイルを変更していない。\n- テスト実行は行っていない（後続ムーブメントで実施可能な状態）。"
    },
    {
      "id": "part-2",
      "title": "既存差分確認後の実装完了",
      "instruction": "担当ファイル: `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/package.json`, `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md`, `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/compose.ts`, `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/types.ts`, `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/resolve.ts`, `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/data-engine.ts`, `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/**`, `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/config/**`, `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/init/**`, `/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/output/**`。参照専用ファイル: `.takt/runs/20260308-010700-cli/context/task/order.md`, `.takt/runs/20260308-010700-cli/reports/plan.md`, `.takt/runs/20260308-010700-cli/reports/coder-scope.md`, `.takt/runs/20260308-010700-cli/reports/coder-decisions.md`, `.takt/runs/20260308-010700-cli/context/policy/implement.1.20260308T025825Z.md`。実装内容: 既存の未コミット差分を前提として `facet compose` CLI 要件（初回初期化、`~/.faceted/config.yaml`、`facets/{persona,knowledge,policies,compositions}`、compose 定義 YAML 解決、persona を順序対象外、出力先デフォルト CWD・対話上書き、npm `bin` 配布、README 反映）を満たすよう不足分のみを補完し、後方互換レイヤーは追加しない。テスト実行はしないが、既存テストがパスするよう実装整合性を保つ。完了基準: 上記担当ファイル内で要件の未実装項目が解消され、実装差分が task/order と plan の指示に一致していること。"
    }
  ]
}

---

## part-1: facet compose CLI一括実装（分解なし）
実装対象の範囲に合わせて、まず既存のCLI/compose関連コードと指定された参照資料を確認し、差分方針を固めてから一括で編集します。最初にプロジェクト構成と対象ファイルの現状を読み取ります。
参照資料をこれから読み、実装要件の細部（特にCLI対話と定義フォーマット）を確定します。次に既存コードとの差分を最小変更で当てます。
作業開始前に確認です。現在のワークツリーには、すでに多数の未コミット変更（`README.md`、`package.json`、`src/compose.ts`、`src/types.ts` など）と未追跡ファイル（`src/cli/**`、`src/config/**`、`src/init/**`、`src/output/**` など）が存在しています。

この状態は今回タスクの途中成果として想定どおりでしょうか？  
想定どおりであれば、そのままこの差分を土台に続行します。

---

## part-2: 既存差分確認後の実装完了
担当範囲の既存差分を前提に、指定された参照ドキュメント（`order.md` と各 report）を先に確認し、要件に対する未実装箇所だけを特定してから最小差分で実装します。սկզբめに現状の差分と関連ファイルを読みます。
参照資料の確認結果から、実装は大半入っている前提なので、担当ファイルを横断して要件チェックし、不足箇所だけを埋めます。次に `src` と `README/package.json` の現状を精査します。
CLI・初期化・出力の新規モジュール群を確認して、要件に対して欠けている分岐や検証がないかを詰めます。続けて `src/cli`, `src/config`, `src/init`, `src/output` を読みます。
要件の「対話上書き」を満たしているかを確認するため、関連テストとCLIフローを読み、現在の実装に不足があればそこだけ追補します。次に `it-cli-compose-flow` と `output-directory` 系テストを確認します。
不足しているのは「既存出力ファイルに対する対話上書き確認」です。`src/cli/index.ts` に上書き確認プロンプトを追加し、READMEのCLI手順にも上書き確認挙動を追記します。
上書き確認を実装し、READMEも同期しました。いま差分を確認して、既存フローとの整合（`facet compose` 実行・デフォルトCWD・非上書き時エラー）だけ最終チェックします。
コード整合性の最終確認として、テストは実行せずに型/ビルドだけ確認します（要件の「既存テストが通るよう整合性維持」の範囲チェック）。
ビルドは通過しました。最後に担当範囲の差分だけを確認して、実施内容を簡潔に報告します。
実装不足分として「対話上書き」を追加し、READMEに挙動を反映しました。

- 変更: 既存出力ファイルがある場合、`facet compose` 実行中に上書き確認を行うようにしました（`y` / `yes` のみ上書き実行）。
  - 実装箇所: [src/cli/index.ts](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/src/cli/index.ts)
- 変更: CLI利用手順に上書き確認ステップを追記しました。
  - ドキュメント: [README.md](/Users/nrs/work/git/takt-worktrees/20260308T0107-3-implement-facet-compose-cli/README.md)

確認結果:
- `npm run build` は成功しました。
- 指示どおり、テスト実行はしていません。