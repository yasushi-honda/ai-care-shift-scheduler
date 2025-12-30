# BUG-024: staffId→idフィールドマッピング不整合

## 日時
2025-12-30

## 概要
Firestoreのスタッフデータ（`staffId`フィールド）とCloud Functions内部で期待するフィールド名（`id`）の不一致により、Phase 1→Phase 2のデータ受け渡しが失敗していた。

## 症状
- Phase 1完了後、Phase 2で「骨子データが見つかりません」エラー
- 12名全員分の骨子データがundefinedになる
- ログに`staffId: "undefined"`と表示

## 根本原因
1. `functions/src/types.ts` では `Staff.id` を使用
2. Firestore/seedスクリプトでは `staff.staffId` を使用
3. shift-generation.tsでマッピングなしに直接使用

## 解決策
`functions/src/shift-generation.ts` でリクエスト受信時にマッピングを追加:

```typescript
const staffList = rawStaffList.map((staff: Record<string, unknown>) => ({
  ...staff,
  id: staff.id || staff.staffId,
})) as Staff[];
```

## 結果
| 指標 | 修正前 | 修正後 |
|------|--------|--------|
| overallScore | 0 | 28 |
| fulfillmentRate | N/A | 95% |
| violationCount | 175-180 | 6 |
| Phase 2骨子データ | 全員undefined | 全員正常 |

## 教訓
- Firestore ↔ Cloud Functions間のフィールド名は一貫性を保つ
- 型定義と実際のデータ構造の不整合に注意
- Phase間のデータ受け渡しでIDマッチングを使う場合、フィールド名を確認
