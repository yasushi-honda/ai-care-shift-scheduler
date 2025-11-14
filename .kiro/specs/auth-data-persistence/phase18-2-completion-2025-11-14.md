# Phase 18-2: Firebase Admin SDK導入とCustom Claims設定修正 - 完了報告

**更新日**: 2025-11-14
**仕様ID**: auth-data-persistence
**Phase**: 18-2
**ステータス**: ✅ 完了（Emulator認証・Custom Claims成功）

## 概要

Phase 18-1で失敗したCustom Claims設定を、Firebase Admin SDK使用に変更して修正しました。また、ブラウザコンテキストでの動的インポート問題を解決し、Emulator認証に成功しました。

## Phase 18-2の目的

1. ✅ Firebase Admin SDKインストール
2. ✅ `setEmulatorCustomClaims`関数をAdmin SDK使用に変更
3. ✅ スモークテスト成功確認（認証・Custom Claims）
4. ⏸️ E2Eテスト全体実行（次フェーズへ持ち越し）

## 実施内容

### Step 1: Firebase Admin SDKインストール（✅ 完了）

**実施コマンド**:
```bash
npm install --save-dev firebase-admin
```

**結果**: ✅ 成功
- firebase-admin@13.0.2インストール完了

---

### Step 2: Admin SDK初期化方針検討（✅ 完了）

**検討した方式**:

#### 方式A: Global Setup（`e2e/global-setup.ts`）で初期化
- **メリット**: テスト実行前に一度だけ初期化
- **デメリット**: モジュール間で変数共有が困難（ESモジュールの制約）

**試行結果**: ❌ 失敗
- `export let adminAuth`で公開しても、`auth-helper.ts`からインポート時に`null`になる
- `export function getAdminAuth()`経由でも同様の問題

#### 方式B: Auth Helper内で直接初期化（採用）
- **メリット**: モジュール依存関係の問題を回避
- **デメリット**: 初回呼び出し時に初期化処理が発生

**実装**(`e2e/helpers/auth-helper.ts:21-38`):
```typescript
function initializeAdminSDK(): void {
  if (adminInitialized) {
    return;
  }

  // Admin SDKが既に初期化されている場合はスキップ
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'ai-care-shift-scheduler',
    });
  }

  // Emulator環境設定
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

  adminInitialized = true;
  console.log('🔧 Firebase Admin SDK初期化完了（auth-helper内）');
}
```

**結果**: ✅ 採用

---

### Step 3: `setEmulatorCustomClaims`関数修正（✅ 完了）

**変更前**（Phase 17-1実装、REST API使用）:
```typescript
// Firebase Auth Emulator専用エンドポイント
const response = await fetch(
  `http://localhost:9099/emulator/v1/projects/ai-care-shift-scheduler/accounts/${uid}`,
  {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customClaims: JSON.stringify(customClaims),
    }),
  }
);
```

**エラー**: `404 Not Found` - エンドポイント不存在

**変更後**（Phase 18-2実装、Admin SDK使用）:
```typescript
try {
  // Admin SDK初期化（未初期化の場合のみ）
  initializeAdminSDK();

  // Admin SDK経由でCustom Claims設定
  await admin.auth().setCustomUserClaims(uid, customClaims);

  console.log(`✅ Custom Claims設定成功: UID=${uid}`);
} catch (error: any) {
  console.error(`❌ Custom Claims設定失敗: ${error.message}`);
  throw new Error(`Failed to set custom claims: ${error.message}`);
}
```

**結果**: ✅ 成功
```
🔧 Firebase Admin SDK初期化完了（auth-helper内）
✅ Custom Claims設定成功: UID=nCMuskGRF2u4rqiCfyhxX0SzUvr6
```

---

### Step 4: ブラウザコンソールログキャプチャ追加（✅ 完了）

**実施内容**: `e2e/auth-flow.spec.ts`にconsoleイベントリスナー追加

**変更箇所**(`e2e/auth-flow.spec.ts:43-49`):
```typescript
// Phase 18-2: ブラウザコンソールログキャプチャ
const consoleMessages: string[] = [];
page.on('console', (msg) => {
  const text = msg.text();
  consoleMessages.push(`[${msg.type()}] ${text}`);
  console.log(`[Browser Console ${msg.type()}] ${text}`);
});
```

**結果**: ✅ 成功 - ブラウザ内エラーを詳細に把握できるようになった

---

### Step 5: 動的インポート問題の特定（✅ 完了）

**実施コマンド**:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e -- auth-flow.spec.ts:42
```

**検出されたエラー**:
```
[Browser Console error] ❌ Emulator認証失敗: Failed to resolve module specifier 'firebase/auth'
```

**問題箇所**: `e2e/helpers/auth-helper.ts:127`
```typescript
const authModule = await import('firebase/auth');
```

**原因**: `page.evaluate()`内ではブラウザコンテキストのため、モジュール解決ができない

---

