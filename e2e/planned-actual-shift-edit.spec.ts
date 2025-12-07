import { test, expect } from '@playwright/test';

/**
 * Phase 25.2: 予実2段書き編集機能テスト
 *
 * このテストスイートは、予定シフトと実績シフトの2段書き表示、
 * シングルクリック編集、差異ハイライトをテストします。
 *
 * 注意: Phase 43でデモシフト作成機能が削除されたため、
 *       このテストファイルは現在スキップされています。
 *       AIシフト生成を使用したテストに書き換える必要があります。
 */
// Phase 43でデモシフト作成機能が削除されたため、このテストスイート全体をスキップ
test.describe.skip('予実2段書き編集機能（デモシフト削除済み）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // デモシフト作成
    await page.getByRole('button', { name: 'デモシフト作成' }).click();
    await expect(page.getByRole('cell', { name: '田中 愛' })).toBeVisible({ timeout: 5000 });
  });

  test('予定シフトセルをクリックすると編集モーダルが開く', async ({ page }) => {
    // シフト表の最初の予定セル（田中 愛の1日目の予定行）をクリック
    // 予定行は各スタッフの最初の行
    const firstPlannedCell = page.locator('tbody tr:nth-child(1) td:nth-child(2)');
    await firstPlannedCell.click();

    // モーダルが開くことを確認
    await expect(page.getByText('シフト編集 - 予定')).toBeVisible({ timeout: 2000 });

    // モーダル内のフィールドを確認
    await expect(page.getByText('シフトタイプ')).toBeVisible();
    await expect(page.getByText('開始時刻')).toBeVisible();
    await expect(page.getByText('終了時刻')).toBeVisible();
    await expect(page.getByText('休憩時間（分）')).toBeVisible();
  });

  test('実績シフトセルをクリックすると編集モーダルが開く', async ({ page }) => {
    // シフト表の最初の実績セル（田中 愛の1日目の実績行）をクリック
    // 実績行は各スタッフの2番目の行
    const firstActualCell = page.locator('tbody tr:nth-child(2) td:nth-child(1)');
    await firstActualCell.click();

    // モーダルが開くことを確認
    await expect(page.getByText('シフト編集 - 実績')).toBeVisible({ timeout: 2000 });

    // モーダル内のフィールドを確認
    await expect(page.getByText('シフトタイプ')).toBeVisible();
    await expect(page.getByText('開始時刻')).toBeVisible();
    await expect(page.getByText('終了時刻')).toBeVisible();
    await expect(page.getByText('休憩時間（分）')).toBeVisible();
  });

  test('予定シフトを編集して保存できる', async ({ page }) => {
    // 予定セルをクリック
    const firstPlannedCell = page.locator('tbody tr:nth-child(1) td:nth-child(2)');
    await firstPlannedCell.click();

    // モーダルが開くのを待つ
    await expect(page.getByText('シフト編集 - 予定')).toBeVisible({ timeout: 2000 });

    // シフトタイプを変更
    await page.locator('select').first().selectOption('早番');

    // 開始時刻を設定
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill('08:00');

    // 終了時刻を設定
    const endTimeInput = page.locator('input[type="time"]').nth(1);
    await endTimeInput.fill('16:00');

    // 休憩時間を設定
    const breakInput = page.locator('input[type="number"]');
    await breakInput.fill('60');

    // 確認ダイアログハンドラを先に登録（race condition回避）
    page.once('dialog', dialog => dialog.accept());

    // 確認ボタンをクリック
    await page.getByRole('button', { name: '確認' }).click();

    // モーダルが閉じることを確認
    await expect(page.getByText('シフト編集 - 予定')).not.toBeVisible({ timeout: 2000 });

    // 保存された値を検証
    await firstPlannedCell.click();
    await expect(page.getByText('シフト編集 - 予定')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('select').first()).toHaveValue('早番');
    await expect(page.locator('input[type="time"]').first()).toHaveValue('08:00');
    await expect(page.locator('input[type="time"]').nth(1)).toHaveValue('16:00');
    await expect(page.locator('input[type="number"]')).toHaveValue('60');

    // モーダルを閉じる
    await page.getByRole('button', { name: 'キャンセル' }).click();
  });

  test('実績シフトを編集して保存できる', async ({ page }) => {
    // 実績セルをクリック
    const firstActualCell = page.locator('tbody tr:nth-child(2) td:nth-child(1)');
    await firstActualCell.click();

    // モーダルが開くのを待つ
    await expect(page.getByText('シフト編集 - 実績')).toBeVisible({ timeout: 2000 });

    // シフトタイプを変更
    await page.locator('select').first().selectOption('日勤');

    // 開始時刻を設定
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill('09:00');

    // 終了時刻を設定
    const endTimeInput = page.locator('input[type="time"]').nth(1);
    await endTimeInput.fill('18:00');

    // 休憩時間を設定
    const breakInput = page.locator('input[type="number"]');
    await breakInput.fill('60');

    // 特記事項を入力
    const notesTextarea = page.locator('textarea');
    await notesTextarea.fill('テスト実績入力');

    // 確認ダイアログハンドラを先に登録（race condition回避）
    page.once('dialog', dialog => dialog.accept());

    // 確認ボタンをクリック
    await page.getByRole('button', { name: '確認' }).click();

    // モーダルが閉じることを確認
    await expect(page.getByText('シフト編集 - 実績')).not.toBeVisible({ timeout: 2000 });

    // 保存された値を検証
    await firstActualCell.click();
    await expect(page.getByText('シフト編集 - 実績')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('select').first()).toHaveValue('日勤');
    await expect(page.locator('input[type="time"]').first()).toHaveValue('09:00');
    await expect(page.locator('input[type="time"]').nth(1)).toHaveValue('18:00');
    await expect(page.locator('input[type="number"]')).toHaveValue('60');
    await expect(page.locator('textarea')).toHaveValue('テスト実績入力');

    // モーダルを閉じる
    await page.getByRole('button', { name: 'キャンセル' }).click();
  });

  test('モーダルでキャンセルボタンをクリックすると変更が破棄される', async ({ page }) => {
    // 予定セルをクリック
    const firstPlannedCell = page.locator('tbody tr:nth-child(1) td:nth-child(2)');
    await firstPlannedCell.click();

    // モーダルが開くのを待つ
    await expect(page.getByText('シフト編集 - 予定')).toBeVisible({ timeout: 2000 });

    // シフトタイプを変更
    await page.locator('select').first().selectOption('早番');

    // キャンセルボタンをクリック
    await page.getByRole('button', { name: 'キャンセル' }).click();

    // モーダルが閉じることを確認
    await expect(page.getByText('シフト編集 - 予定')).not.toBeVisible({ timeout: 2000 });
  });

  test('バリデーションエラーが表示される（開始・終了時刻が同じ）', async ({ page }) => {
    // 予定セルをクリック
    const firstPlannedCell = page.locator('tbody tr:nth-child(1) td:nth-child(2)');
    await firstPlannedCell.click();

    // モーダルが開くのを待つ
    await expect(page.getByText('シフト編集 - 予定')).toBeVisible({ timeout: 2000 });

    // シフトタイプを選択
    await page.locator('select').first().selectOption('日勤');

    // 同じ時刻を設定
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill('09:00');

    const endTimeInput = page.locator('input[type="time"]').nth(1);
    await endTimeInput.fill('09:00');

    // 確認ボタンをクリック
    await page.getByRole('button', { name: '確認' }).click();

    // エラーメッセージが表示されることを確認
    await expect(page.getByText('終了時刻は開始時刻と異なる必要があります')).toBeVisible({ timeout: 2000 });
  });

  test('バリデーションエラーが表示される（8時間超の勤務で休憩60分未満）', async ({ page }) => {
    // 予定セルをクリック
    const firstPlannedCell = page.locator('tbody tr:nth-child(1) td:nth-child(2)');
    await firstPlannedCell.click();

    // モーダルが開くのを待つ
    await expect(page.getByText('シフト編集 - 予定')).toBeVisible({ timeout: 2000 });

    // シフトタイプを選択
    await page.locator('select').first().selectOption('日勤');

    // 9時間勤務で休憩30分を設定
    const startTimeInput = page.locator('input[type="time"]').first();
    await startTimeInput.fill('09:00');

    const endTimeInput = page.locator('input[type="time"]').nth(1);
    await endTimeInput.fill('18:00');

    const breakInput = page.locator('input[type="number"]');
    await breakInput.fill('30');

    // 確認ボタンをクリック
    await page.getByRole('button', { name: '確認' }).click();

    // エラーメッセージが表示されることを確認
    await expect(page.getByText('8時間超の勤務には60分以上の休憩が必要です')).toBeVisible({ timeout: 2000 });
  });

  test('2段書き表示が正しく表示される（予定行と実績行）', async ({ page }) => {
    // 最初のスタッフの行を確認
    // tbody内の最初の2行（予定行と実績行）を確認
    const firstStaffRows = page.locator('tbody tr:nth-child(-n+2)');
    await expect(firstStaffRows).toHaveCount(2);

    // スタッフ名のセルがrowSpan=2で表示されることを確認
    const staffNameCell = page.locator('tbody tr:nth-child(1) td:nth-child(1)');
    await expect(staffNameCell).toHaveAttribute('rowspan', '2');
  });

  test.skip('差異がある場合にハイライトが表示される', async ({ page }) => {
    // このテストは実際に差異を作成する必要があるため、skip
    // 手動テストまたは統合テストで確認すること

    // 予定シフトを設定
    // 実績シフトを異なる値で設定
    // 差異セルがring-2 ring-orange-400クラスを持つことを確認
  });
});
