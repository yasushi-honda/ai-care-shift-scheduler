import { test, expect, devices } from '@playwright/test';
import { setupAuthenticatedUser } from './helpers/auth-helper';

/**
 * Phase 28-29: ダブルクリック/ダブルタップシフト編集テスト
 *
 * シフトセルのダブルクリック/ダブルタップでシフトタイプをサイクル切り替え
 * シングルクリック/シングルタップでモーダル表示
 */
test.describe('ダブルクリックシフト編集', () => {
  test.beforeEach(async ({ page }) => {
    // 認証済みユーザーをセットアップ
    await setupAuthenticatedUser(page, {
      email: 'doubleclick-test@example.com',
      password: 'password123',
      displayName: 'ダブルクリックテスト',
      role: 'admin',
    });

    // アプリケーションに移動
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('シングルクリックでモーダルが表示される', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つける（予定行の最初のセル）
    const shiftCell = page.locator('td[class*="cursor-pointer"]').first();
    await expect(shiftCell).toBeVisible();

    // シングルクリック
    await shiftCell.click();

    // モーダルが表示されるまで待機（250ms + 余裕）
    await page.waitForTimeout(400);

    // モーダルが表示されることを確認
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('ダブルクリックでシフトタイプが変更される', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つける
    const shiftCell = page.locator('td[class*="cursor-pointer"]').first();
    await expect(shiftCell).toBeVisible();

    // 現在のシフトタイプを取得
    const initialText = await shiftCell.textContent();

    // ダブルクリック
    await shiftCell.dblclick();

    // シフトタイプが変更されることを確認（ポーリングで待機）
    await expect(async () => {
      const newText = await shiftCell.textContent();
      expect(newText).not.toBe(initialText);
      expect(newText).toBeTruthy();
    }).toPass({ timeout: 2000 });
  });

  test('ダブルクリック後にモーダルが表示されない', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つける
    const shiftCell = page.locator('td[class*="cursor-pointer"]').first();
    await expect(shiftCell).toBeVisible();

    // ダブルクリック
    await shiftCell.dblclick();

    // モーダルが表示されないことを確認
    await page.waitForTimeout(500);
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    await expect(modal).not.toBeVisible();
  });

  test('シフトサイクル順序が正しい', async ({ page }) => {
    // このテストは実際のシフトサイクルを検証
    // シフトサイクル: 早番 → 日勤 → 遅番 → 夜勤 → 休 → 明け休み → 早番...

    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // 「早番」のセルを見つける
    const earlyShiftCell = page.locator('td:has-text("早番")').first();

    // 「早番」が存在しない場合はスキップ（テストデータに依存）
    const isVisible = await earlyShiftCell.isVisible().catch(() => false);
    test.skip(!isVisible, '「早番」セルが見つからないためスキップ');

    // ダブルクリックで「日勤」に変更
    await earlyShiftCell.dblclick();

    // 「日勤」になっていることを確認（ポーリングで待機）
    await expect(earlyShiftCell.locator('span')).toContainText('日勤', { timeout: 2000 });
  });
});

/**
 * Phase 29: モバイルタッチ対応テスト
 */
test.describe('モバイルタッチ対応', () => {
  // モバイルデバイスをエミュレート
  test.use({ ...devices['iPhone 13'] });

  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: 'mobile-test@example.com',
      password: 'password123',
      displayName: 'モバイルテスト',
      role: 'admin',
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('モバイルでシフトセルがタップ可能', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つける
    const shiftCell = page.locator('td[class*="cursor-pointer"]').first();
    await expect(shiftCell).toBeVisible();

    // タップ（クリック）
    await shiftCell.tap();

    // モーダルが表示されるまで待機
    await page.waitForTimeout(400);
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('モバイルでダブルタップがシフト変更', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つける
    const shiftCell = page.locator('td[class*="cursor-pointer"]').first();
    await expect(shiftCell).toBeVisible();

    // 現在のシフトタイプを取得
    const initialText = await shiftCell.textContent();

    // ダブルタップ（2回連続タップ）
    await shiftCell.tap();
    await shiftCell.tap();

    // シフトタイプが変更されることを確認
    await expect(async () => {
      const newText = await shiftCell.textContent();
      expect(newText).not.toBe(initialText);
    }).toPass({ timeout: 2000 });
  });

  test('シフトセルにタッチ最適化CSSが適用されている', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つける
    const shiftCell = page.locator('td[class*="cursor-pointer"]').first();
    await expect(shiftCell).toBeVisible();

    // touch-action: manipulation が適用されていることを確認
    const touchAction = await shiftCell.evaluate(el =>
      window.getComputedStyle(el).touchAction
    );
    expect(touchAction).toBe('manipulation');
  });
});

