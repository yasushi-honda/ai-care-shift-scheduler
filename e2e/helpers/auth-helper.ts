/**
 * Firebase Authentication Helper for E2E Tests
 *
 * Phase 18.2: Emulator環境での自動認証サポート
 *
 * このヘルパーは、Emulator環境でテストユーザーを作成し、
 * 認証状態を設定します。
 */

import { Page } from '@playwright/test';
import admin from 'firebase-admin';

// Admin SDK初期化状態
let adminInitialized = false;

/**
 * Admin SDKを初期化（Emulator環境）
 *
 * Phase 18-2: Admin SDK使用への変更
 */
function initializeAdminSDK(): void {
  if (adminInitialized) {
    return;
  }

  // Admin SDKが既に初期化されている場合はスキップ
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'ai-care-shift-scheduler',
    });
  }

  // Emulator環境設定
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

  adminInitialized = true;
  console.log('🔧 Firebase Admin SDK初期化完了（auth-helper内）');
}

/**
 * Emulator環境かどうかを判定
 */
export function isEmulatorEnvironment(baseURL: string): boolean {
  return baseURL.includes('localhost') || baseURL.includes('127.0.0.1');
}

/**
 * Emulator環境でテストユーザーとして認証
 *
 * Phase 18.2 Step 4c: Emulator REST API + Firebase SDK認証
 *
 * @param page Playwrightページオブジェクト
 * @param email テストユーザーのメールアドレス（デフォルト: test@example.com）
 * @param password テストユーザーのパスワード（デフォルト: password123）
 */
export async function signInWithEmulator(
  page: Page,
  email: string = 'test@example.com',
  password: string = 'password123'
): Promise<void> {
  console.log(`🔐 Emulator環境で認証開始: ${email}`);

  // Step 1: Auth Emulator REST APIでテストユーザーを作成
  // Emulator環境では、signUpがidempotent（既存ユーザーでもエラーにならない）
  await page.evaluate(
    async ({ testEmail, testPassword }) => {
      // Firebase Auth Emulator REST API endpoint
      const emulatorUrl = 'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test-api-key';

      try {
        const response = await fetch(emulatorUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: testEmail,
            password: testPassword,
            returnSecureToken: true,
          }),
        });

        if (!response.ok) {
          // ユーザーが既に存在する場合もOK（Emulator環境では問題なし）
          console.log(`ℹ️ Auth Emulator signUp response: ${response.status}`);
        } else {
          console.log(`✅ テストユーザー作成成功: ${testEmail}`);
        }
      } catch (error) {
        console.warn(`⚠️ テストユーザー作成エラー（既存ユーザーの可能性）: ${error}`);
      }
    },
    { testEmail: email, testPassword: password }
  );

  // Step 2: ページに移動してFirebase SDKがロードされることを確認
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // 少し待ってFirebase SDKの初期化を完了させる
  await page.waitForTimeout(1000);

  // Step 3: page.evaluate()でFirebase SDKのログイン処理を実行
  const signInSuccess = await page.evaluate(
    async ({ testEmail, testPassword }) => {
      try {
        // Phase 18.2 Step 6: デバッグログ - グローバルオブジェクト確認
        console.log('🔍 [Auth Debug] グローバルオブジェクト確認:', {
          hasWindow: typeof window !== 'undefined',
          hasAuth: !!(window as any).__firebaseAuth,
          hasDb: !!(window as any).__firebaseDb,
          windowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.startsWith('__firebase')) : [],
        });

        // firebase.tsでグローバルに公開された__firebaseAuthを使用
        const auth = (window as any).__firebaseAuth;

        if (!auth) {
          console.error('❌ Firebase Auth がグローバルオブジェクトに存在しません');
          console.error('🔍 [Auth Debug] window.__firebaseAuth is undefined');
          return false;
        }

        console.log('✅ [Auth Debug] Firebase Auth取得成功');

        // Phase 18.2 Step 6: グローバルオブジェクトからsignInWithEmailAndPasswordを取得
        // firebase.tsでグローバルに公開された関数を使用
        console.log('🔍 [Auth Debug] Firebase Auth SDK関数取得開始');
        const signInWithEmailAndPassword = (window as any).__firebaseSignInWithEmailAndPassword;

        if (!signInWithEmailAndPassword) {
          console.error('❌ signInWithEmailAndPassword がグローバルオブジェクトに存在しません');
          console.error('🔍 [Auth Debug] window.__firebaseSignInWithEmailAndPassword is undefined');
          return false;
        }
        console.log('✅ [Auth Debug] Firebase Auth SDK関数取得成功');

        // ログイン実行
        console.log(`🔍 [Auth Debug] ログイン実行開始: ${testEmail}`);
        const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);

        console.log(`✅ Emulator認証成功: ${userCredential.user.email} (UID: ${userCredential.user.uid})`);
        return true;
      } catch (error: any) {
        console.error(`❌ Emulator認証失敗: ${error.message}`);
        console.error('🔍 [Auth Debug] エラー詳細:', {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack,
        });
        return false;
      }
    },
    { testEmail: email, testPassword: password }
  );

  if (!signInSuccess) {
    throw new Error(`Emulator認証に失敗しました: ${email}`);
  }

  // 認証処理の完了を待つ
  await page.waitForTimeout(2000);

  console.log(`✅ Emulator認証完了: ${email}`);
}

