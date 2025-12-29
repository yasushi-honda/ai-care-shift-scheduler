import { defineConfig, devices } from '@playwright/test';

/**
 * CI/CD用 Playwright E2E テスト設定
 *
 * Phase 4: CI/CD拡張
 * - CI環境で安定して動作するテストのみを実行
 * - タイムアウトを最適化
 * - 20件以上のテストを5分以内に完了
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  // CI用: Global Setup（テストデータ投入）
  globalSetup: './e2e/global-setup.ts',

  // CI環境: 実行対象テストファイル（高速・安定テストのみ）
  // Phase 4: タイムアウト内に完了できるテストのみ実行
  testMatch: [
    // 基本動作テスト（認証なし・最速）
    'app.spec.ts',

    // 認証フロー・権限テスト
    'auth-flow.spec.ts',
    'rbac-permissions.spec.ts',

    // AI関連テスト（CIではスキップ扱いだが含める）
    'ai-shift-generation.spec.ts',
    'ai-evaluation-panel.spec.ts',
  ],

  // 全テストのタイムアウト（45秒）
  timeout: 45 * 1000,

  // 各expectのタイムアウト（8秒）
  expect: {
    timeout: 8000,
  },

  // CI設定: 直列実行（安定性重視）
  fullyParallel: false,
  forbidOnly: true,
  retries: 1, // 1回だけリトライ

  // 並列ワーカー数: 1（安定性のため）
  workers: 1,

  // レポート設定
  reporter: [['github'], ['html']],

  // 共通設定
  use: {
    // ベースURL（環境変数で指定）
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',

    // トレース設定（失敗時のみ）
    trace: 'on-first-retry',

    // スクリーンショット設定（失敗時のみ）
    screenshot: 'only-on-failure',

    // 動画設定（無効化 - CI高速化のため）
    video: 'off',
  },

  // プロジェクト設定（Chromiumのみ）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
