# Phase 17: ユーザー管理の不具合修正 - バグ分析

**更新日**: 2025-11-12
**仕様ID**: auth-data-persistence
**Phase**: 17
**種別**: バグ修正（重大）

---

## 概要

本番環境でユーザー管理機能に関する2つの重大なバグが発見されました：

1. **Firestore Permission Error**: ユーザーフェッチ時に「Missing or insufficient permissions」エラーが発生
2. **User Management Sync Issue**: Firebase Authenticationで削除したユーザーが、ユーザー管理画面のリストに残り続ける

---

## バグ詳細

### バグ1: Firestore Permission Error

#### エラーメッセージ

```
index-BzKqViaL.js:3247 Error fetching user: FirebaseError: Missing or insufficient permissions.
```

#### 発生箇所

- **ファイル**: `src/contexts/AuthContext.tsx`
- **関数**: `AuthProvider` の `useEffect` 内、Line 98
- **コード**:
  ```typescript
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  ```

#### 再現手順

1. 本番環境にログイン
2. ページをリロード
3. コンソールにエラーが表示される

#### 根本原因分析

**仮説1: 新規ユーザーでFirestoreドキュメントが未作成**
- 新規ユーザーがログインした際、Cloud Functionが実行される前に`getDoc()`が呼ばれる
- Firestore Security Rules (Line 82) は自分のドキュメントのみ読み取り可能だが、ドキュメントが存在しない場合はエラー

**仮説2: 認証状態の初期化タイミング**
- `authReady`プロミスが解決される前に`getDoc()`が呼ばれる可能性
- Firebase Authentication IDトークンが完全に初期化される前のアクセス

**仮説3: Security Rulesのデプロイ遅延**
- 最新のSecurity Rulesが本番環境に正しくデプロイされていない可能性

#### 影響範囲

- **重大度**: 🔴 高（エラーが発生するとユーザー体験が損なわれる）
- **影響ユーザー**: 新規ユーザー、または特定の条件下での既存ユーザー
- **機能影響**: ログイン後のユーザープロファイル読み込み失敗

---

### バグ2: User Management Sync Issue

#### 問題の詳細

Firebase Authenticationで削除したユーザー（特にドメイン外ユーザー）が、ユーザー管理画面のリストに表示され続ける。

#### 発生箇所

- **ファイル**: `src/pages/admin/UserManagement.tsx`
- **関数**: `loadUsers()` → `getAllUsers()`
- **ファイル**: `src/services/userService.ts`
- **関数**: `getAllUsers()` (Line 196-239)

#### 再現手順

1. super-adminとしてログイン
2. 管理画面でユーザーをFirebase Authenticationから削除
3. ユーザー管理画面をリロード
4. **期待**: 削除したユーザーがリストから消える
5. **実際**: 削除したユーザーが残り続ける

#### 根本原因分析

**原因: Firebase AuthenticationとFirestoreの非同期性**

Firebase Authenticationでユーザーを削除しても、Firestore `users` collectionのドキュメントは**自動的に削除されない**。

- **userService.ts Line 213-220**:
  ```typescript
  const usersRef = collection(db, 'users') as CollectionReference<User>;
  const q = query(usersRef, orderBy('lastLoginAt', 'desc'));

  const snapshot = await getDocs(q);
  const users: UserSummary[] = snapshot.docs.map((doc) => {
    // Firestoreから取得したユーザーをそのままリストに追加
  });
  ```

- Firebase Authenticationの削除は`users` collectionに反映されない
- `getAllUsers()`はFirestoreのデータのみを参照

**アーキテクチャ上の問題**:
- ユーザー削除時のクリーンアップメカニズムが存在しない
- データ整合性を保つための自動同期がない

#### 影響範囲

- **重大度**: 🟡 中（データ整合性の問題だが、システムは動作する）
- **影響ユーザー**: super-admin（ユーザー管理画面を使用するユーザー）
- **機能影響**: ユーザーリストに存在しないユーザーが表示され、混乱を招く
- **セキュリティ影響**: 削除されたユーザーのFirestoreデータが残り続ける（ログイン不可のため直接的な脅威は低い）

---

## 提案される解決策

### バグ1: Firestore Permission Error

#### 解決策1: エラーハンドリングの改善（短期対応）

`AuthContext.tsx`のユーザーフェッチ処理を改善：

```typescript
try {
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (userDoc.exists()) {
    // 既存の処理
  } else {
    console.warn('User document does not exist, creating...');
    // ドキュメント作成処理（createOrUpdateUser）
    setUserProfile(null);
    setSelectedFacilityId(null);
  }
} catch (error: any) {
  // Permission errorの詳細ログ
  if (error.code === 'permission-denied') {
    console.error('Permission denied when fetching user profile. Possible causes:');
    console.error('1. Security Rules not deployed');
    console.error('2. User document does not exist yet');
    console.error('3. Authentication token not ready');
  } else {
    console.error('Failed to fetch user profile:', error);
  }
  setUserProfile(null);
  setSelectedFacilityId(null);
}
```

#### 解決策2: Security Rulesの再デプロイ確認（検証）

GitHub Actions CI/CDで`firestore.rules`が正しくデプロイされているか確認。

---

### バグ2: User Management Sync Issue

#### 解決策1: Cloud Functionによる自動削除（推奨・恒久対応）

Firebase Authentication `onDelete` トリガーを使用して、ユーザー削除時にFirestoreドキュメントも自動削除：

