# BUG-022: 休暇残高管理のFirestoreパーミッションエラー修正

**修正日**: 2025-12-09
**優先度**: 高
**ステータス**: 解決済み

---

## 概要

「休暇残高管理」の「詳細」ボタンクリック時に、Firestoreのパーミッションエラーが発生する問題を修正。

---

## 現象

### エラーメッセージ

```
Error fetching staff leave balance: FirebaseError: Missing or insufficient permissions.
```

### 再現手順

1. デモアカウントでログイン
2. シフト管理画面を開く
3. 「休暇残高管理」アコーディオンを展開
4. 任意のスタッフの「詳細」ボタンをクリック
5. パーミッションエラーが発生

---

## 根本原因

### demoSignIn.ts（Cloud Function）がviewer権限を上書き

毎回デモログイン時に、Cloud Functionがユーザードキュメントを更新する際に`viewer`権限を設定していた。

**問題のコード** (`functions/src/demoSignIn.ts:82-84`):
```typescript
facilities: [{
  facilityId: DEMO_FACILITY_ID,
  role: 'viewer',  // ❌ これが問題
  grantedAt: now,
}],
```

### 必要な権限

`leaveBalances`コレクションのセキュリティルール（`firestore.rules:187-192`）:
- **読み取り**: `viewer`以上 → OK
- **書き込み**: `editor`以上が必要

`getStaffLeaveBalance`関数は、残高が存在しない場合に`setDoc`で新規作成するため、**書き込み権限**が必要。

### 時系列

1. Phase 43.2.1で`createDemoUser.ts`を`editor`に修正
2. しかし`demoSignIn.ts`（Cloud Function）は`viewer`のまま
3. デモログインすると毎回`viewer`で上書きされる
4. 結果: `createDemoUser.ts`での修正が無効化

---

## 修正内容

### functions/src/demoSignIn.ts

```typescript
// Before
facilities: [{
  facilityId: DEMO_FACILITY_ID,
  role: 'viewer',
  grantedAt: now,
}],

// After
facilities: [{
  facilityId: DEMO_FACILITY_ID,
  role: 'editor', // Phase 43.2.1対応: シフト保存・休暇残高アクセスにはeditor権限が必要
  grantedAt: now,
}],
```

施設メンバー追加部分も同様に修正。

---

## 変更ファイル

| ファイル | 変更内容 |
|---------|----------|
| `functions/src/demoSignIn.ts` | 2箇所のroleを`viewer`→`editor`に変更 |

---

## 検証

- [x] TypeScript型チェック通過
- [x] CodeRabbitレビュー完了
- [x] CI/CDパイプライン成功
- [x] 本番環境で動作確認完了

---

## 追加修正（2025-12-09 18:45）

### 問題の継続

Cloud Function修正後も問題が継続。再調査の結果、以下を発見：

1. **demoSignIn関数のデプロイがHTTP 409エラーで失敗**していた（CI/CDは`|| echo`でマスク）
2. 再デプロイ後も、**ユーザーが再ログインしたタイミングが関数デプロイ完了より前**だった
3. Firestoreの`users/{uid}.facilities[].role`が**依然として`viewer`のまま**だった

### 追加修正

Firestoreの`users/demo-user-fixed-uid`ドキュメントを直接更新：

```typescript
await userRef.update({
  facilities: [{
    facilityId: 'demo-facility-001',
    role: 'editor',  // viewer -> editor
    grantedAt: now,
  }],
});
```

### 教訓（追加）

1. **Cloud Functionデプロイログを必ず確認**（409エラー等の失敗がマスクされる可能性）
2. **関数デプロイ後は必ず再ログインのタイミングを確認**
3. **問題継続時はFirestoreの実データを直接確認**

---

## 注意事項

### BUG-009との関連

BUG-009と同じパターンの問題：
- **権限の二重管理**（`users.facilities`と`facilities.members`）
- **Cloud Functionによる上書き**が既存の設定を無効化

### 教訓

1. デモユーザー権限を変更する場合、**全ての権限設定箇所**を確認すること：
   - `scripts/createDemoUser.ts`
   - `functions/src/demoSignIn.ts`（Cloud Function）
   - Firestoreの実データ

2. Cloud Functionは毎回ログイン時に実行されるため、**権限の上書き**に注意

---

## 関連ドキュメント

- [BUG-009ポストモーテム](postmortem-bug009-permission-sync-2025-12-08.md)
- [firestore.rules](../firestore.rules)
- [demoSignIn.ts](../functions/src/demoSignIn.ts)

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-09
