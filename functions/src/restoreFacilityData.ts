/**
 * restoreFacilityData.ts
 *
 * Phase 19.3.2: バックアップ・リストア機能 - データ復元
 *
 * 特徴:
 * - バックアップファイルから施設データを復元
 * - super-admin 権限のみ（高リスク操作）
 * - 既存データは上書きされる
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface RestoreRequest {
  facilityId: string;
  backupId: string;
  storageUrl: string; // gs://... 形式
}

interface RestoreResponse {
  restored: {
    staffCount: number;
    scheduleCount: number;
    scheduleVersionCount: number;
    leaveRequestCount: number;
  };
  timestamp: string;
}

/**
 * バックアップからデータを復元
 *
 * 認証: super-admin のみ
 *
 * ⚠️ 注意: 既存データは上書きされます
 */
export const restoreFacilityData = onCall<RestoreRequest, Promise<RestoreResponse>>(
  {
    region: 'us-central1',
    memory: '1GiB', // 大量データ復元に備えて増量
    timeoutSeconds: 540, // 9分（最大値）
    minInstances: 0,
    maxInstances: 2, // リストアは並列実行しない
  },
  async (request) => {
    // 認証チェック（super-adminのみ）
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '認証が必要です');
    }

    if (request.auth.token.role !== 'super-admin') {
      throw new HttpsError(
        'permission-denied',
        'リストア権限がありません（super-adminのみ実行可能）'
      );
    }

    const { facilityId, storageUrl } = request.data;

    if (!facilityId || !storageUrl) {
      throw new HttpsError('invalid-argument', 'facilityIdとstorageUrlが必要です');
    }

    const db = admin.firestore();
    const storage = admin.storage();

    try {
      // 1. バックアップファイルをCloud Storageから読み込み
      const bucket = storage.bucket();
      const file = bucket.file(storageUrl.replace(`gs://${bucket.name}/`, ''));

      const [fileContents] = await file.download();
      const backupData = JSON.parse(fileContents.toString('utf8'));

      // 2. スキーマバージョンチェック
      if (backupData.schemaVersion !== '1.0.0') {
        throw new HttpsError(
          'failed-precondition',
          `サポートされていないスキーマバージョンです: ${backupData.schemaVersion}`
        );
      }

      // 3. 施設IDの一致確認
      if (backupData.facilityId !== facilityId) {
        throw new HttpsError('invalid-argument', 'バックアップの施設IDが一致しません');
      }

      // 4. バッチ処理で復元（Firestoreの制限: 500ドキュメント/バッチ）
      let batch = db.batch();
      let operationCount = 0;

      // 4.1 施設情報を復元
      const facilityRef = db.collection('facilities').doc(facilityId);
      batch.set(facilityRef, backupData.data.facility, { merge: true });
      operationCount++;

      // 4.2 スタッフを復元
      for (const staffData of backupData.data.staff) {
        const staffRef = facilityRef.collection('staff').doc(staffData.id);
        batch.set(staffRef, staffData);
        operationCount++;

        // バッチの制限（500）に達したらコミット
        if (operationCount >= 450) {
          await batch.commit();
          batch = db.batch();
          operationCount = 0;
        }
      }

      // 4.3 スケジュールを復元
      for (const scheduleData of backupData.data.schedules) {
        const scheduleRef = facilityRef.collection('schedules').doc(scheduleData.id);
        batch.set(scheduleRef, scheduleData);
        operationCount++;

        if (operationCount >= 450) {
          await batch.commit();
          batch = db.batch();
          operationCount = 0;
        }
      }

      // 4.4 スケジュールバージョンを復元
      for (const versionData of backupData.data.scheduleVersions) {
        const versionRef = facilityRef
          .collection('schedules')
          .doc(versionData.scheduleId)
          .collection('versions')
          .doc(versionData.versionId);
        batch.set(versionRef, versionData);
        operationCount++;

        if (operationCount >= 450) {
          await batch.commit();
          batch = db.batch();
          operationCount = 0;
        }
      }

      // 4.5 休暇申請を復元
      for (const leaveRequestData of backupData.data.leaveRequests) {
        const leaveRequestRef = facilityRef.collection('leaveRequests').doc(leaveRequestData.id);
        batch.set(leaveRequestRef, leaveRequestData);
        operationCount++;

        if (operationCount >= 450) {
          await batch.commit();
          batch = db.batch();
          operationCount = 0;
        }
      }

      // 最後のバッチをコミット
      if (operationCount > 0) {
        await batch.commit();
      }

      const result = {
        restored: {
          staffCount: backupData.data.staff.length,
          scheduleCount: backupData.data.schedules.length,
          scheduleVersionCount: backupData.data.scheduleVersions.length,
          leaveRequestCount: backupData.data.leaveRequests.length,
        },
        timestamp: new Date().toISOString(),
      };

      console.log(`Restore completed: ${facilityId}`, result.restored);

      return result;
    } catch (error) {
      console.error('Restore failed:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        `リストアに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    }
  }
);
