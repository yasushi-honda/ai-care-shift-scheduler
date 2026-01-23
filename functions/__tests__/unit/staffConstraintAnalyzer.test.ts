/**
 * staffConstraintAnalyzer.ts ユニットテスト
 *
 * スタッフ制約の数学的分析機能をテスト
 */

import { analyzeStaffConstraints } from '../../src/evaluation/staffConstraintAnalyzer';
import {
  Staff,
  ShiftRequirement,
  Role,
  Qualification,
  TimeSlotPreference,
} from '../../src/types';

describe('analyzeStaffConstraints', () => {
  // テストデータ作成ヘルパー
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

  describe('基本機能', () => {
    it('スタッフ総数を正しく返す', () => {
      const staffList: Staff[] = [
        createStaff({ id: 'staff-001' }),
        createStaff({ id: 'staff-002', name: 'テスト花子' }),
        createStaff({ id: 'staff-003', name: 'テスト次郎' }),
      ];
      const requirements = createRequirements();

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.totalStaff).toBe(3);
    });

    it('営業日数を正しく計算する（夜勤あり: 全日営業）', () => {
      const staffList: Staff[] = [createStaff()];
      const requirements = createRequirements({
        targetMonth: '2025-11', // 11月は30日
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      // 夜勤ありの場合、全日が営業日
      expect(result.businessDays).toBe(30);
    });

    it('営業日数を正しく計算する（夜勤なし: 日曜除外）', () => {
      const staffList: Staff[] = [createStaff()];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        timeSlots: [
          { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
        ],
        requirements: {
          日勤: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
        },
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      // 2025年11月は日曜日が5日（2, 9, 16, 23, 30日）なので、30-5=25日
      expect(result.businessDays).toBe(25);
    });

    it('総供給可能人日数を正しく計算する', () => {
      const staffList: Staff[] = [
        createStaff({ weeklyWorkCount: { hope: 5, must: 4 } }), // 5 * 4.5 = 22.5 → 23
        createStaff({ weeklyWorkCount: { hope: 4, must: 3 } }), // 4 * 4.5 = 18
      ];
      const requirements = createRequirements();

      const result = analyzeStaffConstraints(staffList, requirements);

      // Math.round(5 * 4.5) + Math.round(4 * 4.5) = 23 + 18 = 41
      expect(result.totalSupplyPersonDays).toBe(41);
    });

    it('総必要人日数を正しく計算する', () => {
      const staffList: Staff[] = [createStaff()];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        requirements: {
          日勤: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
          夜勤: { totalStaff: 1, requiredQualifications: [], requiredRoles: [] },
        },
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      // 営業日30日 × (日勤2名 + 夜勤1名) = 30 × 3 = 90
      expect(result.totalRequiredPersonDays).toBe(90);
    });
  });

  describe('timeSlotPreference分布', () => {
    it('スタッフをtimeSlotPreferenceごとに正しく分類する', () => {
      const staffList: Staff[] = [
        createStaff({ id: 'staff-001', name: '太郎', timeSlotPreference: TimeSlotPreference.Any }),
        createStaff({ id: 'staff-002', name: '花子', timeSlotPreference: TimeSlotPreference.DayOnly }),
        createStaff({ id: 'staff-003', name: '次郎', timeSlotPreference: TimeSlotPreference.DayOnly }),
        createStaff({ id: 'staff-004', name: '三郎', timeSlotPreference: TimeSlotPreference.NightOnly }),
      ];
      const requirements = createRequirements();

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.preferenceDistribution[TimeSlotPreference.Any].count).toBe(1);
      expect(result.preferenceDistribution[TimeSlotPreference.Any].staffNames).toContain('太郎');

      expect(result.preferenceDistribution[TimeSlotPreference.DayOnly].count).toBe(2);
      expect(result.preferenceDistribution[TimeSlotPreference.DayOnly].staffNames).toContain('花子');
      expect(result.preferenceDistribution[TimeSlotPreference.DayOnly].staffNames).toContain('次郎');

      expect(result.preferenceDistribution[TimeSlotPreference.NightOnly].count).toBe(1);
      expect(result.preferenceDistribution[TimeSlotPreference.NightOnly].staffNames).toContain('三郎');
    });

    it('timeSlotPreference未設定はAnyとして扱う', () => {
      // 実際のFirestoreデータではtimeSlotPreferenceが未設定の場合があるためテスト
      const staffWithoutPreference = {
        id: 'staff-001',
        name: 'テスト太郎',
        role: Role.CareWorker,
        qualifications: [],
        weeklyWorkCount: { hope: 5, must: 4 },
        maxConsecutiveWorkDays: 5,
        availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
        unavailableDates: [],
        isNightShiftOnly: false,
        // timeSlotPreference未設定をシミュレート
      } as unknown as Staff;
      const staffList: Staff[] = [staffWithoutPreference];
      const requirements = createRequirements();

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.preferenceDistribution[TimeSlotPreference.Any].count).toBe(1);
    });

    it('各preferenceのpersonDaysを正しく計算する', () => {
      const staffList: Staff[] = [
        createStaff({ id: 'staff-001', weeklyWorkCount: { hope: 5, must: 4 }, timeSlotPreference: TimeSlotPreference.DayOnly }),
        createStaff({ id: 'staff-002', weeklyWorkCount: { hope: 4, must: 3 }, timeSlotPreference: TimeSlotPreference.DayOnly }),
      ];
      const requirements = createRequirements();

      const result = analyzeStaffConstraints(staffList, requirements);

      // (5 * 4.5 = 22.5→23) + (4 * 4.5 = 18) = 41
      expect(result.preferenceDistribution[TimeSlotPreference.DayOnly].personDays).toBe(41);
    });
  });

  describe('実現可能性判定', () => {
    it('供給が需要を満たす場合、isFeasible=trueを返す', () => {
      const staffList: Staff[] = [
        createStaff({ weeklyWorkCount: { hope: 5, must: 4 } }),
        createStaff({ weeklyWorkCount: { hope: 5, must: 4 } }),
        createStaff({ weeklyWorkCount: { hope: 5, must: 4 } }),
        createStaff({ weeklyWorkCount: { hope: 5, must: 4 } }),
        createStaff({ weeklyWorkCount: { hope: 5, must: 4 } }),
      ];
      // 5名 × 23人日 = 115人日供給
      const requirements = createRequirements({
        targetMonth: '2025-11',
        requirements: {
          日勤: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
          夜勤: { totalStaff: 1, requiredQualifications: [], requiredRoles: [] },
        },
      });
      // 30日 × 3名 = 90人日必要

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.isFeasible).toBe(true);
      expect(result.infeasibilityReasons).toHaveLength(0);
    });

    it('供給が需要を下回る場合、isFeasible=falseを返す', () => {
      const staffList: Staff[] = [
        createStaff({ weeklyWorkCount: { hope: 1, must: 1 } }), // 5人日のみ
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        requirements: {
          日勤: { totalStaff: 10, requiredQualifications: [], requiredRoles: [] },
        },
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.isFeasible).toBe(false);
      expect(result.infeasibilityReasons.length).toBeGreaterThan(0);
      expect(result.infeasibilityReasons.some(r => r.includes('総供給人日数'))).toBe(true);
    });

    it('「日勤のみ」スタッフが日勤の70%超を占有する場合、警告を出す', () => {
      const staffList: Staff[] = [
        createStaff({
          id: 'staff-001',
          name: '日勤専門A',
          weeklyWorkCount: { hope: 5, must: 4 },
          timeSlotPreference: TimeSlotPreference.DayOnly,
        }),
        createStaff({
          id: 'staff-002',
          name: '日勤専門B',
          weeklyWorkCount: { hope: 5, must: 4 },
          timeSlotPreference: TimeSlotPreference.DayOnly,
        }),
      ];
      // 2名 × 23人日 = 46人日を日勤のみスタッフが消費
      const requirements = createRequirements({
        targetMonth: '2025-11',
        requirements: {
          日勤: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
          // 日勤必要数: 30日 × 2名 = 60人日
          // 46/60 = 76.7% > 70%
        },
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.isFeasible).toBe(false);
      expect(result.infeasibilityReasons.some(r => r.includes('日勤のみ'))).toBe(true);
    });
  });

  describe('シフト種別分析', () => {
    it('各シフト種別の必要人日数を正しく計算する', () => {
      const staffList: Staff[] = [createStaff()];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        requirements: {
          日勤: { totalStaff: 3, requiredQualifications: [], requiredRoles: [] },
          夜勤: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
        },
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      // 30日 × 3名 = 90人日
      expect(result.shiftAnalysis['日勤'].required).toBe(90);
      // 30日 × 2名 = 60人日
      expect(result.shiftAnalysis['夜勤'].required).toBe(60);
    });
  });

  describe('改善提案', () => {
    it('「日勤のみ」スタッフが複数いて占有率が高い場合、改善提案を生成する', () => {
      const staffList: Staff[] = [
        createStaff({
          id: 'staff-001',
          name: '日勤専門A',
          weeklyWorkCount: { hope: 5, must: 4 },
          timeSlotPreference: TimeSlotPreference.DayOnly,
        }),
        createStaff({
          id: 'staff-002',
          name: '日勤専門B',
          weeklyWorkCount: { hope: 5, must: 4 },
          timeSlotPreference: TimeSlotPreference.DayOnly,
        }),
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        requirements: {
          日勤: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
        },
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('timeSlotPreference'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('日勤専門B'))).toBe(true);
    });

    it('「日勤のみ」スタッフが1名のみの場合、改善提案を生成しない', () => {
      const staffList: Staff[] = [
        createStaff({
          id: 'staff-001',
          name: '日勤専門A',
          weeklyWorkCount: { hope: 5, must: 4 },
          timeSlotPreference: TimeSlotPreference.DayOnly,
        }),
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        requirements: {
          日勤: { totalStaff: 1, requiredQualifications: [], requiredRoles: [] },
        },
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      // 1名のみの場合はsuggestionを生成しない（誰を変更するか提案できない）
      expect(result.suggestions.filter(s => s.includes('timeSlotPreference'))).toHaveLength(0);
    });
  });

  describe('早番・遅番分析', () => {
    it('早番・遅番に柔軟なスタッフが不足している場合、警告を出す', () => {
      const staffList: Staff[] = [
        createStaff({
          id: 'staff-001',
          name: '日勤専門',
          weeklyWorkCount: { hope: 5, must: 4 },
          timeSlotPreference: TimeSlotPreference.DayOnly,
        }),
      ];
      const requirements = createRequirements({
        targetMonth: '2025-11',
        timeSlots: [
          { name: '早番', start: '07:00', end: '16:00', restHours: 1 },
          { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
          { name: '遅番', start: '11:00', end: '20:00', restHours: 1 },
        ],
        requirements: {
          早番: { totalStaff: 1, requiredQualifications: [], requiredRoles: [] },
          日勤: { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
          遅番: { totalStaff: 1, requiredQualifications: [], requiredRoles: [] },
        },
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      // 早番・遅番に配置可能なスタッフがいない
      expect(result.infeasibilityReasons.some(r => r.includes('早番・遅番'))).toBe(true);
    });
  });

  describe('エッジケース', () => {
    it('空のスタッフリストを処理できる', () => {
      const staffList: Staff[] = [];
      const requirements = createRequirements();

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.totalStaff).toBe(0);
      expect(result.totalSupplyPersonDays).toBe(0);
      expect(result.isFeasible).toBe(false);
    });

    it('要件が空の場合を処理できる', () => {
      const staffList: Staff[] = [createStaff()];
      const requirements = createRequirements({
        requirements: {},
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.totalRequiredPersonDays).toBe(0);
      expect(result.isFeasible).toBe(true);
    });

    it('2月（28日/29日）を正しく処理する', () => {
      const staffList: Staff[] = [createStaff()];
      const requirements = createRequirements({
        targetMonth: '2025-02', // 2025年は平年（28日）
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.businessDays).toBe(28);
    });

    it('うるう年の2月（29日）を正しく処理する', () => {
      const staffList: Staff[] = [createStaff()];
      const requirements = createRequirements({
        targetMonth: '2024-02', // 2024年はうるう年（29日）
      });

      const result = analyzeStaffConstraints(staffList, requirements);

      expect(result.businessDays).toBe(29);
    });
  });
});
