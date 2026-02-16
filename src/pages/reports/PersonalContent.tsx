import React from 'react';
import { PersonalReportData } from '../../../types';
import { UsageChart, createPieChartData } from '../../components/UsageChart';
import { SummaryCard } from './SummaryCard';

interface PersonalContentProps {
  data: PersonalReportData;
  onDownloadPDF: () => void;
  isPdfGenerating: boolean;
}

export function PersonalContent({ data, onDownloadPDF, isPdfGenerating }: PersonalContentProps): React.ReactElement {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* PDFダウンロードボタン */}
      <div className="flex justify-end">
        <button
          onClick={onDownloadPDF}
          disabled={isPdfGenerating}
          className="inline-flex items-center px-3 sm:px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
        >
          {isPdfGenerating ? '生成中...' : 'PDFダウンロード'}
        </button>
      </div>

      {/* スタッフ名 */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{data.staffName}</h2>
        <p className="text-sm sm:text-base text-gray-500">{data.targetMonth} 勤務実績レポート</p>
      </div>

      {/* 勤務サマリー */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <SummaryCard title="出勤日数" value={`${data.workSummary.workDays}日`} icon="📅" color="blue" />
        <SummaryCard title="総勤務時間" value={`${data.workSummary.totalHours}h`} icon="⏱️" color="green" />
        <SummaryCard title="夜勤回数" value={`${data.workSummary.nightShiftCount}回`} icon="🌙" color="purple" />
        <SummaryCard title="休日数" value={`${data.workSummary.restDays}日`} icon="🏖️" color="orange" />
      </div>

      {/* シフト種別内訳 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <UsageChart
          type="pie"
          title="シフト種別内訳"
          data={createPieChartData(
            data.shiftBreakdown.map(s => s.shiftType),
            data.shiftBreakdown.map(s => s.count)
          )}
          height={250}
        />

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">シフト種別詳細</h3>
          <div className="space-y-2">
            {data.shiftBreakdown.map(shift => (
              <div key={shift.shiftType} className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-gray-700">{shift.shiftType}</span>
                <span className="text-gray-500">{shift.count}回 ({shift.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 休暇残高 */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">休暇残高</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <div className="text-xs sm:text-sm text-gray-500">有給休暇</div>
            <div className="flex items-baseline flex-wrap">
              <span className="text-xl sm:text-2xl font-bold text-gray-900">{data.leaveBalance.paidLeaveRemaining}</span>
              <span className="text-gray-500 ml-1 sm:ml-2 text-xs sm:text-sm">/ {data.leaveBalance.paidLeaveUsed + data.leaveBalance.paidLeaveRemaining}日</span>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">使用済み: {data.leaveBalance.paidLeaveUsed}日</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500">公休</div>
            <div className="flex items-baseline flex-wrap">
              <span className="text-xl sm:text-2xl font-bold text-gray-900">{data.leaveBalance.publicHolidayRemaining}</span>
              <span className="text-gray-500 ml-1 sm:ml-2 text-xs sm:text-sm">/ {data.leaveBalance.publicHolidayUsed + data.leaveBalance.publicHolidayRemaining}日</span>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">使用済み: {data.leaveBalance.publicHolidayUsed}日</div>
          </div>
        </div>
      </div>

      {/* 月間カレンダー */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">月間カレンダー</h3>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-xs">
          {['日', '月', '火', '水', '木', '金', '土'].map(day => (
            <div key={day} className="font-medium text-gray-500 py-1">
              {day}
            </div>
          ))}
          {data.calendar.map((day) => (
            <div
              key={day.date}
              className={`p-1 sm:p-2 rounded ${
                day.status === 'work'
                  ? 'bg-blue-100 text-blue-800'
                  : day.status === 'rest'
                  ? 'bg-gray-100 text-gray-600'
                  : day.status === 'paid_leave'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              <div className="font-medium text-xs sm:text-sm">{new Date(day.date).getDate()}</div>
              <div className="truncate text-xs hidden sm:block">{day.shiftType || '-'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