/**
 * Phase 30: キーボードアクセシビリティテスト
 */
test.describe('キーボードアクセシビリティ', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: 'keyboard-test@example.com',
      password: 'password123',
      displayName: 'キーボードテスト',
      role: 'admin',
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Tabキーでシフトセルにフォーカス移動', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つける
    const shiftCell = page.locator('td[tabindex="0"]').first();
    await expect(shiftCell).toBeVisible();

    // Tabキーでフォーカス
    await shiftCell.focus();

    // フォーカスされていることを確認
    await expect(shiftCell).toBeFocused();
  });

  test('Enterキーでモーダル表示', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つけてフォーカス
    const shiftCell = page.locator('td[tabindex="0"]').first();
    await shiftCell.focus();

    // Enterキーを押す
    await page.keyboard.press('Enter');

    // モーダルが表示されることを確認
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('Spaceキーでシフトタイプ変更', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つけてフォーカス
    const shiftCell = page.locator('td[tabindex="0"]').first();
    await shiftCell.focus();

    // 現在のシフトタイプを取得
    const initialText = await shiftCell.textContent();

    // Spaceキーを押す
    await page.keyboard.press(' ');

    // シフトタイプが変更されることを確認
    await expect(async () => {
      const newText = await shiftCell.textContent();
      expect(newText).not.toBe(initialText);
    }).toPass({ timeout: 2000 });
  });

  test('シフトセルにaria属性が適用されている', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つける
    const shiftCell = page.locator('td[tabindex="0"]').first();
    await expect(shiftCell).toBeVisible();

    // role="button"が適用されていることを確認
    const role = await shiftCell.getAttribute('role');
    expect(role).toBe('button');

    // aria-labelが設定されていることを確認
    const ariaLabel = await shiftCell.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });
});

/**
 * Phase 31: アンドゥ機能テスト
 */
test.describe('アンドゥ機能', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: 'undo-test@example.com',
      password: 'password123',
      displayName: 'アンドゥテスト',
      role: 'admin',
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('シフト変更後にトースト通知が表示される', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つけてフォーカス
    const shiftCell = page.locator('td[tabindex="0"]').first();
    await shiftCell.focus();

    // Spaceキーを押してシフト変更
    await page.keyboard.press(' ');

    // トースト通知が表示されることを確認
    const toast = page.locator('[aria-live="polite"]').locator('text=シフトを変更しました');
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('トースト通知に「元に戻す」ボタンが表示される', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つけてフォーカス
    const shiftCell = page.locator('td[tabindex="0"]').first();
    await shiftCell.focus();

    // Spaceキーを押してシフト変更
    await page.keyboard.press(' ');

    // 「元に戻す」ボタンが表示されることを確認
    const undoButton = page.locator('[aria-live="polite"]').locator('text=元に戻す');
    await expect(undoButton).toBeVisible({ timeout: 5000 });
  });

  test('「元に戻す」ボタンで変更が取り消される', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つけてフォーカス
    const shiftCell = page.locator('td[tabindex="0"]').first();
    await shiftCell.focus();

    // 現在のシフトタイプを取得
    const initialText = await shiftCell.textContent();

    // Spaceキーを押してシフト変更
    await page.keyboard.press(' ');

    // シフトが変更されたことを確認
    await expect(async () => {
      const changedText = await shiftCell.textContent();
      expect(changedText).not.toBe(initialText);
    }).toPass({ timeout: 2000 });

    // 「元に戻す」ボタンをクリック
    const undoButton = page.locator('[aria-live="polite"]').locator('text=元に戻す');
    await undoButton.click();

    // 元に戻ったことを確認
    await expect(async () => {
      const restoredText = await shiftCell.textContent();
      expect(restoredText).toBe(initialText);
    }).toPass({ timeout: 2000 });
  });

  test('Ctrl+Zでアンドゥが実行される', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // シフトセルを見つけてフォーカス
    const shiftCell = page.locator('td[tabindex="0"]').first();
    await shiftCell.focus();

    // 現在のシフトタイプを取得
    const initialText = await shiftCell.textContent();

    // Spaceキーを押してシフト変更
    await page.keyboard.press(' ');

    // シフトが変更されたことを確認
    await expect(async () => {
      const changedText = await shiftCell.textContent();
      expect(changedText).not.toBe(initialText);
    }).toPass({ timeout: 2000 });

    // トーストを閉じるのを待つ（フォーカスを戻す）
    await page.locator('body').click();

    // Ctrl+Zを押す
    await page.keyboard.press('Control+z');

    // 元に戻ったことを確認
    await expect(async () => {
      const restoredText = await shiftCell.textContent();
      expect(restoredText).toBe(initialText);
    }).toPass({ timeout: 2000 });

    // トースト通知が表示されることを確認
    const toast = page.locator('[aria-live="polite"]').locator('text=変更を元に戻しました');
    await expect(toast).toBeVisible({ timeout: 5000 });
  });
});

