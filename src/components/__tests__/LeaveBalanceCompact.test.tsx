/**
 * LeaveBalanceCompact.test.tsx
 *
 * Phase 64: 休暇残高管理 UX刷新
 * LeaveBalanceCompact コンポーネントテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { LeaveBalanceCompact } from '../LeaveBalanceCompact';
import type { Staff, StaffLeaveBalance } from '../../../types';
import { Role, TimeSlotPreference } from '../../../types';
import { Timestamp } from 'firebase/firestore';

// getStaffLeaveBalances のみモック（getBalanceStatus等の純粋関数は実装を維持）
vi.mock('../../services/leaveBalanceService', async () => {
  const actual = await vi.importActual<typeof import('../../services/leaveBalanceService')>(
    '../../services/leaveBalanceService'
  );
  return {
    ...actual,
    getStaffLeaveBalances: vi.fn(),
  };
});

import { getStaffLeaveBalances } from '../../services/leaveBalanceService';

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

function makeBalance(
  staffId: string,
  opts: { phBalance?: number; plBalance?: number; expiresAt?: Date } = {}
): StaffLeaveBalance {
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  return {
    id: `2026-01_${staffId}`,
    staffId,
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

const staffList = [makeStaff('s1', 'スタッフA'), makeStaff('s2', 'スタッフB')];

const defaultProps = {
  facilityId: 'facility-1',
  staffList,
  yearMonth: '2026-01',
  onOpenFullScreen: vi.fn(),
};

// ==================== テスト ====================

describe('LeaveBalanceCompact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('総スタッフ数バッジを表示する', async () => {
    vi.mocked(getStaffLeaveBalances).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<LeaveBalanceCompact {...defaultProps} />);

    expect(screen.getByText('2名')).toBeInTheDocument();
  });

  it('データ読み込み中はスピナーを表示する', () => {
    // Promiseを解決しない（永続的にローディング）
    vi.mocked(getStaffLeaveBalances).mockReturnValue(new Promise(() => {}));

    render(<LeaveBalanceCompact {...defaultProps} />);

    expect(screen.getByText('読込中')).toBeInTheDocument();
  });

  it('マイナス残高がないときはカウント0を表示する', async () => {
    vi.mocked(getStaffLeaveBalances).mockResolvedValue({
      success: true,
      data: [
        makeBalance('s1', { phBalance: 5, plBalance: 8 }),
        makeBalance('s2', { phBalance: 3, plBalance: 4 }),
      ],
    });

    render(<LeaveBalanceCompact {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText('読込中')).not.toBeInTheDocument();
    });

    // テキストが<span>で分割されているため、親要素のtextContentで確認
    const badge = screen.getByText('マイナス', { exact: false }).closest('div');
    expect(badge).toHaveTextContent('マイナス 0名');
  });

  it('マイナス残高があるスタッフ数を赤バッジで表示する', async () => {
    vi.mocked(getStaffLeaveBalances).mockResolvedValue({
      success: true,
      data: [
        makeBalance('s1', { phBalance: -1 }),
        makeBalance('s2', { phBalance: 5 }),
      ],
    });

    render(<LeaveBalanceCompact {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText('読込中')).not.toBeInTheDocument();
    });

    const badge = screen.getByText('マイナス', { exact: false }).closest('div');
    expect(badge).toHaveClass('bg-red-100');
    expect(badge).toHaveTextContent('マイナス 1名');
  });

  it('90日以内に時効のスタッフ数を表示する', async () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 30);

    vi.mocked(getStaffLeaveBalances).mockResolvedValue({
      success: true,
      data: [
        makeBalance('s1', { expiresAt: soonDate }),
        makeBalance('s2'),
      ],
    });

    render(<LeaveBalanceCompact {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText('読込中')).not.toBeInTheDocument();
    });

    const badge = screen.getByText('時効近', { exact: false }).closest('div');
    expect(badge).toHaveTextContent('時効近 1名');
  });

  it('「詳細ダッシュボードを開く」ボタンクリックで onOpenFullScreen が呼ばれる', async () => {
    const onOpenFullScreen = vi.fn();
    vi.mocked(getStaffLeaveBalances).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<LeaveBalanceCompact {...defaultProps} onOpenFullScreen={onOpenFullScreen} />);

    const button = screen.getByRole('button', { name: /詳細ダッシュボードを開く/ });
    fireEvent.click(button);

    expect(onOpenFullScreen).toHaveBeenCalledOnce();
  });

  it('API失敗時もクラッシュしない', async () => {
    vi.mocked(getStaffLeaveBalances).mockResolvedValue({
      success: false,
      error: { code: 'FIRESTORE_ERROR', message: 'fetch failed' },
    });

    // エラーが発生しないことを確認
    expect(() => render(<LeaveBalanceCompact {...defaultProps} />)).not.toThrow();

    // バッジが表示されることを確認（データなし状態）
    await waitFor(() => {
      expect(screen.getByText('2名')).toBeInTheDocument();
    });
  });

  it('refreshTrigger が変化するとデータを再取得する', async () => {
    vi.mocked(getStaffLeaveBalances).mockResolvedValue({
      success: true,
      data: [],
    });

    const { rerender } = render(<LeaveBalanceCompact {...defaultProps} refreshTrigger={0} />);

    await waitFor(() => {
      expect(getStaffLeaveBalances).toHaveBeenCalledTimes(1);
    });

    rerender(<LeaveBalanceCompact {...defaultProps} refreshTrigger={1} />);

    await waitFor(() => {
      expect(getStaffLeaveBalances).toHaveBeenCalledTimes(2);
    });
  });
});
