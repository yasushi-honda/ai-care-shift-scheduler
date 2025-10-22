import { test, expect } from '@playwright/test';

/**
 * アプリケーション基本動作テスト
 */
test.describe('アプリケーション基本動作', () => {
  test('ページが正しく読み込まれる', async ({ page }) => {
    await page.goto('/');

    // タイトル確認
    await expect(page).toHaveTitle(/AIシフト自動作成/);

    // ヘッダー確認
    await expect(page.getByRole('heading', { name: 'AIシフト自動作成' })).toBeVisible();
    await expect(page.getByText('介護・福祉事業所向け')).toBeVisible();
  });

  test('左パネル（設定エリア）が表示される', async ({ page }) => {
    await page.goto('/');

    // スタッフ情報設定アコーディオン
    await expect(page.getByText('スタッフ情報設定')).toBeVisible();

    // シフト要件設定アコーディオン
    await expect(page.getByText('事業所のシフト要件設定')).toBeVisible();

    // シフト作成実行ボタン
    await expect(page.getByRole('button', { name: 'シフト作成実行' })).toBeVisible();
  });

  test('右パネル（シフト表示エリア）が表示される', async ({ page }) => {
    await page.goto('/');

    // デモシフト作成ボタン
    await expect(page.getByRole('button', { name: 'デモシフト作成' })).toBeVisible();

    // CSVダウンロードボタン
    await expect(page.getByRole('button', { name: 'CSV形式でダウンロード' })).toBeVisible();

    // タブ切り替え
    await expect(page.getByRole('button', { name: 'シフト表' })).toBeVisible();
    await expect(page.getByRole('button', { name: '休暇希望入力' })).toBeVisible();
  });

  test('対象月が表示される', async ({ page }) => {
    await page.goto('/');

    // デフォルト月（2025年11月）の表示確認
    await expect(page.getByText('2025年 11月')).toBeVisible();
  });

  test('初期スタッフが表示される', async ({ page }) => {
    await page.goto('/');

    // スタッフ情報設定を開く
    await page.getByText('スタッフ情報設定').click();

    // 初期スタッフの確認
    await expect(page.getByText('田中 愛')).toBeVisible();
    await expect(page.getByText('鈴木 太郎')).toBeVisible();
    await expect(page.getByText('佐藤 花子')).toBeVisible();
    await expect(page.getByText('高橋 健太')).toBeVisible();
    await expect(page.getByText('渡辺 久美子')).toBeVisible();
  });
});
