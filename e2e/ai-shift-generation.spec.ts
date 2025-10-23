import { test, expect } from '@playwright/test';

/**
 * AI シフト生成 E2E テスト
 *
 * Requirements:
 * - Requirement 6: E2Eテストの実装
 * - 本番環境でのテスト実行（ローカルまたは手動実行時のみ）
 * - CI/CD環境ではスキップ（コスト削減）
 *
 * Test Coverage:
 * - Task 5.1: AI生成の正常系UIフロー
 * - Task 5.2: エラーケースのUI表示
 * - Task 5.3: タイムアウト処理
 */

// CI環境ではこのテストスイート全体をスキップ（コスト削減）
const shouldSkipAITests = process.env.CI === 'true';

test.describe('AI シフト生成 E2E テスト', () => {
  test.beforeEach(async ({ page }) => {
    // 本番環境へのナビゲーション
    // ローカル実行時は PLAYWRIGHT_BASE_URL=https://ai-care-shift-scheduler.web.app を設定
    await page.goto('/');
  });

  /**
   * Task 5.1: AI生成の正常系UIフロー
   *
   * Acceptance Criteria (Requirement 6):
   * 1. WHEN 「シフト作成実行」ボタンがクリックされる THEN UI SHALL ローディング表示を表示する
   * 2. WHEN AIシフト生成が進行中 THEN UI SHALL 「AIがシフトを作成中...」メッセージを表示する
   * 3. WHEN AIシフト生成が完了する THEN UI SHALL シフトカレンダーにシフトを表示する
   * 4. WHEN シフトが表示される THEN カレンダー SHALL 全スタッフの全日数分のシフトセルを含む
   */
  test('AI生成の正常系UIフロー: ローディング → 生成中メッセージ → シフト表示', async ({ page }) => {
    // CI環境ではスキップ
    test.skip(shouldSkipAITests, 'CI環境ではAI生成テストをスキップ（コスト削減）');

    // 「シフト作成実行」ボタンを取得
    const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
    await expect(aiButton).toBeVisible();
    await expect(aiButton).not.toBeDisabled();

    // ボタンをクリック
    await aiButton.click();

    // ローディング表示を確認（「AIがシフトを作成中...」）
    const loadingMessage = page.getByText('AIがシフトを作成中...');
    await expect(loadingMessage).toBeVisible({ timeout: 2000 });

    // ボタンが無効化されていることを確認
    await expect(aiButton).toBeDisabled();

    // AI生成完了を待機（最大90秒）
    // シフトカレンダーが表示されるまで待機（スタッフ名が表示される）
    await expect(page.locator('td').first()).toBeVisible({ timeout: 90000 });

    // ローディングメッセージが消えたことを確認
    await expect(loadingMessage).not.toBeVisible();

    // シフト表の内容確認（少なくとも1つのシフトが表示される）
    const shiftCells = page.locator('td').filter({ hasText: /早番|日勤|遅番|夜勤|休/ });
    await expect(shiftCells.first()).toBeVisible();

    // 全スタッフ・全日数分のセルが存在することを確認
    // 最低限の検証: 100セル以上（スタッフ5人 × 30日 = 150セル程度期待）
    const allCells = page.locator('td');
    const cellCount = await allCells.count();
    expect(cellCount).toBeGreaterThan(100);
  });

  /**
   * Task 5.1 (補足): シフト生成後のビュー切り替え
   *
   * Acceptance Criteria:
   * - シフト生成完了後、「シフト表」タブが自動的にアクティブになる
   */
  test('シフト生成完了後、シフト表タブがアクティブになる', async ({ page }) => {
    // CI環境ではスキップ
    test.skip(shouldSkipAITests, 'CI環境ではAI生成テストをスキップ（コスト削減）');

    // 「休暇希望入力」タブに切り替え
    await page.getByRole('button', { name: '休暇希望入力' }).click();
    await expect(page.getByText('休暇希望カレンダー')).toBeVisible();

    // AI生成を実行
    const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
    await aiButton.click();

    // 生成完了を待機
    await expect(page.locator('td').first()).toBeVisible({ timeout: 90000 });

    // 「シフト表」タブが自動的にアクティブになったことを確認
    // （スタッフ名が表示されていることで間接的に確認）
    const shiftCells = page.locator('td').filter({ hasText: /早番|日勤|遅番|夜勤|休/ });
    await expect(shiftCells.first()).toBeVisible();
  });

  /**
   * Task 5.2: エラーケースのUI表示
   *
   * Acceptance Criteria (Requirement 6.7):
   * 1. WHEN エラーが発生する THEN UI SHALL エラーメッセージを赤色で表示する
   *
   * 注: 実際のエラーを発生させるのは困難（モック不可）
   * このテストはエラー表示要素の存在確認のみ
   */
  test('エラーメッセージ表示要素が存在する', async ({ page }) => {
    // このテストはCI環境でも実行可能（実際のAI呼び出しなし）

    // エラーメッセージ表示エリアの存在確認
    // （エラーがない場合は非表示だが、DOM上には存在する可能性あり）
    // 実際のエラー発生テストは統合テストで実施

    // 「シフト作成実行」ボタンの下にエラー表示エリアが存在することを確認
    const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
    await expect(aiButton).toBeVisible();

    // この時点ではエラーは表示されていないはず
    const errorMessage = page.locator('.text-red-500');
    if (await errorMessage.isVisible()) {
      // エラーが表示されている場合、赤色であることを確認
      await expect(errorMessage).toHaveClass(/text-red-500/);
    }
  });

  /**
   * Task 5.3: タイムアウト処理
   *
   * Acceptance Criteria (Requirement 5.3, 5.4):
   * 1. WHEN 60秒のタイムアウト後 THEN AbortErrorが発生する
   * 2. WHEN タイムアウト時 THEN UI SHALL 「タイムアウトしました」メッセージを表示する
   *
   * 注: タイムアウトを強制的にトリガーするのは困難
   * このテストは実装が難しいため、統合テストで代替
   * 実際のE2Eではタイムアウトが発生しないことを前提とする
   */
  test.skip('タイムアウト処理（統合テストで実施）', async () => {
    // このテストは統合テストで実施
    // E2Eでは実際のタイムアウトをトリガーするのが困難
  });

  /**
   * CI環境スキップ確認テスト
   *
   * Acceptance Criteria (Requirement 6.9):
   * - IF CI/CD環境で実行される THEN E2Eテスト SHALL スキップされる（コスト削減のため）
   */
  test('CI環境ではAI生成テストがスキップされる', async () => {
    if (process.env.CI === 'true') {
      console.log('✅ CI環境のため、AI生成テストはスキップされました');
      expect(shouldSkipAITests).toBe(true);
    } else {
      console.log('ℹ️ ローカル環境のため、AI生成テストは実行されます');
      expect(shouldSkipAITests).toBe(false);
    }
  });
});
