# Phase 19-21 未コミット変更分析

**更新日**: 2025-11-15
**仕様ID**: auth-data-persistence
**Phase**: Phase 19-21の追加実装・Phase 22準備作業
**ステータス**: コミット待ち

---

## 概要

Phase 22のE2Eテスト実装中に発見した問題点を修正した変更が、未コミット状態で残っています。
これらは主にPhase 19-21の機能追加とPhase 22のE2Eテスト改善に関連する変更です。

## 変更ファイル一覧

1. `App.tsx` - Phase 20ログアウト機能追加
2. `e2e/auth-flow.spec.ts` - Phase 21認証フローE2Eテスト改善
3. `e2e/helpers/auth-helper.ts` - Phase 19/21テストヘルパー改善
4. `src/components/AdminProtectedRoute.tsx` - Phase 21デバッグログ追加
5. `src/contexts/AuthContext.tsx` - Phase 21デバッグログ追加
6. `src/pages/Forbidden.tsx` - Phase 21 UI改善

---

## 詳細変更内容

### 1. App.tsx - Phase 20ログアウト機能追加

**変更箇所**:
- Line 46: `signOut`をAuthContextから取得
- Line 50: `isSigningOut`状態追加
- Line 822-832: `handleSignOut`関数実装
- Line 862-866: ヘッダーにユーザー名表示追加
- Line 886-896: ログアウトボタン追加

**機能**:
```typescript
// ログアウトハンドラー
const handleSignOut = async () => {
  setIsSigningOut(true);
  const result = await signOut();
  if (result.success) {
    navigate('/');
  } else {
    assertResultError(result);
    console.error('Sign out failed:', result.error);
    setIsSigningOut(false);
  }
};
```

**UI追加要素**:
- ユーザー名表示: `{userProfile.name || 'ユーザー'}`（小画面では非表示）
- ログアウトボタン: 「ログアウト」/「ログアウト中...」（disabled制御）

**Phase 20要件との対応**:
- ✅ ログアウト機能実装
- ✅ UIにログアウトボタン配置
- ✅ ログアウト後のルーティング（`/`へ遷移）

---

### 2. e2e/auth-flow.spec.ts - Phase 21認証フローE2Eテスト改善

**変更箇所**:
- Line 63-66: Test 1のアサーション修正（ユーザー名 → 施設名）
- Line 96-110: Test 3のテストデータ修正（権限なしユーザー → viewerロール）
- Line 127-132: Test 4のテストデータ修正（権限なしユーザー → editorロール）

**変更理由**:

#### Test 1: 認証後のユーザー名表示確認
```typescript
// 修正前（Phase 19当初の想定）
await expect(page.getByText(/Test User/)).toBeVisible({ timeout: 5000 });

// 修正後（Phase 20実装後の実態に合わせる）
await expect(page.getByText(/test-facility-001/)).toBeVisible({ timeout: 5000 });
```

**理由**: Phase 20実装時、ユーザー名表示は小画面では非表示となり、施設名がメインUI要素となったため、テストアサーションを変更。

#### Test 3/4: Forbiddenページ表示テスト
```typescript
// 修正前（Phase 21初期実装）
await setupAuthenticatedUser(page, {
  email: 'no-permission@example.com',
  password: 'password123',
  displayName: 'No Permission User',
  // roleを設定しない = 権限なし
});

// 修正後（Phase 22 E2Eテスト改善）
await setupAuthenticatedUser(page, {
  email: 'viewer-user@example.com',
  password: 'password123',
  displayName: 'Viewer User',
  facilities: [{ facilityId: 'test-facility-001', role: 'viewer' }],
});
```

**理由**:
- Phase 19でFirestore Security Rulesが強化され、`facilities`配列が空のユーザーはドキュメント作成すらできない
- `role`なしユーザーではなく、`viewer`/`editor`ロールを持つが`super-admin`権限がないユーザーで検証
- `AdminProtectedRoute`の正確な権限チェックを検証

