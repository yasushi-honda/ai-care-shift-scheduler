# ADR-0002: 権限データの双方向同期構造

**日付**: 2025-12-08（遡及記録）
**ステータス**: 採用
**関連バグ**: BUG-009

## コンテキスト

Firestoreのセキュリティルールでは、ユーザーの施設アクセス権限を検証する必要がある。権限データの配置には2つの選択肢があった：

1. `users/{userId}.facilities[]`のみ（正規化）
2. 両方に配置（非正規化）

### セキュリティルールの制約

Firestoreセキュリティルールは他ドキュメントの読み取りに制限がある。`facilities.members[]`から逆引きするとルールが複雑化し、パフォーマンスが低下する。

## 決定

**双方向同期構造**を採用：

```
users/{userId}.facilities[]       ← Single Source of Truth（セキュリティルールが参照）
facilities/{facilityId}.members[] ← 非正規化データ（UI表示用）
```

### 更新ルール

権限変更は**必ずトランザクションで両方を更新**：

```typescript
await db.runTransaction(async (transaction) => {
  // 1. users.facilitiesを更新
  transaction.update(userRef, { facilities: arrayUnion(...) });
  // 2. facilities.membersを更新
  transaction.update(facilityRef, { members: arrayUnion(...) });
});
```

## 影響

- **正**: セキュリティルールがシンプル、UI表示が高速
- **負**: 同期漏れによる権限不整合リスク（BUG-009の原因）

## 対策

- 権限変更コードは必ず両方を更新
- 定期的な整合性チェックスクリプト

## 参照

- [permission-rules.md](../../.kiro/steering/permission-rules.md)
- [postmortem-bug009-permission-sync-2025-12-08.md](../../.kiro/postmortem-bug009-permission-sync-2025-12-08.md)
