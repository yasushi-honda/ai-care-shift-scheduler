import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-helper';

/**
 * Phase 26.1: E2Eテスト追加
 * TC1: 改善1「予定と同じ内容を入力」ボタンのテスト
 *
 * テスト対象: ShiftEditConfirmModal.tsx内の「予定と同じ内容を入力」ボタン
 * 実装コミット: f551c3e (Phase 25.2.5)
 *
 * テスト環境:
 * - Firebase Auth Emulator (http://localhost:9099)
 * - Firestore Emulator (http://localhost:8080)
 *
 * 実行方法:
 * PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run test:e2e
 */

test.describe('Phase 26.1: 改善1「予定と同じ」ボタン', () => {
  test.beforeEach(async ({ page }) => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();

    // Managerロールでログイン
    await setupAuthenticatedUser(page, {
      email: 'manager@test.com',
      password: 'password123',
      displayName: 'Test Manager',
      role: 'admin',
      facilities: [{ facilityId: 'test-facility-001', role: 'admin' }],
    });

    // デモシフト作成
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'デモシフト作成' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'デモシフト作成' }).click();

    // シフト表が表示されるまで待機
    await expect(page.getByRole('cell', { name: '田中 愛' })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC1-1: 予定シフトが存在する場合、「予定と同じ」ボタンをクリック
   * 期待結果: 実績シフトが予定シフトと同じ内容で作成される
   */
  test('TC1-1: 予定シフトが存在する場合、実績に同じ内容がコピーされる', async ({ page }) => {
    // Step 1: 予定シフトの内容を確認（田中 愛の1日目）
    const plannedCell = page.locator('tbody tr:nth-child(1) td:nth-child(2)');
    await plannedCell.click();

    // 予定編集モーダルが開くことを確認
    await expect(page.getByText('シフト編集 - 予定')).toBeVisible({ timeout: 3000 });

    // 予定シフトのタイプ・時刻を記録（デモシフトのデフォルト値）
    const plannedShiftType = await page.locator('select').first().inputValue();
    const plannedStartTime = await page.locator('input[type="time"]').first().inputValue();
    const plannedEndTime = await page.locator('input[type="time"]').nth(1).inputValue();

    console.log('[TC1-1] 予定シフト:', { plannedShiftType, plannedStartTime, plannedEndTime });

    // モーダルを閉じる
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page.getByText('シフト編集 - 予定')).not.toBeVisible({ timeout: 2000 });

    // Step 2: 実績シフトセルを開く
    const actualCell = page.locator('tbody tr:nth-child(2) td:nth-child(2)');
    await actualCell.click();

    // 実績編集モーダルが開くことを確認
    await expect(page.getByText('シフト編集 - 実績')).toBeVisible({ timeout: 3000 });

    // Step 3: 「予定と同じ内容を入力」ボタンをクリック
    const copyButton = page.getByRole('button', { name: /予定と同じ/ });
    await expect(copyButton).toBeVisible({ timeout: 2000 });
    await copyButton.click();

    // ボタンクリック後、予定シフトの内容が実績入力フォームにコピーされることを確認
    await expect(page.locator('select').first()).toHaveValue(plannedShiftType);
    await expect(page.locator('input[type="time"]').first()).toHaveValue(plannedStartTime);
    await expect(page.locator('input[type="time"]').nth(1)).toHaveValue(plannedEndTime);

    console.log('[TC1-1] ✅ 予定シフト内容がフォームにコピーされました');

    // Step 4: 確認ダイアログを承認して保存
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '確認' }).click();

    // モーダルが閉じることを確認
    await expect(page.getByText('シフト編集 - 実績')).not.toBeVisible({ timeout: 3000 });

    // Step 5: 実績シフトを再度開いて、保存された内容を検証
    await actualCell.click();
    await expect(page.getByText('シフト編集 - 実績')).toBeVisible({ timeout: 3000 });

    await expect(page.locator('select').first()).toHaveValue(plannedShiftType);
    await expect(page.locator('input[type="time"]').first()).toHaveValue(plannedStartTime);
    await expect(page.locator('input[type="time"]').nth(1)).toHaveValue(plannedEndTime);

    console.log('[TC1-1] ✅ 実績シフトが予定と同じ内容で保存されました');
  });

  /**
   * TC1-2: 予定シフトが存在しない場合
   * 期待結果: 「予定と同じ」ボタンが非表示またはdisabled
   *
   * Note: デモシフト作成時は全日予定が作成されるため、
   * このテストは予定を削除した状態で実行する必要がある
   */
  test.skip('TC1-2: 予定シフトが存在しない場合、ボタンが非表示またはdisabled', async ({ page }) => {
    // TODO Phase 27: 予定シフト削除機能実装後にテスト追加
    // 現在のデモシフト作成では全日予定が作成されるため、スキップ
  });

  /**
   * TC1-3: すでに実績が入力済みの場合、「予定と同じ」ボタンをクリック
   * 期待結果: 実績シフトが上書きされる
   */
  test('TC1-3: すでに実績が入力済みの場合、上書きされる', async ({ page }) => {
    // Step 1: 実績シフトを手動入力
    const actualCell = page.locator('tbody tr:nth-child(2) td:nth-child(2)');
    await actualCell.click();
    await expect(page.getByText('シフト編集 - 実績')).toBeVisible({ timeout: 3000 });

    // 手動で異なる内容を入力
    await page.locator('select').first().selectOption('遅番');
    await page.locator('input[type="time"]').first().fill('11:00');
    await page.locator('input[type="time"]').nth(1).fill('19:00');

    // 保存
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '確認' }).click();
    await expect(page.getByText('シフト編集 - 実績')).not.toBeVisible({ timeout: 3000 });

    // Step 2: 実績シフトを再度開いて「予定と同じ」ボタンをクリック
    await actualCell.click();
    await expect(page.getByText('シフト編集 - 実績')).toBeVisible({ timeout: 3000 });

    // 「予定と同じ内容を入力」ボタンをクリック
    const copyButton = page.getByRole('button', { name: /予定と同じ/ });
    await expect(copyButton).toBeVisible({ timeout: 2000 });
    await copyButton.click();

    // Step 3: 予定シフトの内容が反映されることを確認（上書き）
    // デモシフトのデフォルト値（日勤）に戻ることを期待
    const shiftType = await page.locator('select').first().inputValue();
    expect(shiftType).not.toBe('遅番'); // 手動入力した「遅番」ではない

    console.log('[TC1-3] ✅ 実績シフトが予定の内容で上書きされました');

    // 保存
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '確認' }).click();
  });

  /**
   * TC1-4: コピー後、成功メッセージが表示される
   * 期待結果: トースト通知が表示される
   *
   * Note: 現在の実装ではトースト通知がないため、スキップ
   * Phase 27で実装予定
   */
  test.skip('TC1-4: コピー後、成功メッセージが表示される', async ({ page }) => {
    // TODO Phase 27: トースト通知実装後にテスト追加
  });

  /**
   * TC1-5: 権限のないユーザー（Staff）がアクセス
   * 期待結果: ボタンが非表示またはエラー
   *
   * Note: Phase 25の実装では権限チェックがないため、Phase 27で実装予定
   */
  test.skip('TC1-5: 権限のないユーザー（Staff）がアクセスした場合', async ({ page }) => {
    // TODO Phase 27: RBAC権限チェック実装後にテスト追加
  });
});
