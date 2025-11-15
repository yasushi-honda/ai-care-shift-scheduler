import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-helper';
import {
  createInvitationInEmulator,
  createFacilityInEmulator,
  clearEmulatorFirestore
} from './helpers/firestore-helper';

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

    // 1. Firestoreに施設ドキュメントと招待ドキュメント作成（Emulator環境）
    const token = 'test-token-auto-accept-67890';
    const email = 'auto-accept-user@example.com';
    const role = 'viewer';
    const facilityId = 'test-facility-002';
    const createdBy = 'test-admin-uid';

    // 施設ドキュメント作成
    await createFacilityInEmulator({
      facilityId,
      name: 'テスト施設002',
      adminUserId: createdBy,
    });

    // 招待ドキュメント作成
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

  test('施設詳細ページで招待モーダルを開ける', async ({ page }) => {
    // 1. テスト用施設データ作成（Emulator環境 - Admin SDK使用）
    const facilityId = 'test-facility-invitation-modal';
    const facilityName = 'テスト施設（招待モーダル）';

    // Admin SDKで施設ドキュメント作成（firestore-helperのパターンを踏襲）
    // Admin SDK初期化前に環境変数を設定
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

    const { default: admin } = await import('firebase-admin');
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

    // 2. Super-adminユーザーでログイン（Emulator環境）
    await setupAuthenticatedUser(page, {
      email: 'super-admin@example.com',
      password: 'password123',
      displayName: 'Super Admin User',
      role: 'super-admin',
      facilities: [{ facilityId, role: 'super-admin' }],
    });

    // 3. 施設詳細ページにアクセス
    await page.goto(`/admin/facility/${facilityId}`);

    // 4. 「+ メンバー追加」ボタンクリック
    const inviteButton = page.getByRole('button', { name: /メンバー追加/ });
    await expect(inviteButton).toBeVisible({ timeout: 10000 });
    await inviteButton.click();

    // 5. モーダル表示確認
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('メンバーを招待')).toBeVisible({ timeout: 5000 });

    // 6. メールアドレス入力フィールド確認
    const emailInput = page.locator('#invite-email-input');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await expect(emailInput).toBeEnabled();

    // 7. ロール選択確認（editor/viewer）
    const roleSelect = page.locator('#invite-role-select');
    await expect(roleSelect).toBeVisible({ timeout: 5000 });
    await expect(roleSelect).toBeEnabled();

    // ロール選択肢を確認（editor, viewer）
    const options = await roleSelect.locator('option').allTextContents();
    expect(options).toContain('編集者（シフト編集可能）');
    expect(options).toContain('閲覧者（閲覧のみ）');
  });

  test('招待を送信すると、招待リンクが生成される', async ({ page }) => {
    // 1. テスト用施設データ作成（Emulator環境 - Admin SDK使用）
    const facilityId = 'test-facility-send-invitation';
    const facilityName = 'テスト施設（招待送信）';

    // Admin SDKで施設ドキュメント作成
    // Admin SDK初期化前に環境変数を設定
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

    const { default: admin } = await import('firebase-admin');
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

    // 2. Super-adminユーザーでログイン（Emulator環境）
    await setupAuthenticatedUser(page, {
      email: 'super-admin-invite-sender@example.com',
      password: 'password123',
      displayName: 'Super Admin Invite Sender',
      role: 'super-admin',
      facilities: [{ facilityId, role: 'super-admin' }],
    });

    // 3. 施設詳細ページにアクセス
    await page.goto(`/admin/facility/${facilityId}`);

    // 4. 「+ メンバー追加」ボタンクリック
    const inviteButton = page.getByRole('button', { name: /メンバー追加/ });
    await expect(inviteButton).toBeVisible({ timeout: 10000 });
    await inviteButton.click();

    // モーダル表示確認
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // 5. メールアドレス入力: new-user@example.com
    const emailInput = page.locator('#invite-email-input');
    await emailInput.fill('new-user@example.com');

    // 6. ロール選択: editor
    const roleSelect = page.locator('#invite-role-select');
    await roleSelect.selectOption('editor');

    // 7. 「招待を送信」ボタンクリック
    const sendButton = page.getByRole('button', { name: '招待を送信' });
    await sendButton.click();

    // 8. 成功メッセージと招待リンク表示確認
    // 成功メッセージ: "招待を送信しました！以下のリンクを new-user@example.com に共有してください："
    await expect(page.getByText(/招待を送信しました/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/new-user@example\.com/)).toBeVisible({ timeout: 5000 });

    // 招待リンク表示確認（/invite?token= を含む）
    await expect(page.getByText(/\/invite\?token=/)).toBeVisible({ timeout: 5000 });

    // 9. Firestoreに招待ドキュメントが作成されたことを確認
    const invitationCreated = await page.evaluate(
      async ({ testFacilityId, testEmail }) => {
        try {
          const db = (window as any).__firebaseDb;
          const collection = (window as any).__firebaseCollection;
          const getDocs = (window as any).__firebaseGetDocs;
          const query = (window as any).__firebaseQuery;
          const where = (window as any).__firebaseWhere;

          if (!db || !collection || !getDocs || !query || !where) {
            console.error('❌ Firestore SDK がグローバルオブジェクトに存在しません');
            return false;
          }

          // トップレベルinvitationsコレクションから検索
          const invitationsRef = collection(db, 'invitations');
          const q = query(
            invitationsRef,
            where('email', '==', testEmail),
            where('facilityId', '==', testFacilityId)
          );
          const snapshot = await getDocs(q);

          if (snapshot.empty) {
            console.error('❌ 招待ドキュメントが存在しません');
            return false;
          }

          const invitationData = snapshot.docs[0].data();
          console.log('✅ 招待ドキュメント作成確認:', {
            email: invitationData.email,
            role: invitationData.role,
            facilityId: invitationData.facilityId,
            status: invitationData.status,
          });

          // 期待される値を確認
          if (invitationData.email === testEmail &&
              invitationData.role === 'editor' &&
              invitationData.facilityId === testFacilityId &&
              invitationData.status === 'pending') {
            return true;
          } else {
            console.error('❌ 招待ドキュメントのデータが不正:', invitationData);
            return false;
          }
        } catch (error: any) {
          console.error(`❌ Firestore確認エラー: ${error.message}`);
          return false;
        }
      },
      { testFacilityId: facilityId, testEmail: 'new-user@example.com' }
    );

    expect(invitationCreated).toBe(true);
  });
});
