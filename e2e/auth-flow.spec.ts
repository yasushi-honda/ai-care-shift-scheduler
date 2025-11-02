import { test, expect } from '@playwright/test';

/**
 * 認証フローE2Eテスト
 * Phase 14.1: 認証フロー検証
 *
 * Google OAuth認証フローの完全自動化は困難なため、以下のアプローチを採用：
 * 1. ログアウト機能: 自動E2Eテスト（このファイル）
 * 2. Google OAuthログイン: 手動テストガイド（phase14-1-auth-flow-manual-test-guide-2025-11-02.md）
 * 3. 認証済み状態のテスト: Firebase Auth Emulator使用（Phase 17以降で検討）
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

test.describe('認証フロー - ユーザー状態確認', () => {
  test.skip('認証後、ユーザー名が表示される', async ({ page }) => {
    // このテストは認証済み前提のため、Firebase Auth Emulatorまたはモックが必要
    // Phase 17以降でFirebase Auth Emulatorを導入して実装予定
    await page.goto('/');

    // ユーザー名表示を確認
    await expect(page.getByText(/ようこそ/)).toBeVisible({ timeout: 5000 });
  });

  test.skip('認証後、ユーザーアイコンが表示される', async ({ page }) => {
    // このテストは認証済み前提のため、Firebase Auth Emulatorまたはモックが必要
    // Phase 17以降でFirebase Auth Emulatorを導入して実装予定
    await page.goto('/');

    // ユーザーアイコン表示を確認
    const userIcon = page.locator('[data-testid="user-icon"]');
    await expect(userIcon).toBeVisible({ timeout: 5000 });
  });
});

test.describe('認証フロー - アクセス権限なし画面', () => {
  test.skip('アクセス権限がない場合、Forbiddenページが表示される', async ({ page }) => {
    // このテストは認証済み＋権限なしの状態を作る必要がある
    // Firebase Auth Emulatorを使用してテスト用ユーザーを作成する必要がある
    // Phase 17以降で実装予定
    await page.goto('/forbidden');

    await expect(page.getByRole('heading', { name: 'アクセス権限がありません' })).toBeVisible();
  });

  test.skip('Forbiddenページに「管理者に連絡」メッセージが表示される', async ({ page }) => {
    // このテストは認証済み＋権限なしの状態を作る必要がある
    // Firebase Auth Emulatorを使用してテスト用ユーザーを作成する必要がある
    // Phase 17以降で実装予定
    await page.goto('/forbidden');

    await expect(page.getByText(/管理者に連絡/)).toBeVisible();
  });
});
