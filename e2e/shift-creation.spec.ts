import { test, expect } from '@playwright/test';

/**
 * シフト作成機能テスト
 */
test.describe('シフト作成機能', () => {
  test('デモシフトが正しく生成される', async ({ page }) => {
    await page.goto('/');

    // デモシフト作成ボタンをクリック
    await page.getByRole('button', { name: 'デモシフト作成' }).click();

    // シフト表が表示されるまで待機（テーブルセル内のスタッフ名で確認）
    await expect(page.getByRole('cell', { name: '田中 愛' })).toBeVisible({ timeout: 5000 });

    // シフト表の内容確認（少なくとも1つのシフトが表示される）
    const shiftCells = page.locator('td').filter({ hasText: /早番|日勤|遅番|夜勤|休/ });
    await expect(shiftCells.first()).toBeVisible();

    // 月の日数分（30日）のセルが存在することを確認
    const allCells = page.locator('td');
    const cellCount = await allCells.count();
    expect(cellCount).toBeGreaterThan(100); // スタッフ5人 × 30日 = 150セル以上
  });

  test('シフト表と休暇希望入力のタブ切り替えができる', async ({ page }) => {
    await page.goto('/');

    // デモシフト作成
    await page.getByRole('button', { name: 'デモシフト作成' }).click();
    await expect(page.getByRole('cell', { name: '田中 愛' })).toBeVisible({ timeout: 5000 });

    // 休暇希望入力タブに切り替え
    await page.getByRole('button', { name: '休暇希望入力' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText('スタッフ名')).toBeVisible();

    // シフト表タブに戻る
    await page.getByRole('button', { name: 'シフト表' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('cell', { name: '田中 愛' })).toBeVisible();
  });

  test('CSVエクスポートボタンが機能する', async ({ page }) => {
    await page.goto('/');

    // デモシフト作成
    await page.getByRole('button', { name: 'デモシフト作成' }).click();
    await expect(page.getByRole('cell', { name: '田中 愛' })).toBeVisible({ timeout: 5000 });

    // ダウンロード待機
    const downloadPromise = page.waitForEvent('download');

    // CSVダウンロードボタンをクリック
    await page.getByRole('button', { name: 'CSV形式でダウンロード' }).click();

    // ダウンロード完了確認
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/shift_\d{4}-\d{2}\.csv/);
  });

  test('対象月を変更できる', async ({ page }) => {
    await page.goto('/');

    // シフト要件設定を開く
    await page.getByText('事業所のシフト要件設定').click();
    await page.waitForTimeout(300);

    // 現在の月を確認（heading要素で特定）
    await expect(page.getByRole('heading', { name: /2025年 11月/ })).toBeVisible();

    // 月を進める（aria-labelを使用）
    await page.getByRole('button', { name: '次の月へ' }).click();
    await page.waitForTimeout(300);

    // 12月に変更されたことを確認
    await expect(page.locator('text=/2025年 12月/')).toBeVisible();

    // 月を戻す（aria-labelを使用）
    await page.getByRole('button', { name: '前の月へ' }).click();
    await page.waitForTimeout(300);

    // 11月に戻ったことを確認
    await expect(page.locator('text=/2025年 11月/')).toBeVisible();
  });

  // AI シフト作成テスト（本番環境のみ実行）
  test('AIシフト作成ボタンが表示される', async ({ page }) => {
    await page.goto('/');

    // シフト作成実行ボタンの確認
    const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
    await expect(aiButton).toBeVisible();
    await expect(aiButton).not.toBeDisabled();
  });

  // 注: 実際のAI生成は本番環境でコストがかかるため、E2Eでは実行しない
  // 統合テストまたは手動テストで確認すること
});
