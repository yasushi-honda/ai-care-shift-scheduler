/**
 * leaveBalanceUtils.test.ts
 *
 * Phase 64: 休暇残高管理 UX刷新
 * leaveBalanceUtils.ts の純粋関数のユニットテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  daysUntilExpiry,
  getExpiryUrgency,
  getUrgencyColorClass,
  getNextYearMonth,
  getPreviousYearMonth,
  getMonthRange,
  buildTimelineData,
  simulateBalanceChange,
  previewBorrowImpact,
  filterStaffByLeaveStatus,
} from '../leaveBalanceUtils';
import type { Staff, StaffLeaveBalance } from '../../../types';
import { Role, TimeSlotPreference } from '../../../types';
import { Timestamp } from 'firebase/firestore';

// ==================== フィクスチャ ====================

const makeTimestamp = (date: Date) => ({ toDate: () => date } as unknown as Timestamp);

function makeBalance(
  staffId: string,
  yearMonth: string,
  overrides: Partial<{
    phBalance: number;
    plBalance: number;
    expiresAt: Date;
    adjustments: StaffLeaveBalance['adjustments'];
  }> = {}
): StaffLeaveBalance {
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  return {
    id: `${yearMonth}_${staffId}`,
    staffId,
    yearMonth,
    publicHoliday: {
      allocated: 9,
      used: 0,
      carriedOver: 0,
      balance: overrides.phBalance ?? 9,
    },
    paidLeave: {
      annualAllocated: 10,
      used: 0,
      carriedOver: 0,
      balance: overrides.plBalance ?? 10,
      expiresAt: makeTimestamp(expiresAt),
    },
    adjustments: overrides.adjustments ?? [],
    updatedAt: makeTimestamp(new Date()),
    updatedBy: 'test',
  };
}

function makeStaff(id: string, name: string): Staff {
  return {
    id,
    name,
    role: Role.CareWorker,
    qualifications: [],
    weeklyWorkCount: { hope: 5, must: 5 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.DayOnly,
    isNightShiftOnly: false,
  };
}

// ==================== daysUntilExpiry ====================

describe('daysUntilExpiry', () => {
  it('明日が期限の場合 1 を返す', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(daysUntilExpiry(tomorrow)).toBe(1);
  });

  it('今日が期限の場合 0 を返す', () => {
    const today = new Date();
    expect(daysUntilExpiry(today)).toBe(0);
  });

  it('昨日が期限の場合 -1 を返す', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(daysUntilExpiry(yesterday)).toBe(-1);
  });

  it('30 日後の場合 30 を返す', () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    expect(daysUntilExpiry(date)).toBe(30);
  });

  it('90 日後の場合 90 を返す', () => {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    expect(daysUntilExpiry(date)).toBe(90);
  });
});

// ==================== getExpiryUrgency ====================

describe('getExpiryUrgency', () => {
  it('7 日以下は critical', () => {
    expect(getExpiryUrgency(7)).toBe('critical');
    expect(getExpiryUrgency(0)).toBe('critical');
    expect(getExpiryUrgency(-1)).toBe('critical');
  });

  it('8〜30 日は warning', () => {
    expect(getExpiryUrgency(8)).toBe('warning');
    expect(getExpiryUrgency(30)).toBe('warning');
  });

  it('31〜90 日は caution', () => {
    expect(getExpiryUrgency(31)).toBe('caution');
    expect(getExpiryUrgency(90)).toBe('caution');
  });

  it('91 日以上は safe', () => {
    expect(getExpiryUrgency(91)).toBe('safe');
    expect(getExpiryUrgency(365)).toBe('safe');
  });
});

// ==================== getUrgencyColorClass ====================

describe('getUrgencyColorClass', () => {
  it('critical は赤系クラスを返す', () => {
    const colors = getUrgencyColorClass('critical');
    expect(colors.dot).toContain('animate-pulse');
    expect(colors.bg).toContain('red');
  });

  it('warning は赤系クラスを返す（pulse なし）', () => {
    const colors = getUrgencyColorClass('warning');
    expect(colors.dot).not.toContain('animate-pulse');
    expect(colors.bg).toContain('red');
  });

  it('caution は amber 系クラスを返す', () => {
    const colors = getUrgencyColorClass('caution');
    expect(colors.bg).toContain('amber');
  });

  it('safe は green 系クラスを返す', () => {
    const colors = getUrgencyColorClass('safe');
    expect(colors.bg).toContain('green');
  });
});

// ==================== getNextYearMonth ====================

describe('getNextYearMonth', () => {
  it('通常月の翌月を返す', () => {
    expect(getNextYearMonth('2026-01')).toBe('2026-02');
    expect(getNextYearMonth('2026-06')).toBe('2026-07');
    expect(getNextYearMonth('2026-11')).toBe('2026-12');
  });

  it('12 月の翌月は翌年 1 月', () => {
    expect(getNextYearMonth('2026-12')).toBe('2027-01');
  });

  it('月の 0 埋めが正しい', () => {
    expect(getNextYearMonth('2026-08')).toBe('2026-09');
    expect(getNextYearMonth('2026-09')).toBe('2026-10');
  });
});

// ==================== getPreviousYearMonth ====================

describe('getPreviousYearMonth', () => {
  it('通常月の前月を返す', () => {
    expect(getPreviousYearMonth('2026-03')).toBe('2026-02');
    expect(getPreviousYearMonth('2026-12')).toBe('2026-11');
  });

  it('1 月の前月は前年 12 月', () => {
    expect(getPreviousYearMonth('2026-01')).toBe('2025-12');
  });
});

// ==================== getMonthRange ====================

describe('getMonthRange', () => {
  it('3 ヶ月分のリストを返す', () => {
    expect(getMonthRange('2026-01', 3)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('年をまたぐ場合も正しく返す', () => {
    expect(getMonthRange('2026-11', 3)).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('count=1 の場合は開始月のみ返す', () => {
    expect(getMonthRange('2026-06', 1)).toEqual(['2026-06']);
  });
});

// ==================== buildTimelineData ====================

describe('buildTimelineData', () => {
  it('指定月の残高を正しくマッピングする', () => {
    const balance = makeBalance('staff-1', '2026-01', { phBalance: 5, plBalance: 8 });
    const balancesMap = new Map([['2026-01_staff-1', balance]]);
    const result = buildTimelineData('staff-1', balancesMap, ['2026-01', '2026-02', '2026-03']);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ yearMonth: '2026-01', publicHolidayBalance: 5, paidLeaveBalance: 8 });
    expect(result[1]).toMatchObject({ yearMonth: '2026-02', publicHolidayBalance: 0, paidLeaveBalance: 0 });
    expect(result[2]).toMatchObject({ yearMonth: '2026-03', publicHolidayBalance: 0, paidLeaveBalance: 0 });
  });

  it('マイナス残高は isBorrowed が true になる', () => {
    const balance = makeBalance('staff-1', '2026-01', { phBalance: -2 });
    const balancesMap = new Map([['2026-01_staff-1', balance]]);
    const result = buildTimelineData('staff-1', balancesMap, ['2026-01']);

    expect(result[0].isBorrowed).toBe(true);
  });

  it('プラス残高は isBorrowed が false になる', () => {
    const balance = makeBalance('staff-1', '2026-01', { phBalance: 5 });
    const balancesMap = new Map([['2026-01_staff-1', balance]]);
    const result = buildTimelineData('staff-1', balancesMap, ['2026-01']);

    expect(result[0].isBorrowed).toBe(false);
  });
});

// ==================== simulateBalanceChange ====================

describe('simulateBalanceChange', () => {
  it('公休の使用増をシミュレーションできる', () => {
    const balance = makeBalance('staff-1', '2026-01', { phBalance: 9 });
    const result = simulateBalanceChange(balance, 3, 'publicHoliday');

    expect(result.publicHoliday.balance).toBe(6);
    expect(result.paidLeave.balance).toBe(10); // 有給は変わらない
  });

  it('有給の使用増をシミュレーションできる', () => {
    const balance = makeBalance('staff-1', '2026-01', { plBalance: 10 });
    const result = simulateBalanceChange(balance, 5, 'paidLeave');

    expect(result.paidLeave.balance).toBe(5);
    expect(result.publicHoliday.balance).toBe(9); // 公休は変わらない
  });

  it('元のオブジェクトを変更しない（イミュータブル）', () => {
    const balance = makeBalance('staff-1', '2026-01', { phBalance: 9 });
    simulateBalanceChange(balance, 3, 'publicHoliday');

    expect(balance.publicHoliday.balance).toBe(9); // 変更されていない
  });

  it('マイナスシミュレーション（前借り状態）も返せる', () => {
    const balance = makeBalance('staff-1', '2026-01', { phBalance: 2 });
    const result = simulateBalanceChange(balance, 5, 'publicHoliday');

    expect(result.publicHoliday.balance).toBe(-3);
  });
});

// ==================== previewBorrowImpact ====================

describe('previewBorrowImpact', () => {
  it('前借り後の残高と翌月影響を正しく返す', () => {
    const result = previewBorrowImpact(3, 2);

    expect(result.currentBalance).toBe(3);
    expect(result.afterBorrowBalance).toBe(5);
    expect(result.nextMonthImpact).toBe(-2);
  });

  it('残高 0 からの前借りも計算できる', () => {
    const result = previewBorrowImpact(0, 3);

    expect(result.afterBorrowBalance).toBe(3);
    expect(result.nextMonthImpact).toBe(-3);
  });
});

// ==================== filterStaffByLeaveStatus ====================

describe('filterStaffByLeaveStatus', () => {
  const staff1 = makeStaff('s1', 'スタッフA');
  const staff2 = makeStaff('s2', 'スタッフB');
  const staff3 = makeStaff('s3', 'スタッフC');

  it('all フィルタは全員を返す', () => {
    const balances = new Map([
      ['s1', makeBalance('s1', '2026-01')],
      ['s2', makeBalance('s2', '2026-01')],
    ]);
    const result = filterStaffByLeaveStatus([staff1, staff2], balances, 'all');
    expect(result).toHaveLength(2);
  });

  it('negative フィルタはマイナス残高のスタッフのみ返す', () => {
    const balances = new Map([
      ['s1', makeBalance('s1', '2026-01', { phBalance: -1 })],
      ['s2', makeBalance('s2', '2026-01', { phBalance: 5 })],
    ]);
    const result = filterStaffByLeaveStatus([staff1, staff2], balances, 'negative');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('borrowed フィルタは前借り中のスタッフを返す', () => {
    const borrowedBalance = makeBalance('s1', '2026-01', {
      phBalance: -2,
    });
    const normalBalance = makeBalance('s2', '2026-01', { phBalance: 5 });
    const balances = new Map([
      ['s1', borrowedBalance],
      ['s2', normalBalance],
    ]);
    const result = filterStaffByLeaveStatus([staff1, staff2], balances, 'borrowed');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('expiringSoon フィルタは 90 日以内に有給が切れるスタッフを返す', () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 30);
    const farDate = new Date();
    farDate.setDate(farDate.getDate() + 365);

    const soonBalance = makeBalance('s1', '2026-01', { expiresAt: soonDate });
    const farBalance = makeBalance('s2', '2026-01', { expiresAt: farDate });
    const balances = new Map([
      ['s1', soonBalance],
      ['s2', farBalance],
    ]);
    const result = filterStaffByLeaveStatus([staff1, staff2], balances, 'expiringSoon');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('残高が存在しないスタッフは negative フィルタで除外される', () => {
    const balances = new Map<string, StaffLeaveBalance>();
    const result = filterStaffByLeaveStatus([staff3], balances, 'negative');
    expect(result).toHaveLength(0);
  });

  it('有給が既に期限切れのスタッフは expiringSoon に含まれない', () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);
    const balance = makeBalance('s1', '2026-01', { expiresAt: expiredDate });
    const balances = new Map([['s1', balance]]);
    const result = filterStaffByLeaveStatus([staff1], balances, 'expiringSoon');
    expect(result).toHaveLength(0);
  });
});
