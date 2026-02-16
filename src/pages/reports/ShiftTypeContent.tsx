import React from 'react';
import { MonthlyReportData } from '../../../types';
import { UsageChart, createPieChartData } from '../../components/UsageChart';

interface ShiftTypeContentProps {
  data: MonthlyReportData;
}

export function ShiftTypeContent({ data }: ShiftTypeContentProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* 全体のシフト種別分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsageChart
          type="pie"
          title="シフト種別分布（全体）"
          data={createPieChartData(
            data.shiftTypeData.overall.map(s => s.shiftType),
            data.shiftTypeData.overall.map(s => s.count)
          )}
          height={300}
        />

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">シフト種別サマリー</h3>
          <div className="space-y-3">
            {data.shiftTypeData.overall.map(shift => (
              <div key={shift.shiftType} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 rounded-sm mr-3"
                    style={{ backgroundColor: shift.color }}
                  />
                  <span className="text-sm font-medium text-gray-700">{shift.shiftType}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {shift.count}回 ({shift.percentage}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* スタッフ別シフト種別内訳 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">スタッフ別シフト種別内訳</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  スタッフ名
                </th>
                {data.shiftTypeData.overall.map(shift => (
                  <th
                    key={shift.shiftType}
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {shift.shiftType}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.shiftTypeData.byStaff.map(staff => (
                <tr key={staff.staffId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {staff.staffName}
                    {staff.nightShiftWarning && (
                      <span className="ml-2 text-red-500" title="夜勤8回以上">⚠️</span>
                    )}
                  </td>
                  {data.shiftTypeData.overall.map(shiftType => {
                    const breakdown = staff.breakdown.find(b => b.shiftType === shiftType.shiftType);
                    return (
                      <td
                        key={shiftType.shiftType}
                        className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500"
                      >
                        {breakdown?.count || 0}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
