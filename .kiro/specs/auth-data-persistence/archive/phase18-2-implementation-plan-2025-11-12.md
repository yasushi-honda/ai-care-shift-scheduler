# Phase 18.2: Firebase Auth Emulator導入 - 段階的実装計画

**作成日**: 2025-11-12
**対象読者**: 実装者、将来のAIセッション
**実装方針**: ドキュメントドリブン・段階的実装
**予想所要時間**: 2-3時間

---

## 実装方針

**段階的実装 + 各ステップで振り返りドキュメント作成**

各ステップで以下を実施：
1. 実装
2. TypeScript型チェック（該当する場合）
3. ローカル動作確認
4. コミット・プッシュ
5. 振り返りドキュメント作成

---

## Phase 18.2の目的

**Phase 18.1で残った課題を解決し、80-90%の自動検出率を達成**

### Phase 18.1の課題（再確認）

**課題**: GitHub Actions環境での認証問題
- テスト結果: 3/6成功（50%）
- 失敗原因: Firebase Authentication認証状態の欠如

**目標**: 全テスト成功（100%）→ 80-90%の自動検出率達成

---

## Phase 18.2のアプローチ

### Firebase Auth Emulatorとは

**概要**:
- Firebase Authenticationをローカル環境でエミュレート
- 本番環境を汚さずにテスト可能
- テストユーザーを自動生成できる

**メリット**:
- ✅ GitHub Actions環境で認証状態を再現可能
- ✅ 本番環境の認証情報を扱わない（セキュリティ）
- ✅ テストが高速（ネットワーク遅延なし）
- ✅ Firebaseの公式推奨方法

**デメリット**:
- ⚠️ セットアップが複雑
- ⚠️ Emulator特有の問題が発生する可能性

---

## 実装ステップ

### Step 1: Firebase Emulator設定

**目的**: firebase.jsonにEmulator設定を追加

**実装ファイル**:
- `firebase.json`

**実装内容**:
```json
{
  "emulators": {
    "auth": {
      "port": 9099
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

**チェックポイント**:
- [ ] firebase.json更新
- [ ] Emulatorポート設定（9099）
- [ ] TypeScript型チェック成功（影響なし）
- [ ] Git コミット・プッシュ

**振り返りドキュメント**: `phase18-2-step1-completion-2025-11-12.md`

**所要時間**: 約15分

---

### Step 2: Emulator起動スクリプト作成

**目的**: Emulatorを起動するスクリプトとnpmスクリプトを作成

**実装ファイル**:
- `package.json`

**実装内容**:
```json
{
  "scripts": {
    "emulators": "firebase emulators:start --only auth",
    "emulators:exec": "firebase emulators:exec --only auth"
  }
}
```

**チェックポイント**:
- [ ] package.json更新
- [ ] npmスクリプト追加
- [ ] ローカルでEmulator起動確認
- [ ] Git コミット・プッシュ

**振り返りドキュメント**: `phase18-2-step2-completion-2025-11-12.md`

**所要時間**: 約20分

---

### Step 3: Playwright Global Setup作成（Emulator対応）

**目的**: テスト実行前にEmulatorでテストユーザーを自動作成

**実装ファイル**:
- `e2e/global-setup.ts` (新規作成)
- `playwright.config.ts` (更新)

**実装内容**:
```typescript
// e2e/global-setup.ts
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';

