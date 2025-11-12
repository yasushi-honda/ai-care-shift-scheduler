/**
 * Firebase Authentication Helper for E2E Tests
 *
 * Phase 18.2: Emulator環境での自動認証サポート
 *
 * このヘルパーは、Emulator環境でテストユーザーを作成し、
 * 認証状態を設定します。
 */

import { Page } from '@playwright/test';

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
        // firebase.tsでグローバルに公開された__firebaseAuthを使用
        const auth = (window as any).__firebaseAuth;

        if (!auth) {
          console.error('❌ Firebase Auth がグローバルオブジェクトに存在しません');
          return false;
        }

        // Firebase Auth SDKのsignInWithEmailAndPasswordを動的インポート
        // Viteの開発サーバーでは、node_modulesからESMとして提供される
        const authModule = await import('firebase/auth');
        const { signInWithEmailAndPassword } = authModule;

        // ログイン実行
        const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);

        console.log(`✅ Emulator認証成功: ${userCredential.user.email} (UID: ${userCredential.user.uid})`);
        return true;
      } catch (error: any) {
        console.error(`❌ Emulator認証失敗: ${error.message}`);
        console.error(error);
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
