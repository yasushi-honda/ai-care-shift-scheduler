# BUG-009: seedDemoData.tsでデモユーザー権限が消失する問題

**発生日**: 2025-12-08
**修正日**: 2025-12-08
**影響範囲**: デモ環境、シフト保存機能
**重大度**: 高（デモ機能が完全に動作しない）

---

## 1. 問題概要

### 症状
1. デモ環境でシフト生成後、保存時に「Missing or insufficient permissions」エラー
2. Firestoreセキュリティルールで権限拒否

### 期待される動作
- デモユーザーはeditor権限で施設にアクセス
- シフトの保存・更新が可能

---

## 2. 根本原因分析

### 発生経緯

1. Phase 46でパート職員4名を追加するため`seedDemoData.ts`を修正
2. `npm run seed:demo -- --reset`を実行してデモデータを再投入
3. 施設の`members`配列が初期化され、デモユーザーが削除された

### 問題のコード（修正前）

```typescript
// seedDemoData.ts (Line 624-634)
const facilityData: Facility = {
  facilityId: DEMO_FACILITY_ID,
  name: DEMO_FACILITY_NAME,
  members: superAdminId ? [{
    userId: superAdminId,
    role: 'super-admin',
    grantedAt: now,
  }] : [],  // ← デモユーザーが含まれていない！
  createdAt: now,
  updatedAt: now,
};
```

### Firestoreセキュリティルールとの関係

```javascript
// firestore.rules
match /facilities/{facilityId}/schedules/{scheduleId} {
  allow read, write: if isMember(facilityId, ['admin', 'editor']);
}

function isMember(facilityId, roles) {
  let facility = get(/databases/$(database)/documents/facilities/$(facilityId));
  let userRole = facility.data.members[request.auth.uid].role;
  return userRole in roles;
}
```

デモユーザーがmembersに存在しないため、`isMember`関数がfalseを返し、書き込みが拒否された。

---

## 3. 修正内容

### 修正後のコード

```typescript
// seedDemoData.ts (Line 624-657)

// 既存のmembersを取得して保持（デモユーザーを含む）
const existingFacility = await facilityRef.get();
let existingMembers: FacilityMember[] = [];
if (existingFacility.exists) {
  existingMembers = existingFacility.data()?.members || [];
}

// super-adminを追加（既存になければ）
const members: FacilityMember[] = [...existingMembers];
if (superAdminId && !members.some(m => m.userId === superAdminId)) {
  members.push({
    userId: superAdminId,
    role: 'super-admin',
    grantedAt: now,
  });
}

// デモユーザーを追加（既存になければ）
const DEMO_USER_UID = 'demo-user-fixed-uid';
if (!members.some(m => m.userId === DEMO_USER_UID)) {
  members.push({
    userId: DEMO_USER_UID,
    role: 'editor',  // Phase 43.2.1: 保存可能にするためeditor
    grantedAt: now,
  });
}

const facilityData: Facility = {
  facilityId: DEMO_FACILITY_ID,
  name: DEMO_FACILITY_NAME,
  members,  // 既存メンバーを保持
  createdAt: existingFacility.exists ? existingFacility.data()?.createdAt : now,
  updatedAt: now,
};
```

### 修正のポイント

1. **既存membersの保持**: 施設が既に存在する場合、既存のmembers配列を取得して保持
2. **デモユーザーの自動追加**: membersにデモユーザーが含まれていなければ、editor権限で追加
3. **createdAtの保持**: 既存施設の作成日時を維持

---

## 4. 影響範囲

| 影響対象 | 影響内容 |
|---------|---------|
| seedDemoData.ts | membersの処理ロジック変更 |
| Firestore | デモ施設のmembers配列更新 |
| デモ環境 | シフト保存が可能に |

---

## 5. 検証方法

1. デモログインでアクセス
2. シフト管理 → AI自動生成
3. 生成されたシフトを保存
4. エラーなく保存されることを確認

---

## 6. 再発防止策

### 即時対応
- [x] seedDemoData.tsで既存membersを保持
- [x] デモユーザーを自動的にmembersに追加

### 長期対応
- [ ] デモデータ投入後の自動検証スクリプト作成（候補）
- [ ] Firestoreの状態チェックをCI/CDに追加（候補）

---

## 7. 関連コミット

- `4b0eed3` - docs: BUG-008修正記録とデモユーザー権限修正

---

## 8. 学び

1. **データ再投入時の副作用に注意**: 既存データを上書きする際、意図しないデータ削除が起こり得る
2. **権限問題はログに現れにくい**: クライアント側の「permission denied」だけでは原因特定が困難
3. **デモユーザーの権限は複数箇所で管理**: users.facilities[].role と facilities.members[].role の両方が必要

---

## 9. 関連BUG

| BUG ID | 問題 | 関連性 |
|--------|------|--------|
| BUG-007 | デモデータ同期問題 | seedDemoData.ts修正後の未同期 |
| BUG-008 | thinkingBudget過消費 | 同セッションで発生 |
| **BUG-009** | members消失 | seedDemoData.ts再投入時の問題 |

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
