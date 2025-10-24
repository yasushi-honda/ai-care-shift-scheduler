import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * 初回ユーザーのfacilities配列を修正
 * 問題: assignSuperAdminOnFirstUserが2つのfacilitiesエントリを作成していた
 * 解決: super-adminロールのみを持つように修正
 */
export const fixFirstUserRole = onRequest(
  { region: 'asia-northeast1' },
  async (req, res) => {
    try {
      const db = admin.firestore();

      // system/config から初回ユーザーIDを取得
      const configDoc = await db.collection('system').doc('config').get();
      if (!configDoc.exists) {
        res.status(404).json({
          success: false,
          error: 'System config not found'
        });
        return;
      }

      const config = configDoc.data();
      const firstUserId = config?.firstUserId;

      if (!firstUserId) {
        res.status(404).json({
          success: false,
          error: 'First user ID not found in config'
        });
        return;
      }

      // ユーザードキュメントを取得
      const userDoc = await db.collection('users').doc(firstUserId).get();
      if (!userDoc.exists) {
        res.status(404).json({
          success: false,
          error: `User ${firstUserId} not found`
        });
        return;
      }

      const userData = userDoc.data();
      if (!userData || !userData.facilities || userData.facilities.length === 0) {
        res.status(400).json({
          success: false,
          error: 'User has no facilities'
        });
        return;
      }

      // 現在の状態を記録
      const originalFacilities = userData.facilities;

      // facilityIdで一意にし、super-adminロールのみを保持
      const facilityId = originalFacilities[0].facilityId;
      const fixedFacilities = [{
        facilityId: facilityId,
        role: 'super-admin',
        grantedAt: originalFacilities[0].grantedAt || admin.firestore.Timestamp.now(),
        grantedBy: firstUserId,
      }];

      // 更新
      await db.collection('users').doc(firstUserId).update({
        facilities: fixedFacilities
      });

      res.status(200).json({
        success: true,
        message: 'First user role fixed',
        userId: firstUserId,
        before: {
          facilities: originalFacilities,
          count: originalFacilities.length
        },
        after: {
          facilities: fixedFacilities,
          count: fixedFacilities.length
        }
      });

    } catch (error: any) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);