### Step 6: グローバルオブジェクト経由の認証実装（✅ 完了）

#### 修正1: `firebase.ts`に`signInWithEmailAndPassword`をグローバル公開

**変更箇所1**(`firebase.ts:2`):
```typescript
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
```

**変更箇所2**(`firebase.ts:90-96`):
```typescript
// Phase 18.2 Step 6: signInWithEmailAndPasswordもグローバルに公開
(window as any).__firebaseSignInWithEmailAndPassword = signInWithEmailAndPassword;
console.log('✅ [Firebase Debug] グローバルオブジェクト公開成功:', {
  hasAuth: !!(window as any).__firebaseAuth,
  hasDb: !!(window as any).__firebaseDb,
  hasSignIn: !!(window as any).__firebaseSignInWithEmailAndPassword,
});
```

#### 修正2: `auth-helper.ts`で動的インポートを削除

**変更前**(`e2e/helpers/auth-helper.ts:124-129`):
```typescript
// Firebase Auth SDKのsignInWithEmailAndPasswordを動的インポート
console.log('🔍 [Auth Debug] Firebase Auth SDK動的インポート開始');
const authModule = await import('firebase/auth');
const { signInWithEmailAndPassword } = authModule;
console.log('✅ [Auth Debug] Firebase Auth SDK動的インポート成功');
```

**変更後**(`e2e/helpers/auth-helper.ts:124-134`):
```typescript
// Phase 18.2 Step 6: グローバルオブジェクトからsignInWithEmailAndPasswordを取得
// firebase.tsでグローバルに公開された関数を使用
console.log('🔍 [Auth Debug] Firebase Auth SDK関数取得開始');
const signInWithEmailAndPassword = (window as any).__firebaseSignInWithEmailAndPassword;

if (!signInWithEmailAndPassword) {
  console.error('❌ signInWithEmailAndPassword がグローバルオブジェクトに存在しません');
  console.error('🔍 [Auth Debug] window.__firebaseSignInWithEmailAndPassword is undefined');
  return false;
}
console.log('✅ [Auth Debug] Firebase Auth SDK関数取得成功');
```

**結果**: ✅ 成功

---

### Step 7: 最終スモークテスト実行（✅ 成功）

