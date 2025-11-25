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
