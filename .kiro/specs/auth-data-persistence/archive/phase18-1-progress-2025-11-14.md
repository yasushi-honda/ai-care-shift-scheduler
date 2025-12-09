# Phase 18-1: Emulator環境での自動テスト確認 - 進行状況

**更新日**: 2025-11-14
**仕様ID**: auth-data-persistence
**Phase**: 18-1
**ステータス**: 🔄 進行中（Java runtime問題対処中）

## 概要

Phase 17-1で実装したFirebase Auth Emulator環境とE2Eテストヘルパー関数が実際に動作することを検証する。

## Phase 18-1の目的

1. ✅ Emulator起動確認
2. ✅ E2Eテスト実行環境確認
3. ⏳ 6テストケースの実行成功確認
   - auth-flow.spec.ts: 4テスト
   - rbac-permissions.spec.ts: 2テスト

## 現状の課題

### 🚧 ブロッキング要因: Java Runtime未インストール

**エラー内容**:
```
Error: Process `java -version` has exited with code 1.
Please make sure Java is installed and on your system PATH.

The operation couldn't be completed. Unable to locate a Java Runtime.
Please visit http://www.java.com for information on installing Java.
```

**影響**:
- Firebase Emulatorsの起動に失敗
- Emulator環境でのE2Eテスト実行不可

**原因**:
- Firebase Emulatorsはバックエンド処理にJavaランタイムを使用
- macOS環境でJavaがインストールされていない

## 対応方針

### Option A: Javaをインストールして進める（推奨）

**メリット**:
- Emulator環境での完全なE2Eテストが可能
- 本番環境に近い統合テストが実行可能
- 将来の開発でも必要

**手順**:
1. Homebrewを使用してJavaインストール: `brew install openjdk`
2. PATHに追加
3. Emulator再起動
4. E2Eテスト実行

### Option B: Phase 18-1を一旦保留してPhase 18-2へ進む

**メリット**:
- Java環境構築を後回しにできる
- data-crud.spec.tsの詳細テスト実装に着手可能

**デメリット**:
- Phase 17-1の動作確認が未完了のまま次フェーズへ進む

### Option C: Docker環境でEmulatorを実行

**メリット**:
- ローカル環境にJavaをインストール不要
- 環境の再現性が高い

**デメリット**:
- Dockerセットアップに時間がかかる
- 複雑性が増す

## 実施予定の手順

### Step 1: Java環境確認・インストール

```bash
# 現在のJava環境確認
which java
java -version

# Homebrewでインストール
brew install openjdk

# PATHに追加（必要に応じて）
echo 'export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Step 2: Emulator起動確認

```bash
# バックグラウンドプロセス確認
lsof -ti:9099,8080 | xargs ps

# 必要に応じて再起動
npm run test:e2e:emulator
```

### Step 3: E2Eテスト実行

```bash
# Emulator環境でテスト実行
npm run test:e2e:emulator
```

### Step 4: テスト結果の確認

期待される結果:
- ✅ auth-flow.spec.ts: 4テスト合格
- ✅ rbac-permissions.spec.ts: 2テスト合格
- ✅ 合計6テスト合格

## 関連ドキュメント

- [Phase 17-1完了サマリー](./phase17-1-completion-summary-2025-11-14.md)
- [Phase 17-2完了サマリー](./phase17-2-completion-summary-2025-11-14.md)
- [Phase 17実装計画](./phase17-implementation-plan-2025-11-14.md)

## タイムライン

| 時刻 | イベント |
|------|---------|
| 11:00 | Phase 18-1開始 |
| 11:05 | Java runtime未インストール問題発見 |
| 11:10 | このドキュメント作成 |
| 11:15 | Java環境確認・インストール実施予定 |

## 実施内容

### Step 1: Java環境インストール（完了）

**実施内容**:
```bash
brew install openjdk
echo 'export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"' >> ~/.zshrc
java -version  # OpenJDK 25.0.1 確認
```

**結果**: ✅ 成功
- OpenJDK 25.0.1インストール完了
- PATH設定完了
- Javaが正常に動作することを確認

### Step 2: Firebase Emulator起動（完了）

**実施内容**:
```bash
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH" && firebase emulators:start --only auth,firestore
```

**結果**: ✅ 成功
```
✔  All emulators ready! It is now safe to connect your app.
│ Authentication │ 127.0.0.1:9099 │ http://127.0.0.1:4000/auth      │
│ Firestore      │ 127.0.0.1:8080 │ http://127.0.0.1:4000/firestore │
```

### Step 3: 開発サーバー起動（完了）

**実施内容**:
```bash
PORT=5173 npm run dev
```

**結果**: ✅ 成功
- Vite開発サーバーがポート5173で起動

### Step 4: E2Eテスト実行（失敗）

**実施内容**:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e -- auth-flow.spec.ts rbac-permissions.spec.ts
```

**結果**: ❌ 全テスト失敗（10/10失敗、5スキップ）

**主な問題**:
1. **Custom Claims APIエンドポイント不正確**
   ```
   Error: Failed to set custom claims: Not Found
   ```
   - 現在: `http://localhost:9099/emulator/v1/projects/ai-care-shift-scheduler/accounts/${uid}` (PATCH)
   - 正解: `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=test-api-key` (POST)
   - リクエストボディに `localId` と `customAttributes` が必要

