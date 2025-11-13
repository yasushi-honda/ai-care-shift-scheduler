# Phase 18.2: 再開ガイドライン

**作成日**: 2025-11-13
**対象読者**: 将来のAIセッション、新規メンバー、Phase 18.2再開担当者
**推定所要時間**: 1-3時間（問題解決まで）

---

## このガイドの目的

Phase 18.2は2025年11月13日に一時保留されました。このガイドは、Phase 18.2を再開する際の手順を明確にし、効率的に問題を解決するためのものです。

---

## 再開前のチェックリスト

Phase 18.2を再開する前に、以下を確認してください：

- [ ] **保留理由を理解**: `phase18-2-on-hold-decision-2025-11-13.md`を読む
- [ ] **問題の詳細を確認**: `phase18-2-step6-problem6-analysis-2025-11-13.md`を読む
- [ ] **トラブルシューティング履歴を把握**: `phase18-2-step6-troubleshooting-2025-11-12.md`を読む
- [ ] **時間的余裕を確保**: 1-3時間を確保（深掘り調査 + 修正 + テスト）
- [ ] **開発環境の準備**: Node.js 20, npm, Playwright, Firebase CLI

---

## Phase 18.2の現状（再確認）

### 達成済み

- ✅ Step 1-5完了（Emulator設定、スクリプト、テストコード調整）
- ✅ 6つの問題のうち5つを解決
- ✅ 詳細なドキュメント作成（約3,500行）

### 未達成

- ❌ 問題6未解決：firebase.ts初期化タイミング問題
- ❌ GitHub Actions環境でのテスト成功率：1/6（17%）

---

## 再開の判断基準（再確認）

以下のいずれかに該当する場合、Phase 18.2を再開することを推奨：

1. **Emulator環境でのテストが必須になった**
2. **時間的余裕がある**
3. **Firebase Emulatorの安定性が向上した**
4. **ユーザーからの要望があった**

---

## 再開手順（ステップバイステップ）

### ステップ1: 現状確認（約15分）

#### 1.1 ドキュメントを読む

**必読ドキュメント**（順番に読む）:
1. `phase18-2-on-hold-decision-2025-11-13.md` - 保留理由と現状
2. `phase18-2-step6-problem6-analysis-2025-11-13.md` - 問題6の詳細
3. `phase18-2-resumption-guide.md` - 本ガイド

**所要時間**: 約10分

#### 1.2 GitHub Issueを確認

```bash
# Phase 18.2関連のIssueを確認
gh issue list --label "phase-18"
```

**確認事項**:
- 未解決のIssueがあるか
- 新しい情報やコメントがあるか

**所要時間**: 約5分

---

### ステップ2: ログ強化して原因特定（約30分）

#### 2.1 firebase.tsにログ追加

**ファイル**: `firebase.ts`

**追加場所**: トップレベル（1行目）

```typescript
// 🔥 Phase 18.2再開: デバッグログ強化
console.log('🔥 [Firebase] firebase.ts loaded');
```

**追加場所**: isLocalhost判定後（53行目付近）

```typescript
console.log('🔥 [Firebase] Environment check:', {
  isLocalhost,
  isDev: import.meta.env.DEV,
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
  mode: import.meta.env.MODE,
});

// 追加: isLocalhost判定の詳細
console.log('🔥 [Firebase] isLocalhost判定:', {
  isLocalhost,
  hasWindow: typeof window !== 'undefined',
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
  isLocalhostHostname: typeof window !== 'undefined' && window.location.hostname === 'localhost',
  is127001: typeof window !== 'undefined' && window.location.hostname === '127.0.0.1',
});
```

**追加場所**: グローバルオブジェクト公開後（76-79行目付近）

```typescript
if (typeof window !== 'undefined') {
  (window as any).__firebaseAuth = auth;
  (window as any).__firebaseDb = db;
  console.log('✅ [Firebase Debug] グローバルオブジェクト公開成功:', {
    hasAuth: !!(window as any).__firebaseAuth,
    hasDb: !!(window as any).__firebaseDb,
  });

  // 追加: グローバルオブジェクトの確認
  console.log('🔥 [Firebase] window.__firebaseAuthの型:', typeof (window as any).__firebaseAuth);
  console.log('🔥 [Firebase] window.__firebaseDbの型:', typeof (window as any).__firebaseDb);
}
```

#### 2.2 index.tsxにログ追加

**ファイル**: `index.tsx`

**追加場所**: firebase.tsインポート直後（3行目）

```typescript
import './firebase';  // Phase 18.2 Step 6: Firebase初期化を確実に実行（React マウント前）
console.log('🔥 [Index] firebase.ts imported');
```

#### 2.3 コミット・プッシュ

