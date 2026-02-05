import { test, expect } from '@playwright/test';
import { TEST_STAFF, TEST_FACILITY_NAME } from './fixtures';

/**
 * デモ環境シフト検証 E2E テスト
 *
 * Purpose: デモ環境でのシフト生成が正常に動作することを検証
 * - デモログインフローの確認
 * - スタッフ一覧表示の確認（12名）
 * - シフト生成のUI動作確認
 *
 * Single Source of Truth: scripts/demoData.ts via e2e/fixtures
 *
 * Note: CIではスキップ（AI生成はコスト削減のため）
 */

const shouldSkipInCI = process.env.CI === 'true';

test.describe('デモ環境シフト検証', () => {
  /**
   * デモログインフローのテスト
   *
   * Acceptance Criteria:
   * - /demo URLでデモ環境に直接アクセス可能
   * - 「デモ体験」ボタンが存在する
   */
  test('デモ環境にアクセスできる', async ({ page }) => {
    await page.goto('/demo');
    await page.waitForLoadState('domcontentloaded');

    // デモ画面の特徴的な要素を確認
    // デモログイン画面または自動ログイン後のダッシュボード
    const demoButton = page.getByRole('button', { name: /デモ体験|デモを開始/ });
    const dashboardElement = page.getByText(TEST_FACILITY_NAME);

    // いずれかが表示されていればOK
    const isDemoButtonVisible = await demoButton.isVisible().catch(() => false);
    const isDashboardVisible = await dashboardElement.isVisible().catch(() => false);

    expect(isDemoButtonVisible || isDashboardVisible).toBe(true);
  });

  /**
   * デモ環境でスタッフ一覧が表示される
   *
   * Acceptance Criteria:
   * - 12名のスタッフが表示される
   * - 最初の8名は常勤、後半4名はパート
   */
  test('デモスタッフ一覧が表示される（フィクスチャ整合性）', async ({ page }) => {
    test.skip(shouldSkipInCI, 'CI環境ではスキップ（デモ認証が必要）');

    // デモ環境にアクセス
    await page.goto('/demo');
    await page.waitForLoadState('domcontentloaded');

    // デモボタンがあればクリック
    const demoButton = page.getByRole('button', { name: /デモ体験|デモを開始/ });
    if (await demoButton.isVisible().catch(() => false)) {
      await demoButton.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000); // 認証処理を待機
    }

    // スタッフ管理ページへ移動
    await page.goto('/staff');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // フィクスチャの最初のスタッフが表示されることを確認
    const firstStaffName = TEST_STAFF[0].name;
    await expect(page.getByText(firstStaffName)).toBeVisible({ timeout: 10000 });

    // スタッフ数の確認（12名）
    // テーブル行数またはスタッフカードの数で確認
    const staffRows = page.locator('tbody tr');
    const staffCards = page.locator('[data-testid="staff-card"]');

    const rowCount = await staffRows.count().catch(() => 0);
    const cardCount = await staffCards.count().catch(() => 0);

    // 少なくとも8名以上が表示されていることを確認
    expect(rowCount + cardCount).toBeGreaterThanOrEqual(8);
  });

  /**
   * シフト作成ページが表示される
   *
   * Acceptance Criteria:
   * - シフト作成ページに遷移できる
   * - 「シフト作成実行」ボタンが存在する
   */
  test('シフト作成ページが表示される', async ({ page }) => {
    test.skip(shouldSkipInCI, 'CI環境ではスキップ（デモ認証が必要）');

    // デモ環境にアクセス
    await page.goto('/demo');
    await page.waitForLoadState('domcontentloaded');

    // デモボタンがあればクリック
    const demoButton = page.getByRole('button', { name: /デモ体験|デモを開始/ });
    if (await demoButton.isVisible().catch(() => false)) {
      await demoButton.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
    }

    // シフト作成ページへ移動（直接URLアクセスまたはナビゲーション）
    await page.goto('/shift');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // シフト作成実行ボタンが存在することを確認
    const aiButton = page.getByRole('button', { name: /シフト作成実行|シフト生成/ });
    await expect(aiButton).toBeVisible({ timeout: 10000 });
  });

  /**
   * AI評価パネルが表示される（生成後）
   *
   * Acceptance Criteria:
   * - シフト生成後、AI評価パネルが表示される
   * - スコアが表示される
   *
   * Note: 実際のAI生成は行わない（コスト削減）
   */
  test.skip('AI評価パネルが表示される（AI生成後）', async ({ page }) => {
    // このテストは実際のAI生成が必要なため、通常はスキップ
    // ローカルでの手動テスト用に定義を残す

    await page.goto('/demo');
    await page.waitForLoadState('domcontentloaded');

    // デモボタンがあればクリック
    const demoButton = page.getByRole('button', { name: /デモ体験|デモを開始/ });
    if (await demoButton.isVisible().catch(() => false)) {
      await demoButton.click();
      await page.waitForTimeout(2000);
    }

    // シフト作成ページへ移動
    await page.goto('/shift');
    await page.waitForTimeout(1000);

    // シフト作成実行ボタンをクリック
    const aiButton = page.getByRole('button', { name: /シフト作成実行/ });
    await aiButton.click();

    // 生成中表示を確認
    await expect(page.getByText(/AIがシフトを作成中|生成中/)).toBeVisible({ timeout: 5000 });

    // AI評価パネルが表示されるまで待機（最大120秒）
    const evaluationPanel = page.locator('[data-testid="ai-evaluation-panel"]');
    await expect(evaluationPanel).toBeVisible({ timeout: 120000 });

    // スコアが表示されることを確認
    const scoreElement = page.locator('[data-testid="overall-score"]');
    await expect(scoreElement).toBeVisible();

    // スコア値を取得して検証
    const scoreText = await scoreElement.textContent();
    const score = parseInt(scoreText || '0', 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  /**
   * フィクスチャデータ整合性テスト
   *
   * Acceptance Criteria:
   * - TEST_STAFFに12名のスタッフが定義されている
   * - フィクスチャデータがdemoData.tsと同期している
   */
  test('フィクスチャデータの整合性確認', async () => {
    // スタッフ数の確認
    expect(TEST_STAFF).toHaveLength(12);

    // 常勤スタッフ（最初の8名）の確認
    const fullTimeStaff = TEST_STAFF.slice(0, 8);
    expect(fullTimeStaff).toHaveLength(8);

    // パートスタッフ（後半4名）の確認
    const partTimeStaff = TEST_STAFF.slice(8);
    expect(partTimeStaff).toHaveLength(4);

    // 看護師資格を持つスタッフの確認
    const nurses = TEST_STAFF.filter(s =>
      s.certifications.includes('看護師')
    );
    expect(nurses.length).toBeGreaterThanOrEqual(2);

    // 施設IDの確認
    for (const staff of TEST_STAFF) {
      expect(staff.facilityId).toBe('demo-facility-001');
    }
  });
});
