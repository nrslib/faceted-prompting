会話内容を実装可能なタスク指示書に落とし込むため、まずリポジトリ内のCLI関連ファイル構成を確認し、対象モジュールを具体的なパスで特定します。
対象ファイルを特定できたので、既存のCLIエントリと設定解決ロジックを読み、指示書の「ファイル/モジュール別作業」を現実的な内容に固定します。
CLI未実装なので、既存の型・データロード実装を確認して、新しい`facet compose`仕様をどこに接続するかを明確化します。
# タスク指示書: `facet compose` CLI実装と`~/.faceted`構成対応

## 目的
`faceted-prompting`をCLIとして利用可能にし、`facet compose`コマンドで対話的に構成選択・出力できるようにする。  
実装は**調査で止めず**、CLI・設定初期化・ファイル配置・テストまで完了させること。

## 参照資料（最優先）
- `/Users/nrs/work/git/takt`（対話型インターフェース実装の参照。上下キー選択・入力フローの作法を確認）
- 現リポジトリの既存コード
  - `src/compose.ts`
  - `src/types.ts`
  - `src/data-engine.ts`
  - `src/resolve.ts`
  - `README.md`
  - `package.json`

## 確定要件
- コマンドは `facet compose` を使用（`facet`単体起動可能なCLIとして配布）
- 配布は npm グローバルインストール前提
- 設定ファイルは `~/.faceted/config.yaml`
- 初回起動時に初期化を実施（config生成 + テンプレート投入）
- facets配置は横断利用前提で以下を使用
  - `~/.faceted/facets/persona`
  - `~/.faceted/facets/knowledge`
  - `~/.faceted/facets/policies`
  - compose定義用ディレクトリ（名称は Open Questions 参照）
- YAMLはファイル参照方式
- 出力先デフォルトはカレントディレクトリ（CWD）
- 対話入力で出力先を変更可能
- `name`は必須、`description`は任意
- personaはsystem promptに対応し、**順序制御の対象に含めない**
  - 順序はpersona以外（user message側）の構成要素にのみ適用
- 後方互換レイヤーは作らない（新仕様へ統一）
- 将来のスキルパス指定（Claude Code等）を設定で扱える拡張余地を持たせる

---

## 作業項目（ファイル/モジュール別、優先度付き）

### 高: CLIエントリと配布設定
- `package.json`
  - `bin`エントリを追加し、`facet`コマンドで実行可能にする
  - ビルド成果物とのパス整合を取る
- `src/cli/*`（新規作成。既存構成に合わせて分割）
  - `facet compose`サブコマンドを実装
  - 対話UI（選択 + 入力）を実装
  - 実行フロー: 初期化確認 → compose定義選択 → 出力先入力（デフォルトCWD）→ 生成
- `README.md`
  - CLI利用手順（npm global install, `facet compose`）を追記
  - 初期化・ディレクトリ構成・compose定義の説明を追記

### 高: 初回起動初期化と設定管理
- `src/config/*`（新規）
  - `~/.faceted/config.yaml` の読み込み/生成
  - config未存在時の初期化処理
  - 将来拡張用のスキルパス設定項目を保持できる型/スキーマを用意
- `src/init/*`（新規）
  - 初回起動時に以下ディレクトリを作成
    - `~/.faceted/facets/persona`
    - `~/.faceted/facets/knowledge`
    - `~/.faceted/facets/policies`
    - compose定義ディレクトリ
  - サンプルテンプレートを投入（最小構成）

### 高: compose定義YAMLの型・解決・生成
- `src/types.ts`（必要に応じて拡張）
  - compose定義の型を追加
  - `name`必須・`description`任意を表現
  - personaを順序定義から分離した構造にする
- `src/resolve.ts` / `src/data-engine.ts`（必要に応じて拡張）
  - compose定義YAMLのロードとファイル参照解決
  - persona/knowledge/policies参照の解決ロジック追加
- `src/compose.ts`
  - 既存ルール（persona→system, それ以外→user）に沿ってCLI生成処理と接続
  - personaを順序リストで扱わないことを担保

### 中: 出力生成処理
- `src/output/*`（新規）
  - 出力先パス解決（デフォルトCWD、対話入力で変更）
  - 生成物の書き込み
  - 生成形式（system prompt と user messageの扱い）を明確化し実装

### 中: テスト
- `src/__tests__/cli-compose.test.ts`（新規）
  - `facet compose`フローの主要ケース
- `src/__tests__/init.test.ts`（新規）
  - config未存在時の初期化
  - ディレクトリ/テンプレート作成
- `src/__tests__/compose-definition.test.ts`（新規）
  - `name`必須、`description`任意の検証
  - personaが順序対象外であることの検証
- 既存テスト更新
  - `src/__tests__/compose.test.ts` ほか影響箇所

### 低: ドキュメント整備
- `README.md`
  - ディレクトリ構成例
  - compose定義YAML例
  - 対話UIの利用説明
  - トラブルシュート（初期化済み環境での再実行挙動）

---

## compose定義YAML（実装要件）
- 必須: `name`
- 任意: `description`
- personaは独立フィールド（system prompt用）
- user message側の要素（knowledge/policies/他必要要素）のみ順序制御対象
- 参照はファイル参照方式

---

## 確認手順（再現・検証）
1. `npm run build`
2. `npm pack` もしくはローカルリンクで `facet` コマンドを有効化
3. クリーン環境で `~/.faceted` を一時退避し、`facet compose`初回実行
4. 以下を確認
   - `~/.faceted/config.yaml` が生成される
   - facets配下の必須ディレクトリが生成される
   - テンプレートが投入される
5. 対話UIでcompose定義を選択し、出力先入力を確認
   - デフォルトがCWD
   - 入力で別ディレクトリ指定可能
6. 生成結果確認
   - persona内容がsystem prompt側
   - persona以外がfaceted prompting順でuser message側
7. `npm test` で追加/既存テストが通ること

---

## やらないこと（ユーザー明示のみ）
- 後方互換レイヤーの追加はしない
- `facet compose`以外を主コマンドとして増やさない（今回の確定スコープ外）

---

## Open Questions
- compose定義ディレクトリ名の最終確定  
  - 候補: `~/.faceted/facets/compositions`（`composes`は不自然との指摘あり）  
  - 実装前に名称を1つに確定すること。