import React, { useState, useEffect } from 'react';
import { UsageChart, chartColors } from './UsageChart';
import { getMultiMonthBalances } from '../services/leaveBalanceService';
import { getMonthRange, buildTimelineData, getPreviousYearMonth } from '../utils/leaveBalanceUtils';
import type { StaffLeaveBalance } from '../../types';
import type { LeaveBalanceTrendEntry } from '../../types';

interface LeaveBalanceTimelineProps {
  facilityId: string;
  staffId: string;
  staffName: string;
  currentYearMonth: string; // e.g. "2026-02"
}

/**
 * Phase 64: 3ヶ月残高推移タイムライン棒グラフ
 *
 * 指定スタッフの 前月・当月・翌月 の公休/有給残高を棒グラフで表示する。
 * What-if トグルで当月の公休残高をシミュレートできる。
 */
export const LeaveBalanceTimeline: React.FC<LeaveBalanceTimelineProps> = ({
  facilityId,
  staffId,
  staffName,
  currentYearMonth,
}) => {
  const [balancesMap, setBalancesMap] = useState<Map<string, StaffLeaveBalance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<number>(0);

  // 表示対象の3ヶ月: 前月・当月・翌月
  const prevMonth = getPreviousYearMonth(currentYearMonth);
  const monthLabels = getMonthRange(prevMonth, 3); // [prevMonth, currentYearMonth, nextMonth]

  useEffect(() => {
    let cancelled = false;

    const fetchBalances = async () => {
      setLoading(true);
      setError(null);

      const result = await getMultiMonthBalances(facilityId, staffId, monthLabels);

      if (cancelled) return;

      if (result.success === false) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      setBalancesMap(result.data);
      setLoading(false);
    };

    fetchBalances();

    return () => {
      cancelled = true;
    };
    // monthLabels is derived from prevMonth/currentYearMonth — stringify to keep deps stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, staffId, currentYearMonth]);

  // タイムラインエントリを構築
  const trendEntries: LeaveBalanceTrendEntry[] = buildTimelineData(staffId, balancesMap, monthLabels);

  // What-if 調整: 当月(インデックス 1) の公休残高に adjustment を適用
  const phData = trendEntries.map((entry, idx) => {
    const base = entry.publicHolidayBalance;
    // adjustment は「追加使用」を想定: 使用増 → 残高減, 使用減 → 残高増
    // ここでは UI の +1/-1 ボタンが「追加使用日数」を意味するため、当月残高に -adjustment を加算
    if (idx === 1) {
      return base - adjustment;
    }
    return base;
  });

  const plData = trendEntries.map((entry) => entry.paidLeaveBalance);

  // 公休残高: 負数は赤、正数は青
  const phColors = phData.map((v) => (v < 0 ? chartColors.redAlpha : chartColors.blueAlpha));

  const chartData = {
    labels: monthLabels,
    datasets: [
      {
        label: '公休残高',
        data: phData,
        backgroundColor: phColors,
      },
      {
        label: '有給残高',
        data: plData,
        backgroundColor: chartColors.greenAlpha,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: false,
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-sm text-slate-500">読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">{staffName}</p>

      {/* 棒グラフ */}
      <div style={{ height: '160px' }}>
        <UsageChart
          type="bar"
          data={chartData}
          options={chartOptions}
          title="残高推移（3ヶ月）"
        />
      </div>

      {/* What-if コントロール */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-slate-500">公休 What-if:</span>
        <button
          onClick={() => setAdjustment((a) => a - 1)}
          className="px-2 py-0.5 text-xs bg-slate-100 hover:bg-slate-200 rounded"
        >
          -1
        </button>
        <span className="font-mono text-sm w-6 text-center">
          {adjustment > 0 ? `+${adjustment}` : adjustment}
        </span>
        <button
          onClick={() => setAdjustment((a) => a + 1)}
          className="px-2 py-0.5 text-xs bg-slate-100 hover:bg-slate-200 rounded"
        >
          +1
        </button>
        {adjustment !== 0 && (
          <button
            onClick={() => setAdjustment(0)}
            className="text-xs text-slate-400 hover:text-slate-600 ml-2"
          >
            リセット
          </button>
        )}
        {adjustment !== 0 && (
          <span className="text-xs text-indigo-500 ml-auto">シミュレーション中</span>
        )}
      </div>
    </div>
  );
};
