/**
 * simulationGenerator.ts ユニットテスト
 *
 * シミュレーション結果生成機能をテスト
 */

import {
  generateSimulation,
  SimulationInput,
} from '../../src/evaluation/simulationGenerator';
import {
  ConstraintViolation,
  LeaveType,
} from '../../src/types';

describe('generateSimulation', () => {
  // テストデータ作成ヘルパー
  const createInput = (leaveRequests: SimulationInput['leaveRequests'] = {}): SimulationInput => ({
    leaveRequests,
  });

  const createViolation = (
    type: ConstraintViolation['type'],
    overrides?: Partial<ConstraintViolation>
  ): ConstraintViolation => ({
    type,
    severity: 'warning',
    description: `${type}の違反`,
    ...overrides,
  });

  describe('残業時間予測（estimatedOvertimeHours）', () => {
    it('人員不足がない場合、残業時間は0', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [];

      const result = generateSimulation(input, violations);

      expect(result.estimatedOvertimeHours).toBe(0);
    });

    it('人員不足1件につき2時間の残業を予測', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.estimatedOvertimeHours).toBe(2);
    });

    it('人員不足5件で10時間の残業を予測', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = Array(5)
        .fill(null)
        .map(() => createViolation('staffShortage'));

      const result = generateSimulation(input, violations);

      expect(result.estimatedOvertimeHours).toBe(10);
    });

    it('人員不足以外の違反は残業時間に影響しない', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('consecutiveWork'),
        createViolation('leaveRequestIgnored'),
        createViolation('nightRestViolation'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.estimatedOvertimeHours).toBe(0);
    });
  });

  describe('負荷バランス評価（workloadBalance）', () => {
    it('連勤違反がない場合、goodを返す', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [];

      const result = generateSimulation(input, violations);

      expect(result.workloadBalance).toBe('good');
    });

    it('連勤違反が1件の場合、fairを返す', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('consecutiveWork'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.workloadBalance).toBe('fair');
    });

    it('連勤違反が2件の場合、fairを返す', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('consecutiveWork'),
        createViolation('consecutiveWork'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.workloadBalance).toBe('fair');
    });

    it('連勤違反が3件以上の場合、poorを返す', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('consecutiveWork'),
        createViolation('consecutiveWork'),
        createViolation('consecutiveWork'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.workloadBalance).toBe('poor');
    });

    it('連勤違反が5件の場合もpoorを返す', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = Array(5)
        .fill(null)
        .map(() => createViolation('consecutiveWork'));

      const result = generateSimulation(input, violations);

      expect(result.workloadBalance).toBe('poor');
    });

    it('連勤以外の違反は負荷バランスに影響しない', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage'),
        createViolation('staffShortage'),
        createViolation('staffShortage'),
        createViolation('staffShortage'),
        createViolation('staffShortage'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.workloadBalance).toBe('good');
    });
  });

  describe('有給消化率（paidLeaveUsageRate）', () => {
    it('休暇希望がない場合、100%を返す', () => {
      const input = createInput({});
      const violations: ConstraintViolation[] = [];

      const result = generateSimulation(input, violations);

      expect(result.paidLeaveUsageRate).toBe(100);
    });

    it('全ての休暇希望が反映された場合、100%を返す', () => {
      const input = createInput({
        'staff-001': {
          '2025-11-10': LeaveType.PaidLeave,
          '2025-11-15': LeaveType.Hope,
        },
        'staff-002': {
          '2025-11-20': LeaveType.PaidLeave,
        },
      });
      // 休暇希望3件、違反なし
      const violations: ConstraintViolation[] = [];

      const result = generateSimulation(input, violations);

      expect(result.paidLeaveUsageRate).toBe(100);
    });

    it('一部の休暇希望が無視された場合、正しい消化率を返す', () => {
      const input = createInput({
        'staff-001': {
          '2025-11-10': LeaveType.PaidLeave,
          '2025-11-15': LeaveType.Hope,
        },
        'staff-002': {
          '2025-11-20': LeaveType.PaidLeave,
        },
      });
      // 休暇希望3件中1件が無視
      const violations: ConstraintViolation[] = [
        createViolation('leaveRequestIgnored'),
      ];

      const result = generateSimulation(input, violations);

      // (3 - 1) / 3 * 100 = 66.67 → 67%
      expect(result.paidLeaveUsageRate).toBe(67);
    });

    it('全ての休暇希望が無視された場合、0%を返す', () => {
      const input = createInput({
        'staff-001': {
          '2025-11-10': LeaveType.PaidLeave,
        },
      });
      // 休暇希望1件中1件が無視
      const violations: ConstraintViolation[] = [
        createViolation('leaveRequestIgnored'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.paidLeaveUsageRate).toBe(0);
    });

    it('半分の休暇希望が無視された場合、50%を返す', () => {
      const input = createInput({
        'staff-001': {
          '2025-11-10': LeaveType.PaidLeave,
          '2025-11-15': LeaveType.Hope,
        },
      });
      // 休暇希望2件中1件が無視
      const violations: ConstraintViolation[] = [
        createViolation('leaveRequestIgnored'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.paidLeaveUsageRate).toBe(50);
    });

    it('leaveRequestsがundefinedの場合、100%を返す', () => {
      const input = { leaveRequests: undefined as unknown as SimulationInput['leaveRequests'] };
      const violations: ConstraintViolation[] = [];

      const result = generateSimulation(input, violations);

      expect(result.paidLeaveUsageRate).toBe(100);
    });
  });

  describe('リスク要因（risks）', () => {
    it('違反がない場合、リスクは空', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [];

      const result = generateSimulation(input, violations);

      expect(result.risks).toHaveLength(0);
    });

    it('人員不足がある場合、業務負荷増加リスクを追加', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.risks).toContain('人員不足による業務負荷増加');
    });

    it('連勤違反がある場合、スタッフ疲労リスクを追加', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('consecutiveWork'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.risks).toContain('連勤によるスタッフ疲労');
    });

    it('休暇希望未反映がある場合、モチベーション低下リスクを追加', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('leaveRequestIgnored'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.risks).toContain('休暇希望未反映によるモチベーション低下');
    });

    it('複数の違反タイプがある場合、対応するリスクを全て追加', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage'),
        createViolation('consecutiveWork'),
        createViolation('leaveRequestIgnored'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.risks).toHaveLength(3);
      expect(result.risks).toContain('人員不足による業務負荷増加');
      expect(result.risks).toContain('連勤によるスタッフ疲労');
      expect(result.risks).toContain('休暇希望未反映によるモチベーション低下');
    });

    it('同じ違反タイプが複数あっても、リスクは重複しない', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage'),
        createViolation('staffShortage'),
        createViolation('staffShortage'),
      ];

      const result = generateSimulation(input, violations);

      // リスクは1つだけ
      const shortageRisks = result.risks.filter(r => r.includes('人員不足'));
      expect(shortageRisks).toHaveLength(1);
    });

    it('夜勤休息違反や資格要件未充足はリスクに含まれない', () => {
      const input = createInput();
      const violations: ConstraintViolation[] = [
        createViolation('nightRestViolation'),
        createViolation('qualificationMissing'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.risks).toHaveLength(0);
    });
  });

  describe('総合テスト', () => {
    it('全ての結果フィールドを正しく返す', () => {
      const input = createInput({
        'staff-001': {
          '2025-11-10': LeaveType.PaidLeave,
        },
      });
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage'),
        createViolation('staffShortage'),
        createViolation('consecutiveWork'),
      ];

      const result = generateSimulation(input, violations);

      expect(result).toEqual({
        estimatedOvertimeHours: 4, // 2件 × 2時間
        workloadBalance: 'fair', // 連勤1件
        paidLeaveUsageRate: 100, // 休暇希望1件、違反0件
        risks: [
          '人員不足による業務負荷増加',
          '連勤によるスタッフ疲労',
        ],
      });
    });

    it('最悪ケース：全ての問題が発生している場合', () => {
      const input = createInput({
        'staff-001': {
          '2025-11-10': LeaveType.PaidLeave,
          '2025-11-15': LeaveType.Hope,
        },
      });
      const violations: ConstraintViolation[] = [
        createViolation('staffShortage'),
        createViolation('staffShortage'),
        createViolation('staffShortage'),
        createViolation('consecutiveWork'),
        createViolation('consecutiveWork'),
        createViolation('consecutiveWork'),
        createViolation('leaveRequestIgnored'),
        createViolation('leaveRequestIgnored'),
      ];

      const result = generateSimulation(input, violations);

      expect(result.estimatedOvertimeHours).toBe(6); // 3件 × 2時間
      expect(result.workloadBalance).toBe('poor'); // 連勤3件以上
      expect(result.paidLeaveUsageRate).toBe(0); // 休暇希望2件中2件無視
      expect(result.risks).toHaveLength(3);
    });
  });
});
