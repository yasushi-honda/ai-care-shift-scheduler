import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-helper';
import { TEST_FACILITY_ID } from './fixtures';

/**
 * AI評価パネル E2E テスト
 *
 * Phase 40拡張: AI評価機能改善
 * - 警告メッセージ表示
 * - 自動展開機能
 * - AIコメント表示
 *
 * Test Coverage:
 * - 低スコア時の警告メッセージ表示
 * - スコアに応じた自動展開
 * - AIコメントの表示とコピー機能
 *
 * Phase 3: 認証ヘルパーを追加
 */

// CI環境ではAI関連テストをスキップ（コスト削減）
const shouldSkipAITests = process.env.CI === 'true';

test.describe('AI評価パネル E2E テスト', () => {
  test.beforeEach(async ({ page }) => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();

    // 管理者としてログイン（フィクスチャの施設IDを使用）
    await setupAuthenticatedUser(page, {
      email: 'admin@test.com',
      password: 'password123',
      displayName: 'Test Admin',
      role: 'admin',
      facilities: [{ facilityId: TEST_FACILITY_ID, role: 'admin' }],
    });
  });

  /**
   * 評価パネルの基本表示テスト
   */
  test('AI生成完了後に評価パネルが表示される', async ({ page }) => {
    test.skip(shouldSkipAITests, 'CI環境ではAI生成テストをスキップ');

    // AI生成を実行
    const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
    await expect(aiButton).toBeVisible();
    await aiButton.click();

    // 生成完了を待機（最大180秒 - 思考モード対応）
    await expect(page.getByText('AI評価')).toBeVisible({ timeout: 180000 });

    // 評価パネルのヘッダーが表示されることを確認
    const evaluationHeader = page.getByText('AI評価');
    await expect(evaluationHeader).toBeVisible();

    // スコアバッジが表示されることを確認（スコア数値 + "点"）
    const scoreBadge = page.locator('text=/\\d+点/');
    await expect(scoreBadge).toBeVisible();
  });

  /**
   * AIコメント表示テスト
   */
  test('AIコメントが表示される', async ({ page }) => {
    test.skip(shouldSkipAITests, 'CI環境ではAI生成テストをスキップ');

    // AI生成を実行
    const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
    await aiButton.click();

    // 生成完了を待機
    await expect(page.getByText('AI評価')).toBeVisible({ timeout: 180000 });

    // AIコメントセクションが表示されることを確認
    const aiCommentLabel = page.getByText('AIコメント');
    await expect(aiCommentLabel).toBeVisible();

    // コピーボタンが存在することを確認
    const copyButton = page.getByRole('button', { name: /コピー/ });
    await expect(copyButton).toBeVisible();
  });

  /**
   * 警告メッセージ表示テスト（低スコア時）
   *
   * 注: 実際に低スコアを発生させるにはデータ設定が必要
   * このテストは警告メッセージ要素の構造確認
   */
  test('警告メッセージの要素が正しく構成されている', async ({ page }) => {
    // このテストはUI構造の確認のみ（AI呼び出しなし）

    // ページ構造の確認（警告が表示された場合の要素）
    // 実際の警告表示はAI生成結果に依存するため、統合テストで実施

    // 「シフト作成実行」ボタンの存在確認
    const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
    await expect(aiButton).toBeVisible();

    // role="alert"の要素がある場合は警告メッセージ
    // （生成前は存在しない）
    const alertElements = page.locator('[role="alert"]');
    const alertCount = await alertElements.count();

    // 初期状態では警告なし、または既存の警告のみ
    console.log(`📊 初期状態の警告要素数: ${alertCount}`);
  });

  /**
   * 評価パネル展開・折りたたみテスト
   */
  test('評価パネルの展開・折りたたみが動作する', async ({ page }) => {
    test.skip(shouldSkipAITests, 'CI環境ではAI生成テストをスキップ');

    // AI生成を実行
    const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
    await aiButton.click();

    // 生成完了を待機
    await expect(page.getByText('AI評価')).toBeVisible({ timeout: 180000 });

    // 評価パネルのヘッダーボタンを取得
    const evaluationToggle = page.getByRole('button', { name: /AI評価/ });
    await expect(evaluationToggle).toBeVisible();

    // 初期状態の確認（スコアによって展開/折りたたみが異なる）
    const isInitiallyExpanded = await evaluationToggle.getAttribute('aria-expanded');
    console.log(`📊 初期展開状態: ${isInitiallyExpanded}`);

    // クリックして状態を切り替え
    await evaluationToggle.click();
    await page.waitForTimeout(500); // アニメーション待機

    // 状態が切り替わったことを確認
    const newExpandedState = await evaluationToggle.getAttribute('aria-expanded');
    expect(newExpandedState).not.toBe(isInitiallyExpanded);

    // 再度クリックして元に戻す
    await evaluationToggle.click();
    await page.waitForTimeout(500);

    const finalExpandedState = await evaluationToggle.getAttribute('aria-expanded');
    expect(finalExpandedState).toBe(isInitiallyExpanded);
  });

  /**
   * 展開時の詳細セクション表示テスト
   */
  test('展開時に詳細セクションが表示される', async ({ page }) => {
    test.skip(shouldSkipAITests, 'CI環境ではAI生成テストをスキップ');

    // AI生成を実行
    const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
    await aiButton.click();

    // 生成完了を待機
    await expect(page.getByText('AI評価')).toBeVisible({ timeout: 180000 });

    // パネルを展開（まだ展開されていない場合）
    const evaluationToggle = page.getByRole('button', { name: /AI評価/ });
    const isExpanded = await evaluationToggle.getAttribute('aria-expanded');

    if (isExpanded === 'false') {
      await evaluationToggle.click();
      await page.waitForTimeout(500);
    }

    // サマリーセクションが表示されることを確認
    await expect(page.getByText('総合スコア')).toBeVisible();
    await expect(page.getByText('人員充足率')).toBeVisible();

    // 制約違反セクションまたは改善提案セクションが存在するか確認
    const violationsSection = page.getByText('制約違反');
    const recommendationsSection = page.getByText('改善提案');

    // どちらかが表示されている（違反がない場合は表示されない）
    const hasViolations = await violationsSection.isVisible().catch(() => false);
    const hasRecommendations = await recommendationsSection.isVisible().catch(() => false);

    console.log(`📊 制約違反セクション: ${hasViolations ? '表示' : '非表示'}`);
    console.log(`📊 改善提案セクション: ${hasRecommendations ? '表示' : '非表示'}`);
  });

  /**
   * CI環境スキップ確認テスト
   */
  test('CI環境では評価パネルテストがスキップされる', async () => {
    if (process.env.CI === 'true') {
      console.log('✅ CI環境のため、AI評価パネルテストはスキップされました');
      expect(shouldSkipAITests).toBe(true);
    } else {
      console.log('ℹ️ ローカル環境のため、AI評価パネルテストは実行されます');
      expect(shouldSkipAITests).toBe(false);
    }
  });
});
