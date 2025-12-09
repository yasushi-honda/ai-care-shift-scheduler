# Phase 18-1: Emulator環境での自動テスト確認 - 完了サマリー

**更新日**: 2025-11-14
**仕様ID**: auth-data-persistence
**Phase**: 18-1
**ステータス**: ⚠️ 部分完了（インフラ整備成功、テスト実行失敗）

## エグゼクティブサマリー

Phase 18-1では、Firebase Emulator環境での自動E2Eテスト実行を目標としました。

**達成内容**:
- ✅ Java OpenJDK 25.0.1インストール成功
- ✅ Firebase Emulator（Auth + Firestore）起動成功
- ✅ 開発サーバー（Vite）ポート3001起動成功
- ✅ Custom Claims APIエンドポイント修正（部分的）

**未達成内容**:
- ❌ E2Eテスト全失敗（10/10失敗、5スキップ）
- ❌ Custom Claims API リクエストボディ形式未解決
- ❌ Firebase Emulator認証機能の動作確認未完了

**根本原因**: Phase 17-1で実装された`auth-helper.ts`の`setEmulatorCustomClaims`関数のREST APIリクエスト仕様が不正確。Firebase Auth Emulator REST APIのCustom Claims設定に関する公式ドキュメントが不足しており、試行錯誤が必要。

**推奨される次のステップ**: Phase 17実装の根本的見直し（Admin SDK使用への変更など）が必要。

---

## 実施内容の詳細

### Step 1: Java環境構築（✅ 成功）

**課題**: Firebase EmulatorがJava Runtimeを要求

**実施内容**:
```bash
# OpenJDK インストール
brew install openjdk

# PATH設定
echo 'export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"' >> ~/.zshrc

# 確認
java -version
# openjdk version "25.0.1" 2025-10-21
```

**結果**: ✅ OpenJDK 25.0.1インストール成功

**所要時間**: 約5分

---

### Step 2: Firebase Emulator起動（✅ 成功）

**実施内容**:
```bash
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH" && \
  firebase emulators:start --only auth,firestore
```

**結果**: ✅ Auth（9099） + Firestore（8080）起動成功

**Emulator UI**: http://127.0.0.1:4000/

**所要時間**: 約15秒（初回jarダウンロード含む）

---

### Step 3: Custom Claims API修正（⚠️ 部分成功）

**問題**: Phase 17-1実装のエンドポイントが不正確

**修正1 - エンドポイント変更**:

**変更前** (`e2e/helpers/auth-helper.ts:222`):
```typescript
const response = await fetch(
  `http://localhost:9099/emulator/v1/projects/ai-care-shift-scheduler/accounts/${uid}`,
  {
    method: 'PATCH',
    // ...
  }
);
```

**変更後**:
```typescript
const response = await fetch(
  'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=test-api-key',
  {
    method: 'POST',
    // ...
  }
);
```

**結果**: エンドポイントは修正できたが、リクエストボディ形式が未解決

---

**修正2 - リクエストボディ変更（❌ 失敗）**:

**変更後のリクエストボディ**:
```typescript
body: JSON.stringify({
  localId: uid,
  customAttributes: JSON.stringify(customClaims),
})
```

**エラー内容**:
```
Error: Failed to set custom claims: Bad Request - {
  "error": {
    "code": 400,
    "message": "INVALID_REQ_TYPE : Unsupported request parameters.",
    "errors": [
      {
        "message": "INVALID_REQ_TYPE : Unsupported request parameters.",
        "reason": "invalid",
        "domain": "global"
      }
    ]
  }
}
```

**問題分析**:
- エンドポイント `/identitytoolkit.googleapis.com/v1/accounts:update` は正しい可能性が高い
- しかし、リクエストボディのフィールド名・形式が不正確
- Firebase Auth Emulator REST APIの公式ドキュメントが不足しており、正確な仕様が不明
- `localId` + `customAttributes` の組み合わせが受け付けられていない

**試行すべき代替案**（未実施）:
1. `customAttribute` （単数形）に変更
2. `idToken`ベースのリクエストに変更
3. Firebase Admin SDK（Node.js）経由でCustom Claims設定
4. Emulator REST APIのOpenAPI仕様確認（存在する場合）

---

### Step 4: Viteポート設定変更（✅ 成功）

**問題**: 開発サーバーがポート5173で起動、テストは3001を期待

**実施内容** (`vite.config.ts:9`):
```typescript
server: {
  port: 3001,  // 5173 → 3001
  host: '0.0.0.0',
}
```

**結果**: ✅ ポート3001で起動成功

---

### Step 5: E2Eテスト再実行（❌ 失敗）

**実施内容**:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e -- auth-flow.spec.ts rbac-permissions.spec.ts
```

