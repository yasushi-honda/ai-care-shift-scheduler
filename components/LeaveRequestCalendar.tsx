
import React, { useState, useRef, useEffect } from 'react';
import type { Staff, LeaveRequest, LeaveType } from '../types';
import { WEEKDAYS, LEAVE_TYPES } from '../constants';

interface LeaveRequestCalendarProps {
  staffList: Staff[];
  targetMonth: string;
  leaveRequests: LeaveRequest;
  onLeaveRequestChange: (staffId: string, date: string, leaveType: LeaveType | null) => void;
}

const getLeaveTypeColor = (leaveType: LeaveType) => {
  switch (leaveType) {
    case '希望休': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case '有給休暇': return 'bg-green-100 text-green-800 border-green-200';
    case '研修': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-white hover:bg-slate-50';
  }
};

const LeaveTypeDropdown: React.FC<{
  onSelect: (leaveType: LeaveType | null) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={dropdownRef} className="absolute z-20 mt-1 w-32 bg-white rounded-md shadow-lg border border-slate-200">
      <ul className="py-1">
        {LEAVE_TYPES.map(type => (
          <li key={type}>
            <button
              onClick={() => onSelect(type)}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {type}
            </button>
          </li>
        ))}
        <li><hr className="my-1 border-slate-200" /></li>
        <li>
          <button
            onClick={() => onSelect(null)}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            クリア
          </button>
        </li>
      </ul>
    </div>
  );
};

const LeaveRequestCalendar: React.FC<LeaveRequestCalendarProps> = ({ staffList, targetMonth, leaveRequests, onLeaveRequestChange }) => {
  const [activeCell, setActiveCell] = useState<{ staffId: string; date: string } | null>(null);

  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1));

  const handleCellClick = (staffId: string, date: string) => {
    setActiveCell({ staffId, date });
  };
  
  const handleSelectLeaveType = (leaveType: LeaveType | null) => {
    if (activeCell) {
      onLeaveRequestChange(activeCell.staffId, activeCell.date, leaveType);
    }
    setActiveCell(null);
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-md">
      <table className="min-w-full divide-y divide-slate-200 border-collapse">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-20 border-r border-slate-200">
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
          {staffList.map(staff => (
            <tr key={staff.id}>
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-200">
                {staff.name}
              </td>
              {dates.map(date => {
                const dateStr = `${targetMonth}-${String(date.getDate()).padStart(2, '0')}`;
                const leaveType = leaveRequests[staff.id]?.[dateStr];
                const isCellActive = activeCell?.staffId === staff.id && activeCell?.date === dateStr;

                return (
                  <td
                    key={dateStr}
                    className="relative px-2 py-2 whitespace-nowrap text-center text-sm border-l border-slate-100"
                  >
                    <button
                      onClick={() => handleCellClick(staff.id, dateStr)}
                      className={`w-full h-8 rounded-sm text-xs font-semibold transition-colors duration-150 border ${isCellActive ? 'ring-2 ring-care-secondary' : ''} ${getLeaveTypeColor(leaveType)}`}
                    >
                      {leaveType || <span className="text-slate-300">+</span>}
                    </button>
                    {isCellActive && (
                      <LeaveTypeDropdown 
                        onSelect={handleSelectLeaveType}
                        onClose={() => setActiveCell(null)}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeaveRequestCalendar;
