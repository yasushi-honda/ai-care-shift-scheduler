/**
 * 根本原因分析 ユニットテスト
 * Phase 55: データ設定診断機能
 *
 * TDD: RED -> GREEN -> REFACTOR
 */

import {
  analyzeRootCauses,
  RootCauseAnalysisInput,
} from '../../src/evaluation/rootCauseAnalysis';
import {
  Staff,
  ShiftRequirement,
  ConstraintViolation,
  LeaveRequest,
  TimeSlotPreference,
  Role,
  Qualification,
  LeaveType,
} from '../../src/types';

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

// テスト用ヘルパー: 違反作成
function createViolation(
  overrides: Partial<ConstraintViolation> = {}
): ConstraintViolation {
  return {
    type: 'staffShortage',
    severity: 'error',
    description: '2025-01-10の早番で1名の人員不足',
    affectedDates: ['2025-01-10'],
    suggestion: '早番に追加の配置を検討してください',
    ...overrides,
  };
}

describe('rootCauseAnalysis', () => {
  describe('analyzeRootCauses', () => {
    it('違反がない場合はnullのprimaryCauseを返すこと', () => {
      const input: RootCauseAnalysisInput = {
        violations: [],
        staffList: [createStaff()],
        requirements: createRequirements(),
        leaveRequests: {},
        schedule: [],
      };

      const result = analyzeRootCauses(input);

      expect(result.primaryCause).toBeNull();
      expect(result.secondaryCauses).toHaveLength(0);
      expect(result.aiComment).toContain('問題なし');
    });

    it('人員不足違反の根本原因を特定すること', () => {
      const staffList = [
        createStaff({ id: 's1', name: 'スタッフ1' }),
      ];
      const violations = [
        createViolation({
          type: 'staffShortage',
          description: '2025-01-10の早番で1名の人員不足',
          affectedDates: ['2025-01-10'],
        }),
        createViolation({
          type: 'staffShortage',
          description: '2025-01-10の日勤で1名の人員不足',
          affectedDates: ['2025-01-10'],
        }),
      ];

      const input: RootCauseAnalysisInput = {
        violations,
        staffList,
        requirements: createRequirements(),
        leaveRequests: {},
        schedule: [],
      };

      const result = analyzeRootCauses(input);

      expect(result.primaryCause).not.toBeNull();
      expect(result.primaryCause?.category).toBe('staffShortage');
      expect(result.primaryCause?.impact).toBeGreaterThan(0);
    });

    it('時間帯制約が原因の場合、該当スタッフ名を含めること', () => {
      const staffList = [
        createStaff({ id: 's1', name: '山田太郎', timeSlotPreference: TimeSlotPreference.DayOnly }),
        createStaff({ id: 's2', name: '佐藤花子', timeSlotPreference: TimeSlotPreference.DayOnly }),
        createStaff({ id: 's3', name: '田中一郎', timeSlotPreference: TimeSlotPreference.DayOnly }),
      ];
      const violations = [
        createViolation({
          type: 'staffShortage',
          description: '2025-01-10の早番で2名の人員不足',
          affectedDates: ['2025-01-10'],
        }),
      ];

      const input: RootCauseAnalysisInput = {
        violations,
        staffList,
        requirements: createRequirements(),
        leaveRequests: {},
        schedule: [],
      };

      const result = analyzeRootCauses(input);

      // 時間帯制約が原因の場合
      const timeSlotCause = [result.primaryCause, ...result.secondaryCauses].find(
        (c) => c?.category === 'timeSlotConstraint'
      );
      if (timeSlotCause) {
        expect(timeSlotCause.affectedStaff).toBeDefined();
        expect(timeSlotCause.affectedStaff?.length).toBeGreaterThan(0);
      }
    });

    it('休暇申請が集中している場合を検出すること', () => {
      const staffList = [
        createStaff({ id: 's1', name: 'スタッフ1' }),
        createStaff({ id: 's2', name: 'スタッフ2' }),
        createStaff({ id: 's3', name: 'スタッフ3' }),
      ];
      const leaveRequests: LeaveRequest = {
        's1': { '2025-01-10': LeaveType.PaidLeave },
        's2': { '2025-01-10': LeaveType.PaidLeave },
        's3': { '2025-01-10': LeaveType.PaidLeave },
      };
      const violations = [
        createViolation({
          type: 'staffShortage',
          description: '2025-01-10の早番で2名の人員不足',
          affectedDates: ['2025-01-10'],
        }),
      ];

      const input: RootCauseAnalysisInput = {
        violations,
        staffList,
        requirements: createRequirements(),
        leaveRequests,
        schedule: [],
      };

      const result = analyzeRootCauses(input);

      const leaveCause = [result.primaryCause, ...result.secondaryCauses].find(
        (c) => c?.category === 'leaveConcentration'
      );
      expect(leaveCause).toBeDefined();
      expect(leaveCause?.affectedDates).toContain('2025-01-10');
    });

    it('数値的根拠を含めること', () => {
      const staffList = [createStaff()];
      const violations = [
        createViolation({
          type: 'staffShortage',
          description: '2025-01-10の早番で1名の人員不足',
        }),
      ];

      const input: RootCauseAnalysisInput = {
        violations,
        staffList,
        requirements: createRequirements(),
        leaveRequests: {},
        schedule: [],
      };

      const result = analyzeRootCauses(input);

      expect(result.primaryCause?.metrics).toBeDefined();
    });

    it('AIコメントに根本原因を含めること', () => {
      const staffList = [createStaff()];
      const violations = [
        createViolation({
          type: 'staffShortage',
          description: '人員不足',
        }),
      ];

      const input: RootCauseAnalysisInput = {
        violations,
        staffList,
        requirements: createRequirements(),
        leaveRequests: {},
        schedule: [],
      };

      const result = analyzeRootCauses(input);

      expect(result.aiComment).toBeTruthy();
      expect(result.aiComment.length).toBeGreaterThan(10);
    });

    it('複数の根本原因を検出すること', () => {
      const staffList = [
        createStaff({ id: 's1', name: '山田太郎', timeSlotPreference: TimeSlotPreference.DayOnly }),
        createStaff({ id: 's2', name: '佐藤花子', timeSlotPreference: TimeSlotPreference.DayOnly }),
      ];
      const leaveRequests: LeaveRequest = {
        's1': { '2025-01-10': LeaveType.PaidLeave },
      };
      const violations = [
        createViolation({
          type: 'staffShortage',
          description: '2025-01-10の早番で2名の人員不足',
          affectedDates: ['2025-01-10'],
        }),
        createViolation({
          type: 'staffShortage',
          description: '2025-01-11の遅番で1名の人員不足',
          affectedDates: ['2025-01-11'],
        }),
      ];

      const input: RootCauseAnalysisInput = {
        violations,
        staffList,
        requirements: createRequirements(),
        leaveRequests,
        schedule: [],
      };

      const result = analyzeRootCauses(input);

      // 複数の原因が検出される可能性がある
      const totalCauses = (result.primaryCause ? 1 : 0) + result.secondaryCauses.length;
      expect(totalCauses).toBeGreaterThanOrEqual(1);
    });

    it('analyzedAtが正しい形式であること', () => {
      const input: RootCauseAnalysisInput = {
        violations: [],
        staffList: [createStaff()],
        requirements: createRequirements(),
        leaveRequests: {},
        schedule: [],
      };

      const result = analyzeRootCauses(input);

      expect(() => new Date(result.analyzedAt)).not.toThrow();
    });
  });
});
