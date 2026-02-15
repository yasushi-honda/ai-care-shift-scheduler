/**
 * backupFacilityData.ts
 *
 * Phase 19.3.2: バックアップ・リストア機能 - 施設データバックアップ
 *
 * 特徴:
 * - 施設データをCloud Storageにバックアップ
 * - JSON形式でシリアライズ
 * - admin または super-admin 権限が必要
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';

interface BackupRequest {
  facilityId: string;
}

interface BackupResponse {
  backupId: string;
  storageUrl: string;
  timestamp: string;
  statistics: {
    staffCount: number;
    scheduleCount: number;
    scheduleVersionCount: number;
    leaveRequestCount: number;
    totalSize: number;
  };
}

/**
 * 施設データをバックアップ
 *
 * 認証: admin または super-admin
 * レート制限: Cloud Functionsのデフォルト制限に依存
 */
export const backupFacilityData = onCall<BackupRequest, Promise<BackupResponse>>(
  {
    region: 'asia-northeast1', // 東京リージョン（日本国内データ処理）
    memory: '512MiB',
    timeoutSeconds: 300, // 5分（バックアップ処理に時間がかかる可能性）
    minInstances: 0,
    maxInstances: 5,
  },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '認証が必要です');
    }

    const { facilityId } = request.data;

    if (!facilityId) {
      throw new HttpsError('invalid-argument', 'facilityIdが必要です');
    }

    // 権限チェック（super-admin または該当施設のadmin）
    const isSuperAdmin = request.auth.token.role === 'super-admin';
    const isFacilityAdmin =
      request.auth.token.facilityId === facilityId &&
      request.auth.token.role === 'admin';

    if (!isSuperAdmin && !isFacilityAdmin) {
      throw new HttpsError('permission-denied', 'バックアップ権限がありません');
    }

    const db = admin.firestore();
    const storage = admin.storage();

    try {
      // 1. 施設情報を取得
      const facilityDoc = await db.collection('facilities').doc(facilityId).get();
      if (!facilityDoc.exists) {
        throw new HttpsError('not-found', '施設が見つかりません');
      }
      const facilityData = facilityDoc.data();
      if (!facilityData) {
        throw new HttpsError('not-found', '施設データが存在しません');
      }
      const facility = { facilityId, ...facilityData };

      // 2. スタッフデータを取得
      const staffSnapshot = await db
        .collection('facilities')
        .doc(facilityId)
        .collection('staff')
        .get();
      const staff = staffSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // 3. スケジュールデータを取得
      const schedulesSnapshot = await db
        .collection('facilities')
        .doc(facilityId)
        .collection('schedules')
        .get();
      const schedules = schedulesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // 4. スケジュールバージョンを取得
      const scheduleVersions: any[] = [];
      for (const scheduleDoc of schedulesSnapshot.docs) {
        const versionsSnapshot = await scheduleDoc.ref.collection('versions').get();
        versionsSnapshot.docs.forEach((versionDoc) => {
          scheduleVersions.push({
            scheduleId: scheduleDoc.id,
            versionId: versionDoc.id,
            ...versionDoc.data(),
          });
        });
      }

      // 5. 休暇申請データを取得
      const leaveRequestsSnapshot = await db
        .collection('facilities')
        .doc(facilityId)
        .collection('leaveRequests')
        .get();
      const leaveRequests = leaveRequestsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // 6. バックアップオブジェクトを作成
      const backupId = randomUUID();
      const timestamp = new Date().toISOString();

      const backupData = {
        backupId,
        facilityId,
        facilityName: (facility as any).name,
        timestamp,
        schemaVersion: '1.0.0',
        createdBy: request.auth.uid,
        backupType: 'manual',
        data: {
          facility,
          staff,
          schedules,
          scheduleVersions,
          leaveRequests,
        },
        statistics: {
          staffCount: staff.length,
          scheduleCount: schedules.length,
          scheduleVersionCount: scheduleVersions.length,
          leaveRequestCount: leaveRequests.length,
          totalSize: 0, // 後で計算
        },
      };

      // 7. JSON文字列に変換
      const backupJson = JSON.stringify(backupData, null, 2);
      backupData.statistics.totalSize = Buffer.byteLength(backupJson, 'utf8');

      // 8. Cloud Storageに保存
      const filename = `backups/${facilityId}/${timestamp}.json`;
      const bucket = storage.bucket();
      const file = bucket.file(filename);

      await file.save(backupJson, {
        metadata: {
          contentType: 'application/json',
          metadata: {
            facilityId,
            backupId,
            createdBy: request.auth.uid,
            createdAt: timestamp,
            type: 'manual',
          },
        },
      });

      // 9. ダウンロードURLを取得（署名付きURL、7日間有効）
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7日後
      });

      console.log(`Backup completed: ${backupId} (${backupData.statistics.totalSize} bytes)`);

      return {
        backupId,
        storageUrl: signedUrl,
        timestamp,
        statistics: backupData.statistics,
      };
    } catch (error) {
      console.error('Backup failed:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        `バックアップに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    }
  }
);
