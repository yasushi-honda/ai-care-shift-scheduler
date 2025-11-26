/**
 * generateMonthlyReport.ts
 *
 * Phase 19.3.3: 使用状況レポート機能 - 月次レポート生成
 *
 * 特徴:
 * - 監査ログから月次統計データを自動集計
 * - 定期実行（毎月1日午前9時JST）
 * - 手動実行（super-admin権限）
 * - Firestoreに保存
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * 監査ログの型定義
 */
interface AuditLog {
  id: string;
  facilityId: string;
  userId: string;
  timestamp: admin.firestore.Timestamp;
  action: string;
  resourceType: string;
  result?: string;
  details?: {
    duration?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * 月次レポートの型定義
 */
interface MonthlyReport {
  generatedAt: admin.firestore.FieldValue;
  period: {
    start: admin.firestore.Timestamp;
    end: admin.firestore.Timestamp;
  };
  facilityStats: Record<string, { actions: number; userCount: number }>;
  userStats: Record<string, { actions: number; lastActive: admin.firestore.Timestamp }>;
  shiftStats: {
    total: number;
    success: number;
    successRate: number;
    avgDuration: number;
  };
  totalLogs: number;
}

/**
 * 月次レポート生成ロジック（共通）
 */
async function generateReportForPeriod(
  year: number,
  month: number
): Promise<{ reportId: string; reportData: MonthlyReport }> {
  const db = admin.firestore();

  // 期間を計算（monthは1-12）
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  console.log(
    `Generating monthly report for ${year}-${month.toString().padStart(2, '0')}`
  );
  console.log(`Period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

  // 監査ログを取得
  const logsSnapshot = await db
    .collection('auditLogs')
    .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
    .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
    .get();

  const logs: AuditLog[] = logsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  } as AuditLog));

  console.log(`Loaded ${logs.length} audit logs`);

  // 統計データ集計
  const facilityStats: Record<string, { actions: number; users: Set<string> }> = {};
  const userStats: Record<string, { actions: number; lastActive: Date }> = {};
  let shiftTotal = 0;
  let shiftSuccess = 0;
  let shiftTotalDuration = 0;

  for (const log of logs) {
    // バリデーション: 必須フィールドのチェック
    if (!log.facilityId || !log.userId || !log.timestamp) {
      console.warn(`Skipping invalid log entry: ${log.id}`, {
        hasFacilityId: !!log.facilityId,
        hasUserId: !!log.userId,
        hasTimestamp: !!log.timestamp,
      });
      continue;
    }

    // 施設別統計
    if (!facilityStats[log.facilityId]) {
      facilityStats[log.facilityId] = { actions: 0, users: new Set() };
    }
    facilityStats[log.facilityId].actions++;
    facilityStats[log.facilityId].users.add(log.userId);

    // ユーザー別統計
    if (!userStats[log.userId]) {
      userStats[log.userId] = {
        actions: 0,
        lastActive: log.timestamp.toDate(),
      };
    }
    userStats[log.userId].actions++;
    if (log.timestamp.toDate() > userStats[log.userId].lastActive) {
      userStats[log.userId].lastActive = log.timestamp.toDate();
    }

    // シフト生成統計
    if (log.action === 'CREATE' && log.resourceType === 'schedule') {
      shiftTotal++;
      if (log.result === 'success') shiftSuccess++;
      // durationが数値であることを確認
      if (log.details?.duration && typeof log.details.duration === 'number') {
        shiftTotalDuration += log.details.duration;
      }
    }
  }

  // レポートデータ作成
  const reportData: MonthlyReport = {
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    period: {
      start: admin.firestore.Timestamp.fromDate(startDate),
      end: admin.firestore.Timestamp.fromDate(endDate),
    },
    facilityStats: Object.fromEntries(
      Object.entries(facilityStats).map(([id, stats]) => [
        id,
        { actions: stats.actions, userCount: stats.users.size },
      ])
    ),
    userStats: Object.fromEntries(
      Object.entries(userStats).map(([id, stats]) => [
        id,
        {
          actions: stats.actions,
          lastActive: admin.firestore.Timestamp.fromDate(stats.lastActive),
        },
      ])
    ),
    shiftStats: {
      total: shiftTotal,
      success: shiftSuccess,
      successRate: shiftTotal > 0 ? (shiftSuccess / shiftTotal) * 100 : 0,
      avgDuration: shiftTotal > 0 ? shiftTotalDuration / shiftTotal : 0,
    },
    totalLogs: logs.length,
  };

  // Firestoreに保存
  const reportId = `${year}-${month.toString().padStart(2, '0')}`;
  await db
    .collection('reports')
    .doc('monthly')
    .collection('data')
    .doc(reportId)
    .set(reportData);

  console.log(`Monthly report saved: ${reportId}`);
  console.log('Report summary:', {
    totalLogs: logs.length,
    facilities: Object.keys(facilityStats).length,
    users: Object.keys(userStats).length,
    shiftTotal,
    shiftSuccess,
  });

  return { reportId, reportData };
}

/**
 * 定期実行版: 月次レポート自動生成
 *
 * スケジュール: 毎月1日 午前9時（JST）
 * Cron式: 0 9 1 * *
 */
export const scheduledMonthlyReport = onSchedule(
  {
    schedule: '0 9 1 * *', // 毎月1日午前9時（UTC 0時 = JST 9時）
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1', // 東京リージョン（日本国内データ処理）
    memory: '512MiB',
    timeoutSeconds: 300, // 5分
  },
  async (event) => {
    try {
      console.log('scheduledMonthlyReport triggered:', event.scheduleTime);

      // 前月の年月を計算
      const now = new Date();
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const month = now.getMonth() === 0 ? 12 : now.getMonth();

      // レポート生成
      const { reportId } = await generateReportForPeriod(year, month);

      console.log(`scheduledMonthlyReport completed: ${reportId}`);
    } catch (error) {
      console.error('scheduledMonthlyReport failed:', error);
      throw error;
    }
  }
);

/**
 * 手動実行版: 月次レポート生成
 *
 * 認証: super-admin のみ
 *
 * リクエスト:
 * - year?: number（オプショナル、デフォルト: 前月の年）
 * - month?: number（オプショナル、デフォルト: 前月の月）
 *
 * レスポンス:
 * - reportId: string
 * - period: { start: string, end: string }
 * - summary: { totalLogs: number, facilities: number, users: number, shiftTotal: number }
 */
export const generateMonthlyReport = onCall<
  { year?: number; month?: number },
  Promise<{
    reportId: string;
    period: { start: string; end: string };
    summary: {
      totalLogs: number;
      facilities: number;
      users: number;
      shiftTotal: number;
    };
  }>
>(
  {
    region: 'asia-northeast1', // 東京リージョン（日本国内データ処理）
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    // 認証チェック（super-adminのみ）
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '認証が必要です');
    }

    if (!request.auth.token || request.auth.token.role !== 'super-admin') {
      throw new HttpsError(
        'permission-denied',
        'レポート生成権限がありません（super-adminのみ実行可能）'
      );
    }

    try {
      console.log('generateMonthlyReport called by:', request.auth.uid);

      // 年月を取得（指定されていない場合は前月）
      const now = new Date();
      const year = request.data.year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
      const month = request.data.month || (now.getMonth() === 0 ? 12 : now.getMonth());

      // バリデーション
      if (year < 2020 || year > now.getFullYear() + 1) {
        throw new HttpsError('invalid-argument', '無効な年が指定されました');
      }
      if (month < 1 || month > 12) {
        throw new HttpsError('invalid-argument', '無効な月が指定されました（1-12）');
      }

      console.log(`Generating report for ${year}-${month.toString().padStart(2, '0')}`);

      // レポート生成
      const { reportId, reportData } = await generateReportForPeriod(year, month);

      // レスポンス作成
      return {
        reportId,
        period: {
          start: reportData.period.start.toDate().toISOString(),
          end: reportData.period.end.toDate().toISOString(),
        },
        summary: {
          totalLogs: reportData.totalLogs,
          facilities: Object.keys(reportData.facilityStats).length,
          users: Object.keys(reportData.userStats).length,
          shiftTotal: reportData.shiftStats.total,
        },
      };
    } catch (error) {
      console.error('generateMonthlyReport failed:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        'internal',
        `レポート生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    }
  }
);
