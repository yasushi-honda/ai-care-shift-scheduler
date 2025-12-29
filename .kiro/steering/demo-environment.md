# Demo Environment - デモ環境設計ルール

**最終更新**: 2025-12-29
**関連Phase**: Phase 43, 43.2, 43.2.1

---

## 設計原則

**デモ環境でも本番環境と同様にFirestoreへ保存を許可する**

排他制御（LockService）で複数ユーザーの同時アクセスを保護。

---

## デモ環境の動作

| 機能 | デモ環境での動作 |
|-----|-----------------|
| AI生成 | ✅ 実行可能・保存される |
| 手動編集 | ✅ 実行可能・保存される |
| 確定 | ✅ 実行可能・確定される |
| 月次レポート | ✅ 保存したシフトが集計表示 |
| 排他制御 | ✅ 複数ユーザー同時アクセス時にロック |

---

## 判定ロジック

```typescript
// AuthContext.tsx
const DEMO_USER_UID = 'demo-user-fixed-uid';
const DEMO_FACILITY_ID = 'demo-facility-001';

const isDemoUser = userProfile?.provider === 'demo'
  || currentUser?.uid === DEMO_USER_UID;

const isDemoFacility = selectedFacilityId === DEMO_FACILITY_ID;
```

---

## 排他制御（LockService）

```typescript
const lockResult = await LockService.acquireLock(
  facilityId,
  yearMonth,
  userId,
  'ai-generation'  // または 'saving'
);

if (!lockResult.success) {
  setLockModalOpen(true);
  return;
}
```

| ロック種別 | タイムアウト |
|-----------|-------------|
| AI生成 | 5分 |
| 保存 | 30秒 |

---

## デモユーザー権限

**重要**: デモユーザーには `editor` 権限が必要（`viewer`では保存不可）

権限設定は `scripts/createDemoUser.ts` で管理。

---

## 参考資料

- [Phase 43ドキュメント](../docs/phase43-demo-improvements.html)
- [要件定義書](../specs/demo-environment-improvements/requirements.md)
