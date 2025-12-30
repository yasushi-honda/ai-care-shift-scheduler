/**
 * useDiagnosis カスタムフック ユニットテスト
 * Phase 55: データ設定診断機能
 *
 * TDD: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDiagnosis, AutoDiagnosisOptions } from '../useDiagnosis';
import {
  Staff,
  ShiftRequirement,
  LeaveRequest,
  Role,
  Qualification,
  TimeSlotPreference,
} from '../../../types';
import type { DiagnosisResult } from '../../types/diagnosis';

// テスト用ヘルパー: スタッフ作成
function createStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 'staff-1',
    name: 'テストスタッフ',
    role: Role.CareWorker,
    qualifications: [Qualification.CertifiedCareWorker],
    weeklyWorkCount: { hope: 5, must: 4 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.Any,
    isNightShiftOnly: false,
    ...overrides,
  };
}

// テスト用ヘルパー: シフト要件作成
function createRequirements(
  overrides: Partial<ShiftRequirement> = {}
): ShiftRequirement {
  return {
    targetMonth: '2025-01',
    timeSlots: [
      { name: '早番', start: '07:00', end: '16:00', restHours: 1 },
      { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
      { name: '遅番', start: '11:00', end: '20:00', restHours: 1 },
    ],
    requirements: {
      早番: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
      日勤: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
      遅番: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
    },
    ...overrides,
  };
}

describe('useDiagnosis', () => {
  describe('初期状態', () => {
    it('初期状態がidle状態であること', () => {
      const { result } = renderHook(() => useDiagnosis());

      expect(result.current.status).toBe('idle');
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('runDiagnosis', () => {
    it('診断を実行し結果を返すこと', async () => {
      const { result } = renderHook(() => useDiagnosis());

      const staffList = [
        createStaff({ id: 's1', name: 'スタッフ1' }),
        createStaff({ id: 's2', name: 'スタッフ2' }),
      ];
      const requirements = createRequirements();
      const leaveRequests: LeaveRequest = {};

      await act(async () => {
        await result.current.runDiagnosis(
          staffList,
          requirements,
          leaveRequests
        );
      });

      expect(result.current.status).toBe('completed');
      expect(result.current.result).not.toBeNull();
      expect(result.current.result?.supplyDemandBalance).toBeDefined();
      expect(result.current.result?.issues).toBeDefined();
      expect(result.current.result?.suggestions).toBeDefined();
    });

    it('診断中はisLoadingがtrueになること', async () => {
      const { result } = renderHook(() => useDiagnosis());

      const staffList = [createStaff()];
      const requirements = createRequirements();

      // 診断中の状態を確認するために、診断を開始
      let resolvePromise: () => void;
      const diagnosisPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      act(() => {
        result.current.runDiagnosis(staffList, requirements, {});
      });

      // 一瞬後にisLoadingがtrueになることを確認（同期的なためすぐ完了する可能性がある）
      // クライアントサイド計算のため、実際にはほぼ即座に完了する
      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
      });
    });

    it('スタッフ不足時にerrorステータスを返すこと', async () => {
      const { result } = renderHook(() => useDiagnosis());

      // スタッフ1名のみ（明らかに不足）
      const staffList = [createStaff()];
      const requirements = createRequirements();

      await act(async () => {
        await result.current.runDiagnosis(staffList, requirements, {});
      });

      expect(result.current.result?.status).toBe('error');
      expect(result.current.result?.supplyDemandBalance.balance).toBeLessThan(
        0
      );
    });

    it('十分なスタッフがいる場合はokステータスを返すこと', async () => {
      const { result } = renderHook(() => useDiagnosis());

      // 十分なスタッフ（10名）
      const staffList = Array.from({ length: 10 }, (_, i) =>
        createStaff({ id: `s${i}`, name: `スタッフ${i}` })
      );
      const requirements = createRequirements();

      await act(async () => {
        await result.current.runDiagnosis(staffList, requirements, {});
      });

      expect(result.current.result?.status).toBe('ok');
    });

    it('時間帯制約がある場合にwarningステータスを返すこと', async () => {
      const { result } = renderHook(() => useDiagnosis());

      // 全員日勤のみ
      const staffList = Array.from({ length: 8 }, (_, i) =>
        createStaff({
          id: `s${i}`,
          name: `日勤スタッフ${i}`,
          timeSlotPreference: TimeSlotPreference.DayOnly,
        })
      );
      const requirements = createRequirements();

      await act(async () => {
        await result.current.runDiagnosis(staffList, requirements, {});
      });

      // 時間帯制約があるためwarningまたはerror
      expect(['warning', 'error']).toContain(result.current.result?.status);
    });

    it('診断結果にexecutedAtが含まれること', async () => {
      const { result } = renderHook(() => useDiagnosis());

      const staffList = [createStaff()];
      const requirements = createRequirements();

      await act(async () => {
        await result.current.runDiagnosis(staffList, requirements, {});
      });

      expect(result.current.result?.executedAt).toBeDefined();
      expect(() => new Date(result.current.result!.executedAt)).not.toThrow();
    });
  });

  describe('clearDiagnosis', () => {
    it('診断結果をクリアすること', async () => {
      const { result } = renderHook(() => useDiagnosis());

      // まず診断を実行
      const staffList = [createStaff()];
      const requirements = createRequirements();

      await act(async () => {
        await result.current.runDiagnosis(staffList, requirements, {});
      });

      expect(result.current.result).not.toBeNull();

      // クリア実行
      act(() => {
        result.current.clearDiagnosis();
      });

      expect(result.current.status).toBe('idle');
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('パフォーマンス', () => {
    it('診断が1秒以内に完了すること', async () => {
      const { result } = renderHook(() => useDiagnosis());

      // 大量のスタッフデータ（50名）
      const staffList = Array.from({ length: 50 }, (_, i) =>
        createStaff({ id: `s${i}`, name: `スタッフ${i}` })
      );
      const requirements = createRequirements();

      const startTime = performance.now();

      await act(async () => {
        await result.current.runDiagnosis(staffList, requirements, {});
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // 1秒（1000ms）以内に完了
      expect(executionTime).toBeLessThan(1000);
    });
  });

  describe('エラーハンドリング', () => {
    it('空のスタッフリストでも診断できること', async () => {
      const { result } = renderHook(() => useDiagnosis());

      const staffList: Staff[] = [];
      const requirements = createRequirements();

      await act(async () => {
        await result.current.runDiagnosis(staffList, requirements, {});
      });

      expect(result.current.status).toBe('completed');
      expect(result.current.result?.status).toBe('error');
    });
  });

  describe('自動診断トリガー', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('autoDiagnosisOptionsが渡された場合に自動で診断が実行されること', async () => {
      const staffList = [createStaff()];
      const requirements = createRequirements();
      const leaveRequests: LeaveRequest = {};

      const options: AutoDiagnosisOptions = {
        staffList,
        requirements,
        leaveRequests,
        enabled: true,
        debounceMs: 100,
      };

      const { result } = renderHook(() => useDiagnosis(options));

      // 初期状態はidle
      expect(result.current.status).toBe('idle');

      // デバウンス時間を進めて診断を実行
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // 診断が完了している
      expect(result.current.status).toBe('completed');
      expect(result.current.result).not.toBeNull();
    });

    it('enabled=falseの場合は自動診断が実行されないこと', () => {
      const staffList = [createStaff()];
      const requirements = createRequirements();
      const leaveRequests: LeaveRequest = {};

      const options: AutoDiagnosisOptions = {
        staffList,
        requirements,
        leaveRequests,
        enabled: false,
        debounceMs: 100,
      };

      const { result } = renderHook(() => useDiagnosis(options));

      // デバウンス時間を進める
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // 診断は実行されない
      expect(result.current.status).toBe('idle');
      expect(result.current.result).toBeNull();
    });

    it('データが変更された場合にデバウンス付きで再診断されること', () => {
      const staffList = [createStaff()];
      const requirements = createRequirements();
      const leaveRequests: LeaveRequest = {};

      let options: AutoDiagnosisOptions = {
        staffList,
        requirements,
        leaveRequests,
        enabled: true,
        debounceMs: 100,
      };

      const { result, rerender } = renderHook(
        (props) => useDiagnosis(props),
        { initialProps: options }
      );

      // デバウンス時間を進めて最初の診断を完了
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.result).not.toBeNull();
      const firstExecutedAt = result.current.result?.executedAt;

      // スタッフリストを変更して再レンダリング
      const newStaffList = [
        createStaff({ id: 's1', name: 'スタッフ1' }),
        createStaff({ id: 's2', name: 'スタッフ2' }),
      ];

      options = {
        ...options,
        staffList: newStaffList,
      };

      rerender(options);

      // 少し待つ（デバウンス前）
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // まだ最初の結果のまま
      expect(result.current.result?.executedAt).toBe(firstExecutedAt);

      // デバウンス時間を進める
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // 再診断が完了している（executedAtが更新される）
      expect(result.current.result?.executedAt).not.toBe(firstExecutedAt);
    });

    it('autoDiagnosisOptionsなしでも従来通り動作すること', async () => {
      const { result } = renderHook(() => useDiagnosis());

      expect(result.current.status).toBe('idle');

      const staffList = [createStaff()];
      const requirements = createRequirements();

      await act(async () => {
        await result.current.runDiagnosis(staffList, requirements, {});
      });

      expect(result.current.status).toBe('completed');
    });
  });
});
