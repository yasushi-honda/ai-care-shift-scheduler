import React, { useState } from 'react';
import { MonthlyReportData, WorkTimeWarning } from '../../../types';

function getWarningLabel(warning: WorkTimeWarning): string {
  switch (warning) {
    case 'overtime': return '残業超過';
    case 'consecutive_work': return '連勤注意';
    case 'insufficient_rest': return '休息不足';
    default: return String(warning);
  }
}

interface WorkTimeContentProps {
  data: MonthlyReportData;
}

export function WorkTimeContent({ data }: WorkTimeContentProps): React.ReactElement {
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* モバイル: カード表示 */}
      <div className="block md:hidden">
        <div className="divide-y divide-gray-200">
          {data.workTimeData.map(work => (
            <div
              key={work.staffId}
              onClick={() => setExpandedStaff(expandedStaff === work.staffId ? null : work.staffId)}
              className="p-4 cursor-pointer hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{work.staffName}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    総勤務: {work.totalHours.toFixed(1)}h
                  </div>
                </div>
                <div className="text-right">
                  {work.warningFlags.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      ⚠️ {work.warningFlags.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-gray-500">
                <div>通常: {work.regularHours.toFixed(1)}h</div>
                <div>夜勤: {work.nightHours.toFixed(1)}h</div>
                <div>残業: {work.estimatedOvertimeHours.toFixed(1)}h</div>
              </div>
              {expandedStaff === work.staffId && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">日別詳細</h4>
                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {work.dailyDetails.map(day => (
                      <div
                        key={day.date}
                        className={`p-1 rounded text-center ${
                          day.hours > 0 ? 'bg-blue-100' : 'bg-gray-100'
                        }`}
                      >
                        <div className="font-medium">{day.date.split('-')[2]}</div>
                        <div>{day.hours > 0 ? `${day.hours}h` : '-'}</div>
                      </div>
                    ))}
                  </div>
                  {work.warningFlags.length > 0 && (
                    <div className="mt-3">
                      <h5 className="font-medium text-red-700 mb-1 text-sm">警告</h5>
                      <ul className="list-disc list-inside text-red-600 text-xs">
                        {work.warningFlags.map((flag, idx) => (
                          <li key={idx}>{getWarningLabel(flag)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* デスクトップ: テーブル表示 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                スタッフ名
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                総勤務時間
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                通常勤務
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                夜勤時間
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                推定残業
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                警告
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.workTimeData.map(work => (
              <React.Fragment key={work.staffId}>
                <tr
                  onClick={() => setExpandedStaff(expandedStaff === work.staffId ? null : work.staffId)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {work.staffName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {work.totalHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {work.regularHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {work.nightHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {work.estimatedOvertimeHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {work.warningFlags.length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ⚠️ {work.warningFlags.length}件
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
                {expandedStaff === work.staffId && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 bg-gray-50">
                      <div className="text-sm">
                        <h4 className="font-medium text-gray-900 mb-2">日別詳細</h4>
                        <div className="grid grid-cols-7 gap-1 text-xs">
                          {work.dailyDetails.map(day => (
                            <div
                              key={day.date}
                              className={`p-1 rounded text-center ${
                                day.hours > 0 ? 'bg-blue-100' : 'bg-gray-100'
                              }`}
                            >
                              <div className="font-medium">{day.date.split('-')[2]}</div>
                              <div>{day.hours > 0 ? `${day.hours}h` : '-'}</div>
                            </div>
                          ))}
                        </div>
                        {work.warningFlags.length > 0 && (
                          <div className="mt-3">
                            <h5 className="font-medium text-red-700 mb-1">警告</h5>
                            <ul className="list-disc list-inside text-red-600">
                              {work.warningFlags.map((flag, idx) => (
                                <li key={idx}>{getWarningLabel(flag)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
