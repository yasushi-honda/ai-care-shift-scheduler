import { test, expect } from '@playwright/test';

/**
 * 休暇希望入力機能テスト
 */
test.describe('休暇希望入力機能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 休暇希望入力タブに切り替え
    await page.getByRole('button', { name: '休暇希望入力' }).click();
    // タブ切り替え後の待機
    await page.waitForTimeout(500);
  });

  test('休暇希望カレンダーが表示される', async ({ page }) => {
    // カレンダーテーブルが表示されることを確認
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText('スタッフ名')).toBeVisible();

    // 全スタッフがテーブル内に表示されることを確認（cellロールで特定）
    await expect(page.getByRole('cell', { name: '田中 愛' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '鈴木 太郎' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '佐藤 花子' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '高橋 健太' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '渡辺 久美子' })).toBeVisible();
  });

  test('カレンダーに日付が表示される', async ({ page }) => {
    // カレンダーグリッドが表示されることを確認
    const dateCell = page.locator('td').first();
    await expect(dateCell).toBeVisible();

    // 月の日数分のセルが存在することを確認
    const allCells = page.locator('td');
    const cellCount = await allCells.count();
    expect(cellCount).toBeGreaterThan(100); // スタッフ5人 × 30日 = 150セル以上
  });

  test('休暇希望を入力できる', async ({ page }) => {
    // 最初のスタッフの最初の日付セルをクリック
    const firstCell = page.locator('tbody tr').first().locator('td').nth(1);
    await firstCell.click();

    // プルダウンメニューまたはモーダルが表示されることを確認
    // （実装により異なるため、いずれかが表示されればOK）
    const hasDropdown = await page.locator('select, .dropdown, [role="menu"]').count() > 0;
    const hasModal = await page.locator('.modal, [role="dialog"]').count() > 0;

    expect(hasDropdown || hasModal).toBeTruthy();
  });

  test('初期の休暇希望が表示される', async ({ page }) => {
    // 田中 愛の11/18に有給休暇が設定されている（初期データ）
    const tanakaRow = page.locator('tr').filter({ hasText: '田中 愛' });

    // 有給休暇を示す表示があることを確認
    // （実装により「有」「有給」「P」などの表示）
    const leaveIndicators = tanakaRow.locator('td').filter({
      hasText: /有|有給|P|paid|休暇/
    });

    // 少なくとも1つの休暇表示があることを確認
    const count = await leaveIndicators.count();
    expect(count).toBeGreaterThan(0);
  });

  test('月を変更するとカレンダーも更新される', async ({ page }) => {
    // 現在の月を確認（heading要素で特定）
    await expect(page.getByRole('heading', { name: /2025年 11月/ })).toBeVisible();

    // 事業所のシフト要件設定を開いて、MonthNavigatorを表示
    await page.getByText('事業所のシフト要件設定').click();
    await page.waitForTimeout(300);

    // 月を進める（aria-labelを使用）
    await page.getByRole('button', { name: '次の月へ' }).click();
    await page.waitForTimeout(300);

    // 12月に変更されたことを確認
    await expect(page.locator('text=/2025年 12月/')).toBeVisible();

    // 月を戻す
    await page.getByRole('button', { name: '前の月へ' }).click();
    await page.waitForTimeout(300);

    // 11月に戻ったことを確認
    await expect(page.locator('text=/2025年 11月/')).toBeVisible();
  });

  test('シフト表タブに戻れる', async ({ page }) => {
    // 休暇希望カレンダーテーブルが表示されていることを確認
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText('スタッフ名')).toBeVisible();

    // シフト表タブに切り替え
    await page.getByRole('button', { name: 'シフト表' }).click();
    await page.waitForTimeout(500);

    // デモシフト作成ボタンが表示されることを確認
    await expect(page.getByRole('button', { name: 'デモシフト作成' })).toBeVisible();
  });
});
