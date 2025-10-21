
import React, { useState } from 'react';
import type { StaffSchedule, WorkLogs, WorkLogDetails } from '../types';
import { WEEKDAYS } from '../constants';
import WorkLogModal from './WorkLogModal';

interface ShiftTableProps {
  schedule: StaffSchedule[];
  targetMonth: string;
  workLogs: WorkLogs;
  onWorkLogChange: (staffId: string, date: string, details: WorkLogDetails) => void;
}

const getShiftColor = (shiftType: string) => {
  switch (shiftType) {
    case '早番': return 'bg-sky-100 text-sky-800';
    case '日勤': return 'bg-emerald-100 text-emerald-800';
    case '遅番': return 'bg-amber-100 text-amber-800';
    case '夜勤': return 'bg-indigo-100 text-indigo-800';
    case '休': return 'bg-slate-100 text-slate-600';
    case '明け休み': return 'bg-slate-200 text-slate-700';
    default: return 'bg-white text-slate-900';
  }
};

const NoteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h2a2 2 0 002-2V4a2 2 0 00-2-2H9z" />
    <path d="M4 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
  </svg>
);


const ShiftTable: React.FC<ShiftTableProps> = ({ schedule, targetMonth, workLogs, onWorkLogChange }) => {
  const [editingLog, setEditingLog] = useState<{ staffId: string, staffName: string, date: string, shiftType: string} | null>(null);

  if (!schedule.length) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg shadow-md">
        <div className="text-center p-8">
          <svg className="mx-auto h-16 w-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-slate-800">シフトが作成されていません</h3>
          <p className="mt-2 text-sm text-slate-500">左のパネルで条件を設定し、「シフト作成実行」または「デモシフト作成」ボタンを押してください。</p>
        </div>
      </div>
    );
  }

  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1));

  const handleSaveLog = (details: WorkLogDetails) => {
    if (editingLog) {
      onWorkLogChange(editingLog.staffId, editingLog.date, details);
      setEditingLog(null);
    }
  };

  return (
    <>
      <div className="overflow-x-auto bg-white rounded-lg shadow-md">
        <table className="min-w-full divide-y divide-slate-200 border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-20">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-30 border-r border-slate-200">
                スタッフ名
              </th>
              {dates.map(date => {
                const day = date.getDate();
                const weekday = WEEKDAYS[date.getDay()];
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <th key={day} scope="col" className={`px-2 py-3 text-center text-xs font-semibold ${isWeekend ? 'text-pink-600' : 'text-slate-600'}`}>
                    <div>{day}</div>
                    <div className="font-medium">({weekday})</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {schedule.map(staffSchedule => (
              <tr key={staffSchedule.staffId} className="hover:bg-slate-50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-800 sticky left-0 bg-white hover:bg-slate-50 z-10 border-r border-slate-200">
                  {staffSchedule.staffName}
                </td>
                {staffSchedule.monthlyShifts.map((shift) => {
                  const isWorkday = shift.shiftType !== '休' && shift.shiftType !== '明け休み';
                  const log = workLogs[shift.date]?.[staffSchedule.staffId];
                  const cellContent = (
                     <span className={`px-2.5 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${getShiftColor(shift.shiftType)}`}>
                      {shift.shiftType}
                      {log && (
                        <span className="ml-1.5 opacity-60 relative group">
                          <NoteIcon />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs font-normal rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-30 text-left whitespace-pre-wrap">
                            <h4 className="font-bold border-b border-slate-600 pb-1 mb-1">業務日誌</h4>
                            <p className="font-semibold text-slate-300">業務内容:</p>
                            <p className="mb-1">{log.workDetails || '記載なし'}</p>
                            <p className="font-semibold text-slate-300">特記事項:</p>
                            <p>{log.notes || '記載なし'}</p>
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-[-4px] w-2 h-2 bg-slate-800 rotate-45"></div>
                          </div>
                        </span>
                      )}
                    </span>
                  );
                  
                  return (
                    <td key={`${staffSchedule.staffId}-${shift.date}`} className="px-2 py-1.5 whitespace-nowrap text-center text-sm">
                      {isWorkday ? (
                        <button 
                          className="w-full h-full flex items-center justify-center rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-care-secondary"
                          onClick={() => setEditingLog({ staffId: staffSchedule.staffId, staffName: staffSchedule.staffName, date: shift.date, shiftType: shift.shiftType })}
                        >
                          {cellContent}
                        </button>
                      ) : (
                        cellContent
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingLog && (
        <WorkLogModal
          isOpen={!!editingLog}
          onClose={() => setEditingLog(null)}
          onSave={handleSaveLog}
          logData={editingLog}
          currentLog={workLogs[editingLog.date]?.[editingLog.staffId]}
        />
      )}
    </>
  );
};

export default ShiftTable;
