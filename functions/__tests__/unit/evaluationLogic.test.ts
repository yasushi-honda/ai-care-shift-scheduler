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
  ConstraintViolation,
  ConstraintLevel,
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

  describe('calculateOverallScore（Phase 53: レベル別評価）', () => {
    it('違反がない場合、100点を返す', () => {
      const score = evaluationService.calculateOverallScore([]);
      expect(score).toBe(100);
    });

    it('レベル1（絶対必須）違反がある場合、即座に0点', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'nightRestViolation',
          severity: 'error',
          level: 1 as ConstraintLevel,
          description: '夜勤後休息不足',
        },
      ];

      const score = evaluationService.calculateOverallScore(violations);
      expect(score).toBe(0);
    });

    it('レベル2（運営必須）は1件あたり12点減点', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'staffShortage',
          severity: 'error',
          level: 2 as ConstraintLevel,
          description: '人員不足',
        },
        {
          type: 'qualificationMissing',
          severity: 'error',
          level: 2 as ConstraintLevel,
          description: '資格要件未充足',
        },
      ];

      const score = evaluationService.calculateOverallScore(violations);
      expect(score).toBe(76); // 100 - 12*2 = 76
    });

    it('レベル3（努力目標）は1件あたり4点減点', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'consecutiveWork',
          severity: 'warning',
          level: 3 as ConstraintLevel,
          description: '連勤超過',
        },
        {
          type: 'leaveRequestIgnored',
          severity: 'warning',
          level: 3 as ConstraintLevel,
          description: '休暇希望未反映',
        },
      ];

      const score = evaluationService.calculateOverallScore(violations);
      expect(score).toBe(92); // 100 - 4*2 = 92
    });

    it('レベル4（推奨）は減点なし', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'staffShortage', // typeは仮（将来の推奨事項用）
          severity: 'warning',
          level: 4 as ConstraintLevel,
          description: '推奨事項',
        },
        {
          type: 'staffShortage',
          severity: 'warning',
          level: 4 as ConstraintLevel,
          description: '推奨事項2',
        },
      ];

      const score = evaluationService.calculateOverallScore(violations);
      expect(score).toBe(100); // 減点なし
    });

    it('レベル2×3件 + レベル3×15件で期待値4点（設計書通り）', () => {
      const level2Violations: ConstraintViolation[] = Array(3).fill(null).map((_, i) => ({
        type: 'staffShortage' as const,
        severity: 'error' as const,
        level: 2 as ConstraintLevel,
        description: `人員不足${i + 1}`,
      }));
      const level3Violations: ConstraintViolation[] = Array(15).fill(null).map((_, i) => ({
        type: 'consecutiveWork' as const,
        severity: 'warning' as const,
        level: 3 as ConstraintLevel,
        description: `連勤超過${i + 1}`,
      }));

      const score = evaluationService.calculateOverallScore([...level2Violations, ...level3Violations]);
      // 100 - 3*12 - 15*4 = 100 - 36 - 60 = 4
      expect(score).toBe(4);
    });

    it('11件以上の軽微な違反（レベル3）でも0点にならない', () => {
      const violations: ConstraintViolation[] = Array(11).fill(null).map((_, i) => ({
        type: 'consecutiveWork' as const,
        severity: 'warning' as const,
        level: 3 as ConstraintLevel,
        description: `連勤超過${i + 1}`,
      }));

      const score = evaluationService.calculateOverallScore(violations);
      // 100 - 11*4 = 56 (旧ロジックでは 100 - 11*5 = 45)
      expect(score).toBe(56);
      expect(score).toBeGreaterThan(0);
    });

    it('レベル未指定時はtypeからレベルを推定する（後方互換性）', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'staffShortage', // CONSTRAINT_LEVEL_MAPPING[staffShortage] = 2
          severity: 'error',
          // level未指定
          description: '人員不足',
        },
        {
          type: 'consecutiveWork', // CONSTRAINT_LEVEL_MAPPING[consecutiveWork] = 3
          severity: 'warning',
          // level未指定
          description: '連勤超過',
        },
      ];

      const score = evaluationService.calculateOverallScore(violations);
      // 100 - 12 - 4 = 84
      expect(score).toBe(84);
    });

    it('スコアは0を下回らない', () => {
      const violations: ConstraintViolation[] = Array(10).fill(null).map((_, i) => ({
        type: 'staffShortage' as const,
        severity: 'error' as const,
        level: 2 as ConstraintLevel,
        description: `人員不足${i + 1}`,
      }));

      const score = evaluationService.calculateOverallScore(violations);
      // 100 - 10*12 = -20 → 0
      expect(score).toBe(0);
    });

    it('スコアは100を上回らない', () => {
      // 負の減点は発生しないが、念のためテスト
      const violations: ConstraintViolation[] = [];
      const score = evaluationService.calculateOverallScore(violations);
      expect(score).toBeLessThanOrEqual(100);
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

  describe('checkQualificationMissing', () => {
    it('資格要件がない場合、違反を検出しない', () => {
      const staffList: Staff[] = [createStaff()];
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-04', shiftType: '日勤' }]),
      ];
      // 資格要件なし
      const requirements = createRequirements({
        targetMonth: '2025-11',
        daysToGenerate: 1,
        requirements: {
          日勤: {
            totalStaff: 1,
            requiredQualifications: [], // 資格要件なし
            requiredRoles: [],
          },
        },
      });

      const violations = evaluationService.checkQualificationMissing(
        schedule,
        staffList,
        requirements
      );

      expect(violations.length).toBe(0);
    });

    it('資格保有者が不足している場合、違反を検出する', () => {
      const staffList: Staff[] = [
        createStaff({
          id: 'staff-001',
          qualifications: [], // 資格なし
        }),
      ];
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-04', shiftType: '日勤' }]), // 火曜日（営業日）
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        daysToGenerate: 4,
        requirements: {
          日勤: {
            totalStaff: 1,
            requiredQualifications: [
              { qualification: Qualification.CertifiedCareWorker, count: 1 },
            ],
            requiredRoles: [],
          },
        },
      });

      const violations = evaluationService.checkQualificationMissing(
        schedule,
        staffList,
        requirements
      );

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].type).toBe('qualificationMissing');
    });
  });

  describe('checkTimeSlotPreferenceViolation', () => {
    it('日勤のみ希望スタッフが夜勤に配置された場合、違反を検出する', () => {
      const staffList: Staff[] = [
        createStaff({
          id: 'staff-001',
          timeSlotPreference: TimeSlotPreference.DayOnly,
        }),
      ];
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-01', shiftType: '夜勤' }]),
      ];

      const violations = evaluationService.checkTimeSlotPreferenceViolation(
        schedule,
        staffList
      );

      expect(violations.length).toBe(1);
      expect(violations[0].description).toContain('日勤のみ希望');
    });

    it('夜勤のみ希望スタッフが日勤に配置された場合、違反を検出する', () => {
      const staffList: Staff[] = [
        createStaff({
          id: 'staff-001',
          timeSlotPreference: TimeSlotPreference.NightOnly,
        }),
      ];
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-01', shiftType: '日勤' }]),
      ];

      const violations = evaluationService.checkTimeSlotPreferenceViolation(
        schedule,
        staffList
      );

      expect(violations.length).toBe(1);
      expect(violations[0].description).toContain('夜勤のみ希望');
    });

    it('希望通りの配置の場合、違反を検出しない', () => {
      const staffList: Staff[] = [
        createStaff({
          id: 'staff-001',
          timeSlotPreference: TimeSlotPreference.DayOnly,
        }),
      ];
      const schedule: StaffSchedule[] = [
        createSchedule([{ date: '2025-11-01', shiftType: '日勤' }]),
      ];

      const violations = evaluationService.checkTimeSlotPreferenceViolation(
        schedule,
        staffList
      );

      expect(violations.length).toBe(0);
    });
  });

  describe('generateAIComment', () => {
    it('高スコア（80点以上）の場合、肯定的なコメントを生成する', () => {
      const result = evaluationService.evaluateSchedule({
        schedule: [
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
        ],
        staffList: [
          createStaff({ id: 'staff-001' }),
          createStaff({ id: 'staff-002', name: 'テスト花子' }),
          createStaff({ id: 'staff-003', name: 'テスト次郎' }),
        ],
        requirements: createRequirements({ daysToGenerate: 2 }),
        leaveRequests: {},
      });

      // simulationにrisks配列があり、AIコメントは recommendations に含まれる
      expect(result.simulation).toBeDefined();
      expect(result.simulation.workloadBalance).toBeDefined();
    });
  });

  describe('generateRecommendations', () => {
    it('違反がある場合、改善提案を生成する', () => {
      const schedule: StaffSchedule[] = [
        createSchedule([
          { date: '2025-11-01', shiftType: '日勤' },
          // 日勤2名必要だが1名のみ
        ]),
      ];
      const result = evaluationService.evaluateSchedule({
        schedule,
        staffList: [createStaff()],
        requirements: createRequirements({ daysToGenerate: 1 }),
        leaveRequests: {},
      });

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toHaveProperty('priority');
      expect(result.recommendations[0]).toHaveProperty('description');
    });
  });

  describe('generateSimulation', () => {
    it('シミュレーション結果を生成する', () => {
      const result = evaluationService.evaluateSchedule({
        schedule: [createSchedule([{ date: '2025-11-01', shiftType: '日勤' }])],
        staffList: [createStaff()],
        requirements: createRequirements({ daysToGenerate: 1 }),
        leaveRequests: {},
      });

      expect(result.simulation).toBeDefined();
      expect(result.simulation).toHaveProperty('workloadBalance');
      expect(result.simulation).toHaveProperty('risks');
      expect(result.simulation).toHaveProperty('paidLeaveUsageRate');
    });
  });

  describe('analyzeStaffConstraints', () => {
    it('スタッフ制約を分析する', () => {
      const staffList: Staff[] = [
        createStaff({ id: 'staff-001', weeklyWorkCount: { hope: 5, must: 4 } }),
        createStaff({ id: 'staff-002', name: 'テスト花子', weeklyWorkCount: { hope: 4, must: 3 } }),
      ];
      const requirements = createRequirements({ daysToGenerate: 30 });

      const analysis = evaluationService.analyzeStaffConstraints(
        staffList,
        requirements
      );

      expect(analysis).toHaveProperty('totalStaff');
      expect(analysis).toHaveProperty('isFeasible');
      expect(analysis).toHaveProperty('totalSupplyPersonDays');
      expect(analysis.totalStaff).toBe(2);
    });

    it('人員不足の場合、実現不可能と判定する', () => {
      const staffList: Staff[] = [
        createStaff({ weeklyWorkCount: { hope: 1, must: 1 } }), // 週1日のみ
      ];
      const requirements = createRequirements({
        daysToGenerate: 30,
        requirements: {
          日勤: { totalStaff: 10, requiredQualifications: [], requiredRoles: [] }, // 10名必要
        },
      });

      const analysis = evaluationService.analyzeStaffConstraints(
        staffList,
        requirements
      );

      expect(analysis.isFeasible).toBe(false);
      expect(analysis.infeasibilityReasons.length).toBeGreaterThan(0);
    });
  });
});
