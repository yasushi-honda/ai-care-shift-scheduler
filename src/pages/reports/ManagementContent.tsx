import React from 'react';
import { ManagementReportData } from '../../../types';
import { SummaryCard } from './SummaryCard';

interface ManagementContentProps {
  data: ManagementReportData;
  onDownloadPDF: () => void;
  isPdfGenerating: boolean;
}

export function ManagementContent({ data, onDownloadPDF, isPdfGenerating }: ManagementContentProps): React.ReactElement {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* PDFダウンロードボタン */}
      <div className="flex justify-end">
        <button
          onClick={onDownloadPDF}
          disabled={isPdfGenerating}
          className="inline-flex items-center px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
        >
          {isPdfGenerating ? '生成中...' : 'PDFダウンロード'}
        </button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard title="充足率" value={`${data.summary.fulfillmentRate}%`} icon="📊" color="blue" />
        <SummaryCard title="総勤務時間" value={`${data.summary.totalWorkHours}h`} icon="⏱️" color="green" />
        <SummaryCard title="スタッフ数" value={`${data.summary.totalStaffCount}名`} icon="👥" color="purple" />
        <SummaryCard title="有給消化率" value={`${data.summary.paidLeaveUsageRate}%`} icon="🏖️" color="orange" />
      </div>

      {/* 時間帯別充足率 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">時間帯別充足率</h3>
        </div>
        {/* モバイル: カード表示 */}
        <div className="block sm:hidden divide-y divide-gray-200">
          {data.timeSlotFulfillment.map(slot => (
            <div key={slot.timeSlot} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-gray-900">{slot.timeSlot}</span>
                <span className={`font-bold ${slot.fulfillmentRate >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                  {slot.fulfillmentRate}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                <div>必要: {slot.requiredCount}</div>
                <div>実績: {slot.actualCount}</div>
                <div>不足: {slot.shortfallDays}日</div>
              </div>
            </div>
          ))}
        </div>
        {/* デスクトップ: テーブル表示 */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間帯</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">必要人数</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">実績人数</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">充足率</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">不足日数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.timeSlotFulfillment.map(slot => (
                <tr key={slot.timeSlot} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{slot.timeSlot}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500">{slot.requiredCount}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500">{slot.actualCount}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={`font-medium ${slot.fulfillmentRate >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                      {slot.fulfillmentRate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500">{slot.shortfallDays}日</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* コスト推計 */}
      <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">コスト推計</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <div className="text-xs sm:text-sm text-gray-500">通常勤務</div>
            <div className="text-lg sm:text-xl font-bold text-gray-900">¥{data.costEstimate.regularHoursCost.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500">残業</div>
            <div className="text-lg sm:text-xl font-bold text-gray-900">¥{data.costEstimate.overtimeHoursCost.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500">夜勤手当</div>
            <div className="text-lg sm:text-xl font-bold text-gray-900">¥{data.costEstimate.nightShiftAllowance.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500">合計</div>
            <div className="text-lg sm:text-xl font-bold text-blue-600">¥{data.costEstimate.totalEstimate.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* 前月比較 */}
      {data.monthComparison && (
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">前月比較</h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div>
              <div className="text-xs sm:text-sm text-gray-500">勤務時間差</div>
              <div className={`text-base sm:text-xl font-bold ${data.monthComparison.workHoursDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.monthComparison.workHoursDiff >= 0 ? '+' : ''}{data.monthComparison.workHoursDiff}h
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-gray-500">充足率差</div>
              <div className={`text-base sm:text-xl font-bold ${data.monthComparison.fulfillmentRateDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.monthComparison.fulfillmentRateDiff >= 0 ? '+' : ''}{data.monthComparison.fulfillmentRateDiff}%
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-gray-500">コスト差</div>
              <div className={`text-base sm:text-xl font-bold ${data.monthComparison.costDiff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.monthComparison.costDiff >= 0 ? '+' : ''}¥{data.monthComparison.costDiff.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 改善提案 */}
      {data.recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">改善提案</h3>
          <ul className="space-y-2">
            {data.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start text-sm sm:text-base">
                <span className="mr-2 text-blue-500 shrink-0">💡</span>
                <span className="text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