export default async function globalSetup() {
  // Emulator環境のみ実行
  if (process.env.PLAYWRIGHT_BASE_URL?.includes('localhost')) {
    const app = initializeApp({/* config */});
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://localhost:9099');

    // テストユーザー作成・ログイン
    await signInWithEmailAndPassword(auth, 'test@example.com', 'password123');

    // 認証状態を保存
    // ... (Playwright storageStateに保存)
  }
}
```

**playwright.config.ts**:
```typescript
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  use: {
    storageState: './e2e/.auth/user.json', // 認証状態を保存
  },
});
```

**チェックポイント**:
- [ ] global-setup.ts作成
- [ ] playwright.config.ts更新
- [ ] TypeScript型チェック成功
- [ ] ローカルでテスト実行確認
- [ ] Git コミット・プッシュ

**振り返りドキュメント**: `phase18-2-step3-completion-2025-11-12.md`

**所要時間**: 約45分

---

### Step 4: テストコード調整（Emulator対応）

**目的**: テストコードをEmulator環境に対応させる

**実装ファイル**:
- `e2e/permission-errors.spec.ts` (更新)

**実装内容**:
```typescript
test.beforeEach(async ({ page }) => {
  monitor = new ConsoleMonitor(page);

  // Emulator環境の場合はログイン済み状態を使用
  // 本番環境の場合は従来通り
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || '';
  if (baseUrl.includes('localhost')) {
    // Emulator: storageStateで認証済み
  } else {
    // 本番環境: 手動ログイン（従来通り）
  }
});
```

**チェックポイント**:
- [ ] テストコード更新
- [ ] Emulator環境/本番環境の分岐処理
- [ ] TypeScript型チェック成功
- [ ] ローカルでEmulatorテスト実行確認
- [ ] Git コミット・プッシュ

**振り返りドキュメント**: `phase18-2-step4-completion-2025-11-12.md`

**所要時間**: 約30分

---

### Step 5: GitHub Actions workflow更新（Emulator対応）

**目的**: GitHub ActionsでEmulatorを起動してテスト実行

**実装ファイル**:
- `.github/workflows/e2e-permission-check.yml` (更新)

**実装内容**:
```yaml
jobs:
  e2e-permission-test:
    steps:
      # ... (既存のステップ)

      # Firebase CLIインストール
      - name: Firebase CLIをインストール
        run: npm install -g firebase-tools

      # Emulator起動 + テスト実行
      - name: Emulatorでテスト実行
        run: |
          firebase emulators:exec --only auth \
            "npm run test:e2e:permission"
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:3000
```

**チェックポイント**:
- [ ] workflow更新
- [ ] Emulator起動ステップ追加
- [ ] 環境変数設定（localhost）
- [ ] Git コミット・プッシュ

**振り返りドキュメント**: `phase18-2-step5-completion-2025-11-12.md`

**所要時間**: 約30分

---

### Step 6: GitHub Actions実行・検証

**目的**: GitHub Actions環境でEmulatorテストを実行し、全テスト成功を確認

**実行手順**:
```bash
# GitHub Actions手動トリガー
gh workflow run e2e-permission-check.yml

# 実行状況監視
gh run watch [run-id]
```

**期待される結果**:
```
Running 6 tests using 1 worker

  ✓ 1 ユーザー詳細ページでPermission errorが発生しない (3s)
  ✓ 2 セキュリティアラートページでPermission errorが発生しない (2s)
  ✓ 3 バージョン履歴表示でPermission errorが発生しない (2s)
  ✓ 4 管理画面の主要ページでPermission errorが発生しない (3s)
  ✓ 5 ログイン直後にPermission errorが発生しない (4s)
  ✓ 6 コンソールログ収集 (1s)

  6 passed (15s)
