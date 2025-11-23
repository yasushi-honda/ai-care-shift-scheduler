
import React, { useState } from 'react';
import type { StaffSchedule, GeneratedShift } from '../types';
import { WEEKDAYS } from '../constants';
import { ShiftEditConfirmModal } from '../src/components/ShiftEditConfirmModal';

interface ShiftTableProps {
  schedule: StaffSchedule[];
  targetMonth: string;
  onShiftChange?: (staffId: string, date: string, newShiftType: string) => void;
  onShiftUpdate?: (staffId: string, date: string, updatedShift: Partial<GeneratedShift>) => void;
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


const AVAILABLE_SHIFT_TYPES = ['早番', '日勤', '遅番', '夜勤', '休', '明け休み'];

interface EditModalData {
  date: string;
  staffId: string;
  staffName: string;
  type: 'planned' | 'actual';
  currentShift: GeneratedShift | null;
}

const ShiftTable: React.FC<ShiftTableProps> = ({ schedule, targetMonth, onShiftChange, onShiftUpdate }) => {
  const [editingShift, setEditingShift] = useState<{ staffId: string, date: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalData, setEditModalData] = useState<EditModalData | null>(null);

  const handleShiftTypeChange = (staffId: string, date: string, newShiftType: string) => {
    if (onShiftChange) {
      onShiftChange(staffId, date, newShiftType);
    }
    setEditingShift(null);
  };

  const handleCellClick = (
    date: string,
    staffId: string,
    staffName: string,
    type: 'planned' | 'actual',
    currentShift: GeneratedShift | null
  ) => {
    setEditModalData({
      date,
      staffId,
      staffName,
      type,
      currentShift
    });
    setShowEditModal(true);
  };

  const handleSaveShift = (updatedShift: Partial<GeneratedShift>) => {
    if (!editModalData || !onShiftUpdate) return;

    onShiftUpdate(
      editModalData.staffId,
      editModalData.date,
      updatedShift
    );
  };

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
          <tbody className="bg-white">
            {schedule.map(staffSchedule => {
              // 差異があるかチェックする関数
              const hasDifference = (shift: GeneratedShift): boolean => {
                if (!shift.actualShiftType) return false;

                const plannedType = shift.plannedShiftType || shift.shiftType || '休';
                if (plannedType !== shift.actualShiftType) return true;

                if (shift.plannedStartTime !== shift.actualStartTime) return true;
                if (shift.plannedEndTime !== shift.actualEndTime) return true;

                return false;
              };

              return (
                <React.Fragment key={staffSchedule.staffId}>
                  {/* 予定行 */}
                  <tr className="border-b border-gray-200">
                    <td
                      className="px-4 py-1 text-sm font-medium text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-200"
                      rowSpan={2}
                    >
                      <div className="flex items-center gap-2">
                        <span>{staffSchedule.staffName}</span>
                      </div>
                    </td>
                    {staffSchedule.monthlyShifts.map((shift) => {
                      const plannedShiftType = shift.plannedShiftType || shift.shiftType || '休';
                      const hasDiff = hasDifference(shift);

                      return (
                        <td
                          key={`${staffSchedule.staffId}-${shift.date}-planned`}
                          className={`px-2 py-1 text-center text-xs cursor-pointer hover:bg-blue-50 border-b border-gray-300 ${hasDiff ? 'ring-2 ring-orange-400 bg-orange-50' : 'bg-white'}`}
                          onClick={() => handleCellClick(shift.date, staffSchedule.staffId, staffSchedule.staffName, 'planned', shift)}
                        >
                          <span className={`inline-flex px-2 py-0.5 rounded-full ${getShiftColor(plannedShiftType)}`}>
                            {plannedShiftType}
                          </span>
                          {shift.plannedStartTime && shift.plannedEndTime && (
                            <div className="text-[10px] text-gray-600 mt-0.5">
                              {shift.plannedStartTime}-{shift.plannedEndTime}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 実績行 */}
                  <tr className="border-b border-gray-300">
                    {staffSchedule.monthlyShifts.map((shift) => {
                      const actualShiftType = shift.actualShiftType;
                      const hasDiff = hasDifference(shift);
                      const isEmpty = !actualShiftType;

                      return (
                        <td
                          key={`${staffSchedule.staffId}-${shift.date}-actual`}
                          className={`px-2 py-1 text-center text-xs cursor-pointer hover:bg-blue-100 border-b border-gray-400 ${
                            hasDiff ? 'ring-2 ring-orange-400 bg-orange-50' :
                            isEmpty ? 'bg-gray-100' : 'bg-gray-50'
                          }`}
                          onClick={() => handleCellClick(shift.date, staffSchedule.staffId, staffSchedule.staffName, 'actual', shift)}
                        >
                          {isEmpty ? (
                            <span className="text-gray-400 text-[10px]">未入力</span>
                          ) : (
                            <>
                              <span className={`inline-flex px-2 py-0.5 rounded-full ${getShiftColor(actualShiftType)}`}>
                                {actualShiftType}
                              </span>
                              {shift.actualStartTime && shift.actualEndTime && (
                                <div className="text-[10px] text-gray-600 mt-0.5">
                                  {shift.actualStartTime}-{shift.actualEndTime}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* シフト編集モーダル */}
      {editModalData && (
        <ShiftEditConfirmModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          date={editModalData.date}
          staffId={editModalData.staffId}
          staffName={editModalData.staffName}
          type={editModalData.type}
          currentShift={editModalData.currentShift}
          onSave={handleSaveShift}
        />
      )}
    </>
  );
};

export default ShiftTable;