```bash
git add firebase.ts index.tsx
git commit -m "debug(phase18-2): ログ強化 - firebase.ts実行状況確認

Phase 18.2再開: 問題6デバッグのためログ追加

**追加ログ**:
- firebase.ts loaded確認
- isLocalhost判定詳細
- window.__firebaseAuth設定確認

**目的**: firebase.tsが実行されているか、isLocalhost判定が成功しているかを確認

Phase 18.2再開 - Step 1

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

#### 2.4 GitHub Actions実行・ログ確認

```bash
# ワークフロー手動トリガー
gh workflow run e2e-permission-check.yml

# 実行状況監視（5秒待機後）
sleep 5
gh run list --workflow=e2e-permission-check.yml --limit 1

# 実行完了を待つ（Run IDは上記コマンドで取得）
gh run watch [RUN_ID]

# ログ確認
gh run view [RUN_ID] --log | grep "🔥 \[Firebase\]" | head -50
```

**確認事項**:
- ✅ `🔥 [Firebase] firebase.ts loaded` が出力されているか
- ✅ `isLocalhost` の値（true/false）
- ✅ `window.location.hostname` の値
- ✅ `グローバルオブジェクト公開成功` ログが出力されているか

**所要時間**: 約30分

---

### ステップ3: 原因に応じた修正実施（約30分-1時間）

#### パターンA: firebase.tsが実行されていない（Tree Shaking原因）

**判断基準**: `🔥 [Firebase] firebase.ts loaded` ログが**出力されていない**

**修正1**: vite.config.tsでTree Shaking設定調整

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // firebase.tsの副作用を保持
        preserveModules: false,
      },
    },
  },
});
```

**修正2**: package.jsonでsideEffects設定

```json
{
  "name": "ai-care-shift-scheduler",
  "version": "1.0.0",
  "sideEffects": [
    "./firebase.ts",
    "./index.tsx"
  ],
  ...
}
```

**コミット**:
```bash
git add vite.config.ts package.json
git commit -m "fix(phase18-2): Vite Tree Shaking設定調整 - firebase.ts副作用保持

**問題**: firebase.tsがTree Shakingで削除されていた
**修正**: vite.config.tsとpackage.jsonでsideEffects設定

Phase 18.2再開 - Step 2 (Pattern A)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

---

#### パターンB: isLocalhost判定失敗

**判断基準**:
- `🔥 [Firebase] firebase.ts loaded` ログが**出力されている**
- `isLocalhost` が `false` になっている
- `hostname` が `localhost` や `127.0.0.1` 以外

**修正**: isLocalhost判定を拡張

```typescript
// firebase.ts (48-50行目付近)
const isLocalhost = typeof window !== 'undefined' &&
                    (window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname === '0.0.0.0' ||  // 追加
                     window.location.hostname === 'localhost.localdomain');  // 追加
