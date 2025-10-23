import { onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

/**
 * Firestore onCreate トリガー（users collection）
 *
 * 初回ユーザー（システム内に1人もユーザーが存在しない場合）をsuper-admin権限で作成し、
 * デフォルト施設を自動作成してadmin権限を付与する。
 * それ以外のユーザーは権限なし（facilities: []）で作成する。
 *
 * Requirements: 1.5, 1.6, 1.7, 1.8, 1.9, 2.1
 *
 * Note: クライアント側でユーザードキュメント作成後、このトリガーが実行され、
 * 必要に応じてsuper-admin権限とデフォルト施設を付与する。
 */
export const assignSuperAdminOnFirstUser = onDocumentCreated(
  'users/{userId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }

    const userData = snapshot.data();
    const uid = event.params.userId;
    const { email, name } = userData;

    if (!email) {
      // クライアント側でemailバリデーション済みのため、これは異常ケース
      // throwせずにログを残して早期returnし、ユーザーは権限なし状態のまま
      console.error('❌ Email is missing in user document - skipping permission assignment', { uid });
      return;
    }

    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    try {
      // トランザクションでfirst userフラグをチェック・設定し、レースコンディションを防ぐ
      const configRef = db.collection('system').doc('config');
      let isSuperAdmin = false;

      await db.runTransaction(async (transaction) => {
        const configDoc = await transaction.get(configRef);

        if (!configDoc.exists || !configDoc.data()?.firstUserProcessed) {
          // 初回ユーザー: フラグを設定してsuper-admin権限を付与
          isSuperAdmin = true;
          transaction.set(
            configRef,
            { firstUserProcessed: true, processedAt: now, firstUserId: uid },
            { merge: true }
          );

          console.log('🎉 初回ユーザー検出 - super-admin権限を付与します', { uid, email });

          // デフォルト施設を作成
          const defaultFacilityId = `facility-${uid}`;
          const facilityRef = db.collection('facilities').doc(defaultFacilityId);

          transaction.set(facilityRef, {
            facilityId: defaultFacilityId,
            name: 'デフォルト施設',
            createdAt: now,
            createdBy: uid,
            members: [{
              userId: uid,
              email,
              name: name || '',
              role: 'admin',
            }],
          });

          // ユーザードキュメントを更新（super-admin + admin権限を付与）
          const userRef = db.collection('users').doc(uid);
          transaction.update(userRef, {
            facilities: [
              {
                facilityId: defaultFacilityId,
                role: 'super-admin',
                grantedAt: now,
                grantedBy: uid, // 自動付与
              },
              {
                facilityId: defaultFacilityId,
                role: 'admin',
                grantedAt: now,
                grantedBy: uid,
              },
            ],
          });
        } else {
          // 2人目以降のユーザー: 権限なし（facilities: []のまま）
          console.log('👤 新規ユーザー作成 - 権限なし', { uid, email });
        }
      });

      if (isSuperAdmin) {
        console.log('✅ super-admin権限付与完了（トランザクション成功）', { uid, email });
      }

    } catch (error) {
      console.error('❌ ユーザー権限付与エラー:', error);
      throw new Error(`Failed to assign user permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

/**
 * 手動でユーザーのlastLoginAtを更新するHTTPS Callable Function
 *
 * クライアント側から呼び出して、既存ユーザーのlastLoginAtを更新する。
 * onCreate triggerではlastLoginAt更新ができないため、この関数を使用する。
 */
export const updateLastLogin = onCall(async (request) => {
  const { auth } = request;

  if (!auth) {
    throw new Error('Unauthenticated');
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(auth.uid);

  try {
    await userRef.set({
      lastLoginAt: admin.firestore.Timestamp.now(),
    }, { merge: true });

    console.log('✅ lastLoginAt更新完了', { uid: auth.uid });

    return { success: true };
  } catch (error) {
    console.error('❌ lastLoginAt更新エラー:', error);
    throw new Error(`Failed to update lastLoginAt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});
