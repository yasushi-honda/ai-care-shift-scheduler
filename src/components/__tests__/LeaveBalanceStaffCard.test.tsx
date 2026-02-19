/**
 * LeaveBalanceStaffCard.test.tsx
 *
 * Phase 64: 休暇残高管理 UX刷新
 * LeaveBalanceStaffCard コンポーネントテスト
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeaveBalanceStaffCard } from '../LeaveBalanceStaffCard';
import type { Staff, StaffLeaveBalance } from '../../../types';
import { Role, TimeSlotPreference } from '../../../types';
import { Timestamp } from 'firebase/firestore';

// ==================== フィクスチャ ====================

const makeTimestamp = (date: Date) => ({ toDate: () => date } as unknown as Timestamp);

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

function makeBalance(opts: {
  phBalance?: number;
  plBalance?: number;
  expiresAt?: Date;
} = {}): StaffLeaveBalance {
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  return {
    id: '2026-01_s1',
    staffId: 's1',
    yearMonth: '2026-01',
    publicHoliday: {
      allocated: 9,
      used: 0,
      carriedOver: 0,
      balance: opts.phBalance ?? 9,
    },
    paidLeave: {
      annualAllocated: 10,
      used: 0,
      carriedOver: 0,
      balance: opts.plBalance ?? 10,
      expiresAt: makeTimestamp(expiresAt),
    },
    adjustments: [],
    updatedAt: makeTimestamp(new Date()),
    updatedBy: 'test',
  };
}

const staff = makeStaff('s1', '田中 太郎');

// ==================== テスト ====================

describe('LeaveBalanceStaffCard', () => {
  describe('スタッフ名表示', () => {
    it('スタッフ名を表示する', () => {
      render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance()}
          onOpenDetail={vi.fn()}
        />
      );

      expect(screen.getByText('田中 太郎')).toBeInTheDocument();
    });
  });

  describe('残高なし状態', () => {
    it('残高がない場合は "--" を表示する', () => {
      render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={undefined}
          onOpenDetail={vi.fn()}
        />
      );

      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(2); // 公休・有給の両方
    });
  });

  describe('残高表示', () => {
    it('公休残高を日単位で表示する', () => {
      render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance({ phBalance: 7 })}
          onOpenDetail={vi.fn()}
        />
      );

      expect(screen.getByText('7日')).toBeInTheDocument();
    });

    it('有給残高を日単位で表示する', () => {
      render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance({ plBalance: 5 })}
          onOpenDetail={vi.fn()}
        />
      );

      expect(screen.getByText('5日')).toBeInTheDocument();
    });
  });

  describe('マイナス残高', () => {
    it('公休残高がマイナスの場合 border-l-red-500 が適用される', () => {
      const { container } = render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance({ phBalance: -2 })}
          onOpenDetail={vi.fn()}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-l-red-500');
    });

    it('有給残高がマイナスの場合も border-l-red-500 が適用される', () => {
      const { container } = render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance({ plBalance: -1 })}
          onOpenDetail={vi.fn()}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-l-red-500');
    });

    it('残高がプラスの場合 border-l-red-500 は適用されない', () => {
      const { container } = render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance({ phBalance: 5, plBalance: 5 })}
          onOpenDetail={vi.fn()}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).not.toContain('border-l-red-500');
    });
  });

  describe('有給時効インジケータ', () => {
    it('有給が期限切れ間近（≤7日）のとき animate-pulse ドットを表示する', () => {
      const criticalDate = new Date();
      criticalDate.setDate(criticalDate.getDate() + 5);

      const { container } = render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance({ expiresAt: criticalDate })}
          onOpenDetail={vi.fn()}
        />
      );

      const dot = container.querySelector('.animate-pulse');
      expect(dot).not.toBeNull();
    });

    it('有給期限が余裕あり（>90日）のときインジケータドットを表示しない', () => {
      const safeDate = new Date();
      safeDate.setDate(safeDate.getDate() + 200);

      const { container } = render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance({ expiresAt: safeDate })}
          onOpenDetail={vi.fn()}
        />
      );

      // safe urgencyのドットは表示されない
      const dot = container.querySelector('span[title*="有給期限"]');
      expect(dot).toBeNull();
    });
  });

  describe('アクションボタン', () => {
    it('「詳細」ボタンクリックで onOpenDetail が呼ばれる', async () => {
      const onOpenDetail = vi.fn();

      render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance()}
          onOpenDetail={onOpenDetail}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '詳細' }));

      expect(onOpenDetail).toHaveBeenCalledWith(staff);
    });

    it('onBorrow が提供されていれば「前借り」ボタンを表示する', () => {
      render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance()}
          onOpenDetail={vi.fn()}
          onBorrow={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: '前借り' })).toBeInTheDocument();
    });

    it('onBorrow がなければ「前借り」ボタンを表示しない', () => {
      render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance()}
          onOpenDetail={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: '前借り' })).not.toBeInTheDocument();
    });

    it('残高がない場合「前借り」ボタンを表示しない', () => {
      render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={undefined}
          onOpenDetail={vi.fn()}
          onBorrow={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: '前借り' })).not.toBeInTheDocument();
    });

    it('「前借り」ボタンクリックで onBorrow が呼ばれる', async () => {
      const onBorrow = vi.fn();

      render(
        <LeaveBalanceStaffCard
          staff={staff}
          balance={makeBalance()}
          onOpenDetail={vi.fn()}
          onBorrow={onBorrow}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '前借り' }));

      expect(onBorrow).toHaveBeenCalledWith(staff);
    });
  });
});