```

または、環境変数で強制的にEmulator接続：

```typescript
// firebase.ts
const forceEmulator = import.meta.env.VITE_FORCE_EMULATOR === 'true';
const isLocalhost = typeof window !== 'undefined' &&
                    (window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1');

if (isLocalhost || forceEmulator) {  // 修正
  // Auth Emulator接続
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  // Firestore Emulator接続
  connectFirestoreEmulator(db, 'localhost', 8080);
  // グローバルオブジェクト公開
  if (typeof window !== 'undefined') {
    (window as any).__firebaseAuth = auth;
    (window as any).__firebaseDb = db;
  }
}
```

**GitHub Actions workflow更新**（環境変数使用の場合）:

```yaml
# .github/workflows/e2e-permission-check.yml
- name: 開発サーバーを起動
  run: |
    PORT=5173 npm run dev &
  env:
    VITE_FORCE_EMULATOR: true  # 追加
```

**コミット**:
```bash
git add firebase.ts .github/workflows/e2e-permission-check.yml
git commit -m "fix(phase18-2): isLocalhost判定拡張 - Emulator強制接続対応

**問題**: isLocalhost判定が失敗していた
**修正**:
- 0.0.0.0、localhost.localdomainを追加
- VITE_FORCE_EMULATOR環境変数でEmulator強制接続

Phase 18.2再開 - Step 2 (Pattern B)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

---

#### パターンC: 実行タイミングの問題

**判断基準**:
- `🔥 [Firebase] firebase.ts loaded` ログが**出力されている**
- `isLocalhost` が `true` になっている
- `グローバルオブジェクト公開成功` ログが**出力されている**
- それでも `window.__firebaseAuth is undefined` エラーが発生

**修正**: window.__firebaseAuthに依存しないアプローチに変更

**ファイル**: `e2e/helpers/auth-helper.ts`

**大幅な変更が必要なため、新しいauth-helper-v2.tsを作成することを推奨**:

```typescript
// e2e/helpers/auth-helper-v2.ts
import { Page } from '@playwright/test';

/**
 * Emulator環境で認証（window.__firebaseAuthに依存しない版）
 *
 * @param page Playwrightページオブジェクト
 * @param email テストユーザーのメールアドレス
 * @param password テストユーザーのパスワード
 */
export async function signInWithEmulatorV2(
  page: Page,
  email: string = 'test@example.com',
  password: string = 'password123'
) {
  console.log(`🔐 Emulator環境で認証開始（V2）: ${email}`);

  // Step 1: Auth Emulator REST APIでユーザー作成（重複エラーは無視）
  await page.evaluate(
    async ({ testEmail, testPassword }) => {
      try {
        const response = await fetch('http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: testEmail,
            password: testPassword,
            returnSecureToken: true,
          }),
        });

        if (response.ok) {
          console.log(`✅ テストユーザー作成成功: ${testEmail}`);
        } else if (response.status === 400) {
          const error = await response.json();
          if (error.error?.message?.includes('EMAIL_EXISTS')) {
            console.log(`ℹ️ テストユーザー既存: ${testEmail}`);
          } else {
            console.warn(`⚠️ ユーザー作成エラー: ${error.error?.message}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ テストユーザー作成エラー: ${error}`);
      }
    },
    { testEmail: email, testPassword: password }
  );

  // Step 2: ページに移動してFirebase SDKがロードされることを確認
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Step 3: page.evaluate()内でFirebase SDKを直接インポートして認証
  const signInSuccess = await page.evaluate(
    async ({ testEmail, testPassword, firebaseConfig }) => {
      try {
        // Firebase SDKを動的インポート
        const { initializeApp } = await import('firebase/app');
        const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = await import('firebase/auth');

        // Firebaseアプリ初期化（新しいインスタンス）
        const app = initializeApp(firebaseConfig, 'e2e-test-app');
        const auth = getAuth(app);
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

        console.log('🔍 [Auth V2] Firebase SDK初期化完了');

        // ログイン実行
        const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);

        console.log(`✅ Emulator認証成功（V2）: ${userCredential.user.email} (UID: ${userCredential.user.uid})`);
        return true;
      } catch (error: any) {
        console.error(`❌ Emulator認証失敗（V2）: ${error.message}`);
        return false;
      }
    },
    {
      testEmail: email,
      testPassword: password,
      firebaseConfig: {
        apiKey: "fake-api-key",
        authDomain: "localhost",
        projectId: "demo-project",
      }
    }
  );

  if (!signInSuccess) {
    throw new Error(`Emulator認証に失敗しました（V2）: ${email}`);
  }

  // 認証処理の完了を待つ
  await page.waitForTimeout(2000);

  console.log(`✅ Emulator認証完了（V2）: ${email}`);
}
```

**テストコード更新**:

```typescript
// e2e/permission-errors.spec.ts
import { signInWithEmulatorV2 } from './helpers/auth-helper-v2';

test.beforeEach(async ({ page, baseURL }) => {
  // ...

  if (isEmulator) {
    console.log('🟢 Emulator環境でテスト実行（V2）');

    try {
      await signInWithEmulatorV2(page);  // 変更
      console.log('✅ Emulator認証完了（V2）');
    } catch (error) {
      console.error('❌ Emulator認証失敗（V2）:', error);
      throw error;
    }
  }

  // ...
});
```

**コミット**:
```bash
git add e2e/helpers/auth-helper-v2.ts e2e/permission-errors.spec.ts
git commit -m "fix(phase18-2): window.__firebaseAuth依存を排除 - V2アプローチ

**問題**: グローバルオブジェクトのタイミング問題
**修正**:
- auth-helper-v2.tsを作成（window.__firebaseAuth不使用）
- page.evaluate内でFirebase SDKを直接インポート
- 独立したFirebaseアプリインスタンスで認証

Phase 18.2再開 - Step 2 (Pattern C)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

---

### ステップ4: 再テスト・検証（約15分）

```bash
# GitHub Actions手動トリガー
gh workflow run e2e-permission-check.yml

# 実行状況監視
sleep 5
gh run list --workflow=e2e-permission-check.yml --limit 1

# 実行完了を待つ
gh run watch [RUN_ID]

# テスト結果確認
gh run view [RUN_ID] --log | grep "passed\|failed" | tail -20
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

**成功の場合**: ✅ Phase 18.2完了 → ステップ5へ

**失敗の場合**: ❌ 追加のデバッグが必要 → ステップ2に戻る

---

### ステップ5: Phase 18.2完了レポート作成（約30分）

**ファイル**: `.kiro/specs/auth-data-persistence/phase18-2-completion-report-2025-[DATE].md`

**内容**:
- Phase 18.2の最終成果
- 問題6の解決方法
- テスト結果（6/6成功）
- 所要時間統計
- 学び・振り返り

**テンプレート**:

```markdown
# Phase 18.2: 完了レポート

**完了日**: YYYY-MM-DD
**ステータス**: ✅ 完了
**総所要時間**: Phase 18.2全体（保留前 + 再開後）

## 概要

Phase 18.2（Firebase Auth Emulator導入）を完了しました。

## 問題6の解決

**採用したアプローチ**: パターン[A/B/C]

**修正内容**:
- [具体的な修正内容]

**結果**: ✅ 全テスト成功（6/6）

## テスト結果

| テスト | 結果 |
|--------|------|
| ユーザー詳細ページ | ✅ |
| セキュリティアラート | ✅ |
| バージョン履歴 | ✅ |
| 管理画面主要ページ | ✅ |
| ログイン直後 | ✅ |
| コンソールログ収集 | ✅ |
| **合計** | **6/6（100%）** |

## 所要時間

| Phase | 所要時間 |
|-------|---------|
| Phase 18.2（保留前） | 約5時間 |
| Phase 18.2（再開後） | 約[X]時間 |
| **合計** | **約[Y]時間** |

## 学び・振り返り

[学んだこと、改善点]

## 次のステップ

Phase 18完了により、Permission errorの自動検出体制が確立されました。次は：
- Phase 19: [次の優先タスク]

---

**完了日**: YYYY-MM-DD
**作成者**: [担当者名]
```

---

## トラブルシューティング

### 問題: ログが出力されない

**症状**: ステップ2で追加したログが GitHub Actions ログに出力されない

**原因候補**:
1. ビルドキャッシュが使用されている
2. ブラウザコンソールログのキャプチャが機能していない

**対処法**:
1. GitHub Actions workflowでキャッシュをクリア
2. e2e/permission-errors.spec.tsのpage.on('console')リスナーを確認

---

### 問題: テストが依然として失敗する

**症状**: パターンA/B/Cの修正後もテストが失敗する

**原因候補**:
- 根本原因が他にある
- 複数の問題が重なっている

**対処法**:
1. より詳細なデバッグログを追加
2. ローカル環境でのテスト実行を試みる（Javaインストール後）
3. Firebase Emulatorの代わりに本番環境でのテスト実行を検討
4. Discordコミュニティやstackoverflowで相談

---

## よくある質問

### Q1: Phase 18.2を再開する優先度は？

**A**: 中程度。Phase 18.1で部分的に動作しているため、緊急ではありません。時間的余裕がある時に対応してください。

---

### Q2: パターンA/B/Cのどれから試すべき？

**A**: ステップ2のログ確認結果に基づいて判断してください。ログが出力されていない場合はパターンA、isLocalhost判定が失敗している場合はパターンB、それ以外はパターンCを試してください。

---

### Q3: ローカル環境でのテスト実行は可能？

**A**: Javaがインストールされていれば可能です。`brew install openjdk`でインストール後、以下のコマンドでテスト実行：

```bash
# ターミナル1: Emulator起動
firebase emulators:start --only auth,firestore

# ターミナル2: 開発サーバー起動
npm run dev

# ターミナル3: Playwrightテスト実行
PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run test:e2e:permission
```

---

### Q4: Phase 18.2を完全にスキップすることは可能？

**A**: 可能です。Phase 18.1で部分的に動作しているため、Phase 18.2なしでも最低限の目標は達成しています。ただし、将来的にEmulator環境でのテスト自動化が必要になる可能性があるため、ドキュメントは残しておくことを推奨します。

---

## 参考資料

### 内部ドキュメント

- `phase18-2-on-hold-decision-2025-11-13.md` - 保留決定ドキュメント
- `phase18-2-step6-problem6-analysis-2025-11-13.md` - 問題6分析レポート
- `phase18-2-step6-troubleshooting-2025-11-12.md` - トラブルシューティング履歴（問題1-5）
- `phase18-2-implementation-plan-2025-11-12.md` - Phase 18.2実装計画

### 外部資料

- [Vite Tree Shaking](https://vitejs.dev/guide/features.html#tree-shaking)
- [Vite Side Effects](https://vitejs.dev/guide/build.html#library-mode)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Playwright Authentication](https://playwright.dev/docs/auth)
- [Playwright Page.evaluate](https://playwright.dev/docs/api/class-page#page-evaluate)

---

**作成日**: 2025-11-13
**作成者**: AI（Claude Code）
**ステータス**: 再開ガイドライン完成

---

**メッセージ: 将来の担当者へ**

Phase 18.2の再開、お疲れ様です！このガイドに従って進めることで、効率的に問題を解決できるはずです。

もし新しい問題に遭遇した場合は、このガイドを更新して、将来の担当者に引き継いでください。

Good luck!

---

**End of Resumption Guide**
