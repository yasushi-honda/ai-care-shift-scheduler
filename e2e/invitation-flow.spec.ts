import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-helper';

/**
 * 招待フローE2Eテスト
 * Phase 22: 招待フロー完成とテスト
 *
 * テスト環境：
 * - Firebase Auth Emulator使用（http://localhost:9099）
 * - Firestore Emulator使用（http://localhost:8080）
 *
 * 実行方法：
 * npm run test:e2e:emulator
 */

test.describe('招待フロー - 招待受け入れ（Emulator）', () => {
  test.beforeEach(async () => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();
  });

  test.skip('未ログインユーザーが招待リンクにアクセスすると、ログイン画面が表示される', async ({ page }) => {
    // TODO Phase 22: 実装予定
    // 1. Firestoreに招待ドキュメント作成（Emulator環境）
    // 2. 招待リンク（/invite?token=xxx）にアクセス
    // 3. 招待情報表示確認（メールアドレス、ロール）
    // 4. 「Googleでログイン」ボタン表示確認
  });

  test.skip('ログイン後、自動的に招待が受け入れられる', async ({ page }) => {
    // TODO Phase 22: 実装予定
    // 1. Firestoreに招待ドキュメント作成
    // 2. Emulatorでテストユーザーログイン
    // 3. 招待リンクにアクセス
    // 4. 自動的に招待受け入れ処理実行確認
    // 5. ホーム画面（/）にリダイレクト確認
    // 6. Firestoreユーザードキュメントに施設が追加されたことを確認
  });

  test('無効なトークンの場合、エラーメッセージが表示される', async ({ page }) => {
    // ブラウザコンソールログをキャプチャ
    page.on('console', (msg) => {
      const text = msg.text();
      console.log(`[Browser Console ${msg.type()}] ${text}`);
    });

    // 1. 存在しないトークンで /invite?token=invalid にアクセス
    await page.goto('/invite?token=invalid-token-12345');

    // 2. エラーメッセージ表示確認
    // エラーメッセージ「この招待リンクは見つかりませんでした」を含むテキストを確認（改行文字対応）
    await expect(page.getByText(/この招待リンクは見つかりませんでした/)).toBeVisible({ timeout: 10000 });

    // 3. 「ホームに戻る」ボタン表示確認
    await expect(page.getByRole('button', { name: 'ホームに戻る' })).toBeVisible({ timeout: 5000 });
  });

  test.skip('ログインユーザーのメールアドレスが招待と異なる場合、エラーが表示される', async ({ page }) => {
    // TODO Phase 22: 実装予定
    // 1. test-user-a@example.com 宛の招待ドキュメント作成
    // 2. test-user-b@example.com でログイン
    // 3. 招待リンクにアクセス
    // 4. メールアドレス不一致エラーメッセージ表示確認
  });
});

test.describe('招待フロー - 招待送信（Emulator）', () => {
  test.beforeEach(async () => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();
  });

  test.skip('施設詳細ページで招待モーダルを開ける', async ({ page }) => {
    // TODO Phase 22: 実装予定
    // 1. Super-adminでログイン
    // 2. 施設詳細ページにアクセス
    // 3. 「メンバーを招待」ボタンクリック
    // 4. モーダル表示確認
    // 5. メールアドレス入力フィールド確認
    // 6. ロール選択（editor/viewer）確認
  });

  test.skip('招待を送信すると、招待リンクが生成される', async ({ page }) => {
    // TODO Phase 22: 実装予定
    // 1. Super-adminでログイン
    // 2. 施設詳細ページで招待モーダルを開く
    // 3. メールアドレス入力: new-user@example.com
    // 4. ロール選択: editor
    // 5. 「招待を送信」ボタンクリック
    // 6. 成功メッセージと招待リンク表示確認
    // 7. Firestoreに招待ドキュメントが作成されたことを確認
  });
});
