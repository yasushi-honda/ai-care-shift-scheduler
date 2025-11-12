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
