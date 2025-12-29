# Permission Rules - 権限管理ルール

**最終更新**: 2025-12-29
**関連バグ**: BUG-009

---

## 重要: 権限データの二重管理構造

権限情報は**2箇所**に保存され、**両方を同期して更新する必要がある**。

```
users/{userId}.facilities[]        ← Single Source of Truth（セキュリティルールが参照）
  ├─ facilityId: string
  ├─ role: FacilityRole
  └─ grantedAt: Timestamp

facilities/{facilityId}.members[]  ← 非正規化データ（UI表示用）
  ├─ userId: string
  ├─ role: FacilityRole
  └─ email: string
```

---

## セキュリティルールの参照先

```javascript
// firestore.rules
function hasRole(facilityId, requiredRole) {
  let userProfile = getUserProfile();  // users/{uid}を取得
  let facilities = userProfile.facilities;  // ← ここだけ参照！
  return checkFacilityRole(facilities, index, facilityId, requiredRole);
}
```

**重要**: セキュリティルールは`users.facilities`**のみ**を参照。

---

## 権限変更時の必須実装

```typescript
// 必ずトランザクションで両方を更新
await db.runTransaction(async (transaction) => {
  // 1. users.facilitiesを更新
  transaction.update(userRef, {
    facilities: admin.firestore.FieldValue.arrayUnion({
      facilityId,
      role: 'editor',
      grantedAt: now,
    }),
  });

  // 2. facilities.membersを更新
  transaction.update(facilityRef, {
    members: admin.firestore.FieldValue.arrayUnion({
      userId,
      role: 'editor',
      email,
    }),
  });
});
```

---

## 権限エラーデバッグチェックリスト

1. セキュリティルールを確認: `cat firestore.rules | grep -A 20 "function hasRole"`
2. 検証スクリプト実行: `npx tsx scripts/verifyDemoPermissions.ts`
3. 両コレクションを確認: users側とfacilities側の権限が一致しているか
4. 修正後は両方更新

---

## 参考資料

- [ポストモーテム](../postmortem-bug009-permission-sync-2025-12-08.md)
- [BUG-009修正記録](../bugfix-demo-members-2025-12-08.md)
