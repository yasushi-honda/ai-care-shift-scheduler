# Phase 17.9: Admin User Detail Permission Error - バグ分析

**作成日**: 2025-11-12
**仕様ID**: auth-data-persistence
**Phase**: 17.9
**種別**: バグ修正（重大）
**優先度**: 🔴 緊急

---

## 目次

1. [バグ概要](#バグ概要)
2. [エラー詳細](#エラー詳細)
3. [根本原因分析](#根本原因分析)
4. [影響範囲](#影響範囲)
5. [解決策の方向性](#解決策の方向性)

---

## バグ概要

### 症状

管理画面のユーザー詳細ページ（`/admin/users/{userId}`）で、別のユーザーの詳細情報を取得しようとすると Permission error が発生します。

### 発生条件

- super-admin権限を持つユーザーが管理画面にアクセス
- ユーザー一覧から別のユーザーの詳細ページを開く
- ユーザー詳細情報の取得時にPermission errorが発生

### エラーメッセージ

```
Error fetching user: FirebaseError: Missing or insufficient permissions.
```

---

## エラー詳細

### ブラウザコンソールログ

```
✅ Firestore auth token refreshed
✅ Restored facility from localStorage: facility-o3BZBx5EEPbFqiIaHYRYQKraAut1
Error fetching user: FirebaseError: Missing or insufficient permissions.
```

**重要な発見**:
- AuthContext（Phase 17.8）の修正は正常に動作している
- 認証トークン強制更新は成功している
- このエラーは**別の場所**で発生している

### エラー発生箇所

**ファイル**: `src/services/userService.ts`
**関数**: `getUserById` (Line 249-295)
**エラー発生行**: Line 267

```typescript
export async function getUserById(
  userId: string,
  currentUserId: string
): Promise<Result<User, UserError>> {
  try {
    // super-admin権限チェック
    const isSuperAdmin = await checkIsSuperAdmin(currentUserId);
    if (!isSuperAdmin) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'この操作にはスーパー管理者権限が必要です',
        },
      };
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);  // ← ここでPermission denied

    // ...
  } catch (error) {
    console.error('Error fetching user:', error);  // ← このログが表示される
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: 'ユーザー情報の取得に失敗しました',
      },
    };
  }
}
```

### 呼び出し元

**ファイル**: `src/pages/admin/UserDetail.tsx`
**関数**: `loadUserDetail` (Line 38-64)

```typescript
const loadUserDetail = useCallback(async () => {
  if (!userId || !currentUser) return;

  setLoading(true);
  setError(null);

  // ユーザー情報と全施設情報を並列取得
  const [userResult, facilitiesResult] = await Promise.all([
    getUserById(userId, currentUser.uid),  // ← ここから getUserById を呼び出し
    getAllFacilities(currentUser.uid),
  ]);

  if (!userResult.success) {
    assertResultError(userResult);
    setError(userResult.error.message);
    setLoading(false);
    return;
  }

  setUser(userResult.data);
  // ...
}, [userId, currentUser]);
```

---

## 根本原因分析

### Firestore Security Rulesの調査

**ファイル**: `firestore.rules`
**該当箇所**: users collection (Line 78-82)

```javascript
// users collection
match /users/{userId} {
  // super-adminは全ユーザーをリスト可能（getAllUsers用）
  allow list: if isAuthenticated() && isSuperAdmin();
  // 自分のドキュメントのみ個別読み取り可能
  allow get: if isAuthenticated() && request.auth.uid == userId;
```

### 問題点の特定

**`allow get`ルールの問題**:
```javascript
allow get: if isAuthenticated() && request.auth.uid == userId;
```

このルールでは、**自分のドキュメントのみ**読み取り可能になっています。

**矛盾した設計**:
- ✅ `allow list`: super-adminは**全ユーザーをリスト可能**
- ❌ `allow get`: **自分のドキュメントのみ**読み取り可能

### 根本原因

**super-adminであっても、別のユーザーの個別詳細情報を取得できない**

1. **ユーザー一覧表示**: `allow list`ルールにより成功
   - `/admin/users` でユーザー一覧が表示される

2. **ユーザー詳細表示**: `allow get`ルールにより**失敗**
   - `/admin/users/{userId}` で別のユーザーの詳細を取得しようとすると Permission denied

### なぜPhase 17.8では解決しなかったか

Phase 17.8では**AuthContext内**で認証トークンを強制更新しました。

しかし、今回のエラーは**Firestore Security Rulesの設計問題**であり、認証トークンの問題ではありません。

**タイムライン**:
1. ✅ AuthContext: 認証トークン強制更新成功
2. ✅ 施設選択: LocalStorageから復元成功
3. ❌ getUserById: Firestore Security Rulesで拒否

---

## 影響範囲

### 影響を受ける機能

1. **管理画面 - ユーザー詳細ページ** (`/admin/users/{userId}`)
   - 別のユーザーの詳細情報が表示できない
   - アクセス権限付与・剥奪ができない

2. **管理画面 - ユーザー管理機能**
   - ユーザー一覧は表示可能（`allow list`により）
   - 個別ユーザーの詳細操作が不可能

### 影響を受けないもの

- ✅ 自分自身のユーザー情報取得（AuthContext）
- ✅ ユーザー一覧表示（`allow list`により）
- ✅ その他の管理機能（施設管理、監査ログなど）

---

## 解決策の方向性

### 提案する修正

**firestore.rules の users collection の `allow get` ルールを修正**:

```javascript
// 修正前（現在）:
allow get: if isAuthenticated() && request.auth.uid == userId;

// 修正後（正しい）:
allow get: if isAuthenticated() && (request.auth.uid == userId || isSuperAdmin());
```

### 修正の根拠

1. **一貫性の確保**:
   - `allow list`で全ユーザーリストを許可しているのに、個別取得を拒否するのは矛盾
   - super-adminは全ユーザーの詳細も取得できるべき

2. **管理機能の実現**:
   - ユーザー管理機能では、個別ユーザーの詳細情報が必要
   - アクセス権限付与・剥奪には詳細情報が必須

3. **セキュリティ**:
   - super-admin権限チェック（`isSuperAdmin()`）により保護
   - 一般ユーザーは自分の情報のみアクセス可能（既存の動作を維持）

---

## 次のステップ

1. ✅ バグ分析ドキュメント作成（本ドキュメント）
2. 📝 技術設計ドキュメント作成
3. 🔧 firestore.rules修正
4. 🚀 デプロイ（GitHub Actions CI/CD）
5. ✅ 本番環境で検証
6. 📝 Phase 17.9検証ドキュメント作成

---

## 関連ドキュメント

- `phase17-8-bug-analysis-2025-11-12.md` - Phase 17.8バグ分析（AuthContext Permission error）
- `firestore.rules` - Firestore Security Rules
- `src/services/userService.ts` - getUserById関数
- `src/pages/admin/UserDetail.tsx` - ユーザー詳細ページ

---

**レポート作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: 分析完了・技術設計へ
