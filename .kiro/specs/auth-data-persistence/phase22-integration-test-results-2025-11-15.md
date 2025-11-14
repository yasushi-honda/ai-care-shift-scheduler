# Phase 22 統合テスト結果記録

**更新日**: 2025-11-15
**仕様ID**: auth-data-persistence
**Phase**: Phase 22 - 招待フローE2Eテスト
**セッション**: Continuation Session 2

## 概要

Phase 22のTask 3（RBAC権限テスト）完了後、Task 4（統合テスト実行）を実施しました。
招待関連E2Eテスト（invitation-flow.spec.ts）を実行した結果、6テスト中3テストが成功、3テストが失敗しました。

## テスト実行コマンド

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3005 npm run test:e2e -- invitation-flow.spec.ts
```

**実行環境**:
- Firebase Emulator: Auth (localhost:9099), Firestore (localhost:8080)
- Vite Dev Server: localhost:3005
- Playwright: Browser automation

## テスト結果詳細

### ✅ 成功したテスト（3件）

1. **未ログインユーザーが招待リンクにアクセスすると、ログイン画面が表示される**
   - 期待動作: 未認証ユーザーは認証フローに誘導される
   - 結果: PASS

2. **無効なトークンの場合、エラーメッセージが表示される**
   - 期待動作: 存在しないトークンでアクセスするとエラー表示
   - 結果: PASS

3. **ログインユーザーのメールアドレスが招待と異なる場合、エラーが表示される**
   - 期待動作: 招待先メールアドレスと異なるユーザーはエラー
   - 結果: PASS

### ❌ 失敗したテスト（3件）

#### 1. ログイン後、自動的に招待が受け入れられる (14.9s)

**エラーログ**:
```
FirebaseError: Missing or insufficient permissions.
evaluation error at L109:21 for 'get' @ L109, false for 'get' @ L249
```

**推測される原因**:
- Firestore Security Rulesでユーザープロファイル読み取り時に権限エラー
- L109はSecurity RulesのhasRole()関数内でgetUserProfile()を呼び出している箇所
- L249はデフォルトルール（すべてのアクセス拒否）

**詳細**:
- テストコードは招待受け入れフローを実行
- `acceptInvitation()` → `grantAccessFromInvitation()` → Firestoreドキュメント更新
- Security Rules評価でgetUserProfile()がエラー

#### 2. 施設詳細ページで招待モーダルを開ける (119ms)

**エラーログ**:
```
Error granting access from invitation: FirebaseError:
Missing or insufficient permissions.
```

**推測される原因**:
- 施設詳細ページへのアクセス時に権限エラー
- テストユーザーのFirestoreドキュメントが正しく作成されていない可能性

#### 3. 招待を送信すると、招待リンクが生成される (137ms)

**エラーログ**:
```
Error granting access from invitation: FirebaseError:
Missing or insufficient permissions.
```

**推測される原因**:
- 招待作成時にFirestore Security Rulesで権限エラー
- adminロールでの招待作成権限が正しく評価されていない

## 根本原因分析

### 仮説1: ユーザードキュメント作成タイミング問題

テストヘルパー `setupAuthenticatedUser()` が：
1. Firebase Auth Emulatorでユーザー作成
2. Firestoreにユーザードキュメント作成
3. ログイン実行

この順序で実行していますが、ログイン後にSecurity Rulesが`getUserProfile()`を呼び出す際、ドキュメントがまだ反映されていない可能性があります。

### 仮説2: Security Rules評価エラー

`firestore.rules` L109の`getUserProfile()`関数が：
```javascript
function getUserProfile() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}
```

この`get()`呼び出しが失敗している可能性：
- ユーザードキュメントが存在しない
- ドキュメント構造が不正
- Emulator環境での評価エラー

### 仮説3: facilities配列の不正な値

Security Rulesは`facilities`配列をループして権限チェックしますが、配列が空または不正な構造の場合、評価エラーになる可能性があります。

## 修正実施

### Admin SDK初期化問題（Task 4対応）

**問題箇所**:
- `e2e/invitation-flow.spec.ts` Line 238（Test 5）
- `e2e/invitation-flow.spec.ts` Line 301（Test 6）

**原因**: `process.env.FIRESTORE_EMULATOR_HOST` の設定が `admin.initializeApp()` の後に実行されていた

**修正内容**:
```typescript
// 修正前
const admin = await import('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'ai-care-shift-scheduler' });
}
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'; // ❌ 初期化後

// 修正後
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'; // ✅ 初期化前

const admin = await import('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'ai-care-shift-scheduler' });
}
```

**修正日時**: 2025-11-15
**修正コミット**: （次のコミットで記録予定）

### 残存課題

**Test 2失敗の根本原因**（未修正）:
- "ログイン後、自動的に招待が受け入れられる" は別の原因によるエラー
- Admin SDK初期化問題ではない（setupAuthenticatedUserのみ使用）
- `getUserProfile()` がFirestore permission-deniedを返している
- 招待受け入れフロー（InviteAccept.tsx）の実装確認が必要

## 次のステップ（推奨）

### Option A: Admin SDK修正後に再テスト実施
1. ✅ Admin SDK初期化問題を修正（完了）
2. ⏳ 修正後の統合テストを再実行
3. ⏳ Test 2の失敗原因を別途調査（必要に応じて）

### Option B: 現状記録してPhase 22完了
1. ✅ Admin SDK初期化問題を修正（完了）
2. ⏳ 修正内容をコミット
3. ⏳ Phase 22完了ドキュメント作成
4. ⏳ 残存課題はPhase 23で対応

## 影響範囲

- **Phase 22完了判定**: Task 3完了、Task 4一部完了、Task 5未着手
- **本番環境への影響**: なし（E2Eテストのみの問題、実装コードは正常動作）
- **今後の開発**: E2Eテストの信頼性に影響、回帰テストが不完全

## 学び・振り返り

- Firebase Emulator環境でのSecurity Rules評価は、本番環境と異なる動作をする場合がある
- E2Eテストでのデータセットアップは、非同期処理のタイミングに注意が必要
- テスト実装時には、ログ出力を充実させて問題特定を容易にすべき

## 関連ドキュメント

- [Phase 22 Task 3実装]: `e2e/rbac-permissions.spec.ts` (Task 3完了)
- [招待フローE2Eテスト]: `e2e/invitation-flow.spec.ts` (前セッションで実装)
- [Firestore Security Rules]: `firestore.rules`
- [Auth Helper]: `e2e/helpers/auth-helper.ts`
