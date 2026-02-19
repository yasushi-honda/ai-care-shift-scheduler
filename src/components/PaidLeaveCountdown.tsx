/**
 * PaidLeaveCountdown コンポーネント
 *
 * Phase 64: 休暇残高管理 UX刷新
 * 有給時効アラート - スタッフごとの有給期限カウントダウンをトラフィックライト色で表示
 */

import React, { useMemo } from 'react';
import type { Staff, StaffLeaveBalance } from '../../types';
import { CircularProgress } from './ProgressBar';
import { daysUntilExpiry, getExpiryUrgency, getUrgencyColorClass } from '../utils/leaveBalanceUtils';
import type { ExpiryUrgency } from '../utils/leaveBalanceUtils';
import type { ProgressBarVariant } from './ProgressBar';

// ==================== Props ====================

export interface PaidLeaveCountdownProps {
  staffList: Staff[];
  balances: Map<string, StaffLeaveBalance>;  // key = staffId
  threshold?: number;  // Show only staff with daysLeft <= threshold (default: 90)
}

// ==================== ヘルパー ====================

/** 緊急度を CircularProgress の variant にマッピング */
function urgencyToVariant(urgency: ExpiryUrgency): ProgressBarVariant {
  switch (urgency) {
    case 'critical':
    case 'warning':
      return 'danger';
    case 'caution':
      return 'warning';
    case 'safe':
    default:
      return 'success';
  }
}

/** 有効期限日を日本語表記でフォーマット */
function formatExpiryDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ==================== コンポーネント ====================

export const PaidLeaveCountdown: React.FC<PaidLeaveCountdownProps> = ({
  staffList,
  balances,
  threshold = 90,
}) => {
  // 期限が threshold 日以内のスタッフを抽出し、残日数の昇順（最も緊急なもの優先）でソート
  const urgentStaff = useMemo(() => {
    return staffList
      .map(staff => {
        const balance = balances.get(staff.id);
        if (!balance) return null;
        const daysLeft = daysUntilExpiry(balance.paidLeave.expiresAt.toDate());
        return { staff, balance, daysLeft };
      })
      .filter((item): item is NonNullable<typeof item> =>
        item !== null && item.daysLeft <= threshold && item.daysLeft >= 0
      )
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [staffList, balances, threshold]);

  return (
    <div className="space-y-2">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">有給時効アラート</span>
        {urgentStaff.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
            {urgentStaff.length}
          </span>
        )}
      </div>

      {/* 対象スタッフが存在しない場合の空状態 */}
      {urgentStaff.length === 0 && (
        <div className="py-4 text-center text-sm text-gray-400">
          期限が近い有給はありません
        </div>
      )}

      {/* スタッフカードグリッド（サイドバー用縦積み） */}
      <div className="grid grid-cols-1 gap-3">
        {urgentStaff.map(({ staff, balance, daysLeft }) => {
          const urgency = getExpiryUrgency(daysLeft);
          const colorClass = getUrgencyColorClass(urgency);
          const variant = urgencyToVariant(urgency);
          const percentage = Math.min((daysLeft / 90) * 100, 100);
          const expiryDate = formatExpiryDate(balance.paidLeave.expiresAt.toDate());

          return (
            <div
              key={staff.id}
              className={`rounded-md border-l-4 ${colorClass.border} ${colorClass.bg} p-3 shadow-sm`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* 左側: スタッフ名・残日数・有効期限・残高 */}
                <div className="flex-1 min-w-0">
                  {/* スタッフ名 + 状態ドット */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colorClass.dot}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {staff.name}
                    </span>
                  </div>

                  {/* 残日数 */}
                  <div className="flex items-baseline gap-0.5 mb-1">
                    <span className={`text-2xl font-mono font-bold ${colorClass.text}`}>
                      {daysLeft}
                    </span>
                    <span className={`text-sm font-medium ${colorClass.text}`}>
                      日後
                    </span>
                  </div>

                  {/* 有効期限日 */}
                  <p className="text-xs text-gray-500 mb-0.5">
                    期限: {expiryDate}
                  </p>

                  {/* 現在の有給残高 */}
                  <p className="text-xs text-gray-600">
                    残高: <span className="font-medium">{balance.paidLeave.balance}</span> 日
                  </p>
                </div>

                {/* 右側: CircularProgress ゲージ */}
                <div className="flex-shrink-0">
                  <CircularProgress
                    value={percentage}
                    size={48}
                    thickness={5}
                    variant={variant}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
