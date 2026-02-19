/**
 * DailyFulfillmentBadges.tsx
 *
 * Phase 65: シフトグリッドの日付ヘッダー下に充足率バッジを表示する行
 * <tr> 要素を返し、ShiftTable の <thead> 内に挿入される
 *
 * ✅ met (>=100%) / ⚠ warning (>=80%) / ✗ shortage (<80%)
 */

import React from 'react';
import type { DailyFulfillmentResult } from '../../types';

interface DailyFulfillmentBadgesProps {
  dailyResults: DailyFulfillmentResult[];
  targetMonth: string; // "YYYY-MM"（日数の算出に使用）
}

/** status に応じたスタイルとシンボル */
function getBadgeStyle(status: 'met' | 'warning' | 'shortage'): {
  bg: string;
  text: string;
  symbol: string;
} {
  switch (status) {
    case 'met':
      return { bg: 'bg-green-100', text: 'text-green-700', symbol: '✅' };
    case 'warning':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700', symbol: '⚠' };
    case 'shortage':
      return { bg: 'bg-red-100', text: 'text-red-700', symbol: '✗' };
  }
}

/** ツールチップ文字列を生成 */
function buildTooltip(result: DailyFulfillmentResult): string {
  const lines = [`全体: ${result.overall.fulfillmentRate}% (${result.overall.actualFte}/${result.overall.requiredFte}人)`];
  for (const r of result.byRole) {
    lines.push(`${r.role}: ${r.fulfillmentRate}% (${r.actualFte}/${r.requiredFte}人)`);
  }
  return lines.join('\n');
}

export const DailyFulfillmentBadges: React.FC<DailyFulfillmentBadgesProps> = ({
  dailyResults,
  targetMonth,
}) => {
  if (dailyResults.length === 0) return null;

  // 日付→結果のマッピング
  const resultByDate = new Map<string, DailyFulfillmentResult>();
  for (const r of dailyResults) {
    resultByDate.set(r.date, r);
  }

  // 対象月の全日付を生成
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${targetMonth}-${String(d).padStart(2, '0')}`;
  });

  return (
    <tr className="bg-slate-50">
      <th
        scope="row"
        className="px-4 py-1 text-left text-xs font-medium text-slate-500 sticky left-0 bg-slate-50 z-30 border-r border-slate-200 whitespace-nowrap"
      >
        配置基準
      </th>
      {dates.map((date) => {
        const result = resultByDate.get(date);
        if (!result) {
          return (
            <td key={date} className="px-2 py-1 text-center">
              <span className="text-slate-300 text-xs">―</span>
            </td>
          );
        }
        const { bg, text, symbol } = getBadgeStyle(result.overall.status);
        const tooltip = buildTooltip(result);

        return (
          <td key={date} className="px-2 py-1 text-center">
            <span
              title={tooltip}
              className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium cursor-help ${bg} ${text}`}
            >
              {symbol}
            </span>
          </td>
        );
      })}
    </tr>
  );
};