**結果**: 全テスト失敗（10/10失敗、5スキップ）

**失敗内訳**:

| テストファイル | 失敗テスト | 主な原因 |
|-------------|-----------|---------|
| auth-flow.spec.ts | 5/5失敗 | Custom Claims API失敗（3件）、Emulator認証失敗（2件） |
| rbac-permissions.spec.ts | 5/10失敗 | Custom Claims API失敗（2件）、Emulator認証失敗（1件）、UI要素未検出（2件） |

**エラーパターン**:

1. **Custom Claims API失敗（5件）**:
   ```
   Failed to set custom claims: Bad Request - INVALID_REQ_TYPE : Unsupported request parameters.
   ```

2. **Emulator認証失敗（3件）**:
   ```
   Emulator認証に失敗しました: no-permission@example.com
   ```

3. **UI要素未検出（2件）**:
   ```
   Expected: visible
   Timeout: 5000ms
   Error: element(s) not found
   ```

---

## Phase 17-1実装の根本的問題点

### 1. Firebase Auth Emulator REST API仕様の不正確性

**問題**:
- Phase 17-1実装時、Firebase Auth Emulator REST APIの仕様を正確に確認せずに実装
- `/emulator/v1/projects/{PROJECT_ID}/accounts/{UID}` エンドポイント（PATCH）は非公式または誤り
- 正しいエンドポイント `/identitytoolkit.googleapis.com/v1/accounts:update` に変更したが、リクエストボディ形式が未解決

**影響**:
- Custom Claims設定が全て失敗
- RBAC（Role-Based Access Control）のテストが実行不可能

### 2. 実装後の動作確認不足

**問題**:
- Phase 17-1完了時、実際のE2Eテスト実行で動作確認していない
- 「Phase 18-1で検証」と記載したが、Phase 17-1時点でスモークテストすべきだった

**影響**:
- Phase 18-1で問題発覚
- Phase 17-1の実装全体の見直しが必要に

### 3. Firebase Admin SDK未使用

**問題**:
- Custom Claims設定にREST APIを使用
- Firebase Admin SDKを使用すれば、公式サポートされた方法で確実に設定可能

**理由**:
- Admin SDKはNode.js環境が必要
- E2Eテスト（Playwright）はブラウザ環境で実行
- Global Setup/Teardownスクリプトで Admin SDKを使用する設計が必要

**推奨アプローチ**:
```typescript
// e2e/global-setup.ts（新規作成）
import admin from 'firebase-admin';

export default async function globalSetup() {
  // Admin SDK初期化
  admin.initializeApp({
    projectId: 'ai-care-shift-scheduler',
    // Emulator設定
  });

  // Custom Claims設定
  await admin.auth().setCustomUserClaims(uid, { role: 'super-admin' });
}
```

---

## 達成度評価

| 項目 | 目標 | 実績 | 評価 |
|------|------|------|------|
| **インフラ整備** | | | |
| Java環境構築 | OpenJDKインストール | OpenJDK 25.0.1 | ✅ 100% |
| Emulator起動 | Auth + Firestore起動 | 9099 + 8080起動 | ✅ 100% |
| 開発サーバー | ポート3001起動 | 3001起動成功 | ✅ 100% |
| **API修正** | | | |
| Endpointmodification | 正確なエンドポイント | `/accounts:update`に変更 | ⚠️ 50% |
| Request body修正 | 正確なリクエストボディ | 形式未解決 | ❌ 0% |
| **テスト実行** | | | |
| E2Eテスト成功 | 6テスト合格 | 0/6テスト合格 | ❌ 0% |

**総合評価**: ⚠️ **部分完了（インフラ40% + API修正25% + テスト0% = 合計約25%)**

---

## 学び・振り返り

### 成功要因

1. **Java環境構築**: Homebrewを使用したスムーズなインストール
2. **Emulator起動**: Java解決後は問題なく起動
3. **ポート設定**: Vite設定変更で開発サーバーとテストの統一成功

### 失敗要因

1. **API仕様確認不足**: Firebase Auth Emulator REST APIの公式ドキュメント不足
2. **試行錯誤不足**: リクエストボディ形式の複数パターン検証未実施
3. **Admin SDK未検討**: REST API固執、Admin SDK活用を検討せず
4. **Phase 17-1検証不足**: 実装後のスモークテスト未実施

### 今後の改善策

1. **Admin SDK活用**: Firebase Admin SDKを使用したCustom Claims設定に変更
2. **段階的検証**: 実装直後に最低1テストケースで動作確認
3. **公式ツール優先**: REST APIではなく、公式SDKを優先使用
4. **ドキュメント駆動**: 不明確な仕様は実装前にWeb検索・公式ドキュメント確認

