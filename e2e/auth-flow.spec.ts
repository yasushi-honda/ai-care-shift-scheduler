import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-helper';
import { TEST_FACILITY_ID } from './fixtures';

/**
 * 認証フローE2Eテスト
 * Phase 14.1: 認証フロー検証
 * Phase 17-1: Firebase Auth Emulator導入により自動テスト化
 *
 * テスト環境：
 * - Firebase Auth Emulator使用（http://localhost:9099）
 * - Firestore Emulator使用（http://localhost:8080）
 *
 * 実行方法：
 * npm run test:e2e:emulator
 */

test.describe('認証フロー - ログアウト機能', () => {
  test.beforeEach(async () => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();
  });

  test('ログアウトボタンをクリックすると、ログイン画面に戻る', async ({ page }) => {
    // まず認証済みユーザーをセットアップ（facilitiesを追加）
    await setupAuthenticatedUser(page, {
      email: 'logout-test@example.com',
      password: 'password123',
      displayName: 'Logout Test User',
      role: 'admin',
      facilities: [{ facilityId: TEST_FACILITY_ID, role: 'admin' }],
    });

    // ログアウトボタンを探す（サイドバーまたはヘッダーにある）
    const logoutButton = page.getByRole('button', { name: 'ログアウト' });
    await expect(logoutButton).toBeVisible({ timeout: 10000 });

    // ログアウト実行
    await logoutButton.click();

    // ログイン画面に戻ることを確認（Googleログインボタンが表示される）
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('認証フロー - ユーザー状態確認（Emulator）', () => {
  test.beforeEach(async () => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();
  });

  test('認証後、ダッシュボードが表示される', async ({ page }) => {
    // Phase 18-2: ブラウザコンソールログキャプチャ
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      console.log(`[Browser Console ${msg.type()}] ${text}`);
    });
    // TODO Phase 19: consoleMessagesを検証（エラーがないことを確認）

    // Emulator環境でテストユーザーを作成してログイン（facilitiesを追加）
    await setupAuthenticatedUser(page, {
      email: 'test-user@example.com',
      password: 'password123',
      displayName: 'Test User',
      role: 'admin',
      facilities: [{ facilityId: TEST_FACILITY_ID, role: 'admin' }],
    });

    // ダッシュボードに遷移
    await page.goto('/');
    await page.waitForTimeout(2000);

    // 認証成功を確認 - ダッシュボードの要素が表示されることで確認
    // シフト関連のUI要素またはログアウトボタンが表示されればOK
    const hasShiftUI = await page.getByText(/シフト/).isVisible().catch(() => false);
    const hasLogoutButton = await page.getByRole('button', { name: 'ログアウト' }).isVisible().catch(() => false);
    const hasDashboard = hasShiftUI || hasLogoutButton;

    expect(hasDashboard).toBeTruthy();
  });

  test('認証後、ログアウトボタンが表示される', async ({ page }) => {
    // Emulator環境でテストユーザーを作成してログイン（facilitiesを追加）
    await setupAuthenticatedUser(page, {
      email: 'test-user2@example.com',
      password: 'password123',
      displayName: 'Another User',
      role: 'admin',
      facilities: [{ facilityId: TEST_FACILITY_ID, role: 'admin' }],
    });

    // ダッシュボードに遷移
    await page.goto('/');
    await page.waitForTimeout(2000);

    // 認証済み状態を確認 - ログアウトボタンが存在すれば認証成功
    const logoutButton = page.getByRole('button', { name: 'ログアウト' });
    await expect(logoutButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe('認証フロー - アクセス権限なし画面（Emulator）', () => {
  test.beforeEach(async () => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();
  });

  test('アクセス権限がない場合、Forbiddenページが表示される', async ({ page }) => {
    // Phase 21: ブラウザコンソールログキャプチャ
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      console.log(`[Browser Console ${msg.type()}] ${text}`);
    });

    // Phase 21修正: viewerロールでログイン（super-admin権限なし）
    // facilities が存在するが super-admin ロールがないユーザーを作成
    // AdminProtectedRoute が /forbidden にリダイレクトすることを検証
    await setupAuthenticatedUser(page, {
      email: 'viewer-user@example.com',
      password: 'password123',
      displayName: 'Viewer User',
      facilities: [{ facilityId: 'test-facility-001', role: 'viewer' }],
    });

    // 管理画面にアクセス試行
    await page.goto('/admin');

    // Phase 21: デバッグログ確認のため少し待機
    await page.waitForTimeout(2000);

    // Forbiddenページにリダイレクトされることを確認
    await expect(page).toHaveURL('/forbidden', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'アクセス権限がありません' })).toBeVisible();
  });

  test('Forbiddenページに「管理者に連絡」メッセージが表示される', async ({ page }) => {
    // Phase 21修正: editorロールでログイン（super-admin権限なし）
    await setupAuthenticatedUser(page, {
      email: 'editor-user@example.com',
      password: 'password123',
      displayName: 'Editor User',
      facilities: [{ facilityId: 'test-facility-002', role: 'editor' }],
    });

    // 直接Forbiddenページに遷移
    await page.goto('/forbidden');

    // メッセージ表示を確認
    await expect(page.getByText(/管理者に連絡/)).toBeVisible({ timeout: 5000 });
  });
});