/**
 * 認証状態を確認
 *
 * @param page Playwrightページオブジェクト
 * @returns 認証済みの場合true
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    if (typeof window !== 'undefined' && (window as any).firebase) {
      const auth = (window as any).firebase.auth();
      return auth.currentUser !== null;
    }
    return false;
  });
}

/**
 * 現在のユーザーIDを取得
 *
 * @param page Playwrightページオブジェクト
 * @returns ユーザーID（未認証の場合null）
 */
export async function getCurrentUserId(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    if (typeof window !== 'undefined' && (window as any).firebase) {
      const auth = (window as any).firebase.auth();
      return auth.currentUser?.uid || null;
    }
    return null;
  });
}

/**
 * Firebase Auth Emulatorにテストユーザーを作成（Phase 17-1）
 *
 * @param params ユーザー作成パラメータ
 * @returns ユーザーID
 */
export async function createEmulatorUser(params: {
  email: string;
  password: string;
  displayName: string;
  customClaims?: Record<string, unknown>;
}): Promise<string> {
  console.log(`🔐 Emulatorユーザー作成: ${params.email}`);

  const response = await fetch(
    'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        displayName: params.displayName,
        returnSecureToken: true,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create emulator user: ${response.statusText}`);
  }

  const data = await response.json();
  const uid = data.localId;

  // Custom Claimsを設定
  if (params.customClaims) {
    await setEmulatorCustomClaims(uid, params.customClaims);
  }

  console.log(`✅ Emulatorユーザー作成成功: ${params.email} (UID: ${uid})`);
  return uid;
}

/**
 * Firebase Auth EmulatorのユーザーにCustom Claimsを設定（Phase 17-1）
 *
 * Phase 18-2: Firebase Admin SDK使用に変更
 *
 * @param uid ユーザーID
 * @param customClaims Custom Claims（role等）
 */
export async function setEmulatorCustomClaims(
  uid: string,
  customClaims: Record<string, unknown>
): Promise<void> {
  console.log(`🔐 Custom Claims設定: UID=${uid}`, customClaims);

  try {
    // Admin SDK初期化（未初期化の場合のみ）
    initializeAdminSDK();

    // Admin SDK経由でCustom Claims設定
    await admin.auth().setCustomUserClaims(uid, customClaims);

    console.log(`✅ Custom Claims設定成功: UID=${uid}`);
  } catch (error: any) {
    console.error(`❌ Custom Claims設定失敗: ${error.message}`);
    throw new Error(`Failed to set custom claims: ${error.message}`);
  }
}

/**
 * Emulator環境をクリーンアップ（全ユーザー削除）（Phase 17-1）
 *
 * テスト間での状態リセットに使用
 */
export async function clearEmulatorAuth(): Promise<void> {
  console.log(`🧹 Emulator Auth クリーンアップ開始`);

  const response = await fetch(
    'http://localhost:9099/emulator/v1/projects/ai-care-shift-scheduler/accounts',
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    console.warn(`⚠️ Emulator Auth クリーンアップ失敗: ${response.statusText}`);
    return;
  }

  console.log(`✅ Emulator Auth クリーンアップ完了`);
}

/**
 * Emulator環境でロール付きテストユーザーを作成してログイン（Phase 17-1）
 *
 * RBAC権限テストで使用
 *
 * @param page Playwrightページオブジェクト
 * @param params ユーザー作成+ログインパラメータ
 * @returns ユーザーID
 */
export async function setupAuthenticatedUser(
  page: Page,
  params: {
    email: string;
    password: string;
    displayName: string;
    role?: 'super-admin' | 'admin' | 'editor' | 'viewer';
    facilities?: string[];
  }
): Promise<string> {
  console.log(`🔐 認証済みユーザーセットアップ開始: ${params.email} (role: ${params.role || 'none'})`);

  // Custom Claimsを構築
  const customClaims: Record<string, unknown> = {};
  if (params.role) {
    customClaims.role = params.role;
  }
  if (params.facilities && params.facilities.length > 0) {
    customClaims.facilities = params.facilities;
  }

  // ユーザー作成
  const uid = await createEmulatorUser({
    email: params.email,
    password: params.password,
    displayName: params.displayName,
    customClaims: Object.keys(customClaims).length > 0 ? customClaims : undefined,
  });

  // ログイン
  await signInWithEmulator(page, params.email, params.password);

  console.log(`✅ 認証済みユーザーセットアップ完了: ${params.email} (UID: ${uid})`);
  return uid;
}