---

## 推奨される次のステップ

### Option A: Phase 17実装の根本的見直し（推奨）

**目的**: Firebase Admin SDKを使用したCustom Claims設定に変更

**実施内容**:
1. `e2e/global-setup.ts`を作成し、Admin SDK初期化
2. `setEmulatorCustomClaims`関数をAdmin SDK使用に変更
3. Playwright設定で`globalSetup`を有効化
4. スモークテスト（1-2テスト）で動作確認
5. Phase 18-1再実施（6テスト実行）

**推定時間**: 2-3時間

**メリット**:
- 公式サポートされた方法で確実に動作
- REST API仕様の不確実性を回避
- メンテナンス性向上

**デメリット**:
- Admin SDK依存性追加
- Global Setupスクリプト追加

### Option B: REST API仕様の徹底調査（代替案）

**目的**: Firebase Auth Emulator REST APIの正確な仕様を特定

**実施内容**:
1. Firebase Emulator REST APIのOpenAPI仕様確認
2. `customAttributes`以外のフィールド名試行（`customAttribute`、`customClaims`など）
3. リクエストボディ形式の複数パターン検証
4. 成功したら Phase 18-1再実施

**推定時間**: 1-2時間（成功保証なし）

**メリット**:
- Admin SDK依存なし
- REST APIのみで完結

**デメリット**:
- 成功保証なし
- 公式ドキュメント不足でメンテナンス困難

### Option C: Phase 18-1を保留し、Phase 18-2に進む（非推奨）

**目的**: Phase 17実装の修正を後回し

**実施内容**:
1. Phase 18-1の課題をGitHub Issueとして記録
2. Phase 18-2（data-crud.spec.ts詳細テスト実装）に進む
3. Phase 17修正を別タスクとして実施

**推定時間**: N/A

**メリット**:
- 他のPhaseを先行実施可能

**デメリット**:
- Phase 17実装が未検証のまま残る
- Phase 18-2も同じCustom Claims問題で失敗する可能性

---

## 修正ファイル一覧

### 修正ファイル

1. **`e2e/helpers/auth-helper.ts`**
   - **修正箇所**: 行215-239（`setEmulatorCustomClaims`関数）
   - **修正内容**:
     - Endpoint: `/emulator/v1/.../accounts/${uid}` → `/identitytoolkit.googleapis.com/v1/accounts:update`
     - Method: `PATCH` → `POST`
     - Body: `localId` + `customAttributes` 追加
   - **ステータス**: ⚠️ 部分修正（リクエストボディ形式未解決）

2. **`vite.config.ts`**
   - **修正箇所**: 行9（`server.port`）
   - **修正内容**: `5173` → `3001`
   - **ステータス**: ✅ 完了

### 新規作成ファイル

1. **`.kiro/specs/auth-data-persistence/phase18-1-progress-2025-11-14.md`**
   - Phase 18-1進行状況ドキュメント（418行）
   - 課題分析、Emulator REST API仕様表、推奨ステップ含む

2. **`/Users/yyyhhh/.zshrc`**
   - Java PATH追加（1行）

---

## 関連ドキュメント

- [Phase 17-1完了サマリー](./phase17-1-completion-summary-2025-11-14.md) - Emulator実装詳細
- [Phase 17-2完了サマリー](./phase17-2-completion-summary-2025-11-14.md) - scheduleService単体テストカバレッジ向上
- [Phase 18-1進行状況](./phase18-1-progress-2025-11-14.md) - 本Phaseの詳細分析

---

## 補足: Firebase Auth Emulator REST API仕様（推定）

以下は試行錯誤の結果から推定される仕様です（公式ドキュメント不足のため確定ではありません）。

### Custom Claims設定API（未確定）

**試行エンドポイント**:
- ❌ `POST /emulator/v1/projects/{PROJECT_ID}/accounts/{UID}` - Not Found
- ⚠️ `POST /identitytoolkit.googleapis.com/v1/accounts:update?key=test-api-key` - INVALID_REQ_TYPE

**試行リクエストボディ**:
```json
{
  "localId": "ユーザーUID",
  "customAttributes": "{\"role\":\"super-admin\"}"
}
```
**結果**: `INVALID_REQ_TYPE : Unsupported request parameters`

**推奨される確実な方法**: Firebase Admin SDK使用

---

**更新日時**: 2025-11-14 14:30 JST
**ステータス**: ⚠️ 部分完了（インフラ整備成功、テスト実行失敗）
**次のアクション**: Option A（Admin SDK導入）を推奨
