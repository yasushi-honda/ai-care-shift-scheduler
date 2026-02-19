/**
 * LeaveBalanceCompact.tsx
 *
 * Phase 64: 休暇残高管理 UX刷新
 * サイドバー用コンパクトサマリービュー
 * 集計バッジ（総スタッフ数/マイナス残高/時効近）+ 拡大ボタン
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { Staff, StaffLeaveBalance } from '../../types';
import { getStaffLeaveBalances } from '../services/leaveBalanceService';
import { getBalanceStatus, daysUntilExpiry } from '../utils/leaveBalanceUtils';

interface LeaveBalanceCompactProps {
  facilityId: string;
  staffList: Staff[];
  yearMonth: string;
  /** 値が変わるとデータを再取得 */
  refreshTrigger?: number;
  onOpenFullScreen: () => void;
}

export const LeaveBalanceCompact: React.FC<LeaveBalanceCompactProps> = ({
  facilityId,
  staffList,
  yearMonth,
  refreshTrigger,
  onOpenFullScreen,
}) => {
  const [balances, setBalances] = useState<Map<string, StaffLeaveBalance>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!facilityId || !yearMonth) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getStaffLeaveBalances(facilityId, yearMonth)
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          const map = new Map<string, StaffLeaveBalance>();
          result.data.forEach((b) => map.set(b.staffId, b));
          setBalances(map);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [facilityId, yearMonth, refreshTrigger]);

  const { negativeCount, expiringSoonCount } = useMemo(() => {
    let neg = 0;
    let soon = 0;
    balances.forEach((b) => {
      const phStatus = getBalanceStatus(b.publicHoliday.balance);
      const plStatus = getBalanceStatus(b.paidLeave.balance);
      if (phStatus === 'negative' || plStatus === 'negative') neg++;

      const daysLeft = daysUntilExpiry(b.paidLeave.expiresAt.toDate());
      if (daysLeft >= 0 && daysLeft <= 90) soon++;
    });
    return { negativeCount: neg, expiringSoonCount: soon };
  }, [balances]);

  return (
    <div className="space-y-3">
      {/* 集計バッジ */}
      <div className="flex flex-wrap gap-2">
        {/* 総スタッフ数 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full text-xs text-slate-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{staffList.length}名</span>
        </div>

        {/* マイナス残高 */}
        {loading ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full text-xs text-slate-400">
            <div className="animate-spin h-3 w-3 border border-slate-300 border-t-transparent rounded-full" />
            <span>読込中</span>
          </div>
        ) : (
          <>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                negativeCount > 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>マイナス <span className="font-bold">{negativeCount}</span>名</span>
            </div>

            {/* 時効近 */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                expiringSoonCount > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>時効近 <span className="font-bold">{expiringSoonCount}</span>名</span>
            </div>
          </>
        )}
      </div>

      {/* 拡大ボタン */}
      <button
        onClick={onOpenFullScreen}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        詳細ダッシュボードを開く
      </button>
    </div>
  );
};
