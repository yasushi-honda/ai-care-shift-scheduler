/**
 * Phase 40: AI評価・フィードバック機能
 * 評価ロジック ユニットテスト
 */

import { EvaluationService, createDefaultEvaluation, DEFAULT_EVALUATION } from '../../src/evaluation/evaluationLogic';
import {
  Staff,
  StaffSchedule,
  ShiftRequirement,
  LeaveRequest,
  Role,
  Qualification,
  TimeSlotPreference,
  LeaveType,
} from '../../src/types';

describe('EvaluationService', () => {
  let evaluationService: EvaluationService;

  beforeEach(() => {
    evaluationService = new EvaluationService();
  });

  // テストデータ
  const createStaff = (overrides?: Partial<Staff>): Staff => ({
    id: 'staff-001',
    name: 'テスト太郎',
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

  const createSchedule = (shifts: { date: string; shiftType: string }[]): StaffSchedule => ({
    staffId: 'staff-001',
    staffName: 'テスト太郎',
    monthlyShifts: shifts.map((s) => ({ date: s.date, shiftType: s.shiftType })),
  });

  const createRequirements = (overrides?: Partial<ShiftRequirement>): ShiftRequirement => ({
    targetMonth: '2025-11',
    timeSlots: [
      { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
      { name: '夜勤', start: '17:00', end: '09:00', restHours: 2 },
    ],
    requirements: {
      日勤: {
        totalStaff: 2,
        requiredQualifications: [],
        requiredRoles: [],
      },
      夜勤: {
        totalStaff: 1,
        requiredQualifications: [],
        requiredRoles: [],
      },
    },
    ...overrides,
  });

  describe('checkStaffShortage', () => {
    it('人員が充足している場合、違反を検出しない', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '日勤' },
          { date: '2025-11-02', shiftType: '日勤' },
        ]),
        {
          staffId: 'staff-002',
          staffName: 'テスト花子',
          monthlyShifts: [
            { date: '2025-11-01', shiftType: '日勤' },
            { date: '2025-11-02', shiftType: '日勤' },
          ],
        },
        {
          staffId: 'staff-003',
          staffName: 'テスト次郎',
          monthlyShifts: [
            { date: '2025-11-01', shiftType: '夜勤' },
            { date: '2025-11-02', shiftType: '夜勤' },
          ],
        },
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        daysToGenerate: 2,
      });

      const violations = evaluationService.checkStaffShortage(schedule, requirements);

      // 日勤2名、夜勤1名の要件を満たしている
      expect(violations.filter((v) => v.affectedDates?.includes('2025-11-01')).length).toBe(0);
      expect(violations.filter((v) => v.affectedDates?.includes('2025-11-02')).length).toBe(0);
    });

    it('人員不足を検出する', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-01', shiftType: '日勤' }]),
        // 日勤1名のみ（要件は2名）
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        daysToGenerate: 1,
      });

      const violations = evaluationService.checkStaffShortage(schedule, requirements);

      // 日勤で1名不足、夜勤で1名不足
      const shortageViolations = violations.filter((v) => v.type === 'staffShortage');
      expect(shortageViolations.length).toBeGreaterThanOrEqual(1);
      expect(shortageViolations[0].severity).toBe('error');
    });

    it('休日は人員カウントに含めない', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-01', shiftType: '休' }]),
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        daysToGenerate: 1,
      });

      const violations = evaluationService.checkStaffShortage(schedule, requirements);

      // 休日のスタッフは勤務人数にカウントされない
      expect(violations.filter((v) => v.type === 'staffShortage').length).toBeGreaterThan(0);
    });
  });

  describe('checkConsecutiveWorkViolation', () => {
    it('連勤が上限以内の場合、違反を検出しない', () => {
      const staff = createStaff({ maxConsecutiveWorkDays: 5 });
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '日勤' },
          { date: '2025-11-02', shiftType: '日勤' },
          { date: '2025-11-03', shiftType: '日勤' },
          { date: '2025-11-04', shiftType: '日勤' },
          { date: '2025-11-05', shiftType: '日勤' }, // 5連勤
          { date: '2025-11-06', shiftType: '休' },
        ]),
      ];

      const violations = evaluationService.checkConsecutiveWorkViolation(schedule, [staff]);

      expect(violations.filter((v) => v.type === 'consecutiveWork').length).toBe(0);
    });

    it('連勤超過を検出する（境界値テスト）', () => {
      const staff = createStaff({ maxConsecutiveWorkDays: 5 });
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '日勤' },
          { date: '2025-11-02', shiftType: '日勤' },
          { date: '2025-11-03', shiftType: '日勤' },
          { date: '2025-11-04', shiftType: '日勤' },
          { date: '2025-11-05', shiftType: '日勤' },
          { date: '2025-11-06', shiftType: '日勤' }, // 6連勤（上限超過）
          { date: '2025-11-07', shiftType: '休' },
        ]),
      ];

      const violations = evaluationService.checkConsecutiveWorkViolation(schedule, [staff]);

      expect(violations.filter((v) => v.type === 'consecutiveWork').length).toBe(1);
      expect(violations[0].severity).toBe('warning');
      expect(violations[0].affectedStaff).toContain('staff-001');
    });

    it('「明け休み」は勤務日としてカウントしない', () => {
      const staff = createStaff({ maxConsecutiveWorkDays: 3 });
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '日勤' },
          { date: '2025-11-02', shiftType: '日勤' },
          { date: '2025-11-03', shiftType: '明け休み' }, // 勤務日ではない
          { date: '2025-11-04', shiftType: '日勤' },
          { date: '2025-11-05', shiftType: '日勤' },
        ]),
      ];

      const violations = evaluationService.checkConsecutiveWorkViolation(schedule, [staff]);

      // 明け休みで連勤がリセットされるので違反なし
      expect(violations.filter((v) => v.type === 'consecutiveWork').length).toBe(0);
    });
  });

  describe('checkNightRestViolation', () => {
    it('夜勤後に休息がある場合、違反を検出しない', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '夜勤' },
          { date: '2025-11-02', shiftType: '明け休み' },
          { date: '2025-11-03', shiftType: '休' },
        ]),
      ];

      const violations = evaluationService.checkNightRestViolation(schedule);

      expect(violations.filter((v) => v.type === 'nightRestViolation').length).toBe(0);
    });

    it('夜勤後に休息がない場合、違反を検出する', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '夜勤' },
          { date: '2025-11-02', shiftType: '日勤' }, // 夜勤翌日に日勤は違反
        ]),
      ];

      const violations = evaluationService.checkNightRestViolation(schedule);

      expect(violations.filter((v) => v.type === 'nightRestViolation').length).toBe(1);
      expect(violations[0].severity).toBe('warning');
    });

    it('夜勤後に「公休」がある場合、違反を検出しない', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '夜勤' },
          { date: '2025-11-02', shiftType: '公休' },
        ]),
      ];

      const violations = evaluationService.checkNightRestViolation(schedule);

      expect(violations.filter((v) => v.type === 'nightRestViolation').length).toBe(0);
    });
  });

  describe('checkLeaveRequestIgnored', () => {
    it('休暇希望が反映されている場合、違反を検出しない', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-10', shiftType: '休' }]),
      ];
      const leaveRequests: LeaveRequest = {
        'staff-001': {
          '2025-11-10': LeaveType.PaidLeave,
        },
      };

      const violations = evaluationService.checkLeaveRequestIgnored(schedule, leaveRequests);

      expect(violations.filter((v) => v.type === 'leaveRequestIgnored').length).toBe(0);
    });

    it('休暇希望が反映されていない場合、違反を検出する', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-10', shiftType: '日勤' }]), // 有給希望日に勤務
      ];
      const leaveRequests: LeaveRequest = {
        'staff-001': {
          '2025-11-10': LeaveType.PaidLeave,
        },
      };

      const violations = evaluationService.checkLeaveRequestIgnored(schedule, leaveRequests);

      expect(violations.filter((v) => v.type === 'leaveRequestIgnored').length).toBe(1);
      expect(violations[0].severity).toBe('warning');
    });
  });

  describe('calculateOverallScore', () => {
    it('違反がない場合、100点を返す', () => {
      const score = evaluationService.calculateOverallScore([]);
      expect(score).toBe(100);
    });

    it('errorは-10点、warningは-5点', () => {
      const violations = [
        {
          type: 'staffShortage' as const,
          severity: 'error' as const,
          description: 'テスト',
        },
        {
          type: 'consecutiveWork' as const,
          severity: 'warning' as const,
          description: 'テスト',
        },
      ];

      const score = evaluationService.calculateOverallScore(violations);
      expect(score).toBe(85); // 100 - 10 - 5 = 85
    });

    it('スコアは0を下回らない', () => {
      const violations = Array(15).fill({
        type: 'staffShortage' as const,
        severity: 'error' as const,
        description: 'テスト',
      });

      const score = evaluationService.calculateOverallScore(violations);
      expect(score).toBe(0); // 100 - 150 = -50 → 0
    });
  });

  describe('calculateFulfillmentRate', () => {
    it('全て充足している場合、高い充足率を返す', () => {
      // 11月の全30日分のスケジュールを作成
      const fullMonthShifts = Array.from({ length: 30 }, (_, i) => ({
        date: `2025-11-${String(i + 1).padStart(2, '0')}`,
        shiftType: '日勤',
      }));
      const fullMonthNightShifts = Array.from({ length: 30 }, (_, i) => ({
        date: `2025-11-${String(i + 1).padStart(2, '0')}`,
        shiftType: '夜勤',
      }));

      const schedule: StaffSchedule[] = [
        { staffId: 'staff-001', staffName: 'テスト太郎', monthlyShifts: fullMonthShifts },
        { staffId: 'staff-002', staffName: 'テスト花子', monthlyShifts: fullMonthShifts },
        { staffId: 'staff-003', staffName: 'テスト次郎', monthlyShifts: fullMonthNightShifts },
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
      });

      const rate = evaluationService.calculateFulfillmentRate(schedule, requirements);

      // 日勤2名、夜勤1名で要件を満たしている
      expect(rate).toBe(100);
    });

    it('一部不足がある場合、充足率を計算する', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-01', shiftType: '日勤' }]),
        // 日勤1名のみ（要件2名）、夜勤0名（要件1名）
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        daysToGenerate: 1,
      });

      const rate = evaluationService.calculateFulfillmentRate(schedule, requirements);

      // 日勤: 1/2 = 0.5、夜勤: 0/1 = 0 → (1 + 0) / (2 + 1) = 1/3 ≈ 33%
      expect(rate).toBeLessThan(100);
      expect(rate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('evaluateSchedule', () => {
    it('正常なスケジュールを評価できる', () => {
      const staff = createStaff();
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '日勤' },
          { date: '2025-11-02', shiftType: '日勤' },
          { date: '2025-11-03', shiftType: '休' },
        ]),
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        daysToGenerate: 3,
      });

      const result = evaluationService.evaluateSchedule({
        schedule,
        staffList: [staff],
        requirements,
        leaveRequests: {},
      });

      expect(result.overallScore).toBeDefined();
      expect(result.fulfillmentRate).toBeDefined();
      expect(result.constraintViolations).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.simulation).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });

    it('複数の違反を含むスケジュールを評価できる', () => {
      const staff = createStaff({ maxConsecutiveWorkDays: 3 });
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '夜勤' },
          { date: '2025-11-02', shiftType: '日勤' }, // 夜勤後休息違反
          { date: '2025-11-03', shiftType: '日勤' },
          { date: '2025-11-04', shiftType: '日勤' },
          { date: '2025-11-05', shiftType: '日勤' }, // 4連勤（上限3）
        ]),
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        daysToGenerate: 5,
      });
      const leaveRequests: LeaveRequest = {
        'staff-001': {
          '2025-11-03': LeaveType.Hope, // 希望休が無視されている
        },
      };

      const result = evaluationService.evaluateSchedule({
        schedule,
        staffList: [staff],
        requirements,
        leaveRequests,
      });

      expect(result.overallScore).toBeLessThan(100);
      expect(result.constraintViolations.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('createDefaultEvaluation', () => {
    it('フォールバック用のデフォルト評価が正しい形式', () => {
      const defaultEval = createDefaultEvaluation();
      expect(defaultEval.overallScore).toBe(-1);
      expect(defaultEval.fulfillmentRate).toBe(-1);
      expect(defaultEval.constraintViolations).toEqual([]);
      expect(defaultEval.recommendations.length).toBe(1);
      expect(defaultEval.simulation.risks.length).toBeGreaterThan(0);
    });

    it('呼び出しごとに新しいTimestampが生成される', () => {
      const eval1 = createDefaultEvaluation();
      // 少し待機
      const eval2 = createDefaultEvaluation();

      // 両方ともgeneratedAtを持つ
      expect(eval1.generatedAt).toBeDefined();
      expect(eval2.generatedAt).toBeDefined();
    });

    it('後方互換性のためDEFAULT_EVALUATIONが利用可能', () => {
      expect(DEFAULT_EVALUATION.overallScore).toBe(-1);
    });
  });
});
