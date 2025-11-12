/**
 * 削除済みユーザーのFirestoreドキュメントをクリーンアップ
 *
 * このスクリプトは以下を実行します：
 * 1. Firestore users collection のすべてのドキュメントを取得
 * 2. 各ユーザーがFirebase Authenticationに存在するか確認
 * 3. 存在しないユーザーのFirestoreドキュメントを削除
 * 4. 監査ログに記録
 *
 * 実行方法:
 *   npm run cleanup:deleted-users
 *
 * 注意:
 *   - 本番環境での実行は禁止されています（NODE_ENV=production時はエラー）
 *   - 実行前に5秒の確認待機時間があります（Ctrl+Cでキャンセル可能）
 */

import * as admin from 'firebase-admin';

// 環境変数チェック（本番環境での誤実行防止）
if (process.env.NODE_ENV === 'production') {
  console.error('❌ This script cannot be run in production environment');
  console.error('Please run in development or staging environment');
  process.exit(1);
}

// Firebase Admin SDK初期化
// Firebase Admin SDK will auto-detect project from environment
// Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CONFIG env vars
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

async function cleanupDeletedUsers() {
  console.log('🔍 Starting cleanup of deleted users...\n');

  try {
    // 1. Firestore users collection のすべてのドキュメントを取得
    const usersSnapshot = await db.collection('users').get();
    console.log(`📊 Total users in Firestore: ${usersSnapshot.size}\n`);

    let deletedCount = 0;
    let existsCount = 0;
    let errorCount = 0;

    // 2. 各ユーザーをチェック
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const userEmail = userData.email || 'unknown';

      try {
        // Firebase Authentication にユーザーが存在するか確認
        await auth.getUser(userId);

        // 存在する場合
        console.log(`✅ User ${userId} (${userEmail}) exists in Authentication`);
        existsCount++;
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // Authentication に存在しないユーザー → Firestore から削除
          console.log(`🗑️  User ${userId} (${userEmail}) not found in Authentication`);
          console.log(`    Deleting Firestore document...`);

          // Firestore ドキュメント削除
          await db.collection('users').doc(userId).delete();

          // 監査ログに記録
          await db.collection('auditLogs').add({
            userId: 'system',
            action: 'cleanup_deleted_user',
            resourceType: 'user',
            resourceId: userId,
            metadata: {
              email: userEmail,
              cleanupReason: 'User not found in Authentication',
              cleanupAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            result: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`    ✅ Deleted successfully\n`);
          deletedCount++;
        } else {
          // その他のエラー
          console.error(`❌ Error checking user ${userId} (${userEmail}):`, error.message);
          errorCount++;
        }
      }
    }

    // 3. 結果サマリー
    console.log('\n' + '='.repeat(60));
    console.log('📊 Cleanup Summary:');
    console.log('='.repeat(60));
    console.log(`Total users checked:     ${usersSnapshot.size}`);
    console.log(`Users still valid:       ${existsCount}`);
    console.log(`Users deleted:           ${deletedCount}`);
    console.log(`Errors encountered:      ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (deletedCount > 0) {
      console.log('✅ Cleanup completed successfully');
    } else {
      console.log('ℹ️  No deleted users found');
    }
  } catch (error) {
    console.error('❌ Failed to cleanup deleted users:', error);
    process.exit(1);
  }
}

// 確認プロンプト（安全策）
async function confirmExecution() {
  console.log('⚠️  WARNING: This script will delete Firestore documents for users that do not exist in Firebase Authentication.\n');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  // 5秒待機
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log('Starting cleanup...\n');
}

// 実行
confirmExecution()
  .then(() => cleanupDeletedUsers())
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
