/**
 * scoreCalculators.ts ユニットテスト
 *
 * テスト対象:
 * - calculateOverallScore: 総合スコア計算（4段階レベル評価）
 * - calculateFulfillmentRate: 人員充足率計算
 */

import {
  calculateOverallScore,
  calculateFulfillmentRate,
} from '../../src/evaluation/scoreCalculators';
import {
  ConstraintViolation,
  StaffSchedule,
  ShiftRequirement,
} from '../../src/types';

describe('scoreCalculators', () => {
  describe('calculateOverallScore', () => {
    it('違反がない場合は100点を返す', () => {
      const violations: ConstraintViolation[] = [];
      const score = calculateOverallScore(violations);
      expect(score).toBe(100);
    });

    it('レベル1（nightRestViolation）違反があると即0点', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'nightRestViolation',
          severity: 'error',
          description: '夜勤後の休息不足',
          affectedDates: ['2025-11-01'],
        },
      ];
      const score = calculateOverallScore(violations);
      expect(score).toBe(0);
    });

    it('レベル2（staffShortage）違反は1件あたり-12点', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'staffShortage',
          severity: 'error',
          description: '人員不足',
          affectedDates: ['2025-11-01'],
        },
        {
          type: 'staffShortage',
          severity: 'error',
          description: '人員不足',
          affectedDates: ['2025-11-02'],
        },
      ];
      const score = calculateOverallScore(violations);
      expect(score).toBe(100 - 12 * 2); // 76点
    });

    it('レベル3（consecutiveWork）違反は1件あたり-4点', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'consecutiveWork',
          severity: 'warning',
          description: '連勤超過',
          affectedStaff: ['staff-001'],
        },
        {
          type: 'consecutiveWork',
          severity: 'warning',
          description: '連勤超過',
          affectedStaff: ['staff-002'],
        },
        {
          type: 'consecutiveWork',
          severity: 'warning',
          description: '連勤超過',
          affectedStaff: ['staff-003'],
        },
      ];
      const score = calculateOverallScore(violations);
      expect(score).toBe(100 - 4 * 3); // 88点
    });

    it('明示的なlevelがtypeより優先される', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'staffShortage', // 本来レベル2（-12点）
          level: 4, // 明示的にレベル4を指定（減点なし）
          severity: 'error',
          description: '人員不足',
          affectedDates: ['2025-11-01'],
        },
      ];
      const score = calculateOverallScore(violations);
      expect(score).toBe(100); // レベル4なので減点なし
    });

    it('レベル2とレベル3の複合ケース', () => {
      const violations: ConstraintViolation[] = [
        // レベル2: 2件 × -12 = -24
        { type: 'staffShortage', severity: 'error', description: '人員不足' },
        { type: 'qualificationMissing', severity: 'error', description: '資格不足' },
        // レベル3: 3件 × -4 = -12
        { type: 'consecutiveWork', severity: 'warning', description: '連勤' },
        { type: 'leaveRequestIgnored', severity: 'warning', description: '希望休未反映' },
        { type: 'consecutiveWork', severity: 'warning', description: '連勤' },
      ];
      const score = calculateOverallScore(violations);
      expect(score).toBe(100 - 24 - 12); // 64点
    });

    it('大量のレベル2違反でも0未満にはならない（クランプ）', () => {
      const violations: ConstraintViolation[] = Array(10).fill(null).map(() => ({
        type: 'staffShortage' as const,
        severity: 'error' as const,
        description: '人員不足',
      }));
      const score = calculateOverallScore(violations);
      // 100 - 10*12 = -20 → 0にクランプ
      expect(score).toBe(0);
    });

    it('レベル4（推奨）は減点なし', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'staffShortage', // typeはレベル2だが
          level: 4, // 明示的にレベル4を指定
          severity: 'warning',
          description: '推奨事項',
        },
        {
          type: 'consecutiveWork', // typeはレベル3だが
          level: 4, // 明示的にレベル4を指定
          severity: 'warning',
          description: '推奨事項',
        },
      ];
      const score = calculateOverallScore(violations);
      expect(score).toBe(100);
    });

    it('レベル1違反が複数あっても0点（追加減点なし）', () => {
      const violations: ConstraintViolation[] = [
        { type: 'nightRestViolation', severity: 'error', description: '夜勤後休息不足1' },
        { type: 'nightRestViolation', severity: 'error', description: '夜勤後休息不足2' },
        { type: 'nightRestViolation', severity: 'error', description: '夜勤後休息不足3' },
      ];
      const score = calculateOverallScore(violations);
      expect(score).toBe(0);
    });
  });

  describe('calculateFulfillmentRate', () => {
    const baseRequirements: ShiftRequirement = {
      targetMonth: '2025-11',
      timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
      requirements: {
        '日勤': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
      },
    };

    it('totalRequired=0の場合は100%を返す', () => {
      const schedule: StaffSchedule[] = [];
      const requirements: ShiftRequirement = {
        targetMonth: '2025-11',
        timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
        requirements: {
          '日勤': { totalStaff: 0, requiredQualifications: [], requiredRoles: [] }, // 必要人数0
        },
      };

      const rate = calculateFulfillmentRate(schedule, requirements);
      expect(rate).toBe(100);
    });

    it('夜勤なしの場合、日曜日はスキップされる', () => {
      // 2025-11は1日(土)から始まり、日曜は2,9,16,23,30日
      // 営業日: 30 - 5 = 25日
      const schedule: StaffSchedule[] = [];
      const rate = calculateFulfillmentRate(schedule, baseRequirements);

      // 必要人数: 25日 × 1シフト × 2人 = 50人日
      // 配置人数: 0人日
      // 充足率: 0%
      expect(rate).toBe(0);
    });

    it('夜勤ありの場合、全日が営業日としてカウントされる', () => {
      const requirements: ShiftRequirement = {
        targetMonth: '2025-11',
        timeSlots: [
          { name: '日勤', start: '09:00', end: '17:00', restHours: 1 },
          { name: '夜勤', start: '17:00', end: '09:00', restHours: 2 }, // 夜勤あり
        ],
        requirements: {
          '日勤': { totalStaff: 1, requiredQualifications: [], requiredRoles: [] },
        },
      };
      const schedule: StaffSchedule[] = [];

      const rate = calculateFulfillmentRate(schedule, requirements);
      // 全30日がカウントされる（日曜も含む）
      // 必要人数: 30日 × 1人 = 30人日
      // 配置人数: 0人日
      expect(rate).toBe(0);
    });

    it('過剰配置は上限でカットされる', () => {
      // 2025-11-03（月曜）に3人配置、必要人数は2人
      const schedule: StaffSchedule[] = [
        {
          staffId: 'staff-001',
          staffName: 'スタッフA',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }],
        },
        {
          staffId: 'staff-002',
          staffName: 'スタッフB',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }],
        },
        {
          staffId: 'staff-003',
          staffName: 'スタッフC',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }],
        },
      ];

      const rate = calculateFulfillmentRate(schedule, baseRequirements);
      // 3人配置でも、必要人数2人でカットされるので2人としてカウント
      // 必要人数: 25日 × 2人 = 50人日
      // 配置人数: 1日 × 2人（上限カット） = 2人日
      // 充足率: 2/50 = 4%
      expect(rate).toBe(4);
    });

    it('完全充足の場合は100%', () => {
      // 単純化: 1日だけの月を想定して計算
      const requirements: ShiftRequirement = {
        targetMonth: '2025-12', // 12月1日は月曜
        timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
        requirements: {
          '日勤': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
        },
      };

      // 全営業日（12月は31日、日曜は7,14,21,28の4日）= 27日に2人ずつ配置
      const shifts: { date: string; shiftType: string }[] = [];
      for (let day = 1; day <= 31; day++) {
        const date = `2025-12-${String(day).padStart(2, '0')}`;
        const dayOfWeek = new Date(date).getDay();
        if (dayOfWeek !== 0) {
          // 日曜以外
          shifts.push({ date, shiftType: '日勤' });
        }
      }

      const schedule: StaffSchedule[] = [
        { staffId: 's1', staffName: 'A', monthlyShifts: [...shifts] },
        { staffId: 's2', staffName: 'B', monthlyShifts: [...shifts] },
      ];

      const rate = calculateFulfillmentRate(schedule, requirements);
      expect(rate).toBe(100);
    });

    it('部分充足の場合は正しい割合を返す', () => {
      // 2025-11-03（月曜）のみ1人配置、必要人数は2人
      const schedule: StaffSchedule[] = [
        {
          staffId: 'staff-001',
          staffName: 'スタッフA',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }],
        },
      ];

      const rate = calculateFulfillmentRate(schedule, baseRequirements);
      // 必要人数: 25日 × 2人 = 50人日
      // 配置人数: 1日 × 1人 = 1人日
      // 充足率: 1/50 = 2%
      expect(rate).toBe(2);
    });
  });
});
