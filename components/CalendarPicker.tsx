import React, { useState, useEffect, useRef } from 'react';
import { WEEKDAYS } from '../constants';

interface CalendarPickerProps {
  targetMonth: string; // YYYY-MM
  selectedDates: string[]; // YYYY-MM-DD
  onDateChange: (dates: string[]) => void;
  onClose: () => void;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({ targetMonth, selectedDates, onDateChange, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(targetMonth);
  const selectedSet = new Set(selectedDates);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const changeMonth = (amount: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    // Dateコンストラクタの月は0-indexedなため-1する
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + amount);

    const newYear = date.getFullYear();
    // getMonth()も0-indexedなため+1する
    const newMonth = (date.getMonth() + 1).toString().padStart(2, '0');
    
    setCurrentMonth(`${newYear}-${newMonth}`);
  };
  
  const handleDateClick = (date: string) => {
    const newSet = new Set(selectedSet);
    if (newSet.has(date)) {
      newSet.delete(date);
    } else {
      newSet.add(date);
    }
    onDateChange(Array.from(newSet));
  };

  const [year, month] = currentMonth.split('-').map(Number);
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];
  // Add blank days for the first week
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(<div key={`blank-${i}`} className="p-1"></div>);
  }
  // Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    const isSelected = selectedSet.has(dateStr);
    calendarDays.push(
      <div key={day} className="p-1">
        <button
          onClick={() => handleDateClick(dateStr)}
          className={`w-full h-8 rounded-full text-sm transition-colors duration-200
            ${isSelected ? 'bg-care-secondary text-white font-semibold' : 'hover:bg-slate-200'}
            ${new Date(dateStr + 'T00:00:00').getMonth() + 1 !== month ? 'text-slate-300' : 'text-slate-700'}
          `}
        >
          {day}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={calendarRef}
      className="absolute z-10 mt-2 w-72 bg-white border border-slate-300 rounded-lg shadow-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-slate-100">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="font-semibold text-slate-800">{`${year}年 ${month}月`}</div>
        <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-slate-100">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      {/* Weekdays */}
      <div className="grid grid-cols-7 text-center text-xs text-slate-500 font-bold mb-2">
        {WEEKDAYS.map(day => <div key={day}>{day}</div>)}
      </div>
      {/* Days */}
      <div className="grid grid-cols-7">
        {calendarDays}
      </div>
       <button onClick={onClose} className="w-full mt-4 bg-care-secondary text-white text-sm py-2 rounded-md hover:bg-care-dark transition-colors">
          閉じる
       </button>
    </div>
  );
};

export default CalendarPicker;