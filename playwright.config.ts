import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E テスト設定
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  // 全テストのタイムアウト（30秒）
  timeout: 30 * 1000,

  // 各expectのタイムアウト（5秒）
  expect: {
    timeout: 5000,
  },

  // 失敗時のリトライ（CI環境のみ）
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // 並列ワーカー数
  workers: process.env.CI ? 1 : undefined,

  // レポート設定
  reporter: process.env.CI
    ? [['github'], ['html']]
    : [['html'], ['list']],

  // 共通設定
  use: {
    // ベースURL（環境変数で切り替え可能）
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',

    // トレース設定（失敗時のみ）
    trace: 'on-first-retry',

    // スクリーンショット設定（失敗時のみ）
    screenshot: 'only-on-failure',

    // 動画設定（失敗時のみ）
    video: 'retain-on-failure',
  },

  // プロジェクト設定（ブラウザ別）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // CI環境では Chromium のみ実行
    // ローカルでは以下もコメントアウト解除可能
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // 開発サーバーの起動設定
  // 本番環境URL（PLAYWRIGHT_BASE_URL）が設定されている場合はwebServerをスキップ
  webServer: process.env.PLAYWRIGHT_BASE_URL && !process.env.PLAYWRIGHT_BASE_URL.includes('localhost')
    ? undefined
    : process.env.CI
    ? {
        // CI環境: ビルド後のプレビューサーバーを使用
        command: 'npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: false,
        timeout: 60 * 1000,
      }
    : {
        // ローカル環境: 開発サーバーを使用
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },
});
