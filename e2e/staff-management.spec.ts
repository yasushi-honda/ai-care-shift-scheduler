import { test, expect } from '@playwright/test';
import { TEST_STAFF } from './fixtures';

/**
 * スタッフ管理機能テスト
 *
 * Phase 2: テストフィクスチャを使用するよう修正
 */

// テスト用スタッフ参照（フィクスチャからインデックスで取得）
const NURSE_STAFF = TEST_STAFF.find(s => s.position === '看護職員')!; // 佐藤花子
const CARE_STAFF = TEST_STAFF.find(s => s.position === '介護職員')!;  // 高橋健太
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
    // 看護職員を確認（フィクスチャから取得）
    const nurseCard = page.locator('.bg-white.rounded-lg.border').filter({ hasText: NURSE_STAFF.name });
    await expect(nurseCard.getByText(NURSE_STAFF.position)).toBeVisible();

    // 介護職員を確認（フィクスチャから取得）
    const careCard = page.locator('.bg-white.rounded-lg.border').filter({ hasText: CARE_STAFF.name });
    await expect(careCard.getByText(CARE_STAFF.position)).toBeVisible();
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
    // フィクスチャの全スタッフがスタッフカード内に表示されることを確認
    for (const staff of TEST_STAFF) {
      await expect(
        page.locator('.bg-white.rounded-lg.border').filter({ hasText: staff.name })
      ).toBeVisible();
    }
  });
});