**Phase 21デバッグログ追加**:
```typescript
const consoleMessages: string[] = [];
page.on('console', (msg) => {
  const text = msg.text();
  consoleMessages.push(`[${msg.type()}] ${text}`);
  console.log(`[Browser Console ${msg.type()}] ${text}`);
});
```

---

### 3. e2e/helpers/auth-helper.ts - Phase 19/21テストヘルパー改善

**変更箇所**:
- Line 308: `facilities`パラメータ型変更（`string[]` → `{ facilityId: string; role: ... }[]`）
- Line 311-329: `facilities`配列の構築ロジック改善
- Line 351-418: Firestore ユーザードキュメント作成を2段階に分離

**重要な変更: Firestoreドキュメント作成の2段階アプローチ**

```typescript
// Phase 19: E2Eテスト環境でのFirestoreユーザードキュメント作成
// Firestore Rulesでは、create時にfacilitiesは空配列のみ許可（本番環境のセキュリティ）
// そのため、2段階アプローチを採用：
// 1. まず空のfacilitiesでドキュメント作成（createルールを満たす）
// 2. その後updateでfacilitiesを設定（updateルール: facilitiesフィールドのみ変更を許可）

// Step 1: 空のfacilitiesでユーザードキュメント作成
await setDoc(userRef, {
  userId: testUid,
  email: testEmail,
  name: testDisplayName,
  photoURL: '',
  provider: 'password',
  facilities: [], // 初回作成時は空配列（Firestore Rulesの要件）
  createdAt: now,
  lastLoginAt: now,
});

// Step 2: facilitiesを設定（updateルールに従う）
if (testFacilitiesArray && testFacilitiesArray.length > 0) {
  await setDoc(userRef, {
    facilities: testFacilitiesArray,
  }, { merge: true }); // mergeオプションでfacilitiesフィールドのみ更新
}
```

**この変更の重要性**:
- Firestore Security Rulesは本番環境のセキュリティ要件を満たすため、create時に`facilities`を空配列に制限
- E2Eテストでは、テストユーザーに施設権限を付与する必要がある
- 2段階アプローチにより、Security Rulesを緩めることなくE2Eテストを実現

**Phase 21待機時間追加**:
```typescript
// Phase 21: Firestoreドキュメント作成後の待機時間を追加
await page.waitForTimeout(1500);
```

**理由**: ページ遷移前にFirestoreの書き込みが確実にコミットされることを保証

---

### 4. src/components/AdminProtectedRoute.tsx - Phase 21デバッグログ追加

**変更箇所**:
- Line 18-22: レンダリング時のデバッグログ
- Line 26: ローディング画面表示時のデバッグログ
- Line 38-40: `/forbidden`リダイレクト時のデバッグログ
- Line 44: 子コンポーネント表示時のデバッグログ

**デバッグログの目的**:
- Phase 22のE2Eテスト失敗原因調査のため
- `isSuperAdmin()`の評価タイミングと結果を追跡
- `loading`状態の遷移を追跡

**ログ例**:
```typescript
console.log('[Phase 21 Debug] AdminProtectedRoute rendering:', {
  loading,
  isSuperAdminResult: loading ? '(loading, not checked yet)' : isSuperAdmin(),
});

console.log('[Phase 21 Debug] AdminProtectedRoute: Redirecting to /forbidden (isSuperAdmin=false)');
```

---

### 5. src/contexts/AuthContext.tsx - Phase 21デバッグログ追加

**変更箇所**:
- Line 222-227: `loading`状態変更時のデバッグログ（認証状態ロード完了時）
- Line 231-232: `loading`状態変更時のデバッグログ（エラー時）
- Line 381-386: `isSuperAdmin()`判定時のデバッグログ（userProfileなし）
- Line 388-396: `isSuperAdmin()`判定時のデバッグログ（判定結果）

**デバッグログの目的**:
- Phase 22のE2Eテスト失敗原因調査のため
- `isSuperAdmin()`の評価ロジックを追跡
- `userProfile.facilities`の内容を追跡