**新規ファイル**: `functions/src/onUserDelete.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Firebase Authentication ユーザー削除時に Firestore ドキュメントも削除
 */
export const onUserDelete = functions.auth.user().onDelete(async (user) => {
  const userId = user.uid;

  try {
    // Firestore users collection からドキュメントを削除
    await admin.firestore().collection('users').doc(userId).delete();

    console.log(`Successfully deleted Firestore document for user: ${userId}`);

    // 監査ログに記録
    await admin.firestore().collection('auditLogs').add({
      userId: 'system',
      action: 'user_deleted',
      resourceType: 'user',
      resourceId: userId,
      metadata: {
        email: user.email,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      result: 'success',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(`Failed to delete Firestore document for user ${userId}:`, error);

    // 失敗も監査ログに記録
    await admin.firestore().collection('auditLogs').add({
      userId: 'system',
      action: 'user_deleted',
      resourceType: 'user',
      resourceId: userId,
      metadata: {
        email: user.email,
        error: (error as Error).message,
      },
      result: 'failure',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});
```

**メリット**:
- 自動的にデータ整合性を保つ
- ユーザー削除時の手動クリーンアップ不要
- 監査ログに削除履歴が残る

**デメリット**:
- Cloud Functions デプロイが必要
- 過去に削除済みのユーザーは手動クリーンアップが必要

#### 解決策2: 手動クリーンアップスクリプト（即時対応）

既存の削除済みユーザーをクリーンアップするスクリプト：

**新規ファイル**: `scripts/cleanupDeletedUsers.ts`

```typescript
import * as admin from 'firebase-admin';

async function cleanupDeletedUsers() {
  const usersSnapshot = await admin.firestore().collection('users').get();

  for (const doc of usersSnapshot.docs) {
    const userId = doc.id;

    try {
      // Firebase Authentication にユーザーが存在するか確認
      await admin.auth().getUser(userId);
      console.log(`✅ User ${userId} exists in Authentication`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Authenticationに存在しないユーザーなので、Firestoreから削除
        console.log(`🗑️ Deleting Firestore document for deleted user: ${userId}`);
        await admin.firestore().collection('users').doc(userId).delete();
      } else {
        console.error(`❌ Error checking user ${userId}:`, error);
      }
    }
  }

  console.log('✅ Cleanup completed');
}

// 実行
admin.initializeApp();
cleanupDeletedUsers().catch(console.error);
```

**メリット**:
- 即座に問題を解決
- 既存の削除済みユーザーを一括クリーンアップ

**デメリット**:
- 一時的な対応（将来の削除には効果なし）
- 手動実行が必要

#### 解決策3: UI側でのフィルタリング（代替案・非推奨）

`UserManagement.tsx`で、Firebase Authenticationに存在しないユーザーをフィルタリング：

```typescript
const loadUsers = useCallback(async () => {
  // getAllUsers()でFirestoreユーザーを取得
  const result = await getAllUsers(currentUser.uid);

  if (result.success) {
    // Firebase Authenticationに存在するユーザーのみをフィルタ
    const validUsers = [];
    for (const user of result.data) {
      try {
        // Firebase Admin SDK経由でユーザーの存在確認（要: Cloud Function）
        const exists = await checkUserExists(user.userId);
        if (exists) {
          validUsers.push(user);
        }
      } catch (error) {
        console.error(`Error checking user ${user.userId}:`, error);
      }
    }
    setUsers(validUsers);
  }
}, [currentUser]);
```

**デメリット**:
- パフォーマンスが悪い（各ユーザーごとにAPI呼び出し）
- Cloud Function経由でのチェックが必要
- 根本的な解決にならない

---

## 推奨アプローチ

### 即座の対応（今日中）

1. **バグ1対応**: `AuthContext.tsx`のエラーハンドリング改善（解決策1）
2. **バグ2対応**: 手動クリーンアップスクリプト実行（解決策2）

### 恒久的な対応（Phase 17実装）

1. **バグ2対応**: Cloud Functionによる自動削除実装（解決策1）
2. **検証**: E2Eテストまたは手動テストで動作確認

---

## 次のステップ

1. ✅ このバグ分析ドキュメントを承認
2. 📋 Phase 17技術設計ドキュメント作成
3. 📋 tasks.mdにPhase 17追加
4. 🛠️ Phase 17実装
5. ✅ Phase 17検証ドキュメント作成

---

## 関連ドキュメント

- `firestore.rules` - Firestore Security Rules
- `src/contexts/AuthContext.tsx` - 認証コンテキスト
- `src/services/userService.ts` - ユーザーサービス
- `src/pages/admin/UserManagement.tsx` - ユーザー管理画面
- `overall-progress-2025-11-02.md` - Phase 0-16完了状況

---

## 学び・振り返り

### 教訓

1. **データ整合性の設計**: Firebase AuthenticationとFirestoreは独立したサービスであり、削除時の同期メカニズムを明示的に実装する必要がある
2. **エラーハンドリングの重要性**: Permission errorの詳細な分類とログ記録が、デバッグに不可欠
3. **Cloud Functionsの活用**: Authentication lifeycleイベント（onDelete）を活用することで、自動的にデータ整合性を保つことができる

### 今後の改善

- 新機能実装時は、削除時のクリーンアップメカニズムを設計段階で考慮する
- E2Eテストでユーザー削除シナリオもカバーする
- 監査ログに削除操作を記録し、トレーサビリティを確保する
