
import React, { useState, useEffect, useRef } from 'react';
import type { Staff, EmploymentType } from '../types';
import { Role, Qualification, TimeSlotPreference } from '../types';
import { ROLES, QUALIFICATIONS, TIME_SLOT_PREFERENCES, EMPLOYMENT_TYPES } from '../constants';
import CalendarPicker from './CalendarPicker';

interface StaffSettingsProps {
  staffList: Staff[];
  onStaffChange: (staff: Staff) => void;
  onAddNewStaff: () => void;
  onDeleteStaff: (staffId: string) => void;
  targetMonth: string;
  openStaffId: string | null;
  onOpenStaffChange: (staffId: string | null) => void;
}

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const StaffSettings: React.FC<StaffSettingsProps> = ({
  staffList,
  onStaffChange,
  onAddNewStaff,
  onDeleteStaff,
  targetMonth,
  openStaffId,
  onOpenStaffChange
}) => {
  const [editingCalendarFor, setEditingCalendarFor] = useState<string | null>(null);
  const staffRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleToggle = (id: string) => {
    onOpenStaffChange(openStaffId === id ? null : id);
  };

  const handleDateChange = (staff: Staff, dates: string[]) => {
    onStaffChange({ ...staff, unavailableDates: dates.sort() });
  };

  // 新規追加されたスタッフまでスクロール & 名前入力欄にフォーカス
  useEffect(() => {
    if (openStaffId && staffRefs.current[openStaffId]) {
      const element = staffRefs.current[openStaffId];
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // 少し遅延させて名前入力欄にフォーカス
      setTimeout(() => {
        const nameInput = element.querySelector('input[type="text"]') as HTMLInputElement;
        if (nameInput) {
          nameInput.focus();
          nameInput.select(); // テキストを全選択
        }
      }, 300);
    }
  }, [openStaffId]);
  
  return (
    <div className="space-y-2">
      <div className="p-2">
        <button
          onClick={onAddNewStaff}
          className="w-full flex items-center justify-center p-2 text-sm font-semibold text-care-secondary border-2 border-dashed border-care-secondary rounded-lg hover:bg-care-light transition-colors"
        >
          <PlusIcon />
          <span className="ml-2">新規スタッフを追加</span>
        </button>
      </div>
      {staffList.map(staff => (
        <div
          key={staff.id}
          ref={(el) => (staffRefs.current[staff.id] = el)}
          className="bg-white rounded-lg border border-slate-200"
        >
          <button
            onClick={() => handleToggle(staff.id)}
            className="w-full flex justify-between items-center p-3 text-left font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>{staff.name}</span>
            <svg
              className={`w-5 h-5 transform transition-transform ${openStaffId === staff.id ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openStaffId === staff.id && (
            <div className="p-4 border-t border-slate-200 space-y-4 text-sm">
              {/* Name */}
               <div>
                <label className="block font-medium text-slate-600 mb-1">氏名</label>
                <input 
                  type="text"
                  value={staff.name} 
                  onChange={e => onStaffChange({...staff, name: e.target.value})}
                  className="w-full p-2 bg-white text-slate-800 border border-slate-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-care-secondary focus:border-care-secondary"
                />
              </div>
              {/* Role */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">役職</label>
                <select 
                  value={staff.role} 
                  onChange={e => onStaffChange({...staff, role: e.target.value as Role})}
                  className="w-full p-2 pr-8 bg-white text-slate-800 border border-slate-300 rounded-md shadow-xs appearance-none bg-select-arrow bg-no-repeat bg-position-[center_right_0.75rem] focus:outline-hidden focus:ring-2 focus:ring-care-secondary focus:border-care-secondary"
                >
                  {ROLES.map(r => <option key={r} value={r} className="text-black">{r}</option>)}
                </select>
              </div>
              {/* Qualifications */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">保有資格</label>
                <div className="grid grid-cols-2 gap-2">
                  {QUALIFICATIONS.map(q => (
                    <label key={q} className="flex items-center space-x-2">
                      <input 
                        type="checkbox"
                        checked={staff.qualifications.includes(q)}
                        onChange={e => {
                          const newQuals = e.target.checked
                            ? [...staff.qualifications, q]
                            : staff.qualifications.filter(qual => qual !== q);
                          onStaffChange({...staff, qualifications: newQuals});
                        }}
                        className="rounded-sm text-care-secondary focus:ring-care-secondary"
                      />
                      <span>{q}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Employment Type */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">勤務形態区分</label>
                <select
                  value={staff.employmentType ?? 'A'}
                  onChange={e => onStaffChange({ ...staff, employmentType: e.target.value as EmploymentType })}
                  className="w-full p-2 pr-8 bg-white text-slate-800 border border-slate-300 rounded-md shadow-xs appearance-none bg-select-arrow bg-no-repeat bg-position-[center_right_0.75rem] focus:outline-hidden focus:ring-2 focus:ring-care-secondary focus:border-care-secondary"
                >
                  {(Object.entries(EMPLOYMENT_TYPES) as [EmploymentType, string][]).map(([key, label]) => (
                    <option key={key} value={key}>{key}: {label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">行政提出用（標準様式第1号）に使用します</p>
              </div>
              {/* Weekly Contract Hours (non-constant staff only) */}
              {(staff.employmentType === 'C' || staff.employmentType === 'D') && (
                <div>
                  <label className="block font-medium text-slate-600 mb-1">契約週時間（非常勤）</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={40}
                      step={0.5}
                      value={staff.weeklyContractHours ?? ''}
                      onChange={e => onStaffChange({ ...staff, weeklyContractHours: Number(e.target.value) })}
                      placeholder="例: 20"
                      className="w-24 p-2 bg-white text-slate-800 border border-slate-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-care-secondary focus:border-care-secondary"
                    />
                    <span className="text-slate-500">時間/週（常勤換算計算に使用）</span>
                  </div>
                </div>
              )}
              {/* isNightShiftOnly */}
              <div>
                <label className="flex items-center space-x-2 font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staff.isNightShiftOnly}
                    onChange={e => onStaffChange({ ...staff, isNightShiftOnly: e.target.checked })}
                    className="rounded-sm text-care-secondary focus:ring-care-secondary"
                  />
                  <span>夜勤専従</span>
                </label>
              </div>
              {/* Max Consecutive Work Days */}
              <div>
                <label className="block font-medium text-slate-600 mb-1">最大連続勤務日数</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={staff.maxConsecutiveWorkDays}
                    onChange={e => {
                      const val = Math.min(7, Math.max(1, Number(e.target.value)));
                      onStaffChange({ ...staff, maxConsecutiveWorkDays: val });
                    }}
                    className="w-20 p-2 bg-white text-slate-800 border border-slate-300 rounded-md shadow-xs focus:outline-hidden focus:ring-2 focus:ring-care-secondary focus:border-care-secondary"
                  />
                  <span className="text-slate-500">日（1〜7日）</span>
                </div>
              </div>
              {/* Unavailable Dates */}
              <div className="relative">
                <label className="block font-medium text-slate-600 mb-1">勤務できない日</label>
                <div 
                    onClick={() => setEditingCalendarFor(staff.id)}
                    className="w-full p-2 border border-slate-300 rounded-md shadow-xs bg-white cursor-pointer min-h-[40px] flex flex-wrap gap-1 items-center"
                >
                    {staff.unavailableDates.length > 0 ? (
                        staff.unavailableDates.map(date => (
                            <span key={date} className="bg-slate-200 text-slate-700 text-xs font-semibold px-2 py-1 rounded-full">
                                {new Date(date + 'T00:00:00').getDate()}日
                            </span>
                        ))
                    ) : (
                        <span className="text-slate-400">日付を選択</span>
                    )}
                </div>
                {editingCalendarFor === staff.id && (
                    <CalendarPicker 
                        targetMonth={targetMonth}
                        selectedDates={staff.unavailableDates}
                        onDateChange={(dates) => handleDateChange(staff, dates)}
                        onClose={() => setEditingCalendarFor(null)}
                    />
                )}
              </div>
              {/* Delete Staff */}
              <div className="pt-4 mt-2 border-t border-slate-200">
                <button
                  onClick={() => onDeleteStaff(staff.id)}
                  className="w-full text-sm text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-md transition-colors flex items-center justify-center"
                >
                  <TrashIcon />
                  <span className="ml-2">このスタッフを削除</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default StaffSettings;
