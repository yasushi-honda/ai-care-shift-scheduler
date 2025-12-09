# Phase 17.5: Permission Error修正（versionsサブコレクション） - バグ分析

**更新日**: 2025-11-12
**仕様ID**: auth-data-persistence
**Phase**: 17.5
**種別**: バグ修正（重大）

---

## 概要

Phase 17の修正後も、本番環境で2つのPermission Errorが継続して発生しています：

1. **Version History Permission Error**: `getVersionHistory`でPermission errorが発生
2. **User Fetch Permission Error**: ユーザー情報取得でPermission errorが発生（Phase 17で改善したがまだ発生）

---

## バグ詳細

### バグ1: Version History Permission Error

#### エラーメッセージ

```
index-BcVVQg4d.js:3247 Failed to get version history: FirebaseError: Missing or insufficient permissions.
getVersionHistory @ index-BcVVQg4d.js:3247
```

#### 発生箇所

- **ファイル**: `src/services/scheduleService.ts`
- **関数**: `getVersionHistory()` (Line 470-541)
- **Firestoreパス**: `facilities/{facilityId}/schedules/{scheduleId}/versions`

#### 呼び出し元

- **ファイル**: `App.tsx`
- **Line 697**: バージョン履歴読み込み
- **Line 740**: バージョン復元後のリフレッシュ

#### 根本原因分析

**原因: Firestore Security Rulesにversionsサブコレクションのルールが未定義**

`firestore.rules`の現状:

```javascript
// schedules subcollection
match /schedules/{scheduleId} {
  // super-adminまたはviewer以上で読み取り、editor以上で書き込み
  allow read: if isAuthenticated() && (isSuperAdmin() || hasRole(facilityId, 'viewer'));
  allow write: if isAuthenticated() && hasRole(facilityId, 'editor');
}

// ⚠️ versions サブコレクションのルールが存在しない！
// デフォルトルール（Line 178-180）が適用される:
// match /{document=**} {
//   allow read, write: if false; // すべて拒否
// }
```

**実際のFirestoreアクセス**:

```typescript
// scheduleService.ts Line 497
const versionsRef = collection(
  db,
  `facilities/${facilityId}/schedules/${scheduleId}/versions`
);
const q = query(versionsRef, orderBy('versionNumber', 'desc'));
const querySnapshot = await getDocs(q); // ❌ Permission denied
```

**Firestoreコレクション構造**:

```
facilities/
  {facilityId}/
    schedules/
      {scheduleId}/
        versions/           ← ❌ Security Rulesが未定義
          {versionId}
```

#### 影響範囲

- **重大度**: 🔴 高（バージョン履歴機能が完全に動作しない）
- **影響ユーザー**: すべてのユーザー（viewer以上）
- **機能影響**:
  - バージョン履歴の表示不可
  - バージョン復元機能が使用不可
  - Phase 6で実装したバージョン管理機能が機能しない

---

### バグ2: User Fetch Permission Error（継続）

#### エラーメッセージ

```
index-BcVVQg4d.js:3247 Error fetching user: FirebaseError: Missing or insufficient permissions.
NO @ index-BcVVQg4d.js:3247
エラー: ユーザー情報の取得に失敗しました
```

#### 発生箇所

- **ファイル**: `src/contexts/AuthContext.tsx`
- **関数**: `AuthProvider` の `useEffect` 内 (Line 97付近)
- **Firestoreパス**: `users/{userId}`

#### Phase 17での対応状況

Phase 17では、**エラーハンドリングの改善**のみを実施：
- 詳細なログ記録
- エラー原因の診断情報提供

**しかし、根本原因は解決していない**:
1. ユーザードキュメントが存在しない
2. Security Rulesが正しくデプロイされていない可能性

#### 根本原因分析（追加調査必要）

**仮説1: 新規ユーザーのドキュメント作成失敗**

新規ユーザーがログインした際、以下のフローが期待される：
1. クライアント側で`users`ドキュメント作成（`createOrUpdateUser()`）
2. Cloud Function `assignSuperAdminOnFirstUser`が実行
3. `facilities`配列が設定される

**問題の可能性**:
- Cloud Functionの実行遅延
- `createOrUpdateUser()`の失敗
- Security Rulesのデプロイ遅延

**仮説2: Security Rulesのデプロイ問題**

GitHub Actions CI/CDでSecurity Rulesをデプロイしているが：
- デプロイが失敗している可能性
- キャッシュにより古いRulesが適用されている可能性

#### 確認が必要な項目

1. **Firebase Console確認**:
   - `users`コレクションにユーザードキュメントが存在するか
   - `facilities`配列が設定されているか

