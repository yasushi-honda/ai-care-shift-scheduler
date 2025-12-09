# Phase 18-2: Firebase Admin SDK導入とCustom Claims設定修正 - 進行状況

**更新日**: 2025-11-14
**仕様ID**: auth-data-persistence
**Phase**: 18-2
**ステータス**: 🔄 進行中（Custom Claims成功、Emulator認証調査中）

## 概要

Phase 18-1で失敗したCustom Claims設定を、Firebase Admin SDK使用に変更して修正する。

## Phase 18-2の目的

1. ✅ Firebase Admin SDKインストール
2. ✅ `setEmulatorCustomClaims`関数をAdmin SDK使用に変更
3. ⏳ スモークテスト成功確認
4. ⏳ E2Eテスト全体実行（6テスト）

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
✅ Custom Claims設定成功: UID=SPVBShLnJ93O9nFeVvt8Xe09A1vC
```

---

### Step 4: スモークテスト実行（⚠️ 部分成功）

**実施コマンド**:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e -- auth-flow.spec.ts:42
```

**テスト内容**: auth-flow.spec.ts - "認証後、ユーザー名が表示される"

**結果**: ⚠️ **部分成功**

#### 成功した部分
1. ✅ Emulator環境検出
2. ✅ Auth Emulator クリーンアップ
3. ✅ Emulatorユーザー作成（test-user@example.com）
4. ✅ **Custom Claims設定成功** ← **重要な進展**
5. ✅ ページアクセス成功（「Googleでログイン」ボタン表示）

#### 失敗した部分
❌ Emulator認証（ブラウザ内Firebase SDK認証）

**エラー内容**:
```
Error: Emulator認証に失敗しました: test-user@example.com
  at signInWithEmulator (auth-helper.ts:152)
```

**エラーコンテキスト**:
- ページは「Googleでログイン」ボタンを表示したまま
- Firebase SDK認証が実行されず、ログインページから先に進めない

---

## 問題分析

### Custom Claims設定: ✅ 解決

**Phase 17-1の問題**:
- REST API `/emulator/v1/projects/.../accounts/${uid}` (PATCH)
- エラー: `404 Not Found`

**Phase 18-2の解決策**:
- Firebase Admin SDK使用: `admin.auth().setCustomUserClaims(uid, customClaims)`
- 結果: **成功**

### Emulator認証: ❌ 未解決

**問題箇所**: `e2e/helpers/auth-helper.ts` の `signInWithEmulator`関数（行55-152）

**処理フロー**:
1. ✅ REST APIでテストユーザー作成
2. ✅ ページに移動（`page.goto('/')

`）
3. ❌ `page.evaluate()`内でFirebase SDKログイン実行

**推定される原因**（Phase 18.2 Step 6デバッグログより）:
- `window.__firebaseAuth`が未定義
- または、Firebase Auth SDKの動的インポート失敗
- または、Emulator接続設定の問題

**次のステップ**:
- ブラウザコンソールログをキャプチャして詳細確認
- Phase 18-1進行状況ドキュメントのStep 6トラブルシューティング参照

---

## 修正ファイル一覧

### 修正ファイル

1. **`e2e/helpers/auth-helper.ts`**
   - **修正箇所1**: 行10-38（Admin SDK初期化関数追加）
   - **修正箇所2**: 行245-263（`setEmulatorCustomClaims`関数をAdmin SDK使用に変更）
   - **ステータス**: ✅ Custom Claims設定成功、Emulator認証調査中

2. **`e2e/global-setup.ts`**
   - **修正箇所**: 行10-23（Admin SDK初期化追加、後に使用中止）
   - **ステータス**: ⚠️ 使用中止（方式Bを採用）

---

## 学び・振り返り

### 成功要因

1. **方針転換の柔軟性**: Global Setupでの初期化が失敗した際、Auth Helper内での直接初期化に切り替え
2. **Admin SDK活用**: REST API仕様の不確実性を回避し、公式SDKで確実に動作

### 失敗要因

1. **モジュール間変数共有の理解不足**: ESモジュールでの変数エクスポートの挙動を正確に理解していなかった
2. **ブラウザコンソールログ未確認**: `page.evaluate()`内のエラーをキャプチャしていない

### 今後の改善策

1. **ブラウザコンソールログキャプチャ**: Playwrightの`page.on('console', ...)`でログを取得
2. **段階的デバッグ**: 問題を小さく分割し、各段階で動作確認
3. **ドキュメント駆動**: 既存のトラブルシューティングドキュメント（Phase 18-1 Step 6）を活用

---

## 推奨される次のステップ

### Option A: ブラウザコンソールログキャプチャ（推奨）

**目的**: `signInWithEmulator`関数内のエラー詳細を確認

**実施内容**:
1. `auth-flow.spec.ts`にconsoleイベントリスナー追加
2. スモークテスト再実行
3. デバッグログから問題箇所特定
4. 修正後、E2Eテスト全体実行

**推定時間**: 1-2時間

### Option B: `signInWithEmulator`関数の簡略化

**目的**: 複雑なpage.evaluate()ロジックを簡素化

**実施内容**:
1. Firebase SDKの動的インポートを除去
2. グローバル変数`__firebaseAuth`の存在確認を強化
3. エラーハンドリング改善

**推定時間**: 30分-1時間

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
| 06:22 | Emulator認証失敗確認、原因調査中 |

---

**更新日時**: 2025-11-14 15:25 JST
**ステータス**: 🔄 進行中（Custom Claims成功、Emulator認証調査中）
**次のアクション**: Option A（ブラウザコンソールログキャプチャ）を推奨
