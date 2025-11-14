/**
 * Playwright Global Setup
 *
 * Phase 18.2: Firebase Auth Emulator環境の準備
 *
 * このファイルは、全E2Eテスト実行前に一度だけ実行されます。
 * Emulator環境でのテスト準備を行います。
 */

import { chromium, FullConfig } from '@playwright/test';
import admin from 'firebase-admin';

// Firebase Admin SDKインスタンス（プライベート変数）
let _adminAuth: admin.auth.Auth | null = null;

/**
 * Admin Auth インスタンスを取得
 *
 * @returns Admin Auth インスタンス（未初期化の場合null）
 */
export function getAdminAuth(): admin.auth.Auth | null {
  return _adminAuth;
}

/**
 * Global Setup関数
 *
 * @param config Playwright設定
 */
async function globalSetup(config: FullConfig) {
  // baseURLを環境変数またはプロジェクト設定から取得
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ||
                  (config.projects && config.projects[0]?.use?.baseURL) ||
                  'http://localhost:5173';

  console.log('🔧 Playwright Global Setup開始');
  console.log(`  ベースURL: ${baseURL}`);

  // Emulator環境かどうかを判定
  const isEmulatorEnv = baseURL.includes('localhost') || baseURL.includes('127.0.0.1');

  if (isEmulatorEnv) {
    console.log('  🟢 Emulator環境を検出');
    console.log('  📌 Auth Emulator: http://localhost:9099');
    console.log('  📌 Firestore Emulator: http://localhost:8080');
    console.log('  📌 Emulator UI: http://localhost:4000');

    // Firebase Admin SDK初期化（Emulator環境）
    try {
      // Emulator環境設定（Admin SDK初期化前に設定）
      process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

      // Admin SDKが既に初期化されている場合はスキップ
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: 'ai-care-shift-scheduler',
        });
      }

      // Auth Emulator接続
      _adminAuth = admin.auth();

      console.log('  ✅ Firebase Admin SDK初期化完了');
    } catch (error) {
      console.error('  ❌ Firebase Admin SDK初期化失敗:', error);
      throw error;
    }

    console.log('  ✅ Emulator環境準備完了');
  } else {
    console.log('  🟡 本番環境を検出');
    console.log('  ⚠️  Permission errorテストは認証状態が必要です');
  }

  console.log('✅ Playwright Global Setup完了\n');
}

export default globalSetup;
