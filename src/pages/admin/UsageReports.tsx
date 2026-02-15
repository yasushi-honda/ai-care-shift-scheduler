import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { AuditLog, AuditLogAction } from '../../../types';
import {
  UsageChart,
  createLineChartData,
  createBarChartData,
  createPieChartData,
  chartColors,
} from '../../components/UsageChart';

/**
 * Phase 19.3.3: 使用状況レポート機能
 *
 * 機能:
 * - 施設別利用統計
 * - ユーザー別活動ログ
 * - シフト生成統計（成功率、所要時間）
 * - 期間選択（今月、先月、過去3ヶ月、カスタム）
 * - CSV/PDFエクスポート
 */

// 期間選択の型
type PeriodType = 'thisMonth' | 'lastMonth' | 'last3Months' | 'custom';

// 施設別統計の型
interface FacilityStats {
  facilityId: string;
  facilityName: string;
  totalActions: number;
  uniqueUsers: number;
}

// ユーザー別統計の型
interface UserStats {
  userId: string;
  userName: string;
  totalActions: number;
  lastActive: Date;
}

// シフト生成統計の型
interface ShiftStats {
  total: number;
  success: number;
  failure: number;
  successRate: number;
  avgDuration: number;
}

// 日別統計の型
interface DailyStats {
  date: string;
  actions: number;
}

// アクション種別統計の型
interface ActionTypeStats {
  action: string;
  count: number;
}

// キャッシュデータの型
interface CachedReport {
  data: {
    facilityStats: FacilityStats[];
    userStats: UserStats[];
    shiftStats: ShiftStats | null;
    dailyStats: DailyStats[];
    actionTypeStats: ActionTypeStats[];
  };
  timestamp: number;
}

/**
 * 期間から開始日・終了日を計算
 */