**実施コマンド**:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e -- auth-flow.spec.ts:42
```

**テスト結果**:

#### ✅ 成功した部分（Phase 18-2の目標）
1. ✅ **Custom Claims設定成功**
```
✅ Custom Claims設定成功: UID=nCMuskGRF2u4rqiCfyhxX0SzUvr6
```

2. ✅ **Emulator認証成功**
```
✅ [Firebase Debug] グローバルオブジェクト公開成功: {hasAuth: true, hasDb: true, hasSignIn: true}
✅ [Auth Debug] Firebase Auth取得成功
✅ [Auth Debug] Firebase Auth SDK関数取得成功
✅ Emulator認証成功: test-user@example.com (UID: nCMuskGRF2u4rqiCfyhxX0SzUvr6)
```

#### ⚠️ テスト失敗の理由（Phase 18-2範囲外）
```
Error: expect(locator).toBeVisible() failed
Locator: getByText(/Test User/)
Expected: visible
```

**失敗原因**: Firestoreにユーザードキュメントが存在しない
```
⚠️ User document does not exist for UID: nCMuskGRF2u4rqiCfyhxX0SzUvr6
This may happen if:
1. User just logged in and Cloud Function has not created the document yet
2. User was deleted from Firestore but still exists in Authentication
3. There was an error during user creation
```

**評価**: Phase 18-2の範囲外。Emulator環境にはCloud Functionがないため、ユーザードキュメントが自動作成されません。これは次フェーズ（Phase 19またはPhase 14追加作業）で対応します。

---

## Phase 18-2の成果まとめ

### ✅ 達成した目標

1. **Firebase Admin SDK導入成功**
   - `firebase-admin@13.0.2`インストール
   - Auth Helper内での初期化実装

2. **Custom Claims設定修正成功**
   - REST API（404エラー）→ Admin SDK（成功）
   - 確実にCustom Claimsを設定できる仕組みを確立

3. **ブラウザコンテキスト動的インポート問題解決**
   - `import('firebase/auth')` → グローバルオブジェクト使用
   - `window.__firebaseSignInWithEmailAndPassword`経由でログイン

4. **Emulator認証成功**
   - ブラウザ内Firebase SDK認証が正常に動作
   - Custom Claimsも正しく設定された状態で認証完了

### ⏸️ 次フェーズへ持ち越し

- **E2Eテスト全体実行**: Firestoreユーザードキュメント作成の仕組みが必要
- **テストデータ整備**: Emulator環境用のデモデータ作成スクリプト

---

## 修正ファイル一覧

### 修正ファイル

1. **`firebase.ts`**
   - **修正箇所1**: 行2（`signInWithEmailAndPassword`インポート追加）
   - **修正箇所2**: 行90-96（グローバルオブジェクト公開）
   - **ステータス**: ✅ 完了

2. **`e2e/helpers/auth-helper.ts`**
   - **修正箇所1**: 行10-38（Admin SDK初期化関数追加）
   - **修正箇所2**: 行124-134（動的インポート削除、グローバルオブジェクト使用）
   - **修正箇所3**: 行245-263（`setEmulatorCustomClaims`関数をAdmin SDK使用に変更）
   - **ステータス**: ✅ 完了

3. **`e2e/auth-flow.spec.ts`**
   - **修正箇所**: 行43-49（ブラウザコンソールログキャプチャ追加）
   - **ステータス**: ✅ 完了

4. **`e2e/global-setup.ts`**
   - **修正箇所**: 行10-23（Admin SDK初期化追加、後に使用中止）
   - **ステータス**: ⚠️ 使用中止（方式Bを採用）

---

## 学び・振り返り

### 成功要因

1. **段階的デバッグアプローチ**
   - ブラウザコンソールログキャプチャにより、問題を正確に特定
   - Phase 18-1 → 18-2と、問題を分割して解決

2. **公式SDK活用**
   - REST API仕様の不確実性を回避
   - Firebase Admin SDKで確実に動作

3. **ドキュメントドリブン開発**
   - 進行状況ドキュメントにより、問題点と解決策を明確に記録
   - 振り返りと次のセッションへの引き継ぎが容易

### 失敗から学んだこと

1. **ESモジュール変数共有の理解**
   - Global Setupでの変数エクスポートは、他モジュールから参照できない
   - 各モジュールでの直接初期化が確実

2. **ブラウザコンテキストの制約**
   - `page.evaluate()`内では動的インポートが使用できない
   - グローバルオブジェクト経由でのアクセスが必要

3. **テスト範囲の明確化**
   - Phase 18-2の目標は「Emulator認証成功」であり、UI表示は範囲外
   - 目標を明確にすることで、成功/失敗を正しく評価

### 今後の改善策

1. **テストデータ作成スクリプト**
   - Emulator環境用のFirestoreデモデータ作成
   - `setupAuthenticatedUser`でユーザードキュメントも作成

2. **E2Eテストの段階的実装**
   - 認証テスト（Phase 18-2完了）
   - UI表示テスト（次フェーズ）
   - RBAC権限テスト（次フェーズ）

3. **ドキュメント駆動の継続**
   - 各フェーズで進行状況・完了ドキュメントを作成
   - 問題・解決策・学びを明確に記録

---

## 推奨される次のステップ

### Option A: Phase 19 - E2Eテスト用Firestoreデータ作成（推奨）

**目的**: Emulator環境でE2Eテストが完全に動作するようにする

**実施内容**:
1. `setupAuthenticatedUser`関数を拡張し、Firestoreにユーザードキュメントも作成
2. E2Eテスト全体実行（6テスト）
3. テスト失敗箇所の修正
4. 全テスト成功確認

**推定時間**: 2-3時間

### Option B: Phase 14追加作業 - デモデータ作成スクリプト

**目的**: Emulator環境用の包括的なデモデータ作成

**実施内容**:
1. `e2e/scripts/create-demo-data.ts`作成
2. Users, Facilities, Staff, Shiftsのデモデータ投入
3. E2Eテストから使用

**推定時間**: 3-4時間

---

## タイムライン

| 時刻 | イベント |
|------|---------|
| 06:05 | Phase 18-2開始 |
| 06:08 | Firebase Admin SDKインストール完了 |
| 06:10 | Global Setup方式試行（失敗） |
| 06:15 | Auth Helper内初期化方式に切り替え |
| 06:17 | `setEmulatorCustomClaims`関数修正完了 |
| 06:20 | スモークテスト実行 - Custom Claims成功確認 |
| 06:22 | Emulator認証失敗確認、原因調査開始 |
| 06:30 | ブラウザコンソールログキャプチャ追加 |
| 06:35 | 動的インポート問題を特定 |
| 06:40 | `firebase.ts`修正完了 |
| 06:45 | `auth-helper.ts`修正完了 |
| 06:50 | 最終スモークテスト実行 - **Emulator認証成功！** |
| 07:00 | Phase 18-2完了ドキュメント作成 |

---

**更新日時**: 2025-11-14 17:00 JST
**ステータス**: ✅ Phase 18-2完了（Emulator認証・Custom Claims成功）
**次のアクション**: Option A（Phase 19: E2Eテスト用Firestoreデータ作成）を推奨

---

## 関連ドキュメント

- [Phase 18-1完了サマリー](.kiro/specs/auth-data-persistence/phase18-1-completion-summary-2025-11-14.md)
- [Phase 18-2進行状況](.kiro/specs/auth-data-persistence/phase18-2-progress-2025-11-14.md)
- [Phase 17-1完了サマリー](.kiro/specs/auth-data-persistence/phase17-1-completion-summary-2025-11-14.md)
