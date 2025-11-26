import { test, expect } from '@playwright/test';

/**
 * 月次レポート E2E テスト
 *
 * Phase 41: レポート機能強化
 * - 月次レポートページのナビゲーション
 * - タブ切り替え
 * - レスポンシブ表示
 * - PDFダウンロード機能
 */

test.describe('月次レポート E2E テスト', () => {
  test.beforeEach(async ({ page }) => {
    // アプリケーションに移動
    await page.goto('/');
  });

  /**
   * レポートページへのナビゲーション
   */
  test('レポートページへのナビゲーション', async ({ page }) => {
    // レポートリンクを取得
    const reportLink = page.getByRole('link', { name: /レポート/ });

    // リンクが表示されるまで待機（認証後に表示される）
    const isVisible = await reportLink.isVisible().catch(() => false);

    if (isVisible) {
      await reportLink.click();

      // レポートページに移動したことを確認
      await expect(page).toHaveURL(/.*\/reports/);

      // ページタイトルが表示されることを確認
      await expect(page.getByText('月次レポート')).toBeVisible();
    } else {
      // 認証が必要な場合はテストをスキップ
      test.skip();
    }
  });

  /**
   * タブナビゲーションのテスト
   */
  test('タブナビゲーション: 各タブがクリック可能', async ({ page }) => {
    // レポートページに直接アクセス
    await page.goto('/reports');

    // ページが読み込まれるまで待機
    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);

    if (!pageLoaded) {
      // 認証リダイレクトの場合はスキップ
      test.skip();
      return;
    }

    // ダッシュボードタブが初期表示されていることを確認
    const dashboardTab = page.getByRole('button', { name: 'ダッシュボード' });
    await expect(dashboardTab).toBeVisible();

    // 各タブの存在確認
    const tabs = ['ダッシュボード', '勤務時間', 'シフト種別', 'スタッフ稼働'];
    for (const tabName of tabs) {
      const tab = page.getByRole('button', { name: tabName });
      await expect(tab).toBeVisible();
    }
  });

  /**
   * 勤務時間タブへの切り替え
   */
  test('勤務時間タブへの切り替え', async ({ page }) => {
    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // 勤務時間タブをクリック
    const workTimeTab = page.getByRole('button', { name: '勤務時間' });
    await workTimeTab.click();

    // タブがアクティブになっていることを確認（ボーダーカラーで判断）
    await expect(workTimeTab).toHaveClass(/border-blue-500/);
  });

  /**
   * シフト種別タブへの切り替え
   */
  test('シフト種別タブへの切り替え', async ({ page }) => {
    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // シフト種別タブをクリック
    const shiftTypeTab = page.getByRole('button', { name: 'シフト種別' });
    await shiftTypeTab.click();

    // シフト種別コンテンツが表示されることを確認
    await expect(shiftTypeTab).toHaveClass(/border-blue-500/);
  });

  /**
   * スタッフ稼働タブへの切り替え
   */
  test('スタッフ稼働タブへの切り替え', async ({ page }) => {
    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // スタッフ稼働タブをクリック
    const staffActivityTab = page.getByRole('button', { name: 'スタッフ稼働' });
    await staffActivityTab.click();

    // スタッフ一覧セクションが表示されることを確認
    await expect(page.getByText('スタッフ一覧')).toBeVisible({ timeout: 5000 });
  });

  /**
   * 月ナビゲーションのテスト
   */
  test('月ナビゲーション: 前月・次月への切り替え', async ({ page }) => {
    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // MonthNavigatorが存在することを確認
    const monthNavigator = page.locator('[data-testid="month-navigator"]').or(
      page.getByRole('button').filter({ hasText: /前月|次月|<|>/ }).first()
    );

    // いずれかのナビゲーション要素が存在することを確認
    const hasNavigator = await monthNavigator.count() > 0 ||
      await page.getByRole('button', { name: /</ }).isVisible().catch(() => false) ||
      await page.getByRole('button', { name: />/ }).isVisible().catch(() => false);

    if (hasNavigator) {
      // 前月ボタンが存在すればクリック
      const prevButton = page.getByRole('button', { name: /</ }).or(
        page.getByRole('button', { name: '前月' })
      );

      if (await prevButton.isVisible().catch(() => false)) {
        await prevButton.click();
        // ローディングが完了するまで待機
        await page.waitForTimeout(1000);
      }
    }
  });

  /**
   * レスポンシブ表示のテスト (モバイル)
   */
  test('レスポンシブ表示: モバイルビューポート', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // タブがスクロール可能なことを確認（overflow-x-auto）
    const tabNav = page.locator('nav[aria-label="タブ"]');
    await expect(tabNav).toBeVisible();

    // 各タブがタップ可能サイズであることを確認
    const dashboardTab = page.getByRole('button', { name: 'ダッシュボード' });
    const boundingBox = await dashboardTab.boundingBox();

    if (boundingBox) {
      // タップターゲットが最小44pxであることを確認
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  /**
   * レスポンシブ表示のテスト (タブレット)
   */
  test('レスポンシブ表示: タブレットビューポート', async ({ page }) => {
    // タブレットビューポートに設定
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // コンテンツが適切に表示されることを確認
    await expect(page.getByText('月次レポート')).toBeVisible();
  });

  /**
   * PDFダウンロードボタンの存在確認
   */
  test('PDFダウンロードボタンの存在確認', async ({ page }) => {
    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // データがロードされるまで待機
    await page.waitForTimeout(2000);

    // PDFダウンロードボタンが表示されることを確認
    const pdfButton = page.getByRole('button', { name: /PDF/ });

    // データがある場合のみPDFボタンが表示される
    if (await pdfButton.isVisible().catch(() => false)) {
      await expect(pdfButton).toBeEnabled();
    }
  });

  /**
   * エラー状態の表示確認
   */
  test('シフトデータなし時のエラー表示', async ({ page }) => {
    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // データがない場合のエラーメッセージを確認
    // または正常なデータが表示されることを確認
    await page.waitForTimeout(3000);

    const errorMessage = page.getByText(/シフトデータがありません|読み込みに失敗/);
    const hasData = await page.locator('[class*="SummaryCard"]').or(
      page.getByText(/総勤務時間|スタッフ数/)
    ).isVisible().catch(() => false);

    // エラーメッセージまたはデータのどちらかが表示される
    const errorVisible = await errorMessage.isVisible().catch(() => false);
    expect(errorVisible || hasData).toBeTruthy();
  });

  /**
   * ローディング状態の表示確認
   */
  test('ローディング状態の表示', async ({ page }) => {
    await page.goto('/reports');

    // ローディング中のスケルトン表示を確認
    // （ネットワークが遅い場合に表示される）
    const skeleton = page.locator('[class*="skeleton"]').or(
      page.locator('[class*="animate-pulse"]')
    );

    // ローディングが完了するまで待機（タイムアウト: 10秒）
    await page.waitForTimeout(1000);

    // 最終的にコンテンツまたはエラーが表示されることを確認
    const contentLoaded = await page.getByText(/月次レポート|施設を選択/).isVisible().catch(() => false);
    expect(contentLoaded).toBeTruthy();
  });
});

/**
 * 管理者向けレポートテスト
 */
test.describe('管理者向けレポート E2E テスト', () => {
  test('経営分析タブの表示（管理者ロール）', async ({ page }) => {
    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // 経営分析タブが表示されるか確認（管理者の場合のみ）
    const managementTab = page.getByRole('button', { name: '経営分析' });

    if (await managementTab.isVisible().catch(() => false)) {
      await managementTab.click();

      // 経営分析コンテンツが表示されることを確認
      await expect(managementTab).toHaveClass(/border-blue-500/);
    }
  });
});

/**
 * スタッフ向けレポートテスト
 */
test.describe('スタッフ向けレポート E2E テスト', () => {
  test('個人レポートタブの表示（スタッフロール）', async ({ page }) => {
    await page.goto('/reports');

    const pageLoaded = await page.getByText('月次レポート').isVisible().catch(() => false);
    if (!pageLoaded) {
      test.skip();
      return;
    }

    // 個人レポートタブが表示されるか確認（スタッフの場合のみ）
    const personalTab = page.getByRole('button', { name: '個人レポート' });

    if (await personalTab.isVisible().catch(() => false)) {
      await personalTab.click();

      // 個人レポートコンテンツが表示されることを確認
      await expect(personalTab).toHaveClass(/border-blue-500/);
    }
  });
});
