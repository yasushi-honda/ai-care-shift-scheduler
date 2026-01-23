/**
 * rootCauseAnalyzers.ts ユニットテスト
 *
 * テスト対象:
 * - extractAffectedDates: 違反から影響日を抽出
 * - analyzeStaffShortage: スタッフ数不足分析
 * - analyzeTimeSlotConstraint: 時間帯制約分析
 * - analyzeLeaveConcentration: 休暇申請集中分析
 * - analyzeConsecutiveWorkConstraint: 連勤制限分析
 */

import {
  extractAffectedDates,
  analyzeStaffShortage,
  analyzeTimeSlotConstraint,
  analyzeLeaveConcentration,
  analyzeConsecutiveWorkConstraint,
} from '../../src/evaluation/rootCauseAnalyzers';
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
const createStaff = (overrides: Partial<Staff> = {}): Staff => ({
  id: 'staff-001',
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
});

// テスト用ヘルパー: シフト要件作成
const createRequirements = (overrides: Partial<ShiftRequirement> = {}): ShiftRequirement => ({
  targetMonth: '2025-11',
  timeSlots: [
    { name: '早番', start: '07:00', end: '16:00', restHours: 1 },
    { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
    { name: '遅番', start: '11:00', end: '20:00', restHours: 1 },
  ],
  requirements: {
    早番: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
    日勤: { totalStaff: 3, requiredQualifications: [], requiredRoles: [] },
    遅番: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
  },
  ...overrides,
});

// テスト用ヘルパー: 違反作成
const createViolation = (
  type: ConstraintViolation['type'],
  overrides: Partial<ConstraintViolation> = {}
): ConstraintViolation => ({
  type,
  severity: 'error',
  description: `${type}の違反`,
  ...overrides,
});

describe('rootCauseAnalyzers', () => {
  describe('extractAffectedDates', () => {
    it('違反がない場合は空配列を返す', () => {
      const violations: ConstraintViolation[] = [];
      const result = extractAffectedDates(violations);
      expect(result).toEqual([]);
    });

    it('違反から影響日を抽出する', () => {
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage', { affectedDates: ['2025-11-01'] }),
        createViolation('staffShortage', { affectedDates: ['2025-11-02'] }),
      ];
      const result = extractAffectedDates(violations);
      expect(result).toEqual(['2025-11-01', '2025-11-02']);
    });

    it('重複する日付を除外する', () => {
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage', { affectedDates: ['2025-11-01', '2025-11-02'] }),
        createViolation('staffShortage', { affectedDates: ['2025-11-01', '2025-11-03'] }),
      ];
      const result = extractAffectedDates(violations);
      expect(result).toEqual(['2025-11-01', '2025-11-02', '2025-11-03']);
    });

    it('日付をソートして返す', () => {
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage', { affectedDates: ['2025-11-15'] }),
        createViolation('staffShortage', { affectedDates: ['2025-11-01'] }),
        createViolation('staffShortage', { affectedDates: ['2025-11-10'] }),
      ];
      const result = extractAffectedDates(violations);
      expect(result).toEqual(['2025-11-01', '2025-11-10', '2025-11-15']);
    });

    it('affectedDatesがundefinedの違反を処理する', () => {
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage', { affectedDates: undefined }),
        createViolation('staffShortage', { affectedDates: ['2025-11-01'] }),
      ];
      const result = extractAffectedDates(violations);
      expect(result).toEqual(['2025-11-01']);
    });
  });

  describe('analyzeStaffShortage', () => {
    it('人員不足の違反がない場合はnullを返す', () => {
      const violations = [createViolation('consecutiveWork')];
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = analyzeStaffShortage(violations, staffList, requirements);

      expect(result).toBeNull();
    });

    it('絶対的な人員不足を検出する', () => {
      // 必要人員: (2+3+2) * 30日 = 210人日
      // 供給: 1人 * 5日/週 * 4週 = 20人日 → 大幅不足
      const violations = [
        createViolation('staffShortage', { affectedDates: ['2025-11-01'] }),
        createViolation('staffShortage', { affectedDates: ['2025-11-02'] }),
      ];
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = analyzeStaffShortage(violations, staffList, requirements);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('staffShortage');
      expect(result?.description).toContain('絶対的に不足');
      expect(result?.metrics?.shortage).toBeGreaterThan(0);
    });

    it('特定日・時間帯での不足を検出する（全体的には充足）', () => {
      // 十分なスタッフがいるが、特定日に不足が発生するケース
      const violations = [
        createViolation('staffShortage', { affectedDates: ['2025-11-01'] }),
      ];
      // 必要人員を満たすだけのスタッフを作成
      const staffList = Array.from({ length: 20 }, (_, i) =>
        createStaff({ id: `staff-${i}`, name: `スタッフ${i}` })
      );
      const requirements = createRequirements();

      const result = analyzeStaffShortage(violations, staffList, requirements);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('staffShortage');
      expect(result?.description).toContain('特定の日・時間帯');
      expect(result?.metrics?.shortage).toBe(0);
    });

    it('影響度を正しく計算する', () => {
      const violations = [
        createViolation('staffShortage', { affectedDates: ['2025-11-01'] }),
        createViolation('staffShortage', { affectedDates: ['2025-11-02'] }),
        createViolation('staffShortage', { affectedDates: ['2025-11-03'] }),
      ];
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = analyzeStaffShortage(violations, staffList, requirements);

      expect(result).not.toBeNull();
      expect(result?.impact).toBeGreaterThan(0);
    });

    it('必要人員と供給人員を正しく計算する', () => {
      const violations = [createViolation('staffShortage')];
      const staffList = [
        createStaff({ id: 's1', weeklyWorkCount: { hope: 5, must: 4 } }),
        createStaff({ id: 's2', weeklyWorkCount: { hope: 4, must: 3 } }),
      ];
      const requirements = createRequirements();

      const result = analyzeStaffShortage(violations, staffList, requirements);

      expect(result).not.toBeNull();
      expect(result?.metrics?.required).toBeDefined();
      expect(result?.metrics?.available).toBeDefined();
    });
  });

  describe('analyzeTimeSlotConstraint', () => {
    it('人員不足の違反がない場合はnullを返す', () => {
      const violations = [createViolation('consecutiveWork')];
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = analyzeTimeSlotConstraint(violations, staffList, requirements);

      expect(result).toBeNull();
    });

    it('時間帯制約のあるスタッフがいない場合はnullを返す', () => {
      const violations = [createViolation('staffShortage')];
      const staffList = [
        createStaff({ timeSlotPreference: TimeSlotPreference.Any }),
      ];
      const requirements = createRequirements();

      const result = analyzeTimeSlotConstraint(violations, staffList, requirements);

      expect(result).toBeNull();
    });

    it('早番・遅番の違反がない場合はnullを返す', () => {
      const violations = [
        createViolation('staffShortage', { description: '日勤で人員不足' }),
      ];
      const staffList = [
        createStaff({ timeSlotPreference: TimeSlotPreference.DayOnly }),
      ];
      const requirements = createRequirements();

      const result = analyzeTimeSlotConstraint(violations, staffList, requirements);

      expect(result).toBeNull();
    });

    it('日勤のみスタッフによる早番不足を検出する', () => {
      const violations = [
        createViolation('staffShortage', {
          description: '2025-11-01の早番で人員不足',
          affectedDates: ['2025-11-01'],
        }),
      ];
      const staffList = [
        createStaff({ id: 's1', name: '山田太郎', timeSlotPreference: TimeSlotPreference.DayOnly }),
        createStaff({ id: 's2', name: '佐藤花子', timeSlotPreference: TimeSlotPreference.DayOnly }),
      ];
      const requirements = createRequirements();

      const result = analyzeTimeSlotConstraint(violations, staffList, requirements);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('timeSlotConstraint');
      expect(result?.description).toContain('日勤のみ');
      expect(result?.affectedStaff).toContain('山田太郎');
      expect(result?.affectedStaff).toContain('佐藤花子');
    });

    it('日勤のみスタッフによる遅番不足を検出する', () => {
      const violations = [
        createViolation('staffShortage', {
          description: '2025-11-01の遅番で人員不足',
          affectedDates: ['2025-11-01'],
        }),
      ];
      const staffList = [
        createStaff({ id: 's1', name: '田中一郎', timeSlotPreference: TimeSlotPreference.DayOnly }),
      ];
      const requirements = createRequirements();

      const result = analyzeTimeSlotConstraint(violations, staffList, requirements);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('timeSlotConstraint');
      expect(result?.description).toContain('日勤のみ');
    });

    it('日勤のみスタッフの人数をmetricsに含める', () => {
      const violations = [
        createViolation('staffShortage', { description: '早番で人員不足' }),
      ];
      const staffList = [
        createStaff({ id: 's1', timeSlotPreference: TimeSlotPreference.DayOnly }),
        createStaff({ id: 's2', timeSlotPreference: TimeSlotPreference.DayOnly }),
        createStaff({ id: 's3', timeSlotPreference: TimeSlotPreference.Any }),
      ];
      const requirements = createRequirements();

      const result = analyzeTimeSlotConstraint(violations, staffList, requirements);

      expect(result).not.toBeNull();
      expect(result?.metrics?.shortage).toBe(2); // 日勤のみスタッフ2名
      expect(result?.metrics?.available).toBe(1); // 制限なしスタッフ1名
    });
  });

  describe('analyzeLeaveConcentration', () => {
    it('休暇申請がない場合はnullを返す', () => {
      const violations = [createViolation('staffShortage')];
      const staffList = [createStaff()];
      const leaveRequests: LeaveRequest = {};

      const result = analyzeLeaveConcentration(violations, staffList, leaveRequests);

      expect(result).toBeNull();
    });

    it('集中していない場合はnullを返す（閾値未満）', () => {
      const violations = [
        createViolation('staffShortage', { affectedDates: ['2025-11-01'] }),
      ];
      // 10人のスタッフで1人が休暇 → 10% < 30%閾値
      const staffList = Array.from({ length: 10 }, (_, i) =>
        createStaff({ id: `staff-${i}`, name: `スタッフ${i}` })
      );
      const leaveRequests: LeaveRequest = {
        'staff-0': { '2025-11-01': LeaveType.PaidLeave },
      };

      const result = analyzeLeaveConcentration(violations, staffList, leaveRequests);

      expect(result).toBeNull();
    });

    it('休暇が集中している場合を検出する（30%以上）', () => {
      const violations = [
        createViolation('staffShortage', { affectedDates: ['2025-11-10'] }),
      ];
      // 3人のスタッフ中3人が同日に休暇 → 100% >= 30%閾値
      const staffList = [
        createStaff({ id: 's1', name: 'スタッフ1' }),
        createStaff({ id: 's2', name: 'スタッフ2' }),
        createStaff({ id: 's3', name: 'スタッフ3' }),
      ];
      const leaveRequests: LeaveRequest = {
        's1': { '2025-11-10': LeaveType.PaidLeave },
        's2': { '2025-11-10': LeaveType.Hope },
        's3': { '2025-11-10': LeaveType.PaidLeave },
      };

      const result = analyzeLeaveConcentration(violations, staffList, leaveRequests);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('leaveConcentration');
      expect(result?.affectedDates).toContain('2025-11-10');
    });

    it('違反日と休暇集中日が一致しない場合はnullを返す', () => {
      const violations = [
        createViolation('staffShortage', { affectedDates: ['2025-11-15'] }),
      ];
      // 休暇集中は11/10だが、違反は11/15
      const staffList = [
        createStaff({ id: 's1', name: 'スタッフ1' }),
        createStaff({ id: 's2', name: 'スタッフ2' }),
        createStaff({ id: 's3', name: 'スタッフ3' }),
      ];
      const leaveRequests: LeaveRequest = {
        's1': { '2025-11-10': LeaveType.PaidLeave },
        's2': { '2025-11-10': LeaveType.Hope },
        's3': { '2025-11-10': LeaveType.PaidLeave },
      };

      const result = analyzeLeaveConcentration(violations, staffList, leaveRequests);

      expect(result).toBeNull();
    });

    it('影響を受けるスタッフ名を含める', () => {
      const violations = [
        createViolation('staffShortage', { affectedDates: ['2025-11-10'] }),
      ];
      const staffList = [
        createStaff({ id: 's1', name: '山田太郎' }),
        createStaff({ id: 's2', name: '佐藤花子' }),
        createStaff({ id: 's3', name: '田中一郎' }),
      ];
      const leaveRequests: LeaveRequest = {
        's1': { '2025-11-10': LeaveType.PaidLeave },
        's2': { '2025-11-10': LeaveType.Hope },
        's3': { '2025-11-10': LeaveType.PaidLeave },
      };

      const result = analyzeLeaveConcentration(violations, staffList, leaveRequests);

      expect(result).not.toBeNull();
      expect(result?.affectedStaff).toContain('山田太郎');
      expect(result?.affectedStaff).toContain('佐藤花子');
      expect(result?.affectedStaff).toContain('田中一郎');
    });

    it('複数日の集中を検出する', () => {
      const violations = [
        createViolation('staffShortage', { affectedDates: ['2025-11-10', '2025-11-20'] }),
      ];
      const staffList = [
        createStaff({ id: 's1', name: 'スタッフ1' }),
        createStaff({ id: 's2', name: 'スタッフ2' }),
        createStaff({ id: 's3', name: 'スタッフ3' }),
      ];
      const leaveRequests: LeaveRequest = {
        's1': { '2025-11-10': LeaveType.PaidLeave, '2025-11-20': LeaveType.Hope },
        's2': { '2025-11-10': LeaveType.Hope, '2025-11-20': LeaveType.PaidLeave },
        's3': { '2025-11-10': LeaveType.PaidLeave, '2025-11-20': LeaveType.Hope },
      };

      const result = analyzeLeaveConcentration(violations, staffList, leaveRequests);

      expect(result).not.toBeNull();
      expect(result?.affectedDates?.length).toBe(2);
      expect(result?.description).toContain('2日');
    });
  });

  describe('analyzeConsecutiveWorkConstraint', () => {
    it('連勤違反がない場合はnullを返す', () => {
      const violations = [createViolation('staffShortage')];

      const result = analyzeConsecutiveWorkConstraint(violations);

      expect(result).toBeNull();
    });

    it('連勤違反を検出する', () => {
      const violations = [
        createViolation('consecutiveWork', {
          affectedStaff: ['staff-001'],
          affectedDates: ['2025-11-01', '2025-11-06'],
        }),
      ];

      const result = analyzeConsecutiveWorkConstraint(violations);

      expect(result).not.toBeNull();
      expect(result?.category).toBe('consecutiveWork');
      expect(result?.affectedStaff).toContain('staff-001');
    });

    it('複数スタッフの連勤違反を集約する', () => {
      const violations = [
        createViolation('consecutiveWork', {
          affectedStaff: ['staff-001'],
          affectedDates: ['2025-11-01', '2025-11-06'],
        }),
        createViolation('consecutiveWork', {
          affectedStaff: ['staff-002'],
          affectedDates: ['2025-11-10', '2025-11-15'],
        }),
      ];

      const result = analyzeConsecutiveWorkConstraint(violations);

      expect(result).not.toBeNull();
      expect(result?.description).toContain('2名');
      expect(result?.affectedStaff).toContain('staff-001');
      expect(result?.affectedStaff).toContain('staff-002');
    });

    it('同じスタッフの重複を除外する', () => {
      const violations = [
        createViolation('consecutiveWork', {
          affectedStaff: ['staff-001'],
          affectedDates: ['2025-11-01', '2025-11-06'],
        }),
        createViolation('consecutiveWork', {
          affectedStaff: ['staff-001'], // 同じスタッフ
          affectedDates: ['2025-11-10', '2025-11-15'],
        }),
      ];

      const result = analyzeConsecutiveWorkConstraint(violations);

      expect(result).not.toBeNull();
      expect(result?.description).toContain('1名');
      expect(result?.affectedStaff?.length).toBe(1);
    });

    it('影響度を違反件数で計算する', () => {
      const violations = [
        createViolation('consecutiveWork', { affectedStaff: ['s1'] }),
        createViolation('consecutiveWork', { affectedStaff: ['s2'] }),
        createViolation('consecutiveWork', { affectedStaff: ['s3'] }),
      ];

      const result = analyzeConsecutiveWorkConstraint(violations);

      expect(result).not.toBeNull();
      expect(result?.impact).toBe(3);
    });

    it('affectedStaffがundefinedの違反を処理する', () => {
      const violations = [
        createViolation('consecutiveWork', { affectedStaff: undefined }),
      ];

      const result = analyzeConsecutiveWorkConstraint(violations);

      expect(result).not.toBeNull();
      expect(result?.affectedStaff).toEqual([]);
    });
  });
});
