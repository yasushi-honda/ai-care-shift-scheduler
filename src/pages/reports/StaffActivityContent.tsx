import React, { useState } from 'react';
import { MonthlyReportData } from '../../../types';

interface StaffActivityContentProps {
  data: MonthlyReportData;
}

export function StaffActivityContent({ data }: StaffActivityContentProps): React.ReactElement {
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const selectedActivity = data.staffActivityData.find(s => s.staffId === selectedStaff);

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">
      {/* スタッフ一覧 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">スタッフ一覧</h3>
        </div>
        {/* モバイル: 横スクロールリスト */}
        <div className="lg:hidden flex overflow-x-auto space-x-2 p-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {data.staffActivityData.map(staff => (
            <button
              key={staff.staffId}
              onClick={() => setSelectedStaff(staff.staffId)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStaff === staff.staffId
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {staff.staffName}
            </button>
          ))}
        </div>
        {/* デスクトップ: 縦リスト */}
        <ul className="hidden lg:block divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {data.staffActivityData.map(staff => (
            <li
              key={staff.staffId}
              onClick={() => setSelectedStaff(staff.staffId)}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                selectedStaff === staff.staffId
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">{staff.staffName}</div>
              <div className="text-sm text-gray-500">
                出勤 {staff.workDays}日 / 休日 {staff.restDays}日
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 詳細表示 */}
      <div className="lg:col-span-2">
        {selectedActivity ? (
          <div className="space-y-4">
            {/* 統計カード */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                <div className="text-xs sm:text-sm text-gray-500">出勤日数</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedActivity.workDays}日</div>
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                <div className="text-xs sm:text-sm text-gray-500">休日数</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedActivity.restDays}日</div>
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                <div className="text-xs sm:text-sm text-gray-500">連続勤務最大</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedActivity.maxConsecutiveWorkDays}日</div>
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                <div className="text-xs sm:text-sm text-gray-500">週平均勤務</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedActivity.averageWeeklyHours.toFixed(1)}h</div>
              </div>
            </div>

            {/* 休日内訳 */}
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">休日内訳</h4>
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-xs sm:text-sm text-gray-500">公休:</span>
                  <span className="ml-2 font-medium">{selectedActivity.publicHolidayDays}日</span>
                </div>
                <div>
                  <span className="text-xs sm:text-sm text-gray-500">有給:</span>
                  <span className="ml-2 font-medium">{selectedActivity.paidLeaveDays}日</span>
                </div>
              </div>
            </div>

            {/* 月間カレンダー */}
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">月間カレンダー</h4>
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-xs">
                {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                  <div key={day} className="font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
                {selectedActivity.monthlyCalendar.map((day) => (
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
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8 text-center text-gray-500">
            <p className="hidden lg:block">左のリストからスタッフを選択してください</p>
            <p className="lg:hidden">上のリストからスタッフを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
