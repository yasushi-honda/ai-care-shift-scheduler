import React from 'react';

interface SummaryCardProps {
  title: string;
  value: string;
  icon: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
}

const colorClasses = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  orange: 'bg-orange-50 border-orange-200',
  purple: 'bg-purple-50 border-purple-200',
};

export function SummaryCard({ title, value, icon, color }: SummaryCardProps): React.ReactElement {
  return (
    <div className={`p-3 sm:p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-gray-500 truncate">{title}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{value}</p>
        </div>
        <span className="text-xl sm:text-2xl shrink-0">{icon}</span>
      </div>
    </div>
  );
}
