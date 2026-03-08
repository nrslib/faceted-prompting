# 変更スコープ宣言

## タスク
`facet compose` 実装前提の回帰防止として、初回起動フローと定義/設定の境界条件をテストで固定する

## 変更予定
| 種別 | ファイル |
|------|---------|
| 変更 | `src/__tests__/it-cli-compose-flow.test.ts` |
| 変更 | `src/__tests__/init.test.ts` |
| 変更 | `src/__tests__/compose-definition.test.ts` |

## 推定規模
Medium

## 影響範囲
- `facet compose` の初回実行フロー（init → resolve → compose → output）
- `~/.faceted/config.yaml` の初期内容
- compose定義YAMLの入力バリデーション