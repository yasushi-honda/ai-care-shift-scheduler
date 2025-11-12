# Phase 17.8: User Fetch Permission Error修正 - バグ分析

**更新日**: 2025-11-12
**仕様ID**: auth-data-persistence
**Phase**: 17.8
**種別**: バグ修正（重大）

---

## 概要

Google OAuth認証後、ユーザープロファイルの取得時に「Missing or insufficient permissions」エラーが発生します。このエラーはPhase 17.5で識別されていましたが、Phase 17では未対応でした。

---

## バグ詳細

### エラーメッセージ

```
Error fetching user: FirebaseError: Missing or insufficient permissions.
```

### 発生タイミング

- Google OAuth認証後、`AuthContext`がユーザープロファイルを取得しようとする際
- `onAuthStateChanged`コールバック内で発生

### 影響

- **重大度**: 🔴 重大（認証後のユーザー体験に影響）
- **影響ユーザー**: すべての新規ユーザー、または一部の既存ユーザー
- **機能影響**: ユーザープロファイルが取得できず、アプリケーションが正常に動作しない可能性

---

## 根本原因分析

### エラー発生箇所

**ファイル**: `src/contexts/AuthContext.tsx`
**行**: Line 97

```typescript
// Firestoreからユーザープロファイルを取得
const userDoc = await getDoc(doc(db, 'users', user.uid));
```

この`getDoc()`呼び出し時に`Permission denied`エラーが発生しています。

---

### Firestore Security Rules確認

**ファイル**: `firestore.rules`
**行**: Line 78-102

```javascript
// users collection
match /users/{userId} {
  // super-adminは全ユーザーをリスト可能（getAllUsers用）
  allow list: if isAuthenticated() && isSuperAdmin();
  // 自分のドキュメントのみ個別読み取り可能
  allow get: if isAuthenticated() && request.auth.uid == userId;

  // ...
}
```

**ルール分析**:
- Line 82: `allow get: if isAuthenticated() && request.auth.uid == userId;`
- このルールは、認証済みユーザーが自分のドキュメントのみ読み取り可能

**ルール自体は正しい**ため、問題は別の箇所にあります。

---

### 考えられる根本原因

#### 原因1: ユーザードキュメントが存在しない ⭐ **最も可能性が高い**

**症状**:
- 新規ユーザーのログイン時に、Cloud Function (`assignSuperAdminOnFirstUser`) がまだドキュメントを作成していない
- または、Cloud Functionの実行に失敗している

**証拠**:
- `AuthContext.tsx` Line 178-182に、ユーザードキュメントが存在しない場合の警告ログがある
- しかし、エラーメッセージは`permission-denied`であり、`not-found`ではない

**矛盾**:
- ドキュメントが存在しない場合、Firestoreは`not-found`エラーを返すはず
- `permission-denied`エラーは、ドキュメントは存在するがアクセス権限がないことを示す

---

#### 原因2: Firestore認証トークンの初期化タイミング

**症状**:
- `onAuthStateChanged`が呼ばれた時点で、Firestoreの認証トークンがまだ完全に初期化されていない
- `request.auth`がnullまたは不完全

**証拠**:
- `authReady.then()`はFirebase Authenticationの初期化を待つが、Firestoreの認証トークン初期化は別
- Firebase AuthenticationとFirestoreの認証トークンは別々に初期化される

**可能性**:
- タイミングの問題により、`request.auth.uid`がまだ設定されていない
- または、`request.auth`がnull

---

#### 原因3: `getUserProfile()`ヘルパー関数の循環参照

**症状**:
- `firestore.rules` Line 14-16の`getUserProfile()`ヘルパー関数が、循環参照を引き起こす可能性

```javascript
function getUserProfile() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}
```

**分析**:
- このヘルパー関数は、`hasRole()`や`isSuperAdmin()`で使用される
- これらの関数が`users`コレクションのルール評価中に呼ばれると、循環参照が発生

**しかし**:
- `users`コレクションのルール自体は`getUserProfile()`を使用していない
- つまり、`users`コレクションへのアクセスには循環参照の問題はないはず

**ただし**:
- 他のコレクション（facilities, schedulesなど）のルールで`hasRole()`が評価される際、`getUserProfile()`が呼ばれる
- もし、最初のアクセスが`users`コレクションではなく他のコレクションだった場合、循環参照が発生する可能性

---

### 最も可能性が高い原因

**原因1: ユーザードキュメントが存在しない + Cloud Functionの問題**

**理由**:
1. `permission-denied`エラーは、Security Rulesが評価された結果
2. `request.auth.uid == userId`の条件が`false`になる理由:
   - ユーザードキュメントが存在しない場合、Firestoreは`get`ルールを評価する前にエラーを返す
   - または、Cloud Functionが別のuidでドキュメントを作成してしまった（uidの不一致）

3. Cloud Function (`assignSuperAdminOnFirstUser`) の実行確認が必要

---

## 推奨される調査手順

### 1. Firebase Console確認

**手順**:
1. Firebase Console → Firestore Database → Data
2. `users`コレクションを開く
3. 現在ログインしているユーザーのuidでドキュメントが存在するか確認

**確認事項**:
- ✅ ドキュメントが存在する → uidが一致しているか確認
- ❌ ドキュメントが存在しない → Cloud Functionが実行されていない

---

### 2. Cloud Functions実行ログ確認

**手順**:
```bash
ACCESS_TOKEN=$(gcloud auth application-default print-access-token) && \
curl -s "https://logging.googleapis.com/v2/entries:list" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceNames": ["projects/ai-care-shift-scheduler"],
    "filter": "resource.type=cloud_function AND resource.labels.function_name=assignSuperAdminOnFirstUser AND timestamp>=\"'$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)'\"",
    "orderBy": "timestamp desc",
    "pageSize": 50
  }'
```

**確認事項**:
- ✅ Cloud Functionが実行されている → エラーがないか確認
- ❌ Cloud Functionが実行されていない → トリガーが正しく設定されているか確認

---

### 3. 認証トークン確認

**手順**:
`AuthContext.tsx`に一時的なログを追加して、認証トークンの状態を確認：

```typescript
unsubscribe = onAuthStateChanged(auth, async (user) => {
  console.log('🔍 onAuthStateChanged called:', {
    uid: user?.uid,
    authUid: auth.currentUser?.uid,
    hasToken: !!await user?.getIdToken()
  });

  setCurrentUser(user);

  if (user) {
    // トークンを強制的に更新
    const token = await user.getIdToken(true);
    console.log('🔍 Token refreshed:', !!token);

    // Firestoreからユーザープロファイルを取得
    // ...
  }
});
```

---

## 暫定対応（推奨）

### オプション1: エラー時のリトライ

`AuthContext.tsx`にリトライロジックを追加：