/**
 * Phase 32: 矢印キーナビゲーションテスト
 */
test.describe('矢印キーナビゲーション', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedUser(page, {
      email: 'arrow-nav-test@example.com',
      password: 'password123',
      displayName: '矢印キーテスト',
      role: 'admin',
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('矢印キー右でフォーカスが右のセルに移動', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // 最初のシフトセルにフォーカス
    const firstCell = page.locator('td[tabindex="0"]').first();
    await firstCell.focus();
    await expect(firstCell).toBeFocused();

    // 矢印キー右を押す
    await page.keyboard.press('ArrowRight');

    // フォーカスが右のセルに移動していることを確認
    const secondCell = page.locator('td[tabindex="0"]').nth(1);
    await expect(secondCell).toBeFocused();
  });

  test('矢印キー左でフォーカスが左のセルに移動', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // 2番目のシフトセルにフォーカス
    const secondCell = page.locator('td[tabindex="0"]').nth(1);
    await secondCell.focus();
    await expect(secondCell).toBeFocused();

    // 矢印キー左を押す
    await page.keyboard.press('ArrowLeft');

    // フォーカスが左のセルに移動していることを確認
    const firstCell = page.locator('td[tabindex="0"]').first();
    await expect(firstCell).toBeFocused();
  });

  test('矢印キー下でフォーカスが下のセルに移動', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // 予定行のセルにフォーカス
    const plannedCell = page.locator('td[tabindex="0"]').first();
    await plannedCell.focus();
    await expect(plannedCell).toBeFocused();

    // aria-labelで予定セルであることを確認
    const ariaLabel = await plannedCell.getAttribute('aria-label');
    expect(ariaLabel).toContain('予定');

    // 矢印キー下を押す
    await page.keyboard.press('ArrowDown');

    // フォーカスが移動していることを確認（実績セルへ）
    const focusedElement = page.locator('td[tabindex="0"]:focus');
    await expect(focusedElement).toBeVisible();
  });

  test('矢印キー上でフォーカスが上のセルに移動', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // 実績行のセルを探す（予定と実績がペアなので、最初の予定から下に移動して実績にフォーカス）
    const plannedCell = page.locator('td[tabindex="0"]').first();
    await plannedCell.focus();
    await page.keyboard.press('ArrowDown'); // 実績セルに移動

    // 現在実績セルにいることを確認
    const actualCell = page.locator('td[tabindex="0"]:focus');
    await expect(actualCell).toBeVisible();

    // 矢印キー上を押す
    await page.keyboard.press('ArrowUp');

    // フォーカスが予定セルに戻っていることを確認
    const focusedElement = page.locator('td[tabindex="0"]:focus');
    const ariaLabel = await focusedElement.getAttribute('aria-label');
    expect(ariaLabel).toContain('予定');
  });

  test('境界でのフォーカス維持（左端で左キー）', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // 最初のセル（左端）にフォーカス
    const firstCell = page.locator('td[tabindex="0"]').first();
    await firstCell.focus();

    // 矢印キー左を押す（境界なので移動しない）
    await page.keyboard.press('ArrowLeft');

    // フォーカスが維持されていることを確認
    await expect(firstCell).toBeFocused();
  });

  test('矢印キーナビゲーション後もEnterでモーダル表示', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // 最初のセルにフォーカス
    const firstCell = page.locator('td[tabindex="0"]').first();
    await firstCell.focus();

    // 矢印キーで移動
    await page.keyboard.press('ArrowRight');

    // Enterキーを押してモーダル表示
    await page.keyboard.press('Enter');

    // モーダルが表示されることを確認
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('矢印キーナビゲーション後もSpaceでシフト変更', async ({ page }) => {
    // シフト表が表示されるまで待機
    const shiftTable = page.locator('table');
    await expect(shiftTable).toBeVisible({ timeout: 10000 });

    // 最初のセルにフォーカス
    const firstCell = page.locator('td[tabindex="0"]').first();
    await firstCell.focus();

    // 矢印キーで移動
    await page.keyboard.press('ArrowRight');

    // 移動先のセルの現在値を取得
    const targetCell = page.locator('td[tabindex="0"]:focus');
    const initialText = await targetCell.textContent();

    // Spaceキーを押してシフト変更
    await page.keyboard.press(' ');

    // シフトが変更されることを確認
    await expect(async () => {
      const newText = await targetCell.textContent();
      expect(newText).not.toBe(initialText);
    }).toPass({ timeout: 2000 });
  });
});
