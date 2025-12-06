/**
 * デモサインイン Cloud Function
 *
 * Phase 42.2: デモログイン機能
 * - クライアントからの認証情報ハードコードを回避
 * - サーバーサイドでデモユーザーのカスタムトークンを発行
 * - セキュリティ: 認証情報はサーバーサイドでのみ管理
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// デモアカウント設定（サーバーサイドでのみ保持）
const DEMO_USER_UID = 'demo-user-fixed-uid';
const DEMO_EMAIL = 'demo@example.com';
const DEMO_DISPLAY_NAME = 'デモユーザー';
const DEMO_FACILITY_ID = 'demo-facility-001';

/**
 * デモサインイン用カスタムトークンを発行
 *
 * POST /demoSignIn
 *
 * @returns { customToken: string } - Firebase Authenticationのカスタムトークン
 */
export const demoSignIn = onRequest({
  // セキュリティ: 特定のオリジンのみ許可
  cors: [
    'https://ai-care-shift-scheduler.web.app',
    'https://ai-care-shift-scheduler.firebaseapp.com',
    'http://localhost:5173', // ローカル開発環境
    'http://localhost:3000', // E2Eテスト環境
  ],
  timeoutSeconds: 30,
  memory: '256MiB',
}, async (req, res) => {
  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('🔄 demoSignIn: Starting...');
    const auth = admin.auth();
    const db = admin.firestore();
    console.log('🔄 demoSignIn: Firebase services initialized');

    // デモユーザーの存在確認・作成
    try {
      const existingUser = await auth.getUser(DEMO_USER_UID);
      console.log('✅ Demo user exists:', existingUser.uid);
    } catch (error: any) {
      console.log('🔄 demoSignIn: User lookup result -', error.code);
      if (error.code === 'auth/user-not-found') {
        // デモユーザーを作成
        console.log('🔄 demoSignIn: Creating new demo user...');
        await auth.createUser({
          uid: DEMO_USER_UID,
          email: DEMO_EMAIL,
          displayName: DEMO_DISPLAY_NAME,
          emailVerified: true,
        });
        console.log('✅ Demo user created:', DEMO_USER_UID);
      } else {
        console.error('❌ Auth error:', error.code, error.message);
        throw error;
      }
    }

    // Firestoreにユーザードキュメントを作成/更新
    // レースコンディション対策: set with mergeを使用
    const now = admin.firestore.Timestamp.now();
    const userRef = db.collection('users').doc(DEMO_USER_UID);

    console.log('🔄 demoSignIn: Creating/updating user document...');
    await userRef.set({
      userId: DEMO_USER_UID,
      email: DEMO_EMAIL,
      displayName: DEMO_DISPLAY_NAME,
      provider: 'demo',
      facilities: [{
        facilityId: DEMO_FACILITY_ID,
        role: 'viewer',
        grantedAt: now,
      }],
      lastLoginAt: now,
    }, { merge: true }); // merge: trueでcreatedAtは最初の設定時のみ
    console.log('✅ Demo user document updated');

    // 施設メンバーにデモユーザーを追加
    const facilityRef = db.collection('facilities').doc(DEMO_FACILITY_ID);
    const facilityDoc = await facilityRef.get();

    if (facilityDoc.exists) {
      const facilityData = facilityDoc.data();
      const members = facilityData?.members || [];
      const existingMember = members.find((m: any) => m.userId === DEMO_USER_UID);

      if (!existingMember) {
        members.push({
          userId: DEMO_USER_UID,
          role: 'viewer',
          grantedAt: now,
        });
        await facilityRef.update({ members });
        console.log('✅ Demo user added to facility members');
      }
    }

    // カスタムトークンを発行
    console.log('🔄 demoSignIn: Creating custom token...');
    const customToken = await auth.createCustomToken(DEMO_USER_UID, {
      demoUser: true,
    });

    console.log('✅ Custom token issued for demo user');

    res.status(200).json({ customToken });
  } catch (error: any) {
    console.error('❌ Demo sign-in error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({
      error: 'デモログインに失敗しました。しばらく経ってから再度お試しください。',
    });
  }
});
