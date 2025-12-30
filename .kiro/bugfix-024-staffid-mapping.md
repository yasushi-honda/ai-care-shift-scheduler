# BUG-024: Firestore↔Cloud Functionsフィールドマッピング不整合

## 日時
2025-12-30

## 概要
FirestoreのスタッフデータとCloud Functions内部で期待するフィールド名の不一致により、AI生成処理が失敗していた。

## 症状
### Issue 1: staffId→id
- Phase 1完了後、Phase 2で「骨子データが見つかりません」エラー
- 12名全員分の骨子データがundefinedになる
- ログに`staffId: "undefined"`と表示

### Issue 2: certifications→qualifications
- 資格情報が空配列として扱われる
- 資格要件チェックが正しく機能しない
- ログに`qualifications: []`と表示

## 根本原因
| Firestore | Cloud Functions (types.ts) |
|-----------|----------------------------|
| `staffId` | `id` |
| `certifications` | `qualifications` |

シードスクリプトとFirestoreは`staffId`/`certifications`を使用するが、Cloud Functionsの型定義は`id`/`qualifications`を期待。

## 解決策
`functions/src/shift-generation.ts` でリクエスト受信時にマッピングを追加:

```typescript
const staffList = rawStaffList.map((staff: Record<string, unknown>) => ({
  ...staff,
  id: staff.id || staff.staffId,
  qualifications: staff.qualifications || staff.certifications || [],
})) as Staff[];
```

## 結果
| 指標 | 修正前 | 修正後 |
|------|--------|--------|
| overallScore | 0 | 16-28 |
| fulfillmentRate | 0% | 93-95% |
| violationCount | 175-180 | 6-10 |
| Phase 2骨子データ | 全員undefined | 全員正常 |

**注**: AI生成にはばらつきがあるため、スコアは範囲で表示

## 教訓
1. Firestore ↔ Cloud Functions間のフィールド名は一貫性を保つ
2. 型定義と実際のデータ構造の不整合に注意
3. Phase間のデータ受け渡しでIDマッチングを使う場合、フィールド名を確認
4. シードスクリプトは型定義と整合性を取る
