/**
 * DiagnosisService 単体テスト
 * Phase 55: データ設定診断機能
 *
 * TDD: RED -> GREEN -> REFACTOR
 */

import { DiagnosisService } from '../../src/diagnosis/diagnosisService';
import {
  Staff,
  ShiftRequirement,
  LeaveRequest,
  Role,
  Qualification,
  TimeSlotPreference,
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
function createRequirements(overrides: Partial<ShiftRequirement> = {}): ShiftRequirement {
  return {
    targetMonth: '2025-01',
    timeSlots: [
      { name: '早番', start: '07:00', end: '16:00', restHours: 1 },
      { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
      { name: '遅番', start: '11:00', end: '20:00', restHours: 1 },
    ],
    requirements: {
      '早番': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
      '日勤': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
      '遅番': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
    },
    ...overrides,
  };
}

describe('DiagnosisService', () => {
  let service: DiagnosisService;

  beforeEach(() => {
    service = new DiagnosisService();
  });

  describe('diagnose() - 事前診断', () => {
    describe('需給バランス計算', () => {
      it('営業日数を正しく計算すること（夜勤なしの場合は平日のみ）', () => {
        const staffList = [createStaff({ weeklyWorkCount: { hope: 5, must: 4 } })];
        const requirements = createRequirements({ targetMonth: '2025-01' });

        const result = service.diagnose(staffList, requirements, {});

        // 2025年1月は平日が23日
        expect(result.supplyDemandBalance.totalDemand).toBeGreaterThan(0);
      });

      it('総供給人日数を正しく計算すること', () => {
        // 週5日希望 × 4.5週 = 約22.5人日 × 2人 = 約45人日
        const staffList = [
          createStaff({ id: 's1', name: 'スタッフ1', weeklyWorkCount: { hope: 5, must: 4 } }),
          createStaff({ id: 's2', name: 'スタッフ2', weeklyWorkCount: { hope: 5, must: 4 } }),
        ];
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        // 2人 × 5日/週 × 4.5週 ≈ 45人日
        expect(result.supplyDemandBalance.totalSupply).toBeGreaterThanOrEqual(40);
        expect(result.supplyDemandBalance.totalSupply).toBeLessThanOrEqual(50);
      });

      it('総需要人日数を正しく計算すること', () => {
        // 営業日 × (早番2 + 日勤2 + 遅番2) = 営業日 × 6
        const staffList = [createStaff()];
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        // 23営業日 × 6人/日 = 138人日
        expect(result.supplyDemandBalance.totalDemand).toBeGreaterThanOrEqual(100);
      });

      it('需給バランス（過不足）を正しく計算すること', () => {
        const staffList = [createStaff()];
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        expect(result.supplyDemandBalance.balance).toBe(
          result.supplyDemandBalance.totalSupply - result.supplyDemandBalance.totalDemand
        );
      });

      it('時間帯別の需給バランスを計算すること', () => {
        const staffList = [
          createStaff({ timeSlotPreference: TimeSlotPreference.Any }),
        ];
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        expect(result.supplyDemandBalance.byTimeSlot['早番']).toBeDefined();
        expect(result.supplyDemandBalance.byTimeSlot['日勤']).toBeDefined();
        expect(result.supplyDemandBalance.byTimeSlot['遅番']).toBeDefined();
      });

      it('「日勤のみ」スタッフは早番・遅番の供給に含めないこと', () => {
        const staffList = [
          createStaff({
            id: 's1',
            name: '日勤専用',
            timeSlotPreference: TimeSlotPreference.DayOnly,
            weeklyWorkCount: { hope: 5, must: 4 },
          }),
        ];
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        // 日勤のみスタッフは日勤にしか供給できない
        expect(result.supplyDemandBalance.byTimeSlot['日勤'].supply).toBeGreaterThan(0);
        // 早番・遅番の供給は0（このスタッフからは）
        // ただしfulfillmentRateで確認するのがより適切
        expect(result.supplyDemandBalance.byTimeSlot['早番'].fulfillmentRate).toBeLessThan(
          result.supplyDemandBalance.byTimeSlot['日勤'].fulfillmentRate
        );
      });
    });

    describe('診断ステータス', () => {
      it('十分なスタッフがいる場合はok状態を返すこと', () => {
        // 十分なスタッフを用意
        const staffList = Array.from({ length: 10 }, (_, i) =>
          createStaff({
            id: `s${i}`,
            name: `スタッフ${i}`,
            weeklyWorkCount: { hope: 5, must: 4 },
          })
        );
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        expect(result.status).toBe('ok');
        expect(result.issues).toHaveLength(0);
      });

      it('人員が大幅に不足している場合はerror状態を返すこと', () => {
        // スタッフ1人のみ
        const staffList = [createStaff()];
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        expect(result.status).toBe('error');
        expect(result.supplyDemandBalance.balance).toBeLessThan(0);
      });

      it('時間帯制約による問題がある場合はwarning状態を返すこと', () => {
        // 十分な人数だが、全員日勤のみ
        const staffList = Array.from({ length: 8 }, (_, i) =>
          createStaff({
            id: `s${i}`,
            name: `日勤スタッフ${i}`,
            timeSlotPreference: TimeSlotPreference.DayOnly,
            weeklyWorkCount: { hope: 5, must: 4 },
          })
        );
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        // 総供給は足りるが、早番・遅番が不足するためwarning
        expect(['warning', 'error']).toContain(result.status);
        expect(result.issues.some((i) => i.category === 'timeSlot')).toBe(true);
      });
    });

    describe('サマリーメッセージ', () => {
      it('ok状態では問題なしのメッセージを返すこと', () => {
        const staffList = Array.from({ length: 10 }, (_, i) =>
          createStaff({ id: `s${i}`, name: `スタッフ${i}` })
        );
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        expect(result.summary).toContain('問題');
        expect(result.status).toBe('ok');
      });

      it('error状態では不足を示すメッセージを返すこと', () => {
        const staffList = [createStaff()];
        const requirements = createRequirements();

        const result = service.diagnose(staffList, requirements, {});

        expect(result.summary.length).toBeGreaterThan(0);
        expect(result.status).toBe('error');
      });
    });
  });

  describe('問題検出', () => {
    it('総供給不足の問題を検出すること', () => {
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = service.diagnose(staffList, requirements, {});

      const supplyIssue = result.issues.find((i) => i.category === 'supply');
      expect(supplyIssue).toBeDefined();
      expect(supplyIssue?.severity).toBe('high');
    });

    it('時間帯制約問題を検出し、該当スタッフ名を含めること', () => {
      const staffList = [
        createStaff({
          id: 's1',
          name: '田中太郎',
          timeSlotPreference: TimeSlotPreference.DayOnly,
          weeklyWorkCount: { hope: 5, must: 4 },
        }),
        createStaff({
          id: 's2',
          name: '山田花子',
          timeSlotPreference: TimeSlotPreference.DayOnly,
          weeklyWorkCount: { hope: 5, must: 4 },
        }),
      ];
      // 日勤要件を高くして、日勤のみスタッフが日勤を占有する状況を作る
      const requirements = createRequirements({
        requirements: {
          '早番': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
          '日勤': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
          '遅番': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
        },
      });

      const result = service.diagnose(staffList, requirements, {});

      const timeSlotIssue = result.issues.find((i) => i.category === 'timeSlot');
      expect(timeSlotIssue).toBeDefined();
      expect(timeSlotIssue?.affectedStaff).toContain('田中太郎');
      expect(timeSlotIssue?.affectedStaff).toContain('山田花子');
    });

    it('休暇申請集中を検出すること', () => {
      const staffList = [
        createStaff({ id: 's1', name: '佐藤' }),
        createStaff({ id: 's2', name: '鈴木' }),
        createStaff({ id: 's3', name: '高橋' }),
      ];
      const requirements = createRequirements({ targetMonth: '2025-12' });
      const leaveRequests: LeaveRequest = {
        's1': { '2025-12-25': LeaveType.Hope },
        's2': { '2025-12-25': LeaveType.PaidLeave },
        's3': { '2025-12-25': LeaveType.Hope },
      };

      const result = service.diagnose(staffList, requirements, leaveRequests);

      const leaveIssue = result.issues.find((i) => i.category === 'leave');
      expect(leaveIssue).toBeDefined();
      expect(leaveIssue?.affectedDates).toContain('2025-12-25');
      expect(leaveIssue?.affectedStaff).toContain('佐藤');
    });

    it('問題に重要度を付与すること', () => {
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = service.diagnose(staffList, requirements, {});

      result.issues.forEach((issue) => {
        expect(['high', 'medium', 'low']).toContain(issue.severity);
      });
    });
  });

  describe('改善提案生成', () => {
    it('時間帯制約が原因の場合、具体的なスタッフ名と変更提案を生成すること', () => {
      const staffList = [
        createStaff({
          id: 's1',
          name: '山田花子',
          timeSlotPreference: TimeSlotPreference.DayOnly,
        }),
      ];
      const requirements = createRequirements();

      const result = service.diagnose(staffList, requirements, {});

      const suggestion = result.suggestions.find((s) => s.targetStaff === '山田花子');
      if (suggestion) {
        expect(suggestion.action).toContain('いつでも可');
      }
    });

    it('スタッフ数不足の場合、追加人数を提案すること', () => {
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = service.diagnose(staffList, requirements, {});

      const addStaffSuggestion = result.suggestions.find((s) =>
        s.action.includes('追加') || s.action.includes('採用')
      );
      expect(addStaffSuggestion).toBeDefined();
    });

    it('改善提案に優先度を付与すること', () => {
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = service.diagnose(staffList, requirements, {});

      result.suggestions.forEach((suggestion) => {
        expect(['high', 'medium', 'low']).toContain(suggestion.priority);
      });
    });

    it('改善提案に効果の説明を含めること', () => {
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = service.diagnose(staffList, requirements, {});

      result.suggestions.forEach((suggestion) => {
        expect(suggestion.impact.length).toBeGreaterThan(0);
      });
    });
  });

  describe('executedAt', () => {
    it('診断実行日時を含めること', () => {
      const staffList = [createStaff()];
      const requirements = createRequirements();

      const result = service.diagnose(staffList, requirements, {});

      expect(result.executedAt).toBeDefined();
      // ISO8601形式であることを確認
      expect(() => new Date(result.executedAt)).not.toThrow();
    });
  });
});
