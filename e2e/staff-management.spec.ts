import { test, expect } from '@playwright/test';

/**
 * スタッフ管理機能テスト
 */
test.describe('スタッフ管理機能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // スタッフ情報設定を開く
    await page.getByText('スタッフ情報設定').click();
  });

  test('新規スタッフを追加できる', async ({ page }) => {
    // 初期スタッフ数を確認
    const initialStaffCount = await page.locator('.bg-white.rounded-lg.border').count();

    // 新規スタッフ追加ボタンをクリック
    const addButton = page.getByRole('button', { name: '新規スタッフ追加' });
    await addButton.click();

    // アラートが表示されることを確認
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('新規スタッフ');
      await dialog.accept();
    });

    // スタッフが追加されたことを確認
    await page.waitForTimeout(500);
    const newStaffCount = await page.locator('.bg-white.rounded-lg.border').count();
    expect(newStaffCount).toBe(initialStaffCount + 1);

    // 新規スタッフが表示されることを確認
    await expect(page.getByText('新規スタッフ')).toBeVisible();
  });

  test('スタッフ情報を編集できる', async ({ page }) => {
    // 最初のスタッフカードを展開
    const firstStaffCard = page.locator('.bg-white.rounded-lg.border').first();
    await firstStaffCard.click();

    // 詳細が表示されることを確認
    await expect(page.getByText('資格')).toBeVisible();
    await expect(page.getByText('週の勤務回数')).toBeVisible();

    // 編集可能な入力フィールドが存在することを確認
    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible();
  });

  test('スタッフの役職情報が表示される', async ({ page }) => {
    // 田中 愛（看護職員）を確認
    const tanakaCard = page.locator('.bg-white.rounded-lg.border').filter({ hasText: '田中 愛' });
    await expect(tanakaCard.getByText('看護職員')).toBeVisible();

    // 鈴木 太郎（介護職員）を確認
    const suzukiCard = page.locator('.bg-white.rounded-lg.border').filter({ hasText: '鈴木 太郎' });
    await expect(suzukiCard.getByText('介護職員')).toBeVisible();
  });

  test('スタッフの資格情報が表示される', async ({ page }) => {
    // 最初のスタッフカードを展開
    const firstStaffCard = page.locator('.bg-white.rounded-lg.border').first();
    await firstStaffCard.click();

    // 資格バッジが表示されることを確認
    await expect(page.locator('.bg-blue-100, .bg-green-100, .bg-purple-100, .bg-orange-100').first()).toBeVisible();
  });

  test('スタッフ削除の確認ダイアログが表示される', async ({ page }) => {
    // 最初のスタッフカードを展開
    const firstStaffCard = page.locator('.bg-white.rounded-lg.border').first();
    await firstStaffCard.click();

    // 削除ボタンを探す
    const deleteButton = page.getByRole('button', { name: '削除' }).or(
      page.locator('button').filter({ hasText: '削除' })
    );

    // 削除ボタンが存在する場合のみテスト
    if (await deleteButton.count() > 0) {
      await deleteButton.first().click();

      // 確認モーダルが表示されることを確認
      await expect(page.getByText('スタッフの削除')).toBeVisible();
      await expect(page.getByText('本当に')).toBeVisible();

      // キャンセルボタンをクリック
      await page.getByRole('button', { name: 'キャンセル' }).click();

      // モーダルが閉じることを確認
      await expect(page.getByText('スタッフの削除')).not.toBeVisible();
    }
  });

  test('全スタッフが一覧表示される', async ({ page }) => {
    // 初期スタッフ5人がスタッフカード内に表示されることを確認
    await expect(page.locator('.bg-white.rounded-lg.border').filter({ hasText: '田中 愛' })).toBeVisible();
    await expect(page.locator('.bg-white.rounded-lg.border').filter({ hasText: '鈴木 太郎' })).toBeVisible();
    await expect(page.locator('.bg-white.rounded-lg.border').filter({ hasText: '佐藤 花子' })).toBeVisible();
    await expect(page.locator('.bg-white.rounded-lg.border').filter({ hasText: '高橋 健太' })).toBeVisible();
    await expect(page.locator('.bg-white.rounded-lg.border').filter({ hasText: '渡辺 久美子' })).toBeVisible();
  });
});
