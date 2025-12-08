# BUG-018: leaveRequests型エラー修正

**発生日**: 2025-12-08
**解決日**: 2025-12-08
**重要度**: 高（AI生成が完全に失敗）

---

## 1. 問題の概要

### 症状
Phase 52デプロイ後、AI生成時に以下のエラーが発生：
```
leaveRequests is not iterable
```

### 影響
- AI生成が完全に失敗（500エラー）
- シフト生成が不可能

---

## 2. 根本原因分析

### 型定義の確認

`functions/src/types.ts:33-37`:
```typescript
export interface LeaveRequest {
  [staffId: string]: {
    [date: string]: LeaveType;
  };
}
```

これは**ネストされたRecord型**であり、配列ではない。

### 問題のコード

`functions/src/phased-generation.ts:476` (Phase 52で追加):
```typescript
// ❌ 間違い：Record型を配列としてイテレート
for (const leave of leaveRequests as unknown as Array<{ staffId: string; date: string }>) {
  const dateStr = leave.date;
  // ...
}
```

`as unknown as Array<...>` で強制的に型変換しているが、実行時にはRecord型のままなのでイテレートできない。

### 原因の本質
- Phase 52実装時に`LeaveRequest`型定義を確認せずにコードを書いた
- **設計チェックリスト**（BUG-017で作成）を適用していなかった

---

## 3. 修正内容

### 変更ファイル
- `functions/src/phased-generation.ts`: `buildDailyAvailabilityAnalysis`関数

### 修正コード

```typescript
// ✅ 正しい: Record型を Object.entries() でイテレート
if (leaveRequests && typeof leaveRequests === 'object') {
  for (const [staffId, dateMap] of Object.entries(leaveRequests)) {
    if (dateMap && typeof dateMap === 'object') {
      for (const dateStr of Object.keys(dateMap)) {
        if (!leaveByDate.has(dateStr)) {
          leaveByDate.set(dateStr, new Set());
        }
        leaveByDate.get(dateStr)!.add(staffId);
      }
    }
  }
}
```

### 変更点

| 項目 | 修正前 | 修正後 |
|-----|--------|--------|
| イテレーション | `for...of` (配列用) | `Object.entries()` (Record用) |
| 型チェック | 強制キャスト | `typeof` でランタイムチェック |
| データアクセス | `leave.staffId`, `leave.date` | `staffId`, `dateStr` を分解 |

---

## 4. 教訓

### チェックリスト追加項目

新しいコードを書く際：
1. **型定義を必ず確認**: `types.ts` の定義を読む
2. **Record vs Array**: データ構造に応じた適切なイテレーション方法を選択
3. **型キャストに注意**: `as unknown as` は危険信号

### TypeScriptの型安全性を活かす

```typescript
// ❌ 避ける: 強制キャスト
for (const x of data as unknown as Array<T>)

// ✅ 推奨: Object.entries() + 型推論
for (const [key, value] of Object.entries(data))
```

---

## 5. 検証

### 確認事項
- [x] TypeScript型チェック通過
- [x] デプロイ成功（2025-12-08 12:03 UTC）
- [ ] AI生成正常動作（ユーザーによる本番テスト待ち）

### デプロイ確認
- **CI/CD Run ID**: 20027319866
- **関数**: `generateShift(asia-northeast1)` - Successful update operation
- **コミット**: `2fae092` (TS6133修正含む)

---

## 6. 関連ドキュメント

- [BUG-017修正記録](.kiro/bugfix-batch-prompt-json-2025-12-08.md) - 同日の別バグ
- [AIプロンプト設計チェックリスト](.kiro/ai-prompt-design-checklist.md)
- [types.ts](../functions/src/types.ts) - LeaveRequest型定義

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
