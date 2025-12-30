/**
 * Phase間データバリデーション ユニットテスト
 *
 * BUG-023（夜勤後休息違反）防止のためのPhase間データ受け渡し検証
 * @see .kiro/steering/phased-generation-contract.md
 */

import {
  validateSkeletonOutput,
  validatePhase2Input,
  autoFixSkeleton,
} from '../../src/phase-validation';
import type { ScheduleSkeleton, StaffScheduleSkeleton, Staff } from '../../src/types';
import { Role, Qualification, TimeSlotPreference } from '../../src/types';

describe('Phase Validation', () => {
  // テストデータファクトリ
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

  const createStaffSkeleton = (overrides?: Partial<StaffScheduleSkeleton>): StaffScheduleSkeleton => ({
    staffId: 'staff-001',
    staffName: 'テスト太郎',
    restDays: [6, 7, 13, 14, 20, 21, 27, 28],
    nightShiftDays: [3, 10],
    nightShiftFollowupDays: [4, 5, 11, 12], // 夜勤後の明け休み+公休
    ...overrides,
  });

  const createSkeleton = (staffSchedules: StaffScheduleSkeleton[]): ScheduleSkeleton => ({
    staffSchedules,
  });

  describe('validateSkeletonOutput', () => {
    describe('スタッフ存在チェック', () => {
      it('全スタッフが含まれている場合、エラーなし', () => {
        const staffList = [createStaff({ id: 'staff-001' }), createStaff({ id: 'staff-002', name: 'テスト花子' })];
        const skeleton = createSkeleton([
          createStaffSkeleton({ staffId: 'staff-001' }),
          createStaffSkeleton({ staffId: 'staff-002', staffName: 'テスト花子' }),
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('スタッフが欠落している場合、エラーを検出', () => {
        const staffList = [createStaff({ id: 'staff-001' }), createStaff({ id: 'staff-002', name: 'テスト花子' })];
        const skeleton = createSkeleton([
          createStaffSkeleton({ staffId: 'staff-001' }),
          // staff-002 が欠落
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].type).toBe('missing_field');
        expect(result.errors[0].staffId).toBe('staff-002');
        expect(result.errors[0].message).toContain('テスト花子');
      });
    });

    describe('必須フィールドチェック', () => {
      it('restDaysが配列でない場合、エラーを検出', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          { ...createStaffSkeleton(), restDays: null as unknown as number[] },
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'restDays')).toBe(true);
      });

      it('夜勤施設でnightShiftDaysが配列でない場合、エラーを検出', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          { ...createStaffSkeleton(), nightShiftDays: null as unknown as number[] },
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'nightShiftDays')).toBe(true);
      });

      it('夜勤施設でnightShiftFollowupDaysが配列でない場合、エラーを検出', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          { ...createStaffSkeleton(), nightShiftFollowupDays: null as unknown as number[] },
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'nightShiftFollowupDays')).toBe(true);
      });

      it('夜勤なし施設ではnightShiftフィールドをチェックしない', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          {
            staffId: 'staff-001',
            staffName: 'テスト太郎',
            restDays: [6, 7],
            nightShiftDays: null as unknown as number[],
            nightShiftFollowupDays: null as unknown as number[],
          },
        ]);

        // hasNightShift = false
        const result = validateSkeletonOutput(skeleton, staffList, false);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('夜勤後休息整合性チェック（BUG-023防止）', () => {
      it('夜勤後の明け休み(X+1)が設定されている場合、エラーなし', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [3],
            nightShiftFollowupDays: [4, 5], // 3日夜勤 → 4日明け休み, 5日公休
          }),
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.errors.filter(e => e.type === 'constraint_violation')).toHaveLength(0);
      });

      it('夜勤後の明け休み(X+1)が欠落している場合、エラーを検出', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [3],
            nightShiftFollowupDays: [5], // 4日（明け休み）が欠落
          }),
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.errors.some(e => e.type === 'constraint_violation' && e.message.includes('翌日'))).toBe(true);
      });

      it('夜勤後の公休(X+2)が欠落している場合、警告を出す', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [3],
            nightShiftFollowupDays: [4], // 5日（公休）が欠落
          }),
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.warnings.some(w => w.type === 'constraint_violation' && w.message.includes('翌々日'))).toBe(true);
      });

      it('複数の夜勤日で全て休息が設定されている場合、エラーなし', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [3, 10, 17],
            nightShiftFollowupDays: [4, 5, 11, 12, 18, 19],
          }),
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.errors.filter(e => e.type === 'constraint_violation')).toHaveLength(0);
      });

      it('複数の夜勤日で一部の休息が欠落している場合、エラーを検出', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [3, 10, 17],
            nightShiftFollowupDays: [4, 5, 11, 12], // 18, 19が欠落
          }),
        ]);

        const result = validateSkeletonOutput(skeleton, staffList, true);

        expect(result.errors.filter(e => e.type === 'constraint_violation').length).toBeGreaterThan(0);
      });
    });

    describe('月末境界テスト', () => {
      it('夜勤が30日の場合、31日の明け休みをチェック（31日の月）', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [30],
            nightShiftFollowupDays: [31], // 30日夜勤 → 31日明け休み（月末）
          }),
        ]);

        // daysInMonth = 31（1月、3月など）
        const result = validateSkeletonOutput(skeleton, staffList, true, 31);

        // 31日は月内なので明け休みチェックOK、32日は月外なので警告スキップ
        expect(result.errors.filter(e => e.type === 'constraint_violation')).toHaveLength(0);
      });

      it('夜勤が31日の場合、翌月の休息は検証対象外（31日の月）', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [31],
            nightShiftFollowupDays: [], // 翌月なので設定不要
          }),
        ]);

        // daysInMonth = 31（1月、3月など）
        const result = validateSkeletonOutput(skeleton, staffList, true, 31);

        // 32日、33日は月外なのでエラーにならない（修正済み）
        expect(result.errors.filter(e => e.message.includes('32日'))).toHaveLength(0);
        expect(result.isValid).toBe(true);
      });

      it('2月（28日）で27日夜勤の場合の境界処理', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [27],
            nightShiftFollowupDays: [28], // 27日夜勤 → 28日明け休みのみ（29日は月外）
          }),
        ]);

        // daysInMonth = 28（2月、非閏年）
        const result = validateSkeletonOutput(skeleton, staffList, true, 28);

        // 28日の明け休みはOK、29日の公休は月外なのでスキップ
        expect(result.errors.filter(e => e.type === 'constraint_violation')).toHaveLength(0);
        expect(result.warnings.filter(w => w.message.includes('29日'))).toHaveLength(0);
      });

      it('2月（28日）で28日夜勤の場合、翌月休息は対象外', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [28],
            nightShiftFollowupDays: [], // 翌月なので設定不要
          }),
        ]);

        // daysInMonth = 28（2月、非閏年）
        const result = validateSkeletonOutput(skeleton, staffList, true, 28);

        // 29日、30日は月外なのでエラーにならない
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('閏年2月（29日）で28日夜勤の場合', () => {
        const staffList = [createStaff()];
        const skeleton = createSkeleton([
          createStaffSkeleton({
            nightShiftDays: [28],
            nightShiftFollowupDays: [29], // 28日夜勤 → 29日明け休み（閏年）
          }),
        ]);

        // daysInMonth = 29（閏年2月）
        const result = validateSkeletonOutput(skeleton, staffList, true, 29);

        // 29日の明け休みはOK、30日の公休は月外なのでスキップ
        expect(result.errors.filter(e => e.type === 'constraint_violation')).toHaveLength(0);
        expect(result.warnings.filter(w => w.message.includes('30日'))).toHaveLength(0);
      });
    });

    describe('daysInMonth不正値のハンドリング', () => {
      it('daysInMonth=0 の場合、警告を出して31を使用', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const staffList = [createStaff()];
        const skeleton = createSkeleton([createStaffSkeleton()]);

        const result = validateSkeletonOutput(skeleton, staffList, true, 0);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('daysInMonth の値が不正です: 0'));
        expect(result.isValid).toBe(true); // 31として処理される
        consoleSpy.mockRestore();
      });

      it('daysInMonth=-1 の場合、警告を出して31を使用', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const staffList = [createStaff()];
        const skeleton = createSkeleton([createStaffSkeleton()]);

        validateSkeletonOutput(skeleton, staffList, true, -1);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('daysInMonth の値が不正です: -1'));
        consoleSpy.mockRestore();
      });

      it('daysInMonth=32 の場合、警告を出して31を使用', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const staffList = [createStaff()];
        const skeleton = createSkeleton([createStaffSkeleton()]);

        validateSkeletonOutput(skeleton, staffList, true, 32);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('daysInMonth の値が不正です: 32'));
        consoleSpy.mockRestore();
      });

      it('daysInMonth=30.5（小数）の場合、警告を出して31を使用', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const staffList = [createStaff()];
        const skeleton = createSkeleton([createStaffSkeleton()]);

        validateSkeletonOutput(skeleton, staffList, true, 30.5);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('daysInMonth の値が不正です: 30.5'));
        consoleSpy.mockRestore();
      });
    });
  });

  describe('validatePhase2Input', () => {
    it('全スタッフのskeltonデータがある場合、エラーなし', () => {
      const staffList = [createStaff({ id: 'staff-001' }), createStaff({ id: 'staff-002' })];
      const skeleton = createSkeleton([
        createStaffSkeleton({ staffId: 'staff-001' }),
        createStaffSkeleton({ staffId: 'staff-002' }),
      ]);

      const result = validatePhase2Input(skeleton, staffList, true);

      expect(result.isValid).toBe(true);
    });

    it('スタッフのskeltonデータが欠落している場合、エラーを検出', () => {
      const staffList = [createStaff({ id: 'staff-001' }), createStaff({ id: 'staff-002' })];
      const skeleton = createSkeleton([
        createStaffSkeleton({ staffId: 'staff-001' }),
        // staff-002 欠落
      ]);

      const result = validatePhase2Input(skeleton, staffList, true);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.staffId === 'staff-002')).toBe(true);
    });

    it('夜勤があるのにnightShiftFollowupDaysが空の場合、エラーを検出（BUG-023）', () => {
      const staffList = [createStaff()];
      const skeleton = createSkeleton([
        createStaffSkeleton({
          nightShiftDays: [3, 10],
          nightShiftFollowupDays: [], // 空！これがBUG-023の原因
        }),
      ]);

      const result = validatePhase2Input(skeleton, staffList, true);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'nightShiftFollowupDays')).toBe(true);
      expect(result.errors[0].message).toContain('夜勤');
      expect(result.errors[0].message).toContain('明け休み');
    });

    it('夜勤がない場合、nightShiftFollowupDaysが空でもエラーにならない', () => {
      const staffList = [createStaff()];
      const skeleton = createSkeleton([
        createStaffSkeleton({
          nightShiftDays: [],
          nightShiftFollowupDays: [],
        }),
      ]);

      const result = validatePhase2Input(skeleton, staffList, true);

      expect(result.isValid).toBe(true);
    });

    it('夜勤なし施設ではnightShiftFollowupDaysチェックをスキップ', () => {
      const staffList = [createStaff()];
      const skeleton = createSkeleton([
        createStaffSkeleton({
          nightShiftDays: [3],
          nightShiftFollowupDays: [], // 本来ならエラーだが...
        }),
      ]);

      // hasNightShift = false
      const result = validatePhase2Input(skeleton, staffList, false);

      expect(result.isValid).toBe(true);
    });
  });

  describe('autoFixSkeleton', () => {
    it('nightShiftFollowupDaysが欠落している場合、自動生成する', () => {
      const skeleton = createSkeleton([
        createStaffSkeleton({
          nightShiftDays: [3, 10],
          nightShiftFollowupDays: [], // 空
        }),
      ]);

      const fixed = autoFixSkeleton(skeleton, 30);

      const fixedStaff = fixed.staffSchedules[0];
      expect(fixedStaff.nightShiftFollowupDays).toContain(4); // 3+1
      expect(fixedStaff.nightShiftFollowupDays).toContain(5); // 3+2
      expect(fixedStaff.nightShiftFollowupDays).toContain(11); // 10+1
      expect(fixedStaff.nightShiftFollowupDays).toContain(12); // 10+2
    });

    it('既にnightShiftFollowupDaysがある場合、変更しない', () => {
      const originalFollowups = [4, 5, 11, 12];
      const skeleton = createSkeleton([
        createStaffSkeleton({
          nightShiftDays: [3, 10],
          nightShiftFollowupDays: originalFollowups,
        }),
      ]);

      const fixed = autoFixSkeleton(skeleton, 30);

      expect(fixed.staffSchedules[0].nightShiftFollowupDays).toEqual(originalFollowups);
    });

    it('夜勤がない場合、nightShiftFollowupDaysを生成しない', () => {
      const skeleton = createSkeleton([
        createStaffSkeleton({
          nightShiftDays: [],
          nightShiftFollowupDays: [],
        }),
      ]);

      const fixed = autoFixSkeleton(skeleton, 30);

      expect(fixed.staffSchedules[0].nightShiftFollowupDays).toEqual([]);
    });

    it('月末境界: daysInMonthを超える日は生成しない', () => {
      const skeleton = createSkeleton([
        createStaffSkeleton({
          nightShiftDays: [29, 30],
          nightShiftFollowupDays: [],
        }),
      ]);

      const fixed = autoFixSkeleton(skeleton, 30); // 30日の月

      const followups = fixed.staffSchedules[0].nightShiftFollowupDays;
      expect(followups).toContain(30); // 29+1
      expect(followups).not.toContain(31); // 29+2 は月外
      expect(followups).not.toContain(32); // 30+2 は月外
    });

    it('重複排除とソートが正しく行われる', () => {
      const skeleton = createSkeleton([
        createStaffSkeleton({
          nightShiftDays: [3, 4], // 4日の明け休み(5日)と3日の公休(5日)が重複
          nightShiftFollowupDays: [],
        }),
      ]);

      const fixed = autoFixSkeleton(skeleton, 30);

      const followups = fixed.staffSchedules[0].nightShiftFollowupDays;
      // 重複排除: 4, 5, 5, 6 → 4, 5, 6
      expect(followups).toEqual([4, 5, 6]);
      // ソート済み確認
      expect(followups).toEqual([...followups].sort((a, b) => a - b));
    });

    it('複数スタッフを正しく処理する', () => {
      const skeleton = createSkeleton([
        createStaffSkeleton({
          staffId: 'staff-001',
          nightShiftDays: [3],
          nightShiftFollowupDays: [],
        }),
        createStaffSkeleton({
          staffId: 'staff-002',
          nightShiftDays: [10],
          nightShiftFollowupDays: [11, 12], // 既存
        }),
      ]);

      const fixed = autoFixSkeleton(skeleton, 30);

      expect(fixed.staffSchedules[0].nightShiftFollowupDays).toEqual([4, 5]);
      expect(fixed.staffSchedules[1].nightShiftFollowupDays).toEqual([11, 12]); // 変更なし
    });

    it('daysInMonth不正値の場合、警告を出して31を使用', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(console, 'log').mockImplementation(); // 自動修正ログを抑制
      const skeleton = createSkeleton([
        createStaffSkeleton({
          nightShiftDays: [30],
          nightShiftFollowupDays: [],
        }),
      ]);

      const fixed = autoFixSkeleton(skeleton, 0); // 不正値

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('daysInMonth の値が不正です: 0'));
      // 31として処理されるので、31日も生成される
      expect(fixed.staffSchedules[0].nightShiftFollowupDays).toContain(31);
      consoleSpy.mockRestore();
    });
  });

  describe('統合シナリオ', () => {
    it('Phase 1出力 → バリデーション → 自動修正 → Phase 2入力の完全フロー', () => {
      const staffList = [
        createStaff({ id: 'staff-001', name: 'テスト太郎' }),
        createStaff({ id: 'staff-002', name: 'テスト花子' }),
      ];

      // Phase 1出力（nightShiftFollowupDays欠落）
      const phase1Output = createSkeleton([
        createStaffSkeleton({
          staffId: 'staff-001',
          nightShiftDays: [3, 17],
          nightShiftFollowupDays: [], // 欠落！
        }),
        createStaffSkeleton({
          staffId: 'staff-002',
          nightShiftDays: [10],
          nightShiftFollowupDays: [11, 12], // 正常
        }),
      ]);

      // Step 1: Phase 1出力バリデーション
      const phase1Validation = validateSkeletonOutput(phase1Output, staffList, true);
      expect(phase1Validation.isValid).toBe(false);

      // Step 2: 自動修正
      const fixedSkeleton = autoFixSkeleton(phase1Output, 30);

      // Step 3: 修正後再バリデーション
      const revalidation = validateSkeletonOutput(fixedSkeleton, staffList, true);
      expect(revalidation.isValid).toBe(true);

      // Step 4: Phase 2入力バリデーション
      const phase2Validation = validatePhase2Input(fixedSkeleton, staffList, true);
      expect(phase2Validation.isValid).toBe(true);

      // 修正内容確認
      expect(fixedSkeleton.staffSchedules[0].nightShiftFollowupDays).toContain(4);
      expect(fixedSkeleton.staffSchedules[0].nightShiftFollowupDays).toContain(5);
      expect(fixedSkeleton.staffSchedules[0].nightShiftFollowupDays).toContain(18);
      expect(fixedSkeleton.staffSchedules[0].nightShiftFollowupDays).toContain(19);
    });
  });
});
