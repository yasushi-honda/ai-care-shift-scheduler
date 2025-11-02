import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Storage } from '@google-cloud/storage';

/**
 * 監査ログアーカイブCloud Function
 *
 * 90日以上前の監査ログをCloud Storageにアーカイブし、Firestoreから削除する
 * Cloud Schedulerで月次実行（毎月1日 2:00 JST）
 *
 * @returns {Promise<void>}
 */
export const archiveAuditLogs = onRequest(
  {
    timeoutSeconds: 540, // 9分（Cloud Functions gen2の最大値）
    region: 'us-central1',
    memory: '512MiB',
  },
  async (req, res) => {
    const db = getFirestore();
    const storage = new Storage();
    const bucketName = 'ai-care-shift-scheduler.appspot.com';
    const bucket = storage.bucket(bucketName);

    try {
      console.log('Starting audit log archive process...');

      // 1. 90日以上前のログを取得
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoffTimestamp = Timestamp.fromDate(ninetyDaysAgo);

      console.log(`Cutoff date: ${ninetyDaysAgo.toISOString()}`);

      const oldLogsQuery = db
        .collection('auditLogs')
        .where('timestamp', '<', cutoffTimestamp)
        .orderBy('timestamp', 'asc');

      const oldLogsSnapshot = await oldLogsQuery.get();

      console.log(`Found ${oldLogsSnapshot.size} logs to archive`);

      if (oldLogsSnapshot.empty) {
        console.log('No logs to archive');
        res.status(200).json({
          success: true,
          message: 'No logs to archive',
          archivedCount: 0,
        });
        return;
      }

      // 2. JSON Lines形式に変換（1行1ログ）
      const logs = oldLogsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Timestamp型をISO文字列に変換
          timestamp: data.timestamp?.toDate().toISOString(),
          detectedAt: data.detectedAt?.toDate().toISOString(),
        };
      });

      const jsonLines = logs.map((log) => JSON.stringify(log)).join('\n');

      // 3. Cloud Storageにアップロード
      const year = ninetyDaysAgo.getFullYear();
      const month = String(ninetyDaysAgo.getMonth() + 1).padStart(2, '0');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `audit-logs/archive/audit-logs-${year}-${month}-${timestamp}.jsonl`;

      console.log(`Uploading to Cloud Storage: ${fileName}`);

      const file = bucket.file(fileName);
      await file.save(jsonLines, {
        contentType: 'application/x-ndjson',
        metadata: {
          archivedAt: new Date().toISOString(),
          logsCount: String(logs.length),
          cutoffDate: ninetyDaysAgo.toISOString(),
        },
      });

      console.log(`Upload completed: ${logs.length} logs`);

      // 4. Firestoreから削除（バッチ処理: 500件ずつ）
      const batchSize = 500;
      let deletedCount = 0;

      console.log(`Starting batch deletion (${batchSize} docs per batch)...`);

      for (let i = 0; i < oldLogsSnapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const docsToDelete = oldLogsSnapshot.docs.slice(i, i + batchSize);

        docsToDelete.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        deletedCount += docsToDelete.length;

        console.log(`Deleted ${deletedCount}/${oldLogsSnapshot.docs.length} logs`);
      }

      console.log(`Deletion completed: ${deletedCount} logs deleted`);

      // 5. セキュリティアラート生成（アーカイブ完了通知）
      await db.collection('securityAlerts').add({
        type: 'STORAGE_THRESHOLD',
        severity: 'low',
        status: 'resolved',
        description: `監査ログアーカイブ完了: ${deletedCount}件のログをアーカイブしました`,
        detectedAt: Timestamp.now(),
        details: {
          archivedCount: deletedCount,
          archiveFile: fileName,
          bucketName,
          cutoffDate: ninetyDaysAgo.toISOString(),
        },
        facilityId: null, // グローバルアラート
        userId: null,
      });

      console.log('Security alert created');

      res.status(200).json({
        success: true,
        message: 'Archive completed successfully',
        archivedCount: deletedCount,
        archiveFile: fileName,
        bucketName,
      });
    } catch (error) {
      console.error('Archive failed:', error);

      // エラーログをセキュリティアラートとして記録
      try {
        await db.collection('securityAlerts').add({
          type: 'STORAGE_THRESHOLD',
          severity: 'high',
          status: 'pending',
          description: `監査ログアーカイブ失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
          detectedAt: Timestamp.now(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          },
          facilityId: null,
          userId: null,
        });
      } catch (alertError) {
        console.error('Failed to create security alert:', alertError);
      }

      res.status(500).json({
        success: false,
        error: 'Archive failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);
