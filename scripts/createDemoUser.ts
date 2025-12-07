#!/usr/bin/env tsx

/**
 * デモユーザー作成スクリプト
 *
 * Phase 42.2: デモログイン機能
 * - Firebase AuthenticationにEmail/Passwordデモユーザーを作成
 * - Firestoreにユーザードキュメントを作成
 * - demo-facility-001へのviewer権限を付与
 *
 * 使用方法:
 *   npx tsx scripts/createDemoUser.ts
 *
 * 前提条件:
 *   - Firebase Admin SDKがサービスアカウント経由で認証できること
 *   - GOOGLE_APPLICATION_CREDENTIALS環境変数が設定されていること
 *     または、gcloud auth application-default loginが実行済みであること
 */

import admin from 'firebase-admin';

// ==================== 設定 ====================

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo-password-2024';
const DEMO_DISPLAY_NAME = 'デモユーザー';
const DEMO_FACILITY_ID = 'demo-facility-001';

// ==================== Firebase Admin初期化 ====================

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'ai-care-shift-scheduler';

console.log(`🔧 プロジェクトID: ${projectId}`);

try {
  admin.initializeApp({
    projectId: projectId,
  });
  console.log('✅ Firebase Admin SDK initialized');
} catch (error: any) {
  console.error('❌ Firebase Admin SDK initialization failed:', error.message);
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

// ==================== メイン処理 ====================

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  デモユーザー作成スクリプト (Phase 42.2)');
  console.log('========================================');
  console.log('');

  let uid: string;

  // 1. Firebase Authenticationでユーザー作成
  console.log('📋 Firebase Authenticationでデモユーザーを作成/確認...');

  try {
    // 既存ユーザーを確認
    const existingUser = await auth.getUserByEmail(DEMO_EMAIL);
    uid = existingUser.uid;
    console.log(`  ✓ デモユーザーは既に存在します: ${uid}`);

    // パスワード更新（念のため）
    await auth.updateUser(uid, {
      password: DEMO_PASSWORD,
      displayName: DEMO_DISPLAY_NAME,
    });
    console.log('  ✓ パスワードを更新しました');
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      // 新規作成
      const newUser = await auth.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        displayName: DEMO_DISPLAY_NAME,
        emailVerified: true, // デモ用なのでメール確認済みに
      });
      uid = newUser.uid;
      console.log(`  ✓ デモユーザーを作成しました: ${uid}`);
    } else {
      throw error;
    }
  }

  // 2. Firestoreにユーザードキュメント作成
  console.log('');
  console.log('📋 Firestoreにユーザードキュメントを作成/更新...');

  const now = admin.firestore.Timestamp.now();
  const userRef = db.collection('users').doc(uid);

  const userData = {
    userId: uid,
    email: DEMO_EMAIL,
    displayName: DEMO_DISPLAY_NAME,
    provider: 'password',
    facilities: [
      {
        facilityId: DEMO_FACILITY_ID,
        role: 'editor', // Phase 43.2.1: 保存可能にするためeditorに変更
        grantedAt: now,
      },
    ],
    createdAt: now,
    lastLoginAt: now,
  };

  await userRef.set(userData, { merge: true });
  console.log('  ✓ ユーザードキュメントを作成/更新しました');

  // 3. 施設のmembersにデモユーザーを追加
  console.log('');
  console.log('📋 施設のメンバーリストにデモユーザーを追加...');

  const facilityRef = db.collection('facilities').doc(DEMO_FACILITY_ID);
  const facilityDoc = await facilityRef.get();

  if (facilityDoc.exists) {
    const facilityData = facilityDoc.data();
    const members = facilityData?.members || [];

    // 既存メンバーチェック
    const existingMember = members.find((m: any) => m.userId === uid);
    if (!existingMember) {
      members.push({
        userId: uid,
        role: 'editor', // Phase 43.2.1: 保存可能にするためeditorに変更
        grantedAt: now,
      });
      await facilityRef.update({ members });
      console.log('  ✓ 施設メンバーに追加しました');
    } else {
      console.log('  ✓ 既に施設メンバーに含まれています');
    }
  } else {
    console.log('  ⚠️ デモ施設が存在しません。先に npm run seed:demo を実行してください。');
  }

  // 完了
  console.log('');
  console.log('========================================');
  console.log('✅ デモユーザーの作成が完了しました！');
  console.log('========================================');
  console.log('');
  console.log('📝 デモアカウント情報:');
  console.log(`   Email: ${DEMO_EMAIL}`);
  console.log(`   UID: ${uid}`);
  console.log(`   権限: ${DEMO_FACILITY_ID} (editor)`);
  console.log('');
  console.log('💡 ログインページの「デモアカウントでログイン」ボタンを');
  console.log('   クリックすると、このアカウントでログインできます。');
  console.log('');
}

// ==================== エントリーポイント ====================

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ エラーが発生しました:', error);
    console.error('');
    process.exit(1);
  });