2. **ポート設定の不一致**
   ```
   Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/
   ```
   - 開発サーバー: ポート5173で起動
   - テスト期待値: ポート3001

## 分析・考察

### 成功した点

1. ✅ **Java環境構築**: Homebrew経由でOpenJDK 25.0.1をスムーズにインストール
2. ✅ **Emulator起動**: Auth（9099）+ Firestore（8080）が正常起動
3. ✅ **Playwright Global Setup**: Emulator検出・準備完了

### Phase 17-1実装の課題

Phase 17-1で実装された`auth-helper.ts`には以下の問題があります：

#### 1. Custom Claims APIエンドポイントの誤り

**問題箇所** (`e2e/helpers/auth-helper.ts:221-230`):
```typescript
const response = await fetch(
  `http://localhost:9099/emulator/v1/projects/ai-care-shift-scheduler/accounts/${uid}`,
  {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customAttributes: JSON.stringify(customClaims),
    }),
  }
);
```

**正しい実装**（Firebase Auth Emulator REST API仕様に準拠）:
```typescript
const response = await fetch(
  'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=test-api-key',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localId: uid,
      customAttributes: JSON.stringify(customClaims),
    }),
  }
);
```

**参考**: [Firebase Auth Emulator REST API](https://firebase.google.com/docs/reference/rest/auth#section-auth-emulator)

#### 2. ポート設定の不一致

**問題**:
- 開発サーバー（Vite）: デフォルトで5173起動
- Playwright設定: 3001を期待（`PLAYWRIGHT_BASE_URL=http://localhost:3001`）

**解決策**:
- Option A: Viteを3001で起動（`vite.config.ts`の`server.port`設定）
- Option B: Playwright設定を5173に変更
- **推奨**: Option A - 3001に統一（Phase 17-1計画通り）

### Emulator REST APIの正確な仕様

Firebase Auth Emulator REST APIの主要エンドポイント:

| 操作 | エンドポイント | メソッド | ボディ |
|------|-------------|---------|--------|
| アカウント作成 | `/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test-api-key` | POST | `{ email, password, displayName, returnSecureToken }` |
| アカウント更新 | `/identitytoolkit.googleapis.com/v1/accounts:update?key=test-api-key` | POST | `{ localId, customAttributes }` |
| 全アカウント削除 | `/emulator/v1/projects/{PROJECT_ID}/accounts` | DELETE | - |
| アカウント一覧取得 | `/emulator/v1/projects/{PROJECT_ID}/accounts` | GET | - |

**重要**: Custom Claims設定は「アカウント更新」API（POST）を使用する必要がある。

## Phase 18-1の評価

### 達成状況

| 項目 | 目標 | 実績 | 評価 |
|------|------|------|------|
| Java環境構築 | OpenJDK インストール | OpenJDK 25.0.1 | ✅ 完全達成 |
| Emulator起動 | Auth + Firestore起動 | 9099 + 8080起動 | ✅ 完全達成 |
| E2Eテスト実行 | 6テスト合格 | 0/6テスト合格 | ❌ 未達成 |

### 課題の重要度

1. **Critical**: Custom Claims APIエンドポイント修正（全テスト失敗の主原因）
2. **High**: ポート設定統一（ERR_CONNECTION_REFUSED 3件）
3. **Medium**: Phase 17-1実装の検証不足（Phase 18-1で初めて問題発覚）

## 推奨される次のステップ

### Phase 18-1の再実施（推奨）

**目的**: Custom Claims API修正 + ポート統一 + テスト検証

**実施内容**:
1. `auth-helper.ts`の`setEmulatorCustomClaims`関数を修正
2. Viteポート設定を3001に変更（または Playwright設定を5173に変更）
3. E2Eテスト再実行
4. 6テストの成功確認

**推定時間**: 1-2時間

### Phase 18-2への先送り（代替案）

**理由**: Phase 17-1実装の根本的な見直しが必要

**実施内容**:
1. Phase 18-1の課題をIssue化
2. Phase 18-2（data-crud.spec.ts詳細テスト）に進む
3. Phase 17-1の修正を別タスクとして実施

## 学び・振り返り

### Phase 17-1実装の問題点

1. **API仕様の確認不足**: Firebase Auth Emulator REST API仕様を正確に確認せずに実装
2. **実装後の動作確認不足**: Phase 17-1完了時に実際のテスト実行で検証していない
3. **ドキュメントとの乖離**: Phase 17-1完了サマリーに「実際のテスト実行はPhase 18-1で検証」と記載されていたが、Phase 17-1時点で動作確認すべきだった

### 今後の改善策

1. **API統合前の仕様確認**: 外部API（Firebase Emulator REST API等）を使用する場合、公式ドキュメントを必ず確認
2. **実装直後のスモークテスト**: ヘルパー関数実装後、最低1テストケースで動作確認を実施
3. **段階的な検証**: Phase 17-1で「実装のみ」→ Phase 18-1で「検証」ではなく、Phase 17-1内で「実装 + 検証」を完結させる

---

**更新日時**: 2025-11-14 14:15 JST
**ステータス**: ⚠️ 課題発見・分析完了（修正待ち）
**次のアクション**: Phase 18-1再実施 または Phase 18-2先送り（ユーザー判断待ち）
