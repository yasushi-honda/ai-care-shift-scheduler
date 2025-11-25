import { test, expect } from '@playwright/test';

test.describe('モバイル専用ページ検証', () => {
  test.describe('モバイルデバイス', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test('index.htmlがmobile.htmlにリダイレクトされる', async ({ page }) => {
      await page.goto('index.html');
      await page.waitForLoadState('networkidle');

      // mobile.htmlにリダイレクトされることを確認
      expect(page.url()).toContain('mobile.html');
    });

    test('mobile.htmlが正しく表示される', async ({ page }) => {
      await page.goto('mobile.html');

      // ヘッダーの確認
      const header = page.locator('.header h1');
      await expect(header).toContainText('シフト管理システム');

      // カードが表示されることを確認
      const cards = page.locator('.card');
      await expect(cards.first()).toBeVisible();

      // 実装状況テーブルの確認
      const statusTable = page.locator('table').first();
      await expect(statusTable).toBeVisible();

      // モバイル最適化されたリンクの確認
      const technicalLink = page.locator('a[href="technical-mobile.html"]');
      await expect(technicalLink).toBeVisible();
    });

    test('technical.htmlがtechnical-mobile.htmlにリダイレクトされる', async ({ page }) => {
      await page.goto('technical.html');
      await page.waitForLoadState('networkidle');

      // technical-mobile.htmlにリダイレクトされることを確認
      expect(page.url()).toContain('technical-mobile.html');
    });

    test('technical-mobile.htmlが正しく表示される', async ({ page }) => {
      await page.goto('technical-mobile.html');

      // ヘッダーの確認
      const header = page.locator('.header h1');
      await expect(header).toContainText('技術ドキュメント');

      // システム構成セクションの確認
      const systemSection = page.locator('h2').filter({ hasText: 'システム構成' });
      await expect(systemSection).toBeVisible();

      // コードタグの確認
      const codeElements = page.locator('code');
      await expect(codeElements.first()).toBeVisible();
    });

    test('モバイル版から本番環境へのリンクが機能する', async ({ page }) => {
      await page.goto('mobile.html');

      const productionLink = page.locator('a[href="https://ai-care-shift-scheduler.web.app"]');
      await expect(productionLink).toBeVisible();
      await expect(productionLink).toHaveAttribute('href', 'https://ai-care-shift-scheduler.web.app');
    });
  });

  test.describe('デスクトップデバイス', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('index.htmlがリダイレクトされない', async ({ page }) => {
      await page.goto('index.html');
      await page.waitForLoadState('networkidle');

      // index.htmlのままであることを確認
      expect(page.url()).toContain('index.html');
      expect(page.url()).not.toContain('mobile.html');
    });

    test('index.htmlが正常に表示される', async ({ page }) => {
      await page.goto('index.html');

      // デスクトップ版のヘッダーが表示されることを確認
      const header = page.locator('.page-header');
      await expect(header).toBeVisible();

      // プロジェクト名の確認
      const projectName = page.locator('.project-name');
      await expect(projectName).toBeVisible();
    });

    test('technical.htmlがリダイレクトされない', async ({ page }) => {
      await page.goto('technical.html');
      await page.waitForLoadState('networkidle');

      // technical.htmlのままであることを確認
      expect(page.url()).toContain('technical.html');
      expect(page.url()).not.toContain('technical-mobile.html');
    });

    test('technical.htmlが正常に表示される', async ({ page }) => {
      await page.goto('technical.html');

      // デスクトップ版のヘッダーが表示されることを確認
      const header = page.locator('.page-header');
      await expect(header).toBeVisible();
    });
  });

  test.describe('レスポンシブ境界値テスト', () => {
    test('767px（モバイル最大幅）でリダイレクトされる', async ({ page }) => {
      await page.setViewportSize({ width: 767, height: 600 });
      await page.goto('index.html');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('mobile.html');
    });

    test('768px（デスクトップ最小幅）でリダイレクトされない', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 600 });
      await page.goto('index.html');
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('index.html');
      expect(page.url()).not.toContain('mobile.html');
    });
  });

  test.describe('モバイルページ間ナビゲーション', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('mobile.htmlからtechnical-mobile.htmlへ遷移できる', async ({ page }) => {
      await page.goto('mobile.html');

      const technicalLink = page.locator('a[href="technical-mobile.html"]');
      await technicalLink.click();
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('technical-mobile.html');
    });

    test('technical-mobile.htmlからmobile.htmlへ遷移できる', async ({ page }) => {
      await page.goto('technical-mobile.html');

      const mobileLink = page.locator('a[href="mobile.html"]');
      await mobileLink.click();
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('mobile.html');
    });

    test('モバイル版からデスクトップ版へのリンクが機能する', async ({ page }) => {
      await page.goto('mobile.html');

      const desktopLink = page.locator('a[href="index.html"]');
      await expect(desktopLink).toBeVisible();
    });
  });
});
