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

// デモユーザーを追加または権限を更新
const DEMO_USER_UID = 'demo-user-fixed-uid';
const existingDemoUserIndex = members.findIndex(m => m.userId === DEMO_USER_UID);
if (existingDemoUserIndex >= 0) {
  // 既存の場合は権限をeditorに更新（viewerから変更）
  members[existingDemoUserIndex] = {
    ...members[existingDemoUserIndex],
    role: 'editor',  // Phase 43.2.1: 保存可能にするためeditor
  };
} else {
  // 新規追加
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
2. **デモユーザーの権限更新**: デモユーザーが既に存在する場合、権限を`editor`に強制更新
3. **デモユーザーの自動追加**: membersにデモユーザーが含まれていなければ、editor権限で追加
4. **createdAtの保持**: 既存施設の作成日時を維持

### 追加修正（2回目）

初回修正では「既存になければ追加」というロジックだったため、既存のデモユーザー（viewer権限）がそのまま残ってしまった。
`findIndex`を使用して既存ユーザーを検索し、存在する場合は権限を強制的に`editor`に更新するロジックに変更。

### 追加修正（3回目）

2回目修正後も権限エラーが再発。調査の結果、セキュリティルールが参照しているのは`facilities.members`ではなく`users.facilities`であることが判明。

```
セキュリティルール (firestore.rules L14-34):
function hasRole(facilityId, requiredRole) {
  let userProfile = getUserProfile();  // ← users/{uid}を取得
  let facilities = userProfile.facilities;  // ← users.facilitiesを参照
  ...
}
```

**問題の状態**:
| コレクション | デモユーザーの権限 |
|-------------|------------------|
| `facilities/demo-facility-001.members[]` | editor ✓ |
| `users/demo-user-fixed-uid.facilities[]` | viewer ✗ |

**修正**: seedDemoData.tsで`facilities.members`だけでなく`users.facilities`も同時に更新するように修正。

```typescript
// BUG-009対策: usersコレクションのfacilities配列も更新
const demoUserRef = db.collection('users').doc(DEMO_USER_UID);
const demoUserDoc = await demoUserRef.get();
if (demoUserDoc.exists) {
  const userData = demoUserDoc.data();
  if (userData?.facilities) {
    const userFacilities = userData.facilities.map((f) => {
      if (f.facilityId === DEMO_FACILITY_ID) {
        return { ...f, role: 'editor' };
      }
      return f;
    });
    batch.update(demoUserRef, { facilities: userFacilities });
  }
}
```

---

## 4. 影響範囲

| 影響対象 | 影響内容 |
|---------|---------|
| seedDemoData.ts | membersの処理ロジック変更 + users.facilities更新追加 |
| Firestore | デモ施設のmembers配列 + usersのfacilities配列を同期 |
| デモ環境 | シフト保存が可能に |

---

## 5. 検証方法

1. デモログインでアクセス
2. シフト管理 → AI自動生成
3. 生成されたシフトを保存
4. エラーなく保存されることを確認

### 検証結果（2025-12-08 13:50）

✅ **検証完了**

| 検証項目 | 結果 |
|---------|------|
| 権限検証スクリプト | ✅ 両方editor権限確認 |
| デモログイン | ✅ 成功 |
| AI自動シフト生成 | ✅ 成功（3回実行） |
| シフト保存 | ✅ 成功（v1確定） |
| バージョン履歴 | ✅ 作成者: demo-user-fixed-uid |

```
バージョン履歴:
v1 確定
2025/12/08 13:50 · 作成者: demo-user-fixed-uid
スタッフ数: 12名  前バージョン: v0
```

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
4. **セキュリティルールの参照先を確認**: 実際のルールがどのコレクションを参照しているかを確認することが重要
5. **権限データの同期が必要**: 複数箇所に権限情報がある場合、すべてを同期して更新する必要がある

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
