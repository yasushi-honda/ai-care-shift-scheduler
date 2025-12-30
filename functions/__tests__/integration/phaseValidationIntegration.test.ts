/**
 * Phase間バリデーション 統合テスト
 *
 * Phase 1（骨子生成）→ Phase 2（詳細生成）のデータ受け渡しを
 * 実際のシナリオに近い形でテスト
 *
 * @see .kiro/steering/phased-generation-contract.md
 */

import {
  validateSkeletonOutput,
  validatePhase2Input,
  autoFixSkeleton,
  logValidationResult,
} from '../../src/phase-validation';
import { checkResponseHealth } from '../../src/ai-response-monitor';
import type { ScheduleSkeleton, StaffScheduleSkeleton, Staff } from '../../src/types';
import { Role, Qualification, TimeSlotPreference } from '../../src/types';

describe('Phase間バリデーション統合テスト', () => {
  // 現実的なテストデータ
  const createRealisticStaffList = (count: number): Staff[] => {
    const roles = [Role.CareWorker, Role.Nurse, Role.CareManager];
    const qualifications = [
      [Qualification.CertifiedCareWorker],
      [Qualification.CertifiedCareWorker, Qualification.DriversLicense],
      [Qualification.RegisteredNurse],
    ];

    return Array.from({ length: count }, (_, i) => ({
      id: `staff-${String(i + 1).padStart(3, '0')}`,
      name: `スタッフ${i + 1}`,
      role: roles[i % roles.length],
      qualifications: qualifications[i % qualifications.length],
      weeklyWorkCount: { hope: 5, must: 4 },
      maxConsecutiveWorkDays: 5,
      availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
      unavailableDates: [],
      timeSlotPreference: TimeSlotPreference.Any,
      isNightShiftOnly: i % 5 === 0, // 20%が夜勤専従
    }));
  };

  const createRealisticSkeleton = (staffList: Staff[], hasNightShift: boolean): ScheduleSkeleton => {
    const staffSchedules: StaffScheduleSkeleton[] = staffList.map((staff, i) => {
      // 夜勤日を設定（夜勤専従は多め、それ以外は少なめ）
      const nightShiftDays: number[] = [];
      const nightShiftFollowupDays: number[] = [];

      if (hasNightShift) {
        const nightCount = staff.isNightShiftOnly ? 6 : 2;
        for (let j = 0; j < nightCount; j++) {
          const day = 3 + j * 5 + (i % 3); // スタッフごとに分散
          if (day <= 28) {
            nightShiftDays.push(day);
            nightShiftFollowupDays.push(day + 1); // 明け休み
            nightShiftFollowupDays.push(day + 2); // 公休
          }
        }
      }

      // 休日を設定（週2日）
      const restDays: number[] = [];
      for (let week = 0; week < 4; week++) {
        const baseDay = week * 7 + 6 + (i % 2); // 土日をずらす
        if (baseDay <= 30) restDays.push(baseDay);
        if (baseDay + 1 <= 30) restDays.push(baseDay + 1);
      }

      return {
        staffId: staff.id,
        staffName: staff.name,
        restDays,
        nightShiftDays,
        nightShiftFollowupDays,
      };
    });

    return { staffSchedules };
  };

  describe('BUG-023再発防止シナリオ', () => {
    it('Phase 1で欠落したnightShiftFollowupDaysがPhase 2前に検出される', () => {
      const staffList = createRealisticStaffList(12);

      // Phase 1の出力をシミュレート（BUG-023パターン: followupDays欠落）
      const brokenPhase1Output: ScheduleSkeleton = {
        staffSchedules: staffList.map(staff => ({
          staffId: staff.id,
          staffName: staff.name,
          restDays: [6, 7, 13, 14, 20, 21, 27, 28],
          nightShiftDays: staff.isNightShiftOnly ? [3, 8, 13, 18, 23, 28] : [5, 15],
          nightShiftFollowupDays: [], // BUG-023: 空！
        })),
      };

      // Phase 1出力バリデーション
      const phase1Result = validateSkeletonOutput(brokenPhase1Output, staffList, true);

      // 問題が検出されること
      expect(phase1Result.isValid).toBe(false);
      expect(phase1Result.errors.some(e => e.type === 'constraint_violation')).toBe(true);

      // Phase 2入力バリデーション
      const phase2Result = validatePhase2Input(brokenPhase1Output, staffList, true);

      // Phase 2でも問題が検出されること
      expect(phase2Result.isValid).toBe(false);
      expect(phase2Result.errors.some(e => e.field === 'nightShiftFollowupDays')).toBe(true);
    });

    it('autoFixSkeletonでBUG-023を自動修復できる', () => {
      const staffList = createRealisticStaffList(12);

      // BUG-023パターンのPhase 1出力
      const brokenOutput: ScheduleSkeleton = {
        staffSchedules: staffList.map(staff => ({
          staffId: staff.id,
          staffName: staff.name,
          restDays: [6, 7, 13, 14, 20, 21, 27, 28],
          nightShiftDays: [3, 10, 17],
          nightShiftFollowupDays: [], // 欠落
        })),
      };

      // 自動修正
      const fixed = autoFixSkeleton(brokenOutput, 30);

      // 修正後のバリデーション
      const validationResult = validateSkeletonOutput(fixed, staffList, true);
      expect(validationResult.isValid).toBe(true);

      // Phase 2入力として有効
      const phase2Result = validatePhase2Input(fixed, staffList, true);
      expect(phase2Result.isValid).toBe(true);

      // 各スタッフのfollowupDaysが正しく生成されている
      for (const sched of fixed.staffSchedules) {
        expect(sched.nightShiftFollowupDays).toContain(4);  // 3+1
        expect(sched.nightShiftFollowupDays).toContain(5);  // 3+2
        expect(sched.nightShiftFollowupDays).toContain(11); // 10+1
        expect(sched.nightShiftFollowupDays).toContain(12); // 10+2
        expect(sched.nightShiftFollowupDays).toContain(18); // 17+1
        expect(sched.nightShiftFollowupDays).toContain(19); // 17+2
      }
    });
  });

  describe('大規模施設シナリオ', () => {
    it('20名規模のスタッフリストでバリデーションが正常動作', () => {
      const staffList = createRealisticStaffList(20);
      const skeleton = createRealisticSkeleton(staffList, true);

      const result = validateSkeletonOutput(skeleton, staffList, true);

      // 正常に生成されたデータはバリデーション通過
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('部分的なスタッフ欠落を検出', () => {
      const staffList = createRealisticStaffList(20);
      const skeleton = createRealisticSkeleton(staffList.slice(0, 18), true); // 2名欠落

      const result = validateSkeletonOutput(skeleton, staffList, true);

      expect(result.isValid).toBe(false);
      expect(result.errors.filter(e => e.type === 'missing_field')).toHaveLength(2);
    });
  });

  describe('デイサービス（夜勤なし）シナリオ', () => {
    it('夜勤なし施設ではnightShift関連フィールドをスキップ', () => {
      const staffList = createRealisticStaffList(8);
      const skeleton: ScheduleSkeleton = {
        staffSchedules: staffList.map(staff => ({
          staffId: staff.id,
          staffName: staff.name,
          restDays: [6, 7, 13, 14, 20, 21, 27, 28],
          nightShiftDays: [], // 夜勤なし
          nightShiftFollowupDays: [], // followupも空
        })),
      };

      // hasNightShift = false
      const result = validateSkeletonOutput(skeleton, staffList, false);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('AIレスポンス監視との連携', () => {
    it('BUG-022パターン検出とバリデーションの組み合わせ', () => {
      // BUG-022: thinkingトークン過剰消費
      const bug022Response = {
        text: '', // 空レスポンス
        candidates: [{ finishReason: 'STOP' }],
        usageMetadata: {
          thoughtsTokenCount: 65533,
          candidatesTokenCount: 2,
          totalTokenCount: 65536,
        },
      };

      const healthResult = checkResponseHealth(bug022Response, 'Phase1 Generation');

      // 健全性チェックで問題検出
      expect(healthResult.isHealthy).toBe(false);
      expect(healthResult.issues.some(i => i.includes('BUG-022'))).toBe(true);

      // 空レスポンスの場合、JSON解析失敗 → バリデーション以前の問題
      // 実際の実装ではフォールバック処理が発動する
    });

    it('正常なAIレスポンスからのバリデーションフロー', () => {
      // 正常なAIレスポンス
      const normalResponse = {
        text: JSON.stringify({
          staffSchedules: [
            {
              staffId: 'staff-001',
              staffName: 'テスト太郎',
              restDays: [6, 7],
              nightShiftDays: [3],
              nightShiftFollowupDays: [4, 5],
            },
          ],
        }),
        candidates: [{ finishReason: 'STOP' }],
        usageMetadata: {
          thoughtsTokenCount: 5000,
          candidatesTokenCount: 10000,
          totalTokenCount: 16000,
        },
      };

      // Step 1: 健全性チェック
      const healthResult = checkResponseHealth(normalResponse, 'Phase1 Generation');
      expect(healthResult.isHealthy).toBe(true);

      // Step 2: JSON解析
      const skeleton: ScheduleSkeleton = JSON.parse(normalResponse.text);

      // Step 3: バリデーション
      const staffList: Staff[] = [{
        id: 'staff-001',
        name: 'テスト太郎',
        role: Role.CareWorker,
        qualifications: [],
        weeklyWorkCount: { hope: 5, must: 4 },
        maxConsecutiveWorkDays: 5,
        availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
        unavailableDates: [],
        timeSlotPreference: TimeSlotPreference.Any,
        isNightShiftOnly: false,
      }];

      const validationResult = validateSkeletonOutput(skeleton, staffList, true);
      expect(validationResult.isValid).toBe(true);
    });
  });

  describe('月末境界の現実的シナリオ', () => {
    it('30日の月で28日夜勤は正常処理', () => {
      const staffList = createRealisticStaffList(1);
      const skeleton: ScheduleSkeleton = {
        staffSchedules: [{
          staffId: staffList[0].id,
          staffName: staffList[0].name,
          restDays: [6, 7],
          nightShiftDays: [28],
          nightShiftFollowupDays: [29, 30], // 28+1, 28+2
        }],
      };

      // daysInMonth = 30（4月、6月など）
      const result = validateSkeletonOutput(skeleton, staffList, true, 30);
      expect(result.isValid).toBe(true);
    });

    it('31日の月で30日夜勤のautoFix境界処理', () => {
      const staffList = createRealisticStaffList(1);
      const skeleton: ScheduleSkeleton = {
        staffSchedules: [{
          staffId: staffList[0].id,
          staffName: staffList[0].name,
          restDays: [6, 7],
          nightShiftDays: [30],
          nightShiftFollowupDays: [], // 欠落
        }],
      };

      const fixed = autoFixSkeleton(skeleton, 31);

      // 31日は含まれる、32日は含まれない
      expect(fixed.staffSchedules[0].nightShiftFollowupDays).toContain(31);
      expect(fixed.staffSchedules[0].nightShiftFollowupDays).not.toContain(32);
    });

    it('2月（28日）で27日夜勤のバリデーション', () => {
      const staffList = createRealisticStaffList(1);
      const skeleton: ScheduleSkeleton = {
        staffSchedules: [{
          staffId: staffList[0].id,
          staffName: staffList[0].name,
          restDays: [6, 7],
          nightShiftDays: [27],
          nightShiftFollowupDays: [28], // 27+1のみ、29日は月外
        }],
      };

      // daysInMonth = 28（2月、非閏年）
      const result = validateSkeletonOutput(skeleton, staffList, true, 28);
      expect(result.isValid).toBe(true);
      expect(result.warnings.filter(w => w.message.includes('29日'))).toHaveLength(0);
    });
  });

  describe('ログ出力テスト', () => {
    it('logValidationResultがエラーを正しくログ出力', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = {
        isValid: false,
        errors: [
          { type: 'missing_field' as const, field: 'nightShiftFollowupDays', message: 'テストエラー', severity: 'error' as const },
        ],
        warnings: [],
      };

      logValidationResult('Phase1', result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Phase1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('テストエラー'));

      consoleSpy.mockRestore();
    });

    it('logValidationResultが警告を正しくログ出力', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = {
        isValid: true,
        errors: [],
        warnings: [
          { type: 'constraint_violation' as const, field: 'nightShiftFollowupDays', message: 'テスト警告', severity: 'warning' as const },
        ],
      };

      logValidationResult('Phase1', result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Phase1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('テスト警告'));

      consoleSpy.mockRestore();
    });

    it('全て正常な場合はOKログ', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      logValidationResult('Phase2', result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Phase2'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('OK'));

      consoleSpy.mockRestore();
    });
  });
});
