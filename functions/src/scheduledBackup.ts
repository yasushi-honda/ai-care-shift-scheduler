/**
 * scheduledBackup.ts
 *
 * Phase 19.3.2: バックアップ・リストア機能 - 定期バックアップ
 *
 * 特徴:
 * - Cloud Schedulerによる毎日自動バックアップ
 * - 全施設を順次バックアップ
 * - 30日以上前のバックアップを自動削除
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

/**
 * 毎日午前2時（JST）に全施設のバックアップを実行
 *
 * Cloud Scheduler: 0 17 * * * (UTC) = 午前2時（JST, UTC+9）
 */
export const scheduledBackup = onSchedule(
  {
    schedule: '0 17 * * *', // 毎日午前2時（JST）
    timeZone: 'UTC',
    region: 'asia-northeast1', // 東京リージョン（日本国内データ処理）
    memory: '1GiB',
    timeoutSeconds: 540, // 9分
    // retryConfig は v2 では自動的に設定される
  },
  async (event) => {
    const db = admin.firestore();
    const storage = admin.storage();

    console.log('Scheduled backup started');

    try {
      // 1. 全施設を取得
      const facilitiesSnapshot = await db.collection('facilities').get();

      console.log(`Found ${facilitiesSnapshot.size} facilities to backup`);

      for (const facilityDoc of facilitiesSnapshot.docs) {
        const facilityId = facilityDoc.id;
        const facilityName = facilityDoc.data().name;

        try {
          console.log(`Backing up facility: ${facilityId} (${facilityName})`);

          // 2. バックアップ処理（backupFacilityDataと同じロジック）
          const facilityData = facilityDoc.data();
          if (!facilityData) {
            console.error(`Facility data not found for ${facilityId}`);
            continue;
          }
          const facility = { facilityId, ...facilityData };

          const staffSnapshot = await db
            .collection('facilities')
            .doc(facilityId)
            .collection('staff')
            .get();
          const staff = staffSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          const schedulesSnapshot = await db
            .collection('facilities')
            .doc(facilityId)
            .collection('schedules')
            .get();
          const schedules = schedulesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

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

          const leaveRequestsSnapshot = await db
            .collection('facilities')
            .doc(facilityId)
            .collection('leaveRequests')
            .get();
          const leaveRequests = leaveRequestsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          const backupId = uuidv4();
          const timestamp = new Date().toISOString();

          const backupData = {
            backupId,
            facilityId,
            facilityName,
            timestamp,
            schemaVersion: '1.0.0',
            createdBy: 'system',
            backupType: 'scheduled',
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
              totalSize: 0,
            },
          };

          const backupJson = JSON.stringify(backupData, null, 2);
          backupData.statistics.totalSize = Buffer.byteLength(backupJson, 'utf8');

          const filename = `backups/${facilityId}/${timestamp}.json`;
          const bucket = storage.bucket();
          const file = bucket.file(filename);

          await file.save(backupJson, {
            metadata: {
              contentType: 'application/json',
              metadata: {
                facilityId,
                backupId,
                createdBy: 'system',
                createdAt: timestamp,
                type: 'scheduled',
              },
            },
          });

          console.log(`Backup completed for facility: ${facilityId} (${backupData.statistics.totalSize} bytes)`);
        } catch (error) {
          console.error(`Backup failed for facility ${facilityId}:`, error);
          // 1施設の失敗で全体を停止しない
          continue;
        }
      }

      // 3. 古いバックアップを削除（30日以上前）
      console.log('Cleaning up old backups (>30 days)');
      await cleanupOldBackups(storage);

      console.log('Scheduled backup completed successfully');
    } catch (error) {
      console.error('Scheduled backup failed:', error);
      throw error;
    }
  }
);

/**
 * 30日以上前のバックアップファイルを削除
 */
async function cleanupOldBackups(storage: admin.storage.Storage): Promise<void> {
  const bucket = storage.bucket();
  const [files] = await bucket.getFiles({ prefix: 'backups/' });

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  for (const file of files) {
    try {
      const [metadata] = await file.getMetadata();
      const createdAt = metadata.timeCreated ? new Date(metadata.timeCreated).getTime() : Date.now();

      if (createdAt < thirtyDaysAgo) {
        console.log(`Deleting old backup: ${file.name}`);
        await file.delete();
        deletedCount++;
      }
    } catch (error) {
      console.error(`Failed to delete ${file.name}:`, error);
      // 1ファイルの削除失敗で全体を停止しない
      continue;
    }
  }

  console.log(`Deleted ${deletedCount} old backup(s)`);
}
