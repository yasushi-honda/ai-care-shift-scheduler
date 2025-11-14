import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-helper';
import { createInvitationInEmulator, clearEmulatorFirestore } from './helpers/firestore-helper';

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
    await clearEmulatorFirestore();
  });

  test('未ログインユーザーが招待リンクにアクセスすると、ログイン画面が表示される', async ({ page }) => {
    // ブラウザコンソールログをキャプチャ
    page.on('console', (msg) => {
      const text = msg.text();
      console.log(`[Browser Console ${msg.type()}] ${text}`);
    });

    // 1. Firestoreに招待ドキュメント作成（Emulator環境）
    const token = 'test-token-12345';
    const email = 'invited-user@example.com';
    const role = 'editor';
    const facilityId = 'test-facility-001';
    const createdBy = 'test-admin-uid';

    await createInvitationInEmulator({
      email,
      role,
      token,
      facilityId,
      createdBy,
    });

    // 2. 招待リンク（/invite?token=xxx）にアクセス
    await page.goto(`/invite?token=${token}`);

    // 3. 招待情報表示確認（メールアドレス、ロール）
    // メールアドレス表示確認
    await expect(page.getByText(email)).toBeVisible({ timeout: 10000 });

    // ロール表示確認（editorは「編集者」と表示される）
    await expect(page.getByText(/編集者/)).toBeVisible({ timeout: 5000 });

    // 4. 「Googleでログイン」ボタン表示確認
    await expect(page.getByRole('button', { name: 'Googleでログイン' })).toBeVisible({ timeout: 5000 });
  });

  test('ログイン後、自動的に招待が受け入れられる', async ({ page }) => {
    // ブラウザコンソールログをキャプチャ
    page.on('console', (msg) => {
      const text = msg.text();
      console.log(`[Browser Console ${msg.type()}] ${text}`);
    });

    // 1. Firestoreに招待ドキュメント作成（Emulator環境）
    const token = 'test-token-auto-accept-67890';
    const email = 'auto-accept-user@example.com';
    const role = 'viewer';
    const facilityId = 'test-facility-002';
    const createdBy = 'test-admin-uid';

    const invitationId = await createInvitationInEmulator({
      email,
      role,
      token,
      facilityId,
      createdBy,
    });

    // 2. Emulatorでテストユーザー作成＆ログイン
    const uid = await setupAuthenticatedUser(page, {
      email,
      password: 'password123',
      displayName: 'Auto Accept User',
      // 初期状態ではこの施設へのアクセス権限なし（招待受け入れ後に追加される）
      facilities: [],
    });

    // 3. 招待リンクにアクセス
    await page.goto(`/invite?token=${token}`);

    // 4. 自動的に招待受け入れ処理が実行され、ローディング表示確認
    // 「招待を受け入れています...」というテキストが短時間表示される可能性があるが、
    // 処理が速いため、リダイレクトまで待つ

    // 5. ホーム画面（/）にリダイレクト確認
    // リダイレクトを待つ（最大10秒）
    await page.waitForURL('/', { timeout: 10000 });

    // URLが "/" であることを確認
    expect(page.url()).toMatch(/\/$/);

    // 6. Firestoreユーザードキュメントに施設が追加されたことを確認
    // page.evaluate()でFirestore SDK経由で確認
    const facilityAdded = await page.evaluate(
      async ({ testUid, testFacilityId, testRole }) => {
        try {
          const db = (window as any).__firebaseDb;
          const doc = (window as any).__firebaseDoc;
          const getDoc = (window as any).__firebaseGetDoc;

          if (!db || !doc || !getDoc) {
            console.error('❌ Firestore SDK がグローバルオブジェクトに存在しません');
            return false;
          }

          // ユーザードキュメント取得
          const userRef = doc(db, 'users', testUid);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            console.error('❌ ユーザードキュメントが存在しません');
            return false;
          }

          const userData = userDoc.data();
          const facilities = userData.facilities || [];

          // 施設が追加されているか確認
          const facilityExists = facilities.some(
            (f: any) => f.facilityId === testFacilityId && f.role === testRole
          );

          if (facilityExists) {
            console.log(`✅ 施設が追加されています: ${testFacilityId} (role: ${testRole})`);
            return true;
          } else {
            console.error(`❌ 施設が追加されていません: ${testFacilityId}`, { facilities });
            return false;
          }
        } catch (error: any) {
          console.error(`❌ Firestore確認エラー: ${error.message}`);
          return false;
        }
      },
      { testUid: uid, testFacilityId: facilityId, testRole: role }
    );

    expect(facilityAdded).toBe(true);
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

  test('ログインユーザーのメールアドレスが招待と異なる場合、エラーが表示される', async ({ page }) => {
    // ブラウザコンソールログをキャプチャ
    page.on('console', (msg) => {
      const text = msg.text();
      console.log(`[Browser Console ${msg.type()}] ${text}`);
    });

    // 1. test-user-a@example.com 宛の招待ドキュメント作成（Emulator環境）
    const token = 'test-token-email-mismatch-99999';
    const invitedEmail = 'test-user-a@example.com';
    const role = 'editor';
    const facilityId = 'test-facility-003';
    const createdBy = 'test-admin-uid';

    await createInvitationInEmulator({
      email: invitedEmail,
      role,
      token,
      facilityId,
      createdBy,
    });

    // 2. test-user-b@example.com でログイン（Emulator環境）
    const loginEmail = 'test-user-b@example.com';
    await setupAuthenticatedUser(page, {
      email: loginEmail,
      password: 'password123',
      displayName: 'Test User B',
      facilities: [], // 招待受け入れ前の状態
    });

    // 3. 招待リンクにアクセス
    await page.goto(`/invite?token=${token}`);

    // 4. メールアドレス不一致エラーメッセージ表示確認
    // エラーメッセージ: "この招待は test-user-a@example.com 宛です。現在ログインしているアカウント（test-user-b@example.com）とは異なります。"
    await expect(page.getByText(/この招待は test-user-a@example\.com 宛です/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/現在ログインしているアカウント/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/test-user-b@example\.com/)).toBeVisible({ timeout: 5000 });

    // 5. 「ホームに戻る」ボタン表示確認（canRetry: false のため「ページを更新する」ボタンは表示されない）
    await expect(page.getByRole('button', { name: 'ホームに戻る' })).toBeVisible({ timeout: 5000 });

    // 6. 「ページを更新する」ボタンが表示されないことを確認
    await expect(page.getByRole('button', { name: 'ページを更新する' })).not.toBeVisible();
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
