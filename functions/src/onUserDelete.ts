import * as functionsV1 from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Firebase Authentication ユーザー削除時に Firestore ドキュメントも削除
 *
 * このトリガーは以下を実行します：
 * 1. Firestore users collection からユーザードキュメントを削除
 * 2. 削除操作を監査ログに記録
 *
 * Requirements: Phase 17.10 - onUserDelete Cloud Function修正
 *
 * Note: Firebase Authenticationでユーザーが削除されると、このトリガーが自動実行される。
 * Firestoreの users collection とデータ整合性を保つために、
 * 対応するドキュメントも削除する。
 * v2にはユーザー削除トリガーがないため、v1のAPIを使用しています。
 *
 * @param user - 削除されたユーザー情報
 */
export const onUserDelete = functionsV1.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const userEmail = user.email || 'unknown';
  const db = admin.firestore();

  console.log(`🗑️ User deleted from Authentication: ${uid} (${userEmail})`);

  try {
    // 1. Firestore users collection からドキュメントを削除
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      console.warn(`⚠️ User document does not exist in Firestore: ${uid}`);
      // ドキュメントが存在しない場合も成功とみなす（冪等性）
    } else {
      // ドキュメント削除
      await userDocRef.delete();
      console.log(`✅ Successfully deleted Firestore document for user: ${uid}`);
    }

    // 2. 監査ログに記録（成功）
    await db.collection('auditLogs').add({
      userId: 'system', // システム操作として記録
      action: 'user_deleted',
      resourceType: 'user',
      resourceId: uid,
      metadata: {
        email: userEmail,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        documentExisted: userDoc.exists,
      },
      result: 'success',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📝 Audit log created for user deletion: ${uid}`);
  } catch (error) {
    console.error(`❌ Failed to delete Firestore document for user ${uid}:`, error);

    // 3. 監査ログに記録（失敗）
    try {
      await db.collection('auditLogs').add({
        userId: 'system',
        action: 'user_deleted',
        resourceType: 'user',
        resourceId: uid,
        metadata: {
          email: userEmail,
          error: (error as Error).message,
          errorStack: (error as Error).stack,
        },
        result: 'failure',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (logError) {
      console.error(`❌ Failed to create audit log for user deletion: ${logError}`);
    }

    // エラーを再スローして、Cloud Functionsのエラーログに記録
    throw error;
  }
});
