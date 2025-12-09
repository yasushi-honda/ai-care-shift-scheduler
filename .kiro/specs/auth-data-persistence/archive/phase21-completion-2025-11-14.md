# Phase 21: RBAC Redirect Logic Debugging - 完了レポート

**作成日**: 2025-11-14
**仕様ID**: auth-data-persistence
**Phase**: Phase 21
**ステータス**: ✅ 完了・検証済み

## 概要

Phase 20で発見された最高優先度の問題「RBAC redirect logic debugging」に対応。super-admin権限を持たないユーザーが管理画面にアクセスしても `/forbidden` にリダイレクトされない問題を、デバッグログ追加とE2Eテスト修正により解決しました。

## 問題の背景

Phase 20完了時に発見された問題：
- super-admin以外のユーザーが `/admin` にアクセスしてもURLが `/admin` のまま変わらない
- AdminProtectedRouteのリダイレクトロジックが機能していない可能性

## 実施内容

### 1. デバッグログの追加

#### AuthContext.tsx
- **箇所**: Lines 222-228, 232-234, 381-401
- **内容**:
  - `setLoading(false)` 実行時のデバッグログ追加
  - `isSuperAdmin()` 関数内での判定結果ログ出力
  - facilities情報の詳細表示

```typescript
// 例: isSuperAdmin()のデバッグログ
console.log('[Phase 21 Debug] AuthContext.isSuperAdmin():', result, {
  userId: userProfile.userId,
  facilities: userProfile.facilities.map(f => ({ facilityId: f.facilityId, role: f.role })),
});
```

#### AdminProtectedRoute.tsx
- **箇所**: Lines 18-22, 25-26, 39-41, 45-46
- **内容**:
  - コンポーネントレンダリング時の状態ログ
  - loading中の表示ログ
  - `/forbidden`へのリダイレクト時のログ
  - 子コンポーネント表示時のログ

```typescript
// 例: リダイレクト時のログ
console.log('[Phase 21 Debug] AdminProtectedRoute: Redirecting to /forbidden (isSuperAdmin=false)');
```

### 2. E2Eテストのブラウザコンソールログキャプチャ追加

#### auth-flow.spec.ts
- **箇所**: Lines 96-102 (Test 1), Console log capture setup
- **内容**: Playwrightでブラウザコンソールログをキャプチャしてターミナルに表示

```typescript
page.on('console', (msg) => {
  const text = msg.text();
  console.log(`[Browser Console ${msg.type()}] ${text}`);
});
```

### 3. 根本原因の特定とE2Eテスト修正

#### 発見された問題
1. **ネストされたルート保護構造**: `<ProtectedRoute><AdminProtectedRoute>`
2. **ProtectedRoute  の早期リターン**: `!userProfile` または `facilities.length === 0` で NoAccessPage 表示
3. **テスト設計の問題**: 元のテストがroleもfacilitiesも指定せず、ProtectedRouteでブロックされていた

#### 修正内容 - auth-flow.spec.ts
- **箇所**: Lines 104-112, 126-132
- **修正前**: roleもfacilitiesも指定しないユーザー（`facilities: []`）
- **修正後**: viewer/editorロールでfacilities指定あり

```typescript
// Test 1: viewerロールユーザー
await setupAuthenticatedUser(page, {
  email: 'viewer-user@example.com',
  password: 'password123',
  displayName: 'Viewer User',
  facilities: [{ facilityId: 'test-facility-001', role: 'viewer' }],
});

// Test 2: editorロールユーザー
await setupAuthenticatedUser(page, {
  email: 'editor-user@example.com',
  password: 'password123',
  displayName: 'Editor User',
  facilities: [{ facilityId: 'test-facility-002', role: 'editor' }],
});
```

### 4. 追加発見問題の修正

#### 問題1: Forbiddenページの Lazy Loading エラー
- **発見**: `TypeError: Cannot convert object to primitive value at lazyInitializer`
- **原因**: Forbidden.tsxが`named export`だが、`React.lazy()`は`default export`を期待
- **修正**: src/pages/Forbidden.tsx Line 10

```typescript
// 修正前
export function Forbidden(): React.ReactElement {

// 修正後
export default function Forbidden(): React.ReactElement {
```

#### 問題2: Forbiddenページ見出しテキスト不一致
- **発見**: テスト期待値「アクセス権限がありません」vs 実装「アクセスが拒否されました」
- **修正**: src/pages/Forbidden.tsx Lines 18-20

```typescript
// 修正前
<h1 className="text-2xl font-semibold text-gray-900 mb-2">
  アクセスが拒否されました
</h1>

// 修正後
<h1 className="text-2xl font-semibold text-gray-900 mb-2">
  アクセス権限がありません
</h1>
```

