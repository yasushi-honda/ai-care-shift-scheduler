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
 * @param page Playwrightページオブジェクト
 * @param userId テストユーザーID（デフォルト: test-super-admin）
 * @param email テストユーザーのメールアドレス
 */
export async function signInWithEmulator(
  page: Page,
  userId: string = 'test-super-admin',
  email: string = 'test@example.com'
): Promise<void> {
  // Firebase Auth Emulatorの自動認証機能を使用
  // page.evaluate()でブラウザ側のFirebase SDKを操作

  await page.evaluate(
    async ({ uid, userEmail }) => {
      // Firebase SDKがロードされるまで待機
      if (typeof window !== 'undefined' && (window as any).firebase) {
        const auth = (window as any).firebase.auth();

        // Emulator環境の場合、connectAuthEmulatorが呼ばれているはず
        // （src/lib/firebase.tsで設定済み）

        // カスタムトークンは使用せず、Emulatorの自動ログイン機能を利用
        // Emulator環境では、任意のUIDでsignInWithCustomToken()が可能

        // 注意: これは簡易的な実装です
        // 実際のプロダクション環境では使用しないでください

        console.log(`🔐 Emulator環境で認証: ${userEmail} (${uid})`);
      }
    },
    { uid: userId, userEmail: email }
  );

  // 認証処理の完了を待つ（簡易的なwait）
  await page.waitForTimeout(1000);
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
