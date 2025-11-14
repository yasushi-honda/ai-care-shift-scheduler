import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-helper';

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
  test('ログアウトボタンをクリックすると、ログイン画面に戻る', async ({ page }) => {
    await page.goto('/');

    // ログアウトボタンを探す
    const logoutButton = page.getByRole('button', { name: 'ログアウト' });
    await expect(logoutButton).toBeVisible({ timeout: 10000 });

    // ログアウト実行
    await logoutButton.click();

    // ログイン画面に戻ることを確認
    await expect(page).toHaveURL('/', { timeout: 5000 });

    // Googleログインボタンが表示されることを確認
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('認証フロー - ユーザー状態確認（Emulator）', () => {
  test.beforeEach(async () => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();
  });

  test('認証後、ユーザー名が表示される', async ({ page }) => {
    // Emulator環境でテストユーザーを作成してログイン
    await setupAuthenticatedUser(page, {
      email: 'test-user@example.com',
      password: 'password123',
      displayName: 'Test User',
      role: 'super-admin',
    });

    // ダッシュボードに遷移
    await page.goto('/');

    // ユーザー名表示を確認（ヘッダーまたはサイドバーに表示されると想定）
    await expect(page.getByText(/Test User/)).toBeVisible({ timeout: 5000 });
  });

  test('認証後、ユーザーアイコンまたは表示名が確認できる', async ({ page }) => {
    // Emulator環境でテストユーザーを作成してログイン
    await setupAuthenticatedUser(page, {
      email: 'test-user2@example.com',
      password: 'password123',
      displayName: 'Another User',
      role: 'super-admin',
    });

    // ダッシュボードに遷移
    await page.goto('/');

    // ユーザーアイコンまたは表示名が存在することを確認
    // Note: UIデザインに応じて調整が必要
    const hasUserIcon = await page.locator('[data-testid="user-icon"]').isVisible().catch(() => false);
    const hasDisplayName = await page.getByText(/Another User/).isVisible().catch(() => false);

    expect(hasUserIcon || hasDisplayName).toBeTruthy();
  });
});

test.describe('認証フロー - アクセス権限なし画面（Emulator）', () => {
  test.beforeEach(async () => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();
  });

  test('アクセス権限がない場合、Forbiddenページが表示される', async ({ page }) => {
    // 権限なしユーザーでログイン（roleなし）
    await setupAuthenticatedUser(page, {
      email: 'no-permission@example.com',
      password: 'password123',
      displayName: 'No Permission User',
      // roleを設定しない = 権限なし
    });

    // 管理画面にアクセス試行
    await page.goto('/admin');

    // Forbiddenページにリダイレクトされることを確認
    await expect(page).toHaveURL('/forbidden', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'アクセス権限がありません' })).toBeVisible();
  });

  test('Forbiddenページに「管理者に連絡」メッセージが表示される', async ({ page }) => {
    // 権限なしユーザーでログイン
    await setupAuthenticatedUser(page, {
      email: 'no-permission2@example.com',
      password: 'password123',
      displayName: 'No Permission User 2',
    });

    // 直接Forbiddenページに遷移
    await page.goto('/forbidden');

    // メッセージ表示を確認
    await expect(page.getByText(/管理者に連絡/)).toBeVisible({ timeout: 5000 });
  });
});