### 5. auth-helper.tsのタイミング調整

- **箇所**: Lines 418-420
- **内容**: Firestoreドキュメント作成後の待機時間追加（1500ms）
- **理由**: ページ遷移前にFirestoreの書き込みが確実にコミットされることを保証

## 検証結果

### E2Eテスト結果
```
✓ 1 passed (8.0s)
```

**テストシナリオ**: 認証フロー - アクセス権限なし画面（Emulator） › アクセス権限がない場合、Forbiddenページが表示される

**確認項目**:
- ✅ viewer-user@example.comでログイン成功
- ✅ Firestoreユーザードキュメント作成成功（Step 1 & 2）
- ✅ AdminProtectedRouteレンダリング成功
- ✅ `isSuperAdmin()` = false（viewerロールのため）
- ✅ `/forbidden`へのリダイレクト成功
- ✅ Forbiddenページの正常表示
- ✅ 見出し「アクセス権限がありません」の表示確認

### デバッグログ確認

**重要なログポイント**:
```
[Phase 21 Debug] AdminProtectedRoute rendering: {loading: false, isSuperAdminResult: false}
[Phase 21 Debug] AuthContext.isSuperAdmin(): false {userId: ..., facilities: Array(1)}
[Phase 21 Debug] AdminProtectedRoute: Redirecting to /forbidden (isSuperAdmin=false)
```

- AdminProtectedRouteが正常にレンダリングされている
- isSuperAdmin()が正しくfalseを返している
- `/forbidden`へのリダイレクトが実行されている

## ファイル変更サマリー

### 修正ファイル
1. **src/contexts/AuthContext.tsx** - デバッグログ追加
2. **src/components/AdminProtectedRoute.tsx** - デバッグログ追加
3. **e2e/auth-flow.spec.ts** - コンソールログキャプチャ、テストシナリオ修正
4. **e2e/helpers/auth-helper.ts** - Firestoreドキュメント作成後の待機時間追加
5. **src/pages/Forbidden.tsx** - default export化、見出しテキスト修正

### 変更行数
- **追加**: 約60行（デバッグログ含む）
- **修正**: 約10行
- **削除**: 0行

## 学び・振り返り

### 成功要因
1. **体系的なデバッグアプローチ**: ログ追加 → テスト実行 → ログ分析 → 根本原因特定
2. **ルート構造の理解**: ネストされた保護ルートの動作フロー把握
3. **テスト設計の見直し**: 実際のRBACシナリオに合わせたテストケース作成

### 技術的発見
1. **React.lazy()のexport要件**: default exportが必要
2. **ネストされたルート保護**: ProtectedRoute → AdminProtectedRouteの順序が重要
3. **Firestore書き込みタイミング**: ページ遷移前の待機時間が必要

### 改善ポイント
1. **デバッグログの整理**: 本番環境では不要なログを削除またはフラグ管理
2. **テストカバレッジ**: 他のロール（admin, editorなど）のテストケース追加検討
3. **エラーメッセージの統一**: UI上のテキストとテストの期待値を一致させる

## 次のステップ（Phase 22推奨）

Phase 20完了ドキュメントで推奨された残りの優先事項：

### 1. Phase 22: Invite Flow Completion（高優先度）
- **内容**: 招待フローの実装とテスト完了
- **関連ファイル**: InviteAccept.tsx, AdminLayout.tsx
- **推奨理由**: ユーザー管理機能の完全性

### 2. Phase 23: UI Improvements（中優先度）
- **内容**: Phase 20で特定されたUI改善項目の実装
  - Forbidden.tsxの最終調整
  - AccessControl.tsxのUI改善
- **推奨理由**: ユーザーエクスペリエンス向上

### 3. Phase 24: Debug Logs Cleanup（低優先度）
- **内容**: Phase 21で追加したデバッグログの整理
  - 本番環境用のログレベル管理
  - 環境変数によるデバッグログ切り替え
- **推奨理由**: コードの保守性向上

## 関連ドキュメント

- [Phase 20完了レポート](.kiro/specs/auth-data-persistence/phase20-completion-2025-11-14.md)
- [Phase 19完了レポート](.kiro/specs/auth-data-persistence/phase19-completion-2025-11-14.md)
- [Development Status (2025-11-14)](.kiro/development-status-2025-11-14.md)

## 承認

- **実装者**: Claude Code (AI Assistant)
- **検証**: E2E Test Passed (2025-11-14)
- **ステータス**: ✅ Phase 21 完了・検証済み