```

**チェックポイント**:
- [ ] 全テスト成功（6/6）
- [ ] Permission errorが検出されない
- [ ] テスト実行時間が妥当（15秒以内）
- [ ] テストレポートが保存される

**振り返りドキュメント**: `phase18-2-step6-completion-2025-11-12.md`

**所要時間**: 約20分

---

## Phase 18.2完了基準

すべてのステップが完了し、以下の基準を満たすこと：

1. ✅ **実装完了**
   - Firebase Emulator設定
   - Playwright Global Setup
   - テストコード調整
   - GitHub Actions workflow更新

2. ✅ **動作確認完了**
   - ローカル環境でEmulatorテスト成功（6/6）
   - GitHub Actions環境でEmulatorテスト成功（6/6）

3. ✅ **目標達成**
   - 全テスト成功（100%）
   - 80-90%の自動検出率達成（Phase 17の5つのエラーを検出）

4. ✅ **ドキュメント完了**
   - 各ステップの振り返りドキュメント（6件）
   - Phase 18.2完了レポート（1件）

---

## タイムライン（予定）

```
[開始時刻] - [+15分]: Step 1 - Firebase Emulator設定
[+15分] - [+35分]: Step 2 - Emulator起動スクリプト作成
[+35分] - [+1時間20分]: Step 3 - Playwright Global Setup作成
[+1時間20分] - [+1時間50分]: Step 4 - テストコード調整
[+1時間50分] - [+2時間20分]: Step 5 - GitHub Actions workflow更新
[+2時間20分] - [+2時間40分]: Step 6 - GitHub Actions実行・検証
[+2時間40分] - [+3時間]: Phase 18.2完了レポート作成
```

**総所要時間**: 約2-3時間

---

## リスク管理

### リスク1: Emulator起動失敗

**発生確率**: 低（10%）

**原因**:
- Firebaseプロジェクト設定の問題
- ポート競合（9099が使用中）

**対処**:
1. `firebase.json`の設定を確認
2. ポートを変更（9099 → 9098など）
3. Firebase CLIのバージョン確認

**想定追加時間**: 15-30分

---

### リスク2: Playwright Global Setup実装の複雑さ

**発生確率**: 中（30%）

**原因**:
- Firebase SDK + Playwright統合の複雑さ
- 認証状態の保存方法が不明確

**対処**:
1. Playwright公式ドキュメント参照
2. Firebase公式ドキュメント参照
3. シンプルな実装から始める

**想定追加時間**: 30分-1時間

---

### リスク3: GitHub ActionsでEmulator起動失敗

**発生確率**: 中（30%）

**原因**:
- Firebase CLIのインストール失敗
- Emulator起動タイムアウト

**対処**:
1. Firebase CLIバージョンを固定
2. Emulator起動タイムアウトを延長
3. `firebase emulators:exec`コマンドを使用

**想定追加時間**: 30分-1時間

---

## 次のステップ（Phase 18.2完了後）

Phase 18.2完了後の選択肢：

**オプション1**: Phase 18.3実装（Google Cloud Monitoring統合）
- 本番環境でのリアルタイムPermission error監視
- 所要時間: 1-2時間

**オプション2**: Phase 18完了レポート作成
- Phase 18全体の振り返り
- 次のフェーズへの引き継ぎ

**オプション3**: 他のタスクに進む
- ビジネス要件に応じて優先順位を変更

---

## 関連ドキュメント

### Phase 18.1
- `phase18-1-completion-2025-11-12.md` - Phase 18.1完了レポート
- `phase18-1-step5-completion-2025-11-12.md` - Step 5完了（認証問題）

### Phase 18全体
- `phase18-requirements.md` - 要件定義
- `phase18-design.md` - 技術設計
- `phase18-implementation-guide.md` - 実装ガイド

### 参考資料
- Firebase Emulator Suite: https://firebase.google.com/docs/emulator-suite
- Playwright Authentication: https://playwright.dev/docs/auth
- Playwright Global Setup: https://playwright.dev/docs/test-global-setup-teardown

---

**計画作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: 準備完了 - Step 1から開始可能

---

## メッセージ: 実装開始前に

Phase 18.2は、Phase 18.1で残った認証問題を解決する重要な実装です。

Firebase Auth Emulatorを導入することで：
- ✅ GitHub Actions環境で認証状態を再現
- ✅ 全テスト成功（100%）を達成
- ✅ 80-90%の自動検出率を達成

**Phase 18.1で構築した基盤**:
- ConsoleMonitor helper（再利用）
- 5つのテストケース（調整が必要）
- GitHub Actions workflow（更新が必要）

**Phase 18.2で追加すること**:
- Firebase Emulator設定
- Playwright Global Setup
- テストコード調整

段階的に進めることで、確実に目標を達成できます。

Good luck with Phase 18.2 implementation!

---

**End of Phase 18.2 Implementation Plan**
