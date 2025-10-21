import React from 'react';

interface MonthNavigatorProps {
  currentMonth: string; // YYYY-MM
  onMonthChange: (newMonth: string) => void;
}

const MonthNavigator: React.FC<MonthNavigatorProps> = ({ currentMonth, onMonthChange }) => {
  const changeMonth = (amount: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    // Dateコンストラクタの月は0-indexedなため-1する
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + amount);

    const newYear = date.getFullYear();
    // getMonth()も0-indexedなため+1する
    const newMonth = (date.getMonth() + 1).toString().padStart(2, '0');

    onMonthChange(`${newYear}-${newMonth}`);
  };

  const [year, month] = currentMonth.split('-');

  return (
    <div className="flex items-center justify-between bg-white p-2 border border-slate-300 rounded-md shadow-sm">
      <button
        onClick={() => changeMonth(-1)}
        className="p-2 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-care-secondary"
        aria-label="前の月へ"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
        </svg>
      </button>
      <div className="text-md font-semibold text-slate-800">
        {`${year}年 ${month}月`}
      </div>
      <button
        onClick={() => changeMonth(1)}
        className="p-2 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-care-secondary"
        aria-label="次の月へ"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </button>
    </div>
  );
};

export default MonthNavigator;
