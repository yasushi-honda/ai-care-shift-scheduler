/**
 * leaveBalanceUtils.ts
 *
 * Phase 64: 休暇残高管理 UX刷新
 * 純粋関数をまとめたユーティリティモジュール
 */

import type { Staff, StaffLeaveBalance, LeaveBalanceTrendEntry } from '../../types';

// ==================== 時効・緊急度 ====================

/** 時効緊急度レベル */
export type ExpiryUrgency = 'safe' | 'caution' | 'warning' | 'critical';

/**
 * 有効期限まの残日数を計算
 * @param expiresAt 有効期限日
 * @returns 残日数（期限切れは 0 以下の負数）
 */
export function daysUntilExpiry(expiresAt: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiresAt);
  exp.setHours(0, 0, 0, 0);
  return Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 時効緊急度を判定
 * - 'critical'  : ≤7日（赤点滅）
 * - 'warning'   : ≤30日（赤）
 * - 'caution'   : ≤90日（黄）
 * - 'safe'      : >90日（緑）
 */
export function getExpiryUrgency(daysLeft: number): ExpiryUrgency {
  if (daysLeft <= 7) return 'critical';
  if (daysLeft <= 30) return 'warning';
  if (daysLeft <= 90) return 'caution';
  return 'safe';
}

/** 緊急度に対応する Tailwind クラスを返す */
export function getUrgencyColorClass(urgency: ExpiryUrgency): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (urgency) {
    case 'critical':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-400',
        dot: 'bg-red-500 animate-pulse',
      };
    case 'warning':
      return {
        bg: 'bg-red-50',
        text: 'text-red-600',
        border: 'border-red-300',
        dot: 'bg-red-500',
      };
    case 'caution':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-300',
        dot: 'bg-amber-500',
      };
    case 'safe':
      return {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-300',
        dot: 'bg-green-500',
      };
  }
}

// ==================== 月計算 ====================

/**
 * 翌月の YYYY-MM 文字列を返す
 */
export function getNextYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * 前月の YYYY-MM 文字列を返す（後方互換性のために再エクスポート用）
 */
export function getPreviousYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

/**
 * 指定月から N ヶ月分の YYYY-MM リストを返す（昇順）
 */
export function getMonthRange(startYearMonth: string, count: number): string[] {
  const months: string[] = [];
  let current = startYearMonth;
  for (let i = 0; i < count; i++) {
    months.push(current);
    current = getNextYearMonth(current);
  }
  return months;
}

// ==================== タイムラインデータ ====================

/**
 * 3ヶ月分の残高タイムラインデータを構築する
 * @param staffId    対象スタッフID
 * @param balancesMap yearMonth → StaffLeaveBalance のマップ
 * @param monthLabels 3ヶ月分の YYYY-MM リスト
 * @returns LeaveBalanceTrendEntry[]
 */
export function buildTimelineData(
  staffId: string,
  balancesMap: Map<string, StaffLeaveBalance>,
  monthLabels: string[]
): LeaveBalanceTrendEntry[] {
  return monthLabels.map((ym) => {
    const balance = balancesMap.get(`${ym}_${staffId}`);
    return {
      yearMonth: ym,
      publicHolidayBalance: balance?.publicHoliday.balance ?? 0,
      paidLeaveBalance: balance?.paidLeave.balance ?? 0,
      isBorrowed: balance ? balance.publicHoliday.balance < 0 : false,
    };
  });
}

// ==================== シミュレーション ====================

/**
 * What-if シミュレーション: 残高変更後の状態を返す
 * @param balance        現在の残高オブジェクト
 * @param additionalUsage 追加使用日数（正=使用増、負=使用減）
 * @param type            公休 or 有給
 */
export function simulateBalanceChange(
  balance: StaffLeaveBalance,
  additionalUsage: number,
  type: 'publicHoliday' | 'paidLeave'
): StaffLeaveBalance {
  if (type === 'publicHoliday') {
    const newBal = balance.publicHoliday.balance - additionalUsage;
    return {
      ...balance,
      publicHoliday: {
        ...balance.publicHoliday,
        balance: newBal,
      },
    };
  } else {
    const newBal = balance.paidLeave.balance - additionalUsage;
    return {
      ...balance,
      paidLeave: {
        ...balance.paidLeave,
        balance: newBal,
      },
    };
  }
}

/** 前借りの影響プレビュー */
export interface BorrowImpact {
  currentBalance: number;
  afterBorrowBalance: number;  // 当月残高（前借り後）
  nextMonthImpact: number;     // 翌月減算分（負数）
}

/**
 * 前借り影響プレビュー
 * @param currentPublicHolidayBalance 現在の公休残高
 * @param borrowAmount               前借り日数（正数）
 */
export function previewBorrowImpact(
  currentPublicHolidayBalance: number,
  borrowAmount: number
): BorrowImpact {
  return {
    currentBalance: currentPublicHolidayBalance,
    afterBorrowBalance: currentPublicHolidayBalance + borrowAmount,
    nextMonthImpact: -borrowAmount,
  };
}

// ==================== フィルタ ====================

/** 全画面ダッシュボード用フィルタ種別 */
export type LeaveStatusFilter = 'all' | 'negative' | 'borrowed' | 'expiringSoon';

/**
 * フィルタ条件に応じてスタッフリストを絞り込む
 * @param staffList  全スタッフリスト
 * @param balances   staffId → StaffLeaveBalance のマップ
 * @param filter     フィルタ種別
 * @param today      基準日（省略時は現在日時）
 */
export function filterStaffByLeaveStatus(
  staffList: Staff[],
  balances: Map<string, StaffLeaveBalance>,
  filter: LeaveStatusFilter,
  today: Date = new Date()
): Staff[] {
  if (filter === 'all') return staffList;

  return staffList.filter((staff) => {
    const balance = balances.get(staff.id);
    if (!balance) return false;

    switch (filter) {
      case 'negative':
        return balance.publicHoliday.balance < 0 || balance.paidLeave.balance < 0;

      case 'borrowed':
        // 前借り中: 公休残高がマイナスか、調整履歴に前借りあり
        return (
          balance.publicHoliday.balance < 0 ||
          balance.adjustments.some((a) => a.reason.includes('前借り'))
        );

      case 'expiringSoon': {
        const daysLeft = daysUntilExpiry(balance.paidLeave.expiresAt.toDate());
        return daysLeft <= 90 && daysLeft >= 0;
      }

      default:
        return true;
    }
  });
}

// ==================== 残高ステータス（後方互換性のため再エクスポート） ====================

/** 残高ステータスを返す（leaveBalanceService.ts からの再エクスポート） */
export { getBalanceStatus } from '../services/leaveBalanceService';