function getPeriodDates(period: PeriodType, customStart?: Date, customEnd?: Date): [Date, Date] {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (period) {
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case 'last3Months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case 'custom':
      startDate = customStart || new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = customEnd || now;
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return [startDate, endDate];
}

/**
 * 日付を YYYY-MM-DD 形式にフォーマット
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Timestamp を Date に変換
 */
function timestampToDate(timestamp: any): Date {
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
}

export function UsageReports(): React.ReactElement {
  // 状態管理
  const [period, setPeriod] = useState<PeriodType>('last3Months'); // Phase 2-4: デフォルトを直近3ヶ月に変更
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // 統計データ
  const [facilityStats, setFacilityStats] = useState<FacilityStats[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [shiftStats, setShiftStats] = useState<ShiftStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [actionTypeStats, setActionTypeStats] = useState<ActionTypeStats[]>([]);

  // Phase 2-4: キャッシュ機能（5分間有効）
  const [reportCache, setReportCache] = useState<Map<string, CachedReport>>(new Map());
  const CACHE_DURATION = 5 * 60 * 1000; // 5分
  const [refreshKey, setRefreshKey] = useState(0); // 手動更新用

  /**
   * 期限切れキャッシュエントリを削除（メモリリーク防止）
   */
  const cleanupCache = () => {
    setReportCache(prev => {
      const now = Date.now();
      const cleaned = new Map<string, CachedReport>(prev);
      for (const [key, value] of cleaned.entries()) {
        if (now - value.timestamp >= CACHE_DURATION) {
          cleaned.delete(key);
        }
      }
      return cleaned;
    });
  };

  // データ取得（Phase 2-4: Race condition対策でuseEffect内に実装）
  useEffect(() => {
    let isActive = true;

    const loadUsageData = async () => {
      try {
        if (!isActive) return;
        setLoading(true);

        // 期間を計算
        const [startDate, endDate] = getPeriodDates(
          period,
          customStartDate ? new Date(customStartDate) : undefined,
          customEndDate ? new Date(customEndDate) : undefined
        );

        // キャッシュキーを生成
        const cacheKey = `${formatDate(startDate)}-${formatDate(endDate)}`;
        const cached = reportCache.get(cacheKey);

        // キャッシュチェック
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log('Using cached report data:', cacheKey);
          if (!isActive) return;
          setFacilityStats(cached.data.facilityStats);
          setUserStats(cached.data.userStats);
          setShiftStats(cached.data.shiftStats);
          setDailyStats(cached.data.dailyStats);
          setActionTypeStats(cached.data.actionTypeStats);
          setLoading(false);
          return;
        }

        console.log('Loading usage data:', { startDate, endDate });

        // 監査ログを取得
        const logsQuery = query(
          collection(db, 'auditLogs'),
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          where('timestamp', '<=', Timestamp.fromDate(endDate)),
          orderBy('timestamp', 'desc')
        );

        const logsSnapshot = await getDocs(logsQuery);
        const logs: AuditLog[] = logsSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as AuditLog)
        );

        console.log(`Loaded ${logs.length} audit logs`);

        // 統計データを計算
        const statsData = calculateStats(logs);

        // isActiveチェック: 期間変更により新しいリクエストが開始されていたら更新しない
        if (!isActive) return;

        // ステートを更新
        setFacilityStats(statsData.facilityStats);
        setUserStats(statsData.userStats);
        setShiftStats(statsData.shiftStats);
        setDailyStats(statsData.dailyStats);
        setActionTypeStats(statsData.actionTypeStats);

        // 期限切れキャッシュをクリーンアップして新しいエントリを保存（単一操作でRace condition回避）
        setReportCache(prev => {
          const now = Date.now();
          const cleaned = new Map<string, CachedReport>(prev);
          // 期限切れエントリを削除
          for (const [key, value] of cleaned.entries()) {
            if (now - value.timestamp >= CACHE_DURATION) {
              cleaned.delete(key);
            }
          }
          // 新しいエントリを追加
          cleaned.set(cacheKey, {
            data: statsData,
            timestamp: now,
          });
          return cleaned;
        });
      } catch (error) {
        console.error('Failed to load usage data:', error);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadUsageData();

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customStartDate, customEndDate, refreshKey]);

  // 定期的なキャッシュクリーンアップ（60秒ごと）
  useEffect(() => {
    const interval = setInterval(cleanupCache, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * 統計データを計算（Phase 2-4: 計算結果を返すように修正）
   */
  const calculateStats = (logs: AuditLog[]) => {
    // 施設別統計
    const facilityMap = new Map<string, { actions: number; users: Set<string> }>();
    logs.forEach((log) => {
      if (!facilityMap.has(log.facilityId)) {
        facilityMap.set(log.facilityId, { actions: 0, users: new Set() });
      }
      const stats = facilityMap.get(log.facilityId)!;
      stats.actions++;
      stats.users.add(log.userId);
    });

    const facilityStatsData: FacilityStats[] = Array.from(facilityMap.entries()).map(
      ([facilityId, stats]) => ({
        facilityId,
        facilityName: facilityId, // TODO: 施設名をマスタから取得
        totalActions: stats.actions,
        uniqueUsers: stats.users.size,
      })
    );
    const facilityStats = facilityStatsData.sort((a, b) => b.totalActions - a.totalActions);

    // ユーザー別統計
    const userMap = new Map<string, { actions: number; lastActive: Date }>();
    logs.forEach((log) => {
      if (!userMap.has(log.userId)) {
        userMap.set(log.userId, {
          actions: 0,
          lastActive: timestampToDate(log.timestamp),
        });
      }
      const stats = userMap.get(log.userId)!;
      stats.actions++;
      const logDate = timestampToDate(log.timestamp);
      if (logDate > stats.lastActive) {
        stats.lastActive = logDate;
      }
    });

    const userStatsData: UserStats[] = Array.from(userMap.entries()).map(
      ([userId, stats]) => ({
        userId,
        userName: userId, // TODO: ユーザー名をマスタから取得
        totalActions: stats.actions,
        lastActive: stats.lastActive,
      })
    );
    const userStats = userStatsData.sort((a, b) => b.totalActions - a.totalActions);

    // シフト生成統計
    const shiftLogs = logs.filter(
      (log) => log.action === AuditLogAction.CREATE && log.resourceType === 'schedule'
    );
    const shiftSuccess = shiftLogs.filter((log) => log.result === 'success').length;
    const shiftFailure = shiftLogs.length - shiftSuccess;
    const totalDuration = shiftLogs.reduce(
      (sum, log) => sum + ((log.details as any)?.duration || 0),
      0
    );

    const shiftStats = {
      total: shiftLogs.length,
      success: shiftSuccess,
      failure: shiftFailure,
      successRate: shiftLogs.length > 0 ? (shiftSuccess / shiftLogs.length) * 100 : 0,
      avgDuration: shiftLogs.length > 0 ? totalDuration / shiftLogs.length : 0,
    };

    // 日別統計
    const dailyMap = new Map<string, number>();
    logs.forEach((log) => {
      const dateStr = formatDate(timestampToDate(log.timestamp));
      dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
    });

    const dailyStats: DailyStats[] = Array.from(dailyMap.entries())
      .map(([date, actions]) => ({ date, actions }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // アクション種別統計
    const actionMap = new Map<string, number>();
    logs.forEach((log) => {
      actionMap.set(log.action, (actionMap.get(log.action) || 0) + 1);
    });

    const actionTypeStats: ActionTypeStats[] = Array.from(actionMap.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    // Phase 2-4: 計算結果を返す
    return {
      facilityStats,
      userStats,
      shiftStats,
      dailyStats,
      actionTypeStats,
    };
  };

  /**
   * CSVエクスポート
   */
  const handleExportCSV = () => {
    // 施設別統計をCSV形式に変換
    const csvHeader = '施設ID,施設名,総アクション数,ユニークユーザー数\n';
    const csvRows = facilityStats
      .map(
        (stats) =>
          `${stats.facilityId},${stats.facilityName},${stats.totalActions},${stats.uniqueUsers}`
      )
      .join('\n');
    const csv = csvHeader + csvRows;

    // BOM付きUTF-8でエンコード（Excelで文字化け防止）
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-report-${formatDate(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * PDFエクスポート（簡易実装）
   */
  const handleExportPDF = () => {
    // PDF生成は Phase 19.3.1 の実装を参考に、必要に応じて実装
    // ここでは window.print() による簡易実装
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">使用状況レポート</h1>

      {/* 期間選択 */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">期間選択</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">期間</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodType)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="thisMonth">今月</option>
              <option value="lastMonth">先月</option>
              <option value="last3Months">過去3ヶ月</option>
              <option value="custom">カスタム</option>
            </select>
          </div>

          {period === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">開始日</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">終了日</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}

          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '読み込み中...' : '更新'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">データを読み込んでいます...</p>
        </div>
      ) : (
        <>
          {/* シフト生成統計カード */}
          {shiftStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="text-sm font-medium text-gray-600 mb-2">総シフト生成</div>
                <div className="text-3xl font-bold text-gray-900">{shiftStats.total}</div>
              </div>
              <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="text-sm font-medium text-gray-600 mb-2">成功</div>
                <div className="text-3xl font-bold text-green-600">{shiftStats.success}</div>
              </div>
              <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="text-sm font-medium text-gray-600 mb-2">失敗</div>
                <div className="text-3xl font-bold text-red-600">{shiftStats.failure}</div>
              </div>
              <div className="bg-white shadow-sm rounded-lg p-6">
                <div className="text-sm font-medium text-gray-600 mb-2">成功率</div>
                <div className="text-3xl font-bold text-blue-600">
                  {shiftStats.successRate.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* グラフ表示 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 日別アクション数推移 */}
            <UsageChart
              type="line"
              data={createLineChartData(
                dailyStats.map((s) => s.date),
                dailyStats.map((s) => s.actions),
                'アクション数',
                chartColors.blue
              )}
              title="日別アクション数推移"
              height={300}
            />

            {/* アクション種別分布 */}
            <UsageChart
              type="pie"
              data={createPieChartData(
                actionTypeStats.map((s) => s.action),
                actionTypeStats.map((s) => s.count)
              )}
              title="アクション種別分布"
              height={300}
            />
          </div>

          {/* 施設別利用統計 */}
          <div className="bg-white shadow-sm rounded-lg mb-6">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">施設別利用統計</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      施設ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      総アクション数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ユニークユーザー数
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {facilityStats.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    facilityStats.map((stats) => (
                      <tr key={stats.facilityId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats.facilityId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats.totalActions}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats.uniqueUsers}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ユーザー別活動ログ */}
          <div className="bg-white shadow-sm rounded-lg mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">ユーザー別活動ログ</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ユーザーID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      総アクション数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最終活動日時
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userStats.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    userStats.slice(0, 10).map((stats) => (
                      <tr key={stats.userId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats.userId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats.totalActions}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {stats.lastActive.toLocaleString('ja-JP')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* エクスポートボタン */}
          <div className="flex justify-end gap-4">
            <button
              onClick={handleExportCSV}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📊 CSVエクスポート
            </button>
            <button
              onClick={handleExportPDF}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              📄 PDFエクスポート（印刷）
            </button>
          </div>
        </>
      )}
    </div>
  );
}