**ログ例**:
```typescript
console.log('[Phase 21 Debug] AuthContext: setLoading(false) - Authentication state loaded', {
  currentUser: user?.uid || null,
  userProfileExists: !!userProfile,
  selectedFacilityId,
});

console.log('[Phase 21 Debug] AuthContext.isSuperAdmin():', result, {
  userId: userProfile.userId,
  facilities: userProfile.facilities.map(f => ({ facilityId: f.facilityId, role: f.role })),
});
```

---

### 6. src/pages/Forbidden.tsx - Phase 21 UI改善

**変更箇所**:
- Line 10: `export default`に変更（`export function`から）
- Line 19: 見出しテキスト変更（「アクセスが拒否されました」→「アクセス権限がありません」）
- Line 37-39: 管理者連絡メッセージ追加

**UI改善**:
```typescript
<p className="text-sm text-gray-600 mt-4">
  アクセス権限が必要な場合は、管理者に連絡してください。
</p>
```

**変更理由**:
- ユーザーフレンドリーなメッセージに改善
- E2Eテストのアサーションで期待されるメッセージに統一

---

## 影響分析

### Phase 20: ログアウト機能
- ✅ **機能完全性**: ログアウト機能が完全に実装された
- ✅ **UIの一貫性**: ユーザー名表示とログアウトボタンがヘッダーに統合
- ✅ **ルーティング**: ログアウト後の遷移が適切に実装

### Phase 21: デバッグログ追加
- ✅ **E2Eテストのデバッグ性向上**: 失敗原因の特定が容易に
- ⚠️ **本番環境への影響**: デバッグログが本番環境でも出力される
  - **推奨**: 本番環境ではデバッグログを無効化するための環境変数制御を追加
  - **今後の対応**: `import.meta.env.MODE === 'development'` で条件分岐

### E2Eテストヘルパー改善
- ✅ **テストの信頼性向上**: Firestore Security Rulesに準拠したテストデータ作成
- ✅ **保守性向上**: 2段階アプローチのコメント化により、将来のメンテナンスが容易

---

## コミット推奨事項

### コミットメッセージ案

```bash
feat(phase20-21): ログアウト機能追加・E2Eテスト改善・デバッグログ追加

Phase 20:
- ログアウト機能実装 (App.tsx)
- ヘッダーにユーザー名表示追加
- ログアウトボタンUI追加

Phase 21:
- AdminProtectedRouteデバッグログ追加
- AuthContextデバッグログ追加
- Forbiddenページメッセージ改善

E2Eテスト改善:
- auth-flow.spec.ts: Phase 20実装に合わせたアサーション修正
- auth-helper.ts: Firestore Security Rules準拠の2段階ドキュメント作成
- facilities配列のテストデータ改善

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 今後の対応推奨

### 1. 本番環境でのデバッグログ無効化（優先度: 中）

```typescript
// AdminProtectedRoute.tsx, AuthContext.tsx
const isDevelopment = import.meta.env.MODE === 'development';

if (isDevelopment) {
  console.log('[Phase 21 Debug] ...');
}
```

### 2. Phase 22統合テスト再実行（優先度: 高）

これらの変更をコミット後、Phase 22の統合テストを再実行し、E2Eテストの成功率を確認する。

### 3. Phase 20-21完了ドキュメント作成（優先度: 高）

Phase 20-21の完了状況を包括的にドキュメント化する。

---

## 関連ドキュメント

- [Phase 20完了記録](.kiro/specs/auth-data-persistence/phase20-completion-2025-11-14.md)
- [Phase 21完了記録](.kiro/specs/auth-data-persistence/phase21-completion-2025-11-14.md)
- [Phase 22進捗記録](.kiro/specs/auth-data-persistence/phase22-progress-2025-11-14.md)
- [Phase 22統合テスト結果](.kiro/specs/auth-data-persistence/phase22-integration-test-results-2025-11-15.md)

---

**記録者**: Claude Code
**記録日時**: 2025-11-15
