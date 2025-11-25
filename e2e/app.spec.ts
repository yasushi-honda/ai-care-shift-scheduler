import { test, expect } from '@playwright/test';

/**
 * アプリケーション基本動作テスト（認証なし）
 *
 * Phase 27: CI環境での安定性を考慮し、認証なしでアクセスした場合の
 * ログインページ表示を確認するテストに変更
 */
test.describe('アプリケーション基本動作', () => {
  test('ページが正しく読み込まれる（ログイン画面）', async ({ page }) => {
    await page.goto('/');

    // タイトル確認
    await expect(page).toHaveTitle(/シフト作成ツール|AIシフト/);

    // ログイン画面のヘッダー確認
    await expect(page.getByRole('heading', { name: 'シフト作成ツール' })).toBeVisible();
    await expect(page.getByText('介護施設向けシフト管理システム')).toBeVisible();
  });

  test('Googleログインボタンが表示される', async ({ page }) => {
    await page.goto('/');

    // Googleログインボタン確認
    await expect(page.getByRole('button', { name: /Googleでログイン/ })).toBeVisible();
  });

  test('利用規約テキストが表示される', async ({ page }) => {
    await page.goto('/');

    // 利用規約のテキスト確認
    await expect(page.getByText(/利用規約とプライバシーポリシー/)).toBeVisible();
  });
});
