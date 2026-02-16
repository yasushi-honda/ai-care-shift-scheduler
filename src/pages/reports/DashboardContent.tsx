import React from 'react';
import { MonthlyReportData } from '../../../types';
import { UsageChart, createPieChartData, createBarChartData } from '../../components/UsageChart';
import { SummaryCard } from './SummaryCard';

interface DashboardContentProps {
  data: MonthlyReportData;
  onDownloadPDF: () => void;
  isPdfGenerating: boolean;
}

export function DashboardContent({ data, onDownloadPDF, isPdfGenerating }: DashboardContentProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* PDFダウンロードボタン */}
      <div className="flex justify-end">
        <button
          onClick={onDownloadPDF}
          disabled={isPdfGenerating}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPdfGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              生成中...
            </>
          ) : (
            <>
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDFダウンロード
            </>
          )}
        </button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="総勤務時間"
          value={`${data.summary.totalWorkHours.toLocaleString()}h`}
          icon="⏱️"
          color="blue"
        />
        <SummaryCard
          title="スタッフ数"
          value={`${data.summary.totalStaffCount}名`}
          icon="👥"
          color="green"
        />
        <SummaryCard
          title="充足率"
          value={`${data.summary.fulfillmentRate}%`}
          icon="📊"
          color={data.summary.fulfillmentRate >= 80 ? 'green' : 'orange'}
        />
        <SummaryCard
          title="有給消化率"
          value={`${data.summary.paidLeaveUsageRate}%`}
          icon="🏖️"
          color="purple"
        />
      </div>

      {/* グラフ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* シフト種別分布 */}
        <UsageChart
          type="pie"
          title="シフト種別分布"
          data={createPieChartData(
            data.shiftTypeData.overall.map(s => s.shiftType),
            data.shiftTypeData.overall.map(s => s.count)
          )}
          height={300}
        />

        {/* スタッフ別勤務時間 */}
        <UsageChart
          type="bar"
          title="スタッフ別勤務時間（上位10名）"
          data={createBarChartData(
            data.workTimeData.slice(0, 10).map(w => w.staffName),
            data.workTimeData.slice(0, 10).map(w => w.totalHours),
            '勤務時間(h)'
          )}
          height={300}
        />
      </div>
    </div>
  );
}
