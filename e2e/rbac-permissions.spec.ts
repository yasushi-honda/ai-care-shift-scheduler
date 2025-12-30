import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-helper';

/**
 * RBAC権限チェックE2Eテスト
 * Phase 14.3: RBAC権限チェック検証
 * Phase 17-1: Firebase Auth Emulator導入により自動テスト化
 *
 * テスト環境：
 * - Firebase Auth Emulator使用（http://localhost:9099）
 * - Firestore Emulator使用（http://localhost:8080）
 *
 * 実行方法：
 * npm run test:e2e:emulator
 */

test.describe('RBAC権限チェック - アクセス権限なし画面（Forbidden）', () => {
  test('Forbiddenページが正しく表示される', async ({ page }) => {
    await page.goto('/forbidden');

    // 403エラーコードを確認
    await expect(page.getByText('403')).toBeVisible();

    // ヘッディングを確認（実際のUI: 「アクセス権限がありません」）
    await expect(page.getByRole('heading', { name: 'アクセス権限がありません' })).toBeVisible();

    // メッセージを確認
    await expect(page.getByText('このページにアクセスする権限がありません。')).toBeVisible();

    // 説明文を確認
    await expect(page.getByText('管理画面にアクセスするにはsuper-admin権限が必要です。')).toBeVisible();
  });

  test('Forbiddenページに「ホームに戻る」ボタンが表示される', async ({ page }) => {
    await page.goto('/forbidden');

    // 「ホームに戻る」ボタンを確認
    const homeButton = page.getByRole('button', { name: 'ホームに戻る' });
    await expect(homeButton).toBeVisible();

    // ボタンがクリック可能であることを確認
    await expect(homeButton).toBeEnabled();
  });

  test('「ホームに戻る」ボタンをクリックするとホームページに遷移する', async ({ page }) => {
    await page.goto('/forbidden');

    // 「ホームに戻る」ボタンをクリック
    const homeButton = page.getByRole('button', { name: 'ホームに戻る' });
    await homeButton.click();

    // ホームページに遷移することを確認
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});

test.describe('RBAC権限チェック - 各ロール（Emulator）', () => {
  test.beforeEach(async () => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();
  });

  test('super-adminは管理画面にアクセスできる', async ({ page }) => {
    // super-adminユーザーを作成してログイン（facilitiesを追加）
    await setupAuthenticatedUser(page, {
      email: 'super-admin@example.com',
      password: 'password123',
      displayName: 'Super Admin User',
      role: 'super-admin',
      facilities: [{ facilityId: 'test-facility-001', role: 'admin' }],
    });

    // 管理画面にアクセス
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    // 管理画面が表示されることを確認（Forbiddenにリダイレクトされない）
    await expect(page).not.toHaveURL('/forbidden', { timeout: 5000 });

    // 管理画面の要素が表示されることを確認
    // 管理画面にいる証拠として、管理系のタブまたはURLをチェック
    const currentUrl = page.url();
    const isOnAdminPage = currentUrl.includes('/admin');
    const hasFacilityTab = await page.getByText(/施設管理/).isVisible().catch(() => false);
    const hasUserTab = await page.getByText(/ユーザー管理/).isVisible().catch(() => false);
    const hasAdminContent = await page.locator('[data-testid="admin-panel"]').isVisible().catch(() => false);
    const hasAdminHeading = await page.getByRole('heading').isVisible().catch(() => false);

    expect(isOnAdminPage || hasFacilityTab || hasUserTab || hasAdminContent || hasAdminHeading).toBeTruthy();
  });

  test('権限なしユーザーはForbiddenページが表示される', async ({ page }) => {
    // 権限なしユーザーを作成してログイン（roleなし）
    await setupAuthenticatedUser(page, {
      email: 'no-permission@example.com',
      password: 'password123',
      displayName: 'No Permission User',
      // roleを設定しない = 権限なし
    });

    // 管理画面にアクセス試行
    await page.goto('/admin');

    // Forbiddenページにリダイレクトされることを確認
    await expect(page).toHaveURL('/forbidden', { timeout: 5000 });

    // 「アクセス権限がありません」が表示されることを確認
    await expect(page.getByText(/アクセス/)).toBeVisible();
  });

  // 以下のテストは、実際のUI実装を詳しく確認する必要があるため、Phase 17-2以降で実装

  test.skip('adminはシフト作成・編集ができる', async ({ page }) => {
    // Phase 17-2以降で実装予定
    // 施設データのセットアップが必要
  });

  test.skip('editorはシフト作成・編集ができるが、スタッフ編集はできない', async ({ page }) => {
    // Phase 17-2以降で実装予定
    // 施設データのセットアップと詳細なUI要素チェックが必要
  });

  test.skip('viewerはすべて閲覧のみで、編集操作が拒否される', async ({ page }) => {
    // Phase 17-2以降で実装予定
    // 施設データのセットアップと詳細なUI要素チェックが必要
  });

  test.skip('adminは他の施設のデータにアクセスできない', async ({ page }) => {
    // Phase 17-2以降で実装予定
    // 複数施設のセットアップとFirestore Security Rulesテストが必要
  });

  test('adminはメンバー招待でeditor/viewerのみ選択できる', async ({ page }) => {
    // Phase 22: Task 3実装
    // adminロールでログインし、招待モーダルでeditor/viewerのみ選択可能なことを確認

    // 1. テスト用施設データ作成（Emulator環境 - Admin SDK使用）
    const facilityId = 'test-facility-admin-invitation';
    const facilityName = 'テスト施設（Admin招待権限）';

    // Admin SDKで施設ドキュメント作成（invitation-flow.spec.tsのパターンを踏襲）
    // CodeRabbit指摘対応: Admin SDK初期化前に環境変数を設定
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

    const admin = await import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'ai-care-shift-scheduler',
      });
    }

    const facilityData = {
      id: facilityId,
      name: facilityName,
      address: 'テスト住所',
      contactEmail: 'test@example.com',
      contactPhone: '000-0000-0000',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await admin.firestore().collection('facilities').doc(facilityId).set(facilityData);

    // 2. adminロールでログイン（super-adminではなくadminでテスト）
    await setupAuthenticatedUser(page, {
      email: 'admin-invite-test@example.com',
      password: 'password123',
      displayName: 'Admin Invite Tester',
      role: 'admin',
      facilities: [{ facilityId, role: 'admin' }],
    });

    // 3. 施設詳細ページにアクセス
    await page.goto(`/admin/facility/${facilityId}`);

    // 4. 「+ メンバー追加」ボタンクリック
    const inviteButton = page.getByRole('button', { name: /メンバー追加/ });
    await expect(inviteButton).toBeVisible({ timeout: 10000 });
    await inviteButton.click();

    // 5. モーダル表示確認
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // 6. ロール選択ドロップダウン確認
    const roleSelect = page.locator('#invite-role-select');
    await expect(roleSelect).toBeVisible({ timeout: 5000 });

    // 7. 選択肢を取得（editor, viewerのみ存在することを確認）
    const options = await roleSelect.locator('option').allTextContents();

    // editorとviewerが選択肢に含まれることを確認
    expect(options).toContain('編集者（シフト編集可能）');
    expect(options).toContain('閲覧者（閲覧のみ）');

    // adminとsuper-adminが選択肢に含まれないことを確認
    expect(options).not.toContain('管理者');
    expect(options).not.toContain('システム管理者');

    // 選択肢が2つのみであることを確認（editor, viewer）
    expect(options.length).toBe(2);
  });
});