2. **Cloud Functionsログ確認**:
   - `assignSuperAdminOnFirstUser`が実行されているか
   - エラーログがないか

3. **Security Rulesデプロイ確認**:
   - 最新のRulesがデプロイされているか
   - Firebase Consoleで確認

---

## 提案される解決策

### バグ1: Version History Permission Error

#### 解決策: versionsサブコレクションのSecurity Rules追加

`firestore.rules`に以下を追加：

```javascript
// schedules subcollection
match /schedules/{scheduleId} {
  // super-adminまたはviewer以上で読み取り、editor以上で書き込み
  allow read: if isAuthenticated() && (isSuperAdmin() || hasRole(facilityId, 'viewer'));
  allow write: if isAuthenticated() && hasRole(facilityId, 'editor');

  // 🆕 versions サブコレクション
  match /versions/{versionId} {
    // viewer以上で読み取り、editor以上で書き込み（scheduleと同じ権限）
    allow read: if isAuthenticated() && (isSuperAdmin() || hasRole(facilityId, 'viewer'));
    allow write: if isAuthenticated() && hasRole(facilityId, 'editor');
  }
}
```

**理由**:
- バージョン履歴はスケジュールの一部であり、同じ権限体系を適用すべき
- viewer以上がバージョン履歴を閲覧可能
- editor以上がバージョンを作成・復元可能

**メリット**:
- バージョン管理機能が正常に動作する
- Phase 6で実装した機能が使用可能になる

---

### バグ2: User Fetch Permission Error

#### 解決策1: Cloud Function実行確認とデバッグ

1. **Cloud Functionsログ確認**:
   ```bash
   firebase functions:log --only assignSuperAdminOnFirstUser
   ```

2. **新規ユーザーでテスト**:
   - 新しいGoogleアカウントでログイン
   - Cloud Functionが実行されるか確認
   - `users`ドキュメントが作成されるか確認

3. **エラーログ分析**:
   - AuthContextの詳細ログを確認
   - Permission errorの原因を特定

#### 解決策2: Security Rulesデプロイ確認

1. **Firebase Console確認**:
   - Firebase Console → Firestore Database → Rules
   - 最新のRulesがデプロイされているか確認

2. **手動デプロイ**（必要な場合）:
   ```bash
   firebase deploy --only firestore:rules
   ```

#### 解決策3: ユーザードキュメント手動作成（緊急対応）

エラーが発生しているユーザーのドキュメントを手動で作成：

```javascript
// Firebase Console → Firestore Database → users → Add document
{
  userId: "ユーザーのUID",
  email: "ユーザーのメール",
  name: "ユーザー名",
  provider: "google",
  facilities: [
    {
      facilityId: "facility-{userId}",
      role: "super-admin",
      grantedAt: Timestamp.now(),
      grantedBy: "{userId}"
    }
  ],
  createdAt: Timestamp.now(),
  lastLoginAt: Timestamp.now()
}
```

---

## 推奨アプローチ

### 即座の対応（今日中）

1. **バグ1対応**: `firestore.rules`にversionsサブコレクションのルール追加
2. **デプロイ**: GitHub Actions CI/CDでデプロイ
3. **確認**: 本番環境でバージョン履歴が表示されるか確認

### バグ2の調査（並行）

1. **Firebase Console確認**: `users`コレクションの状態確認
2. **Cloud Functionsログ確認**: エラーログ確認
3. **原因特定**: Permission errorの根本原因を特定
4. **修正実装**: 原因に応じた修正

---

## 次のステップ

1. ✅ このバグ分析ドキュメントを承認
2. 📋 Phase 17.5技術設計ドキュメント作成
3. 🛠️ Phase 17.5実装（versionsサブコレクションRules追加）
4. 🔍 バグ2の追加調査
5. ✅ Phase 17.5検証ドキュメント作成

---

## 関連ドキュメント

- `firestore.rules` - Firestore Security Rules
- `src/services/scheduleService.ts` - スケジュールサービス
- `src/contexts/AuthContext.tsx` - 認証コンテキスト
- `phase17-bug-analysis-2025-11-12.md` - Phase 17バグ分析
- `phase17-verification-2025-11-12.md` - Phase 17検証レポート

---

## 学び・振り返り

### 教訓

1. **Security Rulesの網羅性**: サブコレクションのSecurity Rulesは明示的に定義する必要がある
2. **実装完了≠デプロイ完了**: Phase 6でバージョン管理機能を実装したが、Security Rulesが不足していた
3. **E2Eテストの重要性**: E2EテストでPermission errorを検出できなかった

### 今後の改善

- 新しいサブコレクション追加時は、Security Rulesも同時に追加する
- E2EテストでPermission errorをテストする
- デプロイ後の本番環境での動作確認を徹底する
