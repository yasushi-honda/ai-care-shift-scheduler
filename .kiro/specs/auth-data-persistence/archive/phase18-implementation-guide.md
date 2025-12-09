# Phase 18: E2Eテストの拡充と監視の強化 - 実装ガイド

**作成日**: 2025-11-12
**対象**: 実装者（将来のAIセッション、新規メンバー）
**前提知識**: TypeScript、Playwright、Firebase

---

## 目次

1. [実装前の準備](#実装前の準備)
2. [Phase 18.1実装: Permission error自動検出E2Eテスト](#phase-181実装-permission-error自動検出e2eテスト)
3. [Phase 18.2実装: 監視アラート設定](#phase-182実装-監視アラート設定)
4. [実装後の検証](#実装後の検証)
5. [よくある質問](#よくある質問)

---

## 実装前の準備

### 必読ドキュメント

**実装開始前に必ず読むこと**:
1. ✅ `phase17-18-context.md` - なぜPhase 18が必要か理解する
2. ✅ `phase18-requirements.md` - 何を実現するか理解する
3. ✅ `phase18-design.md` - どのように実装するか理解する
4. ✅ `phase18-implementation-plan-diagram.md` - 全体像を視覚的に理解する
5. ✅ 本ドキュメント - ステップバイステップで実装する

### 開発環境確認

```bash
# Node.jsバージョン確認
node --version
# → v20.x.x が推奨

# npm バージョン確認
npm --version
# → 10.x.x が推奨

# Playwright インストール確認
npx playwright --version
# → Version 1.x.x

# 依存関係インストール
npm install
```

### 作業ブランチ作成

```bash
# mainブランチから最新を取得
git checkout main
git pull origin main

# Phase 18作業ブランチ作成（オプション）
git checkout -b feature/phase18-e2e-monitoring

# または mainブランチで直接作業（GitHub Flow）
```

---

## Phase 18.1実装: Permission error自動検出E2Eテスト

### ステップ1: コンソール監視ヘルパー作成

**ファイル**: `e2e/helpers/console-monitor.ts`

**実装内容**:

```typescript
import { Page } from '@playwright/test';

/**
 * Permission errorを検出するコンソール監視ヘルパー
 *
 * Phase 18.1: Phase 17で発見されたPermission errorを自動検出
 *
 * 使用例:
 * ```typescript
 * const monitor = new ConsoleMonitor(page);
 * await page.goto('/admin/users');
 * const error = monitor.hasPermissionError();
 * expect(error).toBeNull();
 * ```
 */

export interface ConsoleMessage {
  type: string;
  text: string;
  location?: string;
}

/**
 * Permission errorのパターン
 */
const PERMISSION_ERROR_PATTERNS = [
  /permission/i,
  /insufficient permissions/i,
  /PERMISSION_DENIED/i,
  /Missing or insufficient permissions/i,
  /Failed to get.*permission/i,
  /Error fetching.*permission/i,
];

/**
 * コンソールログを監視し、Permission errorを検出
 */
export class ConsoleMonitor {
  private consoleMessages: ConsoleMessage[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupConsoleListener();
  }

  /**
   * コンソールリスナーをセットアップ
   */
  private setupConsoleListener() {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()?.url,
      });
    });
  }

  /**
   * Permission errorが発生しているか確認
   *
   * @returns Permission errorが発生している場合はそのメッセージ、なければnull
   */
  hasPermissionError(): ConsoleMessage | null {
    for (const msg of this.consoleMessages) {
      // error, warningタイプのみチェック
      if (msg.type !== 'error' && msg.type !== 'warning') {
        continue;
      }

      // Permission errorパターンにマッチするか確認
      for (const pattern of PERMISSION_ERROR_PATTERNS) {
        if (pattern.test(msg.text)) {
          return msg;
        }
      }
    }

    return null;
  }

  /**
   * すべてのコンソールメッセージを取得
   */
  getAllMessages(): ConsoleMessage[] {
    return this.consoleMessages;
  }

  /**
   * エラーメッセージのみ取得
   */
  getErrorMessages(): ConsoleMessage[] {
    return this.consoleMessages.filter((msg) => msg.type === 'error');
  }

  /**
   * コンソールログをクリア
   */
  clear() {
    this.consoleMessages = [];
  }
}
```

**実装手順**:

1. `e2e/helpers/` ディレクトリを作成（存在しない場合）:
   ```bash
   mkdir -p e2e/helpers
   ```

2. `e2e/helpers/console-monitor.ts` を作成し、上記コードをコピー

3. TypeScriptコンパイル確認:
   ```bash
   npx tsc --noEmit e2e/helpers/console-monitor.ts
   # → エラーがないことを確認
   ```

**実装のポイント**:
- ✅ `PERMISSION_ERROR_PATTERNS` にPhase 17で発見されたすべてのパターンを含む
- ✅ `ConsoleMessage` インターフェースでログの構造を明確化
- ✅ `clear()` メソッドで複数ページのテストに対応

---

### ステップ2: Permission error検出テスト作成

**ファイル**: `e2e/permission-errors.spec.ts`

**実装内容** (全文は長いため、主要部分のみ記載):

```typescript
import { test, expect } from '@playwright/test';
import { ConsoleMonitor } from './helpers/console-monitor';

/**
 * Permission error自動検出E2Eテスト
 * Phase 18.1: 管理画面の主要ページでPermission errorが発生しないことを確認
 *
 * 背景:
 * Phase 17で5つのPermission errorが本番環境で発見された。
 * これらはすべてコンソールログ監視で事前検出可能だった。
 *
 * 目的:
 * - Permission errorをデプロイ前に自動検出
 * - Phase 17のような問題を繰り返さない
 *
 * 制約:
 * - Firebase Auth Emulator不使用（設定が複雑なため）
 * - 本番環境で実際の認証を使用（手動トリガー）
 *
 * 実行方法:
 * - ローカル: PLAYWRIGHT_BASE_URL=https://ai-care-shift-scheduler.web.app npm run test:e2e:permission
 * - CI/CD: 手動トリガー（workflow_dispatch）
 */

test.describe('Permission error自動検出 - 管理画面', () => {
  let monitor: ConsoleMonitor;

  test.beforeEach(async ({ page }) => {
    // コンソール監視を開始
    monitor = new ConsoleMonitor(page);
  });

  /**
   * Phase 17.9で発生: Admin User Detail Permission Error
   */
  test('ユーザー詳細ページでPermission errorが発生しない', async ({ page }) => {
    const userId = process.env.TEST_USER_ID || 'test-user-id';

    await page.goto(`/admin/users/${userId}`);
    await page.waitForLoadState('networkidle');

    const permissionError = monitor.hasPermissionError();
    expect(permissionError, `Permission error detected: ${permissionError?.text}`).toBeNull();

    await expect(page.getByText(/所属施設とロール/i)).toBeVisible({ timeout: 10000 });
  });

  /**
   * Phase 17.11で発生: Security Alerts Permission Error
   */
  test('セキュリティアラートページでPermission errorが発生しない', async ({ page }) => {
    await page.goto('/admin/security-alerts');
    await page.waitForLoadState('networkidle');

    const permissionError = monitor.hasPermissionError();
    expect(permissionError, `Permission error detected: ${permissionError?.text}`).toBeNull();

    await expect(
      page.getByRole('heading', { name: /セキュリティアラート/i })
    ).toBeVisible({ timeout: 10000 });
  });

  /**
   * Phase 17.5で発生: Versions Subcollection Permission Error
   */
  test('バージョン履歴表示でPermission errorが発生しない', async ({ page }) => {
    await page.goto('/shift-management');
    await page.waitForLoadState('networkidle');

    const versionButton = page.getByRole('button', { name: /バージョン履歴/i });
    const isVisible = await versionButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await versionButton.click();
      await page.waitForLoadState('networkidle');
    }

    const permissionError = monitor.hasPermissionError();
    expect(permissionError, `Permission error detected: ${permissionError?.text}`).toBeNull();
  });

  /**
   * 管理画面のその他の重要ページ
   */
  test('管理画面の主要ページでPermission errorが発生しない', async ({ page }) => {
    const pages = [
      { url: '/admin/users', name: 'ユーザー一覧' },
      { url: '/admin/facilities', name: '施設管理' },
      { url: '/admin/audit-logs', name: '監査ログ' },
    ];

    for (const pageInfo of pages) {
      await page.goto(pageInfo.url);
      await page.waitForLoadState('networkidle');

      const permissionError = monitor.hasPermissionError();
      expect(
        permissionError,
        `Permission error detected on ${pageInfo.name}: ${permissionError?.text}`
      ).toBeNull();

      monitor.clear();
    }
  });

  /**
   * Phase 17.8で発生: User Fetch Permission Error
   */
  test('ログイン直後にPermission errorが発生しない', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000); // 認証トークン初期化を待つ
    await page.waitForLoadState('networkidle');

    const permissionError = monitor.hasPermissionError();
    expect(permissionError, `Permission error detected: ${permissionError?.text}`).toBeNull();

    await expect(page.getByText(/施設を選択/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Permission error自動検出 - デバッグ情報', () => {
  /**
   * テスト失敗時のデバッグ用
   */
  test('コンソールログを収集して出力', async ({ page }) => {
    const monitor = new ConsoleMonitor(page);

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const allMessages = monitor.getAllMessages();
    console.log('--- All Console Messages ---');
    allMessages.forEach((msg, index) => {
      console.log(`[${index}] ${msg.type}: ${msg.text}`);
    });

    const errorMessages = monitor.getErrorMessages();
    console.log('--- Error Messages ---');
    errorMessages.forEach((msg, index) => {
      console.log(`[${index}] ${msg.text}`);
    });
  });
});
```

**実装手順**:

1. `e2e/permission-errors.spec.ts` を作成し、上記コードをコピー

2. TypeScriptコンパイル確認:
   ```bash
   npx tsc --noEmit e2e/permission-errors.spec.ts
   ```

3. TEST_USER_IDの確認:
   - Firebase Console → Authentication → Users
   - super-adminユーザーのUIDをコピー
   - 環境変数に設定: `export TEST_USER_ID=<UID>`

**実装のポイント**:
- ✅ Phase 17で発見された5つのPermission errorすべてをカバー
- ✅ 各テストにPhase番号とバグ説明をコメント
- ✅ デバッグ用のテストも含める

---

### ステップ3: package.json スクリプト追加

**ファイル**: `package.json`

**追加内容**:

```json
{
  "scripts": {
    "test:e2e:permission": "playwright test permission-errors.spec.ts"
  }
}
```

**実装手順**:

1. `package.json` を開く

2. `"scripts"` セクションに上記を追加

3. スクリプト動作確認:
   ```bash
   npm run test:e2e:permission -- --help
   # → Playwrightのヘルプが表示されればOK
   ```

---

### ステップ4: GitHub Actions workflow作成

**ファイル**: `.github/workflows/e2e-permission-check.yml`

**実装内容**:

```yaml
name: E2E Permission Check (Manual Trigger)

on:
  workflow_dispatch:
    inputs:
      test_user_id:
        description: 'Test User ID (super-admin UID)'
        required: true
        type: string

jobs:
  permission-check:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: Run Permission Error Detection Tests
        env:
          PLAYWRIGHT_BASE_URL: https://ai-care-shift-scheduler.web.app
          TEST_USER_ID: ${{ inputs.test_user_id }}
        run: npm run test:e2e:permission

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

**実装手順**:

1. `.github/workflows/e2e-permission-check.yml` を作成

2. 上記内容をコピー

3. GitHub にプッシュ:
   ```bash
   git add .github/workflows/e2e-permission-check.yml
   git commit -m "feat(ci): add E2E permission check workflow (Phase 18.1)"
   git push origin main
   ```

4. GitHub Actions で確認:
   - GitHub → Actions → "E2E Permission Check (Manual Trigger)"
   - ワークフローが表示されることを確認

**実装のポイント**:
- ✅ `workflow_dispatch` で手動トリガー
- ✅ `test_user_id` を入力として受け取る
- ✅ `always()` でテスト失敗時もレポートアップロード

---

### ステップ5: ローカル環境での動作確認

**前提条件**:
- 本番環境（https://ai-care-shift-scheduler.web.app）にsuper-adminでログイン済み
- ブラウザの認証状態が保存されている

**テスト実行**:

```bash
# 1. 環境変数設定
export PLAYWRIGHT_BASE_URL=https://ai-care-shift-scheduler.web.app
export TEST_USER_ID=<super-adminのUID>

# 2. テスト実行
npm run test:e2e:permission

# 3. 結果確認
# → すべてのテストが成功すれば Phase 18.1 完了
# → 失敗した場合は、phase18-test-manual.md のトラブルシューティング参照
```

**期待される結果**:

```
Running 5 tests using 1 worker

  ✓ 1 ユーザー詳細ページでPermission errorが発生しない (3s)
  ✓ 2 セキュリティアラートページでPermission errorが発生しない (2s)
  ✓ 3 バージョン履歴表示でPermission errorが発生しない (2s)
  ✓ 4 管理画面の主要ページでPermission errorが発生しない (8s)
  ✓ 5 ログイン直後にPermission errorが発生しない (4s)

  5 passed (19s)
```

---

## Phase 18.2実装: 監視アラート設定

### ステップ1: Google Cloud Monitoring設定ガイド作成

**ファイル**: `phase18-monitoring-setup-guide.md`

このファイルは別途詳細に作成します。

**概要のみ記載**:

1. Permission Error アラート設定
2. Cloud Functions エラーアラート設定
3. 通知チャネル設定（Email + Slack）
4. 動作確認

詳細は `phase18-monitoring-setup-guide.md` を参照。

---

### ステップ2: 監視設定の実施

**Google Cloud Console での作業**:

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクト `ai-care-shift-scheduler` を選択
3. **Logging** → **Logs Explorer** に移動
4. Permission Error 検出クエリを入力:
   ```
   resource.type="cloud_run_revision" OR resource.type="cloud_function"
   severity>=ERROR
   (textPayload=~"Missing or insufficient permissions" OR
    textPayload=~"PERMISSION_DENIED")
   ```
5. **Create alert** をクリック
6. アラート条件設定:
   - 条件: ログエントリが5分間に3回以上
   - 通知チャネル: Email
7. **Create** をクリック

**詳細手順**: `phase18-monitoring-setup-guide.md` 参照

---

## 実装後の検証

### Phase 18.1の検証

**チェックリスト**:

- [ ] `e2e/helpers/console-monitor.ts` 作成完了
- [ ] `e2e/permission-errors.spec.ts` 作成完了
- [ ] `package.json` にスクリプト追加完了
- [ ] `.github/workflows/e2e-permission-check.yml` 作成完了
- [ ] ローカル環境でテスト実行成功
- [ ] Phase 17の5つのPermission errorが検出可能であることを確認
- [ ] コミット・プッシュ完了

### Phase 18.2の検証

**チェックリスト**:

- [ ] Google Cloud Monitoring設定完了
- [ ] Permission Error アラート設定完了
- [ ] Cloud Functions エラーアラート設定完了
- [ ] 通知チャネル設定完了（Email確認）
- [ ] 動作確認完了（テストアラート送信成功）
- [ ] `phase18-monitoring-setup-guide.md` 作成完了

### コミット・デプロイ

```bash
# 1. すべてのファイルをステージング
git add e2e/helpers/console-monitor.ts
git add e2e/permission-errors.spec.ts
git add package.json
git add .github/workflows/e2e-permission-check.yml
git add .kiro/specs/auth-data-persistence/

# 2. コミット
git commit -m "feat(test): Phase 18.1 - Permission error自動検出E2Eテスト実装

実装内容:
- e2e/helpers/console-monitor.ts: コンソール監視ヘルパー
- e2e/permission-errors.spec.ts: Permission error検出テスト
- package.json: test:e2e:permission スクリプト追加
- .github/workflows/e2e-permission-check.yml: CI/CD手動トリガー

Phase 17で発見された5つのPermission errorを自動検出可能に。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 3. CodeRabbitレビュー
coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md

# 4. プッシュ
git push origin main

# 5. GitHub Actions CI/CD確認
gh run list --limit 1
```

---

## よくある質問

### Q1: テストが失敗する場合

**A**: `phase18-test-manual.md` のトラブルシューティングセクションを参照してください。

### Q2: TEST_USER_IDが分からない

**A**: Firebase Console → Authentication → Users → super-adminユーザーのUIDをコピー

### Q3: 本番環境でテストして大丈夫？

**A**: はい。テストは読み取り専用操作のみで、データの変更は行いません。

### Q4: CI/CDで自動実行できない？

**A**: Firebase認証が必要なため、手動トリガーのみです。将来的にFirebase Auth Emulatorの導入を検討（Phase 19以降）。

### Q5: Permission errorを意図的に発生させてテストしたい

**A**: `firestore.rules` を一時的に変更して Permission error を発生させることができます。ただし、本番環境への影響を考慮してください。

---

## 次のステップ

Phase 18.1実装完了後:
1. `phase18-test-manual.md` を読んでテスト実行方法を確認
2. Phase 18.2実装へ進む
3. `phase18-monitoring-setup-guide.md` を読んで監視設定を実施

Phase 18.2実装完了後:
1. `phase18-troubleshooting.md` を読んでトラブルシューティング方法を確認
2. `phase18-verification.md` を作成して検証結果を記録
3. Phase 18完了

---

**ドキュメント作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**対象読者**: 実装者（将来のAIセッション、新規メンバー）
**次のドキュメント**: `phase18-test-manual.md`
