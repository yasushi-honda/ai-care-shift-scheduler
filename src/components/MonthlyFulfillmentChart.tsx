/**
 * MonthlyFulfillmentChart.tsx
 *
 * Phase 65: 月次人員配置基準充足率グラフ
 *
 * - X軸: 1日〜末日
 * - Y軸: 充足率(%)
 * - 全体充足率（太線, blue）+ 職種別（細線, 各色）
 * - 100%基準線（赤破線）、80%警告線（黄破線）
 * - 未達日: 赤ドットマーカー
 */

import React, { useMemo } from 'react';
import { UsageChart } from './UsageChart';
import type { MonthlyFulfillmentSummary } from '../../types';

interface MonthlyFulfillmentChartProps {
  summary: MonthlyFulfillmentSummary;
}

/** 職種別グラフ色 */
const ROLE_COLORS = [
  'rgb(16, 185, 129)',   // emerald
  'rgb(245, 158, 11)',   // amber
  'rgb(139, 92, 246)',   // violet
  'rgb(236, 72, 153)',   // pink
  'rgb(20, 184, 166)',   // teal
];

export const MonthlyFulfillmentChart: React.FC<MonthlyFulfillmentChartProps> = ({
  summary,
}) => {
  const chartData = useMemo(() => {
    const labels = summary.dailyResults.map((r) => {
      const day = parseInt(r.date.split('-')[2], 10);
      return `${day}日`;
    });

    const overallData = summary.dailyResults.map((r) => r.overall.fulfillmentRate);

    // 全体充足率データセット（太線）
    const datasets: any[] = [
      {
        label: '全体充足率',
        data: overallData,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        pointRadius: summary.dailyResults.map((r) =>
          r.overall.status === 'shortage' ? 6 : 3
        ),
        pointBackgroundColor: summary.dailyResults.map((r) =>
          r.overall.status === 'shortage' ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'
        ),
        pointBorderColor: summary.dailyResults.map((r) =>
          r.overall.status === 'shortage' ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)'
        ),
        tension: 0.3,
        fill: false,
      },
    ];

    // 職種別データセット（細線）
    const roleNames = summary.dailyResults[0]?.byRole.map((r) => r.role) ?? [];
    roleNames.forEach((role, idx) => {
      const color = ROLE_COLORS[idx % ROLE_COLORS.length];
      const roleData = summary.dailyResults.map((d) => {
        const r = d.byRole.find((rb) => rb.role === role);
        return r?.fulfillmentRate ?? 0;
      });

      datasets.push({
        label: role,
        data: roleData,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 2,
        tension: 0.3,
        fill: false,
      });
    });

    // 100%基準線（赤破線）
    datasets.push({
      label: '基準値 (100%)',
      data: Array(labels.length).fill(100),
      borderColor: 'rgb(239, 68, 68)',
      borderWidth: 1,
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0,
      fill: false,
    });

    // 80%警告線（黄破線）
    datasets.push({
      label: '警告ライン (80%)',
      data: Array(labels.length).fill(80),
      borderColor: 'rgb(234, 179, 8)',
      borderWidth: 1,
      borderDash: [4, 3],
      pointRadius: 0,
      tension: 0,
      fill: false,
    });

    return { labels, datasets };
  }, [summary]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
          labels: { boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 150,
          ticks: {
            callback: (val: number | string) => `${val}%`,
            font: { size: 10 },
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        x: {
          ticks: { font: { size: 10 } },
          grid: { display: false },
        },
      },
    }),
    []
  );

  if (summary.dailyResults.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-4">充足率データがありません</p>;
  }

  return (
    <div>
      <UsageChart
        type="line"
        data={chartData}
        options={chartOptions}
        height={260}
      />
    </div>
  );
};
