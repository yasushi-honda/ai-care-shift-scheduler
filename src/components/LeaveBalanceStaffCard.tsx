/**
 * LeaveBalanceStaffCard.tsx
 *
 * Phase 64: 休暇残高管理 UX刷新
 * スタッフ個別の休暇残高カード（全画面ダッシュボード用）
 */

import React from 'react';
import type { Staff, StaffLeaveBalance } from '../../types';
import { ProgressBar } from './ProgressBar';
import { getBalanceStatus } from '../services/leaveBalanceService';
import { daysUntilExpiry, getExpiryUrgency } from '../utils/leaveBalanceUtils';

interface LeaveBalanceStaffCardProps {
  staff: Staff;
  balance: StaffLeaveBalance | undefined;
  onOpenDetail: (staff: Staff) => void;
  onBorrow?: (staff: Staff) => void;
}

/** 公休残高に応じた ProgressBar variant */
function phVariant(balance: number): 'success' | 'warning' | 'danger' {
  const status = getBalanceStatus(balance);
  if (status === 'negative') return 'danger';
  if (status === 'low') return 'warning';
  return 'success';
}

/** 公休残高の文字色 */
function phTextClass(balance: number): string {
  const status = getBalanceStatus(balance);
  if (status === 'negative') return 'text-red-600 font-bold';
  if (status === 'low') return 'text-amber-600';
  return 'text-slate-800';
}

export const LeaveBalanceStaffCard: React.FC<LeaveBalanceStaffCardProps> = ({
  staff,
  balance,
  onOpenDetail,
  onBorrow,
}) => {
  const isNegative =
    balance &&
    (balance.publicHoliday.balance < 0 || balance.paidLeave.balance < 0);

  // 有給時効の緊急度
  const plDaysLeft = balance
    ? daysUntilExpiry(balance.paidLeave.expiresAt.toDate())
    : null;
  const plUrgency = plDaysLeft !== null ? getExpiryUrgency(plDaysLeft) : null;

  // 公休バーの割合（月間付与+繰越を分母）
  const phMax = balance
    ? Math.max(balance.publicHoliday.allocated + balance.publicHoliday.carriedOver, 1)
    : 9;
  const phPercent = balance
    ? Math.max(0, (balance.publicHoliday.balance / phMax) * 100)
    : 0;

  return (
    <div
      className={`bg-white rounded-lg border shadow-sm p-4 flex flex-col gap-3 transition-shadow hover:shadow-md ${
        isNegative ? 'border-l-4 border-l-red-500 border-t border-r border-b border-slate-200' : 'border-slate-200'
      }`}
    >
      {/* スタッフ名 */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-800 text-sm">{staff.name}</span>
        {plUrgency && plUrgency !== 'safe' && (
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              plUrgency === 'critical'
                ? 'bg-red-500 animate-pulse'
                : plUrgency === 'warning'
                ? 'bg-red-400'
                : 'bg-amber-400'
            }`}
            title={`有給期限: ${plDaysLeft}日後`}
          />
        )}
      </div>

      {/* 公休残高 */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500">公休残高</span>
          <span className={`font-mono text-sm ${balance ? phTextClass(balance.publicHoliday.balance) : 'text-slate-400'}`}>
            {balance ? `${balance.publicHoliday.balance}日` : '--'}
          </span>
        </div>
        <ProgressBar
          value={phPercent}
          variant={balance ? phVariant(balance.publicHoliday.balance) : 'primary'}
          size="small"
        />
      </div>

      {/* 有給残高 */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-500">有給残高</span>
        <span className={`font-mono text-sm ${balance && balance.paidLeave.balance < 0 ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
          {balance ? `${balance.paidLeave.balance}日` : '--'}
        </span>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-1.5 pt-1">
        <button
          onClick={() => onOpenDetail(staff)}
          className="flex-1 px-2 py-1 text-xs text-care-primary border border-care-primary/30 hover:bg-care-primary/5 rounded transition-colors"
        >
          詳細
        </button>
        {onBorrow && balance && (
          <button
            onClick={() => onBorrow(staff)}
            className="flex-1 px-2 py-1 text-xs text-indigo-700 border border-indigo-200 hover:bg-indigo-50 rounded transition-colors"
          >
            前借り
          </button>
        )}
      </div>
    </div>
  );
};