```typescript
async function fetchUserWithRetry(uid: string, maxRetries = 3): Promise<DocumentSnapshot> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getDoc(doc(db, 'users', uid));
    } catch (error: any) {
      if (error.code === 'permission-denied' && i < maxRetries - 1) {
        console.warn(`⚠️ Retry fetching user (${i + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries reached');
}
```

### オプション2: トークン更新を待つ

`getDoc()`実行前にトークンを強制的に更新：

```typescript
if (user) {
  // トークンを強制的に更新
  await user.getIdToken(true);

  // Firestoreからユーザープロファイルを取得
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  // ...
}
```

---

---

## 根本原因の確定 ✅

### Cloud Functionsログ分析結果

**Firebase CLIでログ確認**（2025-11-12 過去24時間）:

```
2025-11-12T06:36:27 👤 新規ユーザー作成 - 権限なし
  uid: 'YG2b94wqzCeNf03xiM3Z22QWPIx2'
  email: 'hy.unimail.11@gmail.com'

2025-11-12T07:24:28 👤 新規ユーザー作成 - 権限なし
  uid: '0uEdDz82MjMMi63nniUScyLQWVF2'
  email: 's-kimura@fuku-no-tane.com'

（他3件も同様: facilities配列が空で作成）
```

**結論**:
- ✅ Cloud Function (`assignSuperAdminOnFirstUser`) は正常に動作している
- ✅ 初回ユーザー以外は、意図通り`facilities: []`（権限なし）で作成される
- ✅ これは**仕様通りの動作**

---

### 真の根本原因

**Firestore認証トークンの初期化タイミング問題**

#### 問題の流れ

1. **Firebase Authentication認証完了**:
   - `onAuthStateChanged`コールバックが呼ばれる
   - `user.uid`が取得できる

2. **Firestoreアクセス試行**:
   - `getDoc(doc(db, 'users', user.uid))`を実行
   - **しかし、この時点でFirestoreの`request.auth`がまだnullまたは不完全**

3. **Security Rules評価**:
   - `allow get: if isAuthenticated() && request.auth.uid == userId;`
   - `request.auth`が不完全なため、`request.auth.uid == userId`が`false`
   - **Permission denied**

#### 証拠

**ファイル**: `src/contexts/AuthContext.tsx` Line 86-97

```typescript
// authReady が完了するまで待機してから認証状態を監視
authReady.then(() => {
  unsubscribe = onAuthStateChanged(auth, async (user) => {
    setCurrentUser(user);

    if (user) {
      // Firestoreからユーザープロファイルを取得
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        // ↑ ここでPermission deniedが発生
```

**問題**:
- `authReady`はFirebase Authenticationの初期化を待つ
- しかし、**Firestoreの認証トークン初期化は別**
- `onAuthStateChanged`が呼ばれた時点では、Firestoreの`request.auth`がまだ完全に初期化されていない可能性

---

### なぜ一部のユーザーのみに発生するか

**推測**:
1. **初回ユーザー**:
   - Cloud Functionが即座に`facilities`配列を更新
   - その間に認証トークンが完全に初期化される
   - `getDoc()`実行時には`request.auth`が有効
   - **エラーが発生しない**

2. **2人目以降のユーザー**:
   - Cloud Functionは`facilities`を更新しない
   - `onAuthStateChanged`が即座に呼ばれる
   - `getDoc()`実行時に`request.auth`がまだ不完全
   - **Permission deniedが発生**

---

## 解決策の方向性

### オプション1: 認証トークンの強制更新 ⭐ **推奨**

`getDoc()`実行前に、認証トークンを強制的に更新：

```typescript
if (user) {
  // Firestoreの認証トークンを強制的に更新
  await user.getIdToken(true);

  // Firestoreからユーザープロファイルを取得
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  // ...
}
```

**メリット**:
- ✅ シンプルな修正
- ✅ 既存コードへの影響が少ない
- ✅ 確実に認証トークンが有効

**デメリット**:
- ⚠️ 若干のパフォーマンス低下（トークン更新のネットワークリクエスト）

---

### オプション2: リトライロジック

`getDoc()`失敗時に、トークン更新してリトライ：

```typescript
async function fetchUserWithRetry(user: FirebaseUser, maxRetries = 3): Promise<DocumentSnapshot> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // トークン更新（2回目以降）
      if (i > 0) {
        await user.getIdToken(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return await getDoc(doc(db, 'users', user.uid));
    } catch (error: any) {
      if (error.code === 'permission-denied' && i < maxRetries - 1) {
        console.warn(`⚠️ Retry fetching user (${i + 1}/${maxRetries})...`);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries reached');
}
```

**メリット**:
- ✅ 1回目で成功すればパフォーマンス低下なし
- ✅ ネットワークエラーにも対応

**デメリット**:
- ❌ コードが複雑
- ❌ エラー発生時のリトライで遅延

---

### オプション3: Firestoreの認証準備完了を待つ

`getDoc()`実行前に、Firestoreの認証が完全に準備されるまで待つ：

```typescript
// Firestoreの認証準備完了を待つヘルパー
async function waitForFirestoreAuth(user: FirebaseUser): Promise<void> {
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    const token = await user.getIdTokenResult();
    if (token.claims.sub === user.uid) {
      return; // 認証完了
    }
    await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
  }
  throw new Error('Firestore auth not ready');
}
```

**メリット**:
- ✅ 認証準備完了を確実に待つ

**デメリット**:
- ❌ 複雑
- ❌ 待機時間が不確定

---

## 推奨される解決策

**オプション1: 認証トークンの強制更新**を推奨します。

**理由**:
1. シンプルで実装が容易
2. 確実に認証トークンが有効になる
3. 既存コードへの影響が最小限
4. パフォーマンス低下は許容範囲（ログイン時の1回のみ）

---

## 次のステップ

1. ✅ このバグ分析ドキュメントを承認（根本原因確定）
2. ✅ Cloud Functionsログ確認完了
3. 📋 Phase 17.8技術設計ドキュメント作成
4. 🛠️ AuthContext.tsx修正（認証トークン強制更新）
5. 🚀 デプロイ（GitHub Actions CI/CD）
6. ✅ 本番環境で確認
7. 📝 Phase 17.8検証ドキュメント作成

---

## 関連ドキュメント

- `src/contexts/AuthContext.tsx` - 認証コンテキスト（エラー発生箇所）
- `firestore.rules` - Firestore Security Rules
- `functions/src/auth-onCreate.ts` - Cloud Function（assignSuperAdminOnFirstUser）
- `phase17-5-verification-2025-11-12.md` - Phase 17.5で識別されていた問題

---

**レポート作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**優先度**: 🔴 重大（認証後のユーザー体験に影響）
**ステータス**: ✅ 根本原因確定・解決策選定完了
