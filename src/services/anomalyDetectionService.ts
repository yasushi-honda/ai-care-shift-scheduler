import {
  collection,
  query,
  where,
  getDocs,
  Timestamp as FirestoreTimestamp,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { SecurityAlertService } from './securityAlertService';
import {
  SecurityAlertType,
  SecurityAlertSeverity,
  AuditLogAction,
} from '../../types';

/**
 * AnomalyDetectionService
 *
 * 監査ログを分析し、不審なアクセスパターンを検出してセキュリティアラートを生成
 *
 * Phase 13.3の検出ロジック:
 * 1. 大量データエクスポート: 短時間（5分以内）に10件以上のREAD操作
 * 2. 通常外時間帯アクセス: 深夜（22時〜6時）のアクセス
 * 3. 複数回認証失敗: 15分以内に5回以上のLOGIN失敗
 * 4. 権限なしアクセス試行: PERMISSION_DENIEDエラーが15分以内に3回以上
 *
 * 本サービスは定期的に実行される想定（Cloud Scheduler + Cloud Functions）
 * Phase 13.3ではクライアント側から手動実行可能な形で実装
 */
export const AnomalyDetectionService = {
  /**
   * 大量データエクスポートを検出
   *
   * 短時間（5分以内）に10件以上のREAD操作があった場合にアラート生成
   */
  async detectBulkExport(): Promise<void> {
    try {
      // 5分前のタイムスタンプを計算
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // 5分以内のREAD操作を取得
      const q = query(
        collection(db, 'auditLogs'),
        where('action', '==', AuditLogAction.READ),
        where('timestamp', '>=', FirestoreTimestamp.fromDate(fiveMinutesAgo)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);

      // ユーザーごとにREAD操作をカウント
      const userReadCounts: Record<string, number> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId;
        userReadCounts[userId] = (userReadCounts[userId] || 0) + 1;
      });

      // 10件以上のREAD操作があったユーザーに対してアラート生成
      for (const [userId, count] of Object.entries(userReadCounts)) {
        if (count >= 10) {
          await SecurityAlertService.createAlert({
            type: SecurityAlertType.BULK_EXPORT,
            severity: SecurityAlertSeverity.MEDIUM,
            userId,
            facilityId: null,
            title: '大量データエクスポート検出',
            description: `ユーザー ${userId} が過去5分間に ${count} 件のデータ読取操作を実行しました`,
            metadata: {
              readCount: count,
              timeWindow: '5分',
              detectionTime: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to detect bulk export:', error);
    }
  },

  /**
   * 通常外時間帯アクセスを検出
   *
   * 深夜（22時〜6時）のアクセスがあった場合にアラート生成
   */
  async detectUnusualTimeAccess(): Promise<void> {
    try {
      // 1時間前のタイムスタンプを計算
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // 1時間以内のすべての操作を取得
      const q = query(
        collection(db, 'auditLogs'),
        where('timestamp', '>=', FirestoreTimestamp.fromDate(oneHourAgo)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);

      // 深夜時間帯（22時〜6時）のアクセスを検出
      const unusualAccessUsers = new Set<string>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp.toDate();
        const hour = timestamp.getHours();

        // 22時〜23時または0時〜6時
        if (hour >= 22 || hour < 6) {
          unusualAccessUsers.add(data.userId);
        }
      });

      // 深夜時間帯にアクセスしたユーザーに対してアラート生成
      for (const userId of unusualAccessUsers) {
        await SecurityAlertService.createAlert({
          type: SecurityAlertType.UNUSUAL_TIME_ACCESS,
          severity: SecurityAlertSeverity.LOW,
          userId,
          facilityId: null,
          title: '通常外時間帯アクセス検出',
          description: `ユーザー ${userId} が深夜時間帯（22時〜6時）にアクセスしました`,
          metadata: {
            detectionTime: new Date().toISOString(),
            timeRange: '22:00-06:00',
          },
        });
      }
    } catch (error) {
      console.error('Failed to detect unusual time access:', error);
    }
  },

  /**
   * 複数回認証失敗を検出
   *
   * 15分以内に5回以上のLOGIN失敗があった場合にアラート生成
   */
  async detectMultipleAuthFailures(): Promise<void> {
    try {
      // 15分前のタイムスタンプを計算
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      // 15分以内の失敗したLOGIN操作を取得
      const q = query(
        collection(db, 'auditLogs'),
        where('action', '==', AuditLogAction.LOGIN),
        where('result', '==', 'failure'),
        where('timestamp', '>=', FirestoreTimestamp.fromDate(fifteenMinutesAgo)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);

      // ユーザーごとに失敗回数をカウント
      const userFailureCounts: Record<string, number> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId;
        userFailureCounts[userId] = (userFailureCounts[userId] || 0) + 1;
      });

      // 5回以上失敗したユーザーに対してアラート生成
      for (const [userId, count] of Object.entries(userFailureCounts)) {
        if (count >= 5) {
          await SecurityAlertService.createAlert({
            type: SecurityAlertType.MULTIPLE_AUTH_FAILURES,
            severity: SecurityAlertSeverity.HIGH,
            userId,
            facilityId: null,
            title: '複数回認証失敗検出',
            description: `ユーザー ${userId} が過去15分間に ${count} 回ログインに失敗しました`,
            metadata: {
              failureCount: count,
              timeWindow: '15分',
              detectionTime: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to detect multiple auth failures:', error);
    }
  },

  /**
   * 権限なしアクセス試行を検出
   *
   * 15分以内に3回以上のPERMISSION_DENIEDエラーがあった場合にアラート生成
   */
  async detectUnauthorizedAccessAttempts(): Promise<void> {
    try {
      // 15分前のタイムスタンプを計算
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      // 15分以内の失敗操作を取得
      const q = query(
        collection(db, 'auditLogs'),
        where('result', '==', 'failure'),
        where('timestamp', '>=', FirestoreTimestamp.fromDate(fifteenMinutesAgo)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);

      // ユーザーごとにPERMISSION_DENIEDエラーをカウント
      const userDeniedCounts: Record<string, number> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (
          data.errorMessage &&
          data.errorMessage.includes('PERMISSION_DENIED')
        ) {
          const userId = data.userId;
          userDeniedCounts[userId] = (userDeniedCounts[userId] || 0) + 1;
        }
      });

      // 3回以上権限エラーがあったユーザーに対してアラート生成
      for (const [userId, count] of Object.entries(userDeniedCounts)) {
        if (count >= 3) {
          await SecurityAlertService.createAlert({
            type: SecurityAlertType.UNAUTHORIZED_ACCESS_ATTEMPT,
            severity: SecurityAlertSeverity.HIGH,
            userId,
            facilityId: null,
            title: '権限なしアクセス試行検出',
            description: `ユーザー ${userId} が過去15分間に ${count} 回権限のないリソースへのアクセスを試行しました`,
            metadata: {
              deniedCount: count,
              timeWindow: '15分',
              detectionTime: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error) {
      console.error('Failed to detect unauthorized access attempts:', error);
    }
  },

  /**
   * ストレージ容量閾値超過を検出
   *
   * 監査ログのドキュメント数が閾値（10,000件）を超えた場合にアラート生成
   * Note: 実際のストレージサイズではなくドキュメント数で簡易的に判定
   */
  async detectStorageThresholdExceeded(): Promise<void> {
    try {
      // 監査ログの総数を取得（最新1件のみでカウント効率化）
      const q = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        firestoreLimit(1)
      );

      const snapshot = await getDocs(q);

      // 概算: 全件数を取得するにはcollection.countが必要だが、
      // ここでは簡易的に最新10,000件を超えているかチェック
      const countQuery = query(
        collection(db, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        firestoreLimit(10001)
      );

      const countSnapshot = await getDocs(countQuery);
      const logCount = countSnapshot.size;

      if (logCount > 10000) {
        await SecurityAlertService.createAlert({
          type: SecurityAlertType.STORAGE_THRESHOLD_EXCEEDED,
          severity: SecurityAlertSeverity.MEDIUM,
          userId: null,
          facilityId: null,
          title: 'ストレージ容量閾値超過',
          description: `監査ログが閾値（10,000件）を超えました。現在 ${logCount} 件のログが保存されています。古いログのアーカイブを検討してください。`,
          metadata: {
            currentCount: logCount,
            threshold: 10000,
            detectionTime: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error('Failed to detect storage threshold exceeded:', error);
    }
  },

  /**
   * すべての異常検知を実行
   *
   * 上記すべての検知ロジックを一括実行
   */
  async runAllDetections(): Promise<void> {
    console.log('Running anomaly detection...');
    await Promise.all([
      this.detectBulkExport(),
      this.detectUnusualTimeAccess(),
      this.detectMultipleAuthFailures(),
      this.detectUnauthorizedAccessAttempts(),
      this.detectStorageThresholdExceeded(),
    ]);
    console.log('Anomaly detection completed.');
  },
};
