import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-helper';
import { TEST_STAFF, TEST_FACILITY_ID } from './fixtures';

/**
 * Phase 26.1: E2Eテスト追加
 * TC2: 改善2「一括コピー」機能のテスト
 *
 * テスト対象:
 * - BulkCopyPlannedToActualModal.tsx
 * - ShiftTable.tsx内の「予定を実績にコピー」ボタン
 * 実装コミット: e80f5d1 (Phase 25.2.5)
 *
 * Phase 2: テストフィクスチャを使用するよう修正
 *
 * 注意: Phase 43でデモシフト作成機能が削除されたため、
 *       このテストファイルは現在スキップされています。
 *       AIシフト生成を使用したテストに書き換える必要があります。
 *
 * テスト環境:
 * - Firebase Auth Emulator (http://localhost:9099)
 * - Firestore Emulator (http://localhost:8080)
 *
 * 実行方法:
 * PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run test:e2e
 */

// テスト用スタッフ参照
const FIRST_STAFF = TEST_STAFF[0];

// Phase 43でデモシフト作成機能が削除されたため、このテストスイート全体をスキップ
test.describe.skip('Phase 26.1: 改善2「一括コピー」機能（デモシフト削除済み）', () => {
  test.beforeEach(async ({ page }) => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();

    // Managerロールでログイン（フィクスチャの施設IDを使用）
    await setupAuthenticatedUser(page, {
      email: 'manager@test.com',
      password: 'password123',
      displayName: 'Test Manager',
      role: 'admin',
      facilities: [{ facilityId: TEST_FACILITY_ID, role: 'admin' }],
    });

    // デモシフト作成
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'デモシフト作成' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'デモシフト作成' }).click();

    // シフト表が表示されるまで待機
    await expect(page.getByRole('cell', { name: FIRST_STAFF.name })).toBeVisible({ timeout: 10000 });
  });

  /**
   * TC2-1: 一括コピーモーダルを開く
   * 期待結果: モーダルが表示される
   */
  test('TC2-1: 一括コピーモーダルを開く', async ({ page }) => {
    // 「予定を実績にコピー」ボタンをクリック
    const bulkCopyButton = page.getByRole('button', { name: /予定を実績にコピー/ });
    await expect(bulkCopyButton).toBeVisible({ timeout: 5000 });
    await bulkCopyButton.click();

    // モーダルが開くことを確認
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 3000 });

    // モーダル内の要素を確認
    await expect(page.getByText('スタッフ選択')).toBeVisible();
    await expect(page.getByText('期間')).toBeVisible();
    await expect(page.getByRole('button', { name: '実行' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible();

    console.log('[TC2-1] ✅ 一括コピーモーダルが正常に表示されました');

    // モーダルを閉じる
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page.getByText('予定を実績にコピー')).not.toBeVisible({ timeout: 2000 });
  });

  /**
   * TC2-2: 複数スタッフを選択して一括コピー実行
   * 期待結果: 選択されたスタッフの予定が実績にコピーされる
   */
  test('TC2-2: 複数スタッフを選択して一括コピー実行', async ({ page }) => {
    // 一括コピーモーダルを開く
    const bulkCopyButton = page.getByRole('button', { name: /予定を実績にコピー/ });
    await bulkCopyButton.click();
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 3000 });

    // デモシフト作成時、デフォルトで実績未入力のスタッフが自動選択されていることを確認
    // チェックボックスがチェック済みであることを確認
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    let checkedCount = 0;
    for (let i = 0; i < checkboxCount; i++) {
      if (await checkboxes.nth(i).isChecked()) {
        checkedCount++;
      }
    }
    console.log('[TC2-2] 選択済みスタッフ数:', checkedCount);
    expect(checkedCount).toBeGreaterThan(0); // 少なくとも1名は選択されている

    // 対象月の期間が自動設定されていることを確認
    const startDateInput = page.locator('input[name="start"]');
    const endDateInput = page.locator('input[name="end"]');
    const startDate = await startDateInput.inputValue();
    const endDate = await endDateInput.inputValue();
    console.log('[TC2-2] 期間:', { startDate, endDate });
    expect(startDate).toBeTruthy();
    expect(endDate).toBeTruthy();

    // 確認ダイアログハンドラを登録
    const dialogPromise = page.waitForEvent('dialog');

    // 実行ボタンをクリック
    await page.getByRole('button', { name: '実行' }).click();

    // ダイアログを処理
    const dialog = await dialogPromise;
    console.log('[TC2-2] 確認ダイアログメッセージ:', dialog.message());
    expect(dialog.message()).toContain('件'); // 「〇〇件の予定を実績にコピーします」
    await dialog.accept();

    // モーダルが閉じることを確認（処理完了）
    await expect(page.getByText('予定を実績にコピー')).not.toBeVisible({ timeout: 10000 });

    console.log('[TC2-2] ✅ 一括コピーが正常に実行されました');
  });

  /**
   * TC2-3: 日付範囲を指定して一括コピー実行
   * 期待結果: 指定期間内の予定が実績にコピーされる
   */
  test('TC2-3: 日付範囲を指定して一括コピー実行', async ({ page }) => {
    // 一括コピーモーダルを開く
    const bulkCopyButton = page.getByRole('button', { name: /予定を実績にコピー/ });
    await bulkCopyButton.click();
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 3000 });

    // 日付範囲を手動で変更（例: 今月1日～7日のみ）
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const customStartDate = `${year}-${month}-01`;
    const customEndDate = `${year}-${month}-07`;

    await page.locator('input[name="start"]').fill(customStartDate);
    await page.locator('input[name="end"]').fill(customEndDate);

    console.log('[TC2-3] カスタム期間:', { customStartDate, customEndDate });

    // 確認ダイアログハンドラを登録
    const dialogPromise = page.waitForEvent('dialog');

    // 実行ボタンをクリック
    await page.getByRole('button', { name: '実行' }).click();

    // ダイアログを処理
    const dialog = await dialogPromise;
    console.log('[TC2-3] 確認ダイアログメッセージ:', dialog.message());
    await dialog.accept();

    // モーダルが閉じることを確認
    await expect(page.getByText('予定を実績にコピー')).not.toBeVisible({ timeout: 10000 });

    console.log('[TC2-3] ✅ カスタム期間での一括コピーが正常に実行されました');
  });

  /**
   * TC2-4: スタッフ未選択でコピー実行
   * 期待結果: エラーメッセージが表示される
   */
  test('TC2-4: スタッフ未選択でコピー実行するとエラーメッセージが表示される', async ({ page }) => {
    // 一括コピーモーダルを開く
    const bulkCopyButton = page.getByRole('button', { name: /予定を実績にコピー/ });
    await bulkCopyButton.click();
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 3000 });

    // すべてのスタッフ選択を解除
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      const isChecked = await checkbox.isChecked();
      if (isChecked) {
        await checkbox.click();
      }
    }

    // 選択解除を確認
    const totalCheckboxes = await checkboxes.count();
    let remainingChecked = 0;
    for (let i = 0; i < totalCheckboxes; i++) {
      if (await checkboxes.nth(i).isChecked()) {
        remainingChecked++;
      }
    }
    expect(remainingChecked).toBe(0);
    console.log('[TC2-4] スタッフ選択を全解除しました');

    // アラートダイアログハンドラを登録
    const dialogPromise = page.waitForEvent('dialog');

    // 実行ボタンをクリック
    await page.getByRole('button', { name: '実行' }).click();

    // ダイアログを処理
    const dialog = await dialogPromise;
    console.log('[TC2-4] アラートメッセージ:', dialog.message());
    expect(dialog.message()).toContain('スタッフを1名以上選択してください');
    await dialog.accept();

    // モーダルは閉じない（エラー状態）
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 2000 });

    console.log('[TC2-4] ✅ スタッフ未選択時のエラーメッセージが表示されました');

    // モーダルを閉じる
    await page.getByRole('button', { name: 'キャンセル' }).click();
  });

  /**
   * TC2-5: 日付範囲未入力でコピー実行
   * 期待結果: エラーメッセージが表示される
   */
  test('TC2-5: 日付範囲未入力でコピー実行するとエラーメッセージが表示される', async ({ page }) => {
    // 一括コピーモーダルを開く
    const bulkCopyButton = page.getByRole('button', { name: /予定を実績にコピー/ });
    await bulkCopyButton.click();
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 3000 });

    // 開始日をクリアする
    await page.locator('input[name="start"]').clear();

    // アラートダイアログハンドラを登録
    const dialogPromise = page.waitForEvent('dialog');

    // 実行ボタンをクリック
    await page.getByRole('button', { name: '実行' }).click();

    // ダイアログを処理
    const dialog = await dialogPromise;
    console.log('[TC2-5] アラートメッセージ:', dialog.message());
    expect(dialog.message()).toContain('日付'); // 「開始日と終了日を入力してください」等
    await dialog.accept();

    // モーダルは閉じない（エラー状態）
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 2000 });

    console.log('[TC2-5] ✅ 日付範囲未入力時のエラーメッセージが表示されました');

    // モーダルを閉じる
    await page.getByRole('button', { name: 'キャンセル' }).click();
  });

  /**
   * TC2-6: 開始日 > 終了日の場合
   * 期待結果: バリデーションエラーが表示される
   */
  test('TC2-6: 開始日が終了日より後の場合、バリデーションエラーが表示される', async ({ page }) => {
    // 一括コピーモーダルを開く
    const bulkCopyButton = page.getByRole('button', { name: /予定を実績にコピー/ });
    await bulkCopyButton.click();
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 3000 });

    // 無効な日付範囲を設定（開始日 > 終了日）
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const invalidStartDate = `${year}-${month}-15`;
    const invalidEndDate = `${year}-${month}-10`;

    await page.locator('input[name="start"]').fill(invalidStartDate);
    await page.locator('input[name="end"]').fill(invalidEndDate);

    console.log('[TC2-6] 無効な日付範囲:', { invalidStartDate, invalidEndDate });

    // アラートダイアログハンドラを登録
    const dialogPromise = page.waitForEvent('dialog');

    // 実行ボタンをクリック
    await page.getByRole('button', { name: '実行' }).click();

    // ダイアログを処理
    const dialog = await dialogPromise;
    console.log('[TC2-6] アラートメッセージ:', dialog.message());
    expect(dialog.message()).toContain('開始日'); // 「開始日は終了日より前にしてください」等
    await dialog.accept();

    // モーダルは閉じない（エラー状態）
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 2000 });

    console.log('[TC2-6] ✅ 日付範囲バリデーションエラーが表示されました');

    // モーダルを閉じる
    await page.getByRole('button', { name: 'キャンセル' }).click();
  });

  /**
   * TC2-7: コピー後、成功メッセージが表示される
   * 期待結果: トースト通知が表示される
   *
   * Note: 現在の実装では確認ダイアログのみでトースト通知がないため、スキップ
   * Phase 27で実装予定
   */
  test.skip('TC2-7: コピー後、成功メッセージが表示される', async ({ page }) => {
    // TODO Phase 27: トースト通知実装後にテスト追加
  });

  /**
   * TC2-8: 権限のないユーザー（Staff）がアクセス
   * 期待結果: モーダルが開けない、またはエラー
   *
   * Note: Phase 25の実装では権限チェックがないため、Phase 27で実装予定
   */
  test.skip('TC2-8: 権限のないユーザー（Staff）がアクセスした場合', async ({ page }) => {
    // TODO Phase 27: RBAC権限チェック実装後にテスト追加
  });

  /**
   * TC2-Extra: ESCキーでモーダルを閉じる
   * 期待結果: モーダルが閉じる
   */
  test('TC2-Extra: ESCキーでモーダルを閉じる', async ({ page }) => {
    // 一括コピーモーダルを開く
    const bulkCopyButton = page.getByRole('button', { name: /予定を実績にコピー/ });
    await bulkCopyButton.click();
    await expect(page.getByText('予定を実績にコピー')).toBeVisible({ timeout: 3000 });

    // ESCキーを押す
    await page.keyboard.press('Escape');

    // モーダルが閉じることを確認
    await expect(page.getByText('予定を実績にコピー')).not.toBeVisible({ timeout: 2000 });

    console.log('[TC2-Extra] ✅ ESCキーでモーダルが閉じました');
  });
});
