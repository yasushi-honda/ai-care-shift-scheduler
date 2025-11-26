/**
 * Phase 40: AI評価・フィードバック機能
 * 評価ロジック実装
 *
 * シフトスケジュールに対する制約違反検出と評価スコア計算を行う
 */

import { Timestamp } from 'firebase-admin/firestore';
import {
  Staff,
  StaffSchedule,
  ShiftRequirement,
  LeaveRequest,
  ConstraintViolation,
  AIEvaluationResult,
  Recommendation,
  SimulationResult,
} from '../types';

/**
 * 評価入力データ
 */
export interface EvaluationInput {
  schedule: StaffSchedule[];
  staffList: Staff[];
  requirements: ShiftRequirement;
  leaveRequests: LeaveRequest;
}

/**
 * 評価サービスクラス
 *
 * シフトスケジュールの評価・制約違反検出・改善提案生成を行う
 */
export class EvaluationService {
  /**
   * シフトスケジュールを評価し、制約違反と改善提案を生成
   */
  evaluateSchedule(input: EvaluationInput): AIEvaluationResult {
    const violations: ConstraintViolation[] = [];

    // 各制約チェックを実行
    violations.push(
      ...this.checkStaffShortage(input.schedule, input.requirements)
    );
    violations.push(
      ...this.checkConsecutiveWorkViolation(input.schedule, input.staffList)
    );
    violations.push(...this.checkNightRestViolation(input.schedule));
    violations.push(
      ...this.checkQualificationMissing(
        input.schedule,
        input.staffList,
        input.requirements
      )
    );
    violations.push(
      ...this.checkLeaveRequestIgnored(input.schedule, input.leaveRequests)
    );

    // スコア計算
    const overallScore = this.calculateOverallScore(violations);
    const fulfillmentRate = this.calculateFulfillmentRate(
      input.schedule,
      input.requirements
    );

    // 改善提案生成
    const recommendations = this.generateRecommendations(violations, input);

    // シミュレーション結果生成
    const simulation = this.generateSimulation(input, violations);

    return {
      overallScore,
      fulfillmentRate,
      constraintViolations: violations,
      recommendations,
      simulation,
      generatedAt: Timestamp.now(),
    };
  }

  /**
   * 人員不足を検出
   *
   * 各日・各シフトの配置人数が要件を満たしているかをチェック
   */
  checkStaffShortage(
    schedule: StaffSchedule[],
    requirements: ShiftRequirement
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const targetMonth = requirements.targetMonth;

    // 対象月の日数を取得
    const [year, month] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 各日の配置人数をカウント
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${targetMonth}-${String(day).padStart(2, '0')}`;
      const dailyStaffByShift: Record<string, string[]> = {};

      // 各スタッフのシフトをカウント
      for (const staffSchedule of schedule) {
        const shift = staffSchedule.monthlyShifts.find((s) => s.date === date);
        if (shift && shift.shiftType && shift.shiftType !== '休') {
          const shiftType = shift.shiftType;
          if (!dailyStaffByShift[shiftType]) {
            dailyStaffByShift[shiftType] = [];
          }
          dailyStaffByShift[shiftType].push(staffSchedule.staffId);
        }
      }

      // 要件と比較
      for (const [shiftName, requirement] of Object.entries(
        requirements.requirements
      )) {
        const assignedStaff = dailyStaffByShift[shiftName] || [];
        const shortage = requirement.totalStaff - assignedStaff.length;

        if (shortage > 0) {
          violations.push({
            type: 'staffShortage',
            severity: 'error',
            description: `${date}の${shiftName}で${shortage}名の人員不足`,
            affectedDates: [date],
            suggestion: `${shiftName}に追加の配置を検討してください`,
          });
        }
      }
    }

    return violations;
  }

  /**
   * 連続勤務超過を検出
   *
   * 各スタッフの連続勤務日数がmaxConsecutiveWorkDaysを超えていないかをチェック
   */
  checkConsecutiveWorkViolation(
    schedule: StaffSchedule[],
    staffList: Staff[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const DEFAULT_MAX_CONSECUTIVE = 5; // デフォルト連勤上限

    for (const staffSchedule of schedule) {
      const staff = staffList.find((s) => s.id === staffSchedule.staffId);
      if (!staff) continue;

      const maxConsecutive = staff.maxConsecutiveWorkDays ?? DEFAULT_MAX_CONSECUTIVE;
      const shifts = [...staffSchedule.monthlyShifts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      let consecutiveDays = 0;
      let startDate = '';
      const violatingPeriods: { start: string; end: string }[] = [];

      for (let i = 0; i < shifts.length; i++) {
        const shift = shifts[i];
        const isWorkDay =
          shift.shiftType && shift.shiftType !== '休' && shift.shiftType !== '明け休み';

        if (isWorkDay) {
          if (consecutiveDays === 0) {
            startDate = shift.date;
          }
          consecutiveDays++;

          // 連勤超過を検出（境界値：ちょうど上限は違反にならない）
          if (consecutiveDays > maxConsecutive) {
            // 前日までの期間を記録（まだ記録していない場合）
            if (
              violatingPeriods.length === 0 ||
              violatingPeriods[violatingPeriods.length - 1].end !== shifts[i - 1]?.date
            ) {
              violatingPeriods.push({
                start: startDate,
                end: shift.date,
              });
            } else {
              // 継続中の違反期間を更新
              violatingPeriods[violatingPeriods.length - 1].end = shift.date;
            }
          }
        } else {
          consecutiveDays = 0;
        }
      }

      // 違反期間があれば報告
      for (const period of violatingPeriods) {
        violations.push({
          type: 'consecutiveWork',
          severity: 'warning',
          description: `${staff.name}さんが${period.start}から${period.end}まで${maxConsecutive}日を超える連勤`,
          affectedStaff: [staffSchedule.staffId],
          affectedDates: [period.start, period.end],
          suggestion: `連勤を${maxConsecutive}日以内に調整してください`,
        });
      }
    }

    return violations;
  }

  /**
   * 夜勤後休息不足を検出
   *
   * 夜勤の翌日が「休み」または「明け休み」でない場合を検出
   */
  checkNightRestViolation(schedule: StaffSchedule[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const staffSchedule of schedule) {
      const shifts = [...staffSchedule.monthlyShifts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      for (let i = 0; i < shifts.length - 1; i++) {
        const currentShift = shifts[i];
        const nextShift = shifts[i + 1];

        // 夜勤かどうかをチェック（「夜勤」または「夜」を含むシフト）
        const isNightShift =
          currentShift.shiftType?.includes('夜勤') ||
          currentShift.shiftType?.includes('夜');

        if (isNightShift) {
          // 翌日が連続しているかチェック（DST対策: UTC日付で比較）
          const currentDate = new Date(currentShift.date + 'T00:00:00Z');
          const nextDate = new Date(nextShift.date + 'T00:00:00Z');
          const diffDays =
            (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);

          if (diffDays === 1) {
            // 翌日が「休み」または「明け休み」でない場合は違反
            const nextShiftType = nextShift.shiftType || '';
            const isRest =
              nextShiftType === '休' ||
              nextShiftType.includes('明け') ||
              nextShiftType.includes('公休');

            if (!isRest) {
              violations.push({
                type: 'nightRestViolation',
                severity: 'warning',
                description: `${staffSchedule.staffName}さんの${currentShift.date}の夜勤後に休息がありません`,
                affectedStaff: [staffSchedule.staffId],
                affectedDates: [currentShift.date, nextShift.date],
                suggestion: `夜勤の翌日は「明け休み」または「休」を設定してください`,
              });
            }
          }
        }
      }
    }

    return violations;
  }

  /**
   * 資格要件未充足を検出
   */
  checkQualificationMissing(
    schedule: StaffSchedule[],
    staffList: Staff[],
    requirements: ShiftRequirement
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const targetMonth = requirements.targetMonth;

    // 対象月の日数を取得
    const [year, month] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 各日の資格保有者をカウント
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${targetMonth}-${String(day).padStart(2, '0')}`;

      for (const [shiftName, requirement] of Object.entries(
        requirements.requirements
      )) {
        // 各資格要件をチェック
        for (const qualReq of requirement.requiredQualifications || []) {
          let qualifiedCount = 0;

          for (const staffSchedule of schedule) {
            const shift = staffSchedule.monthlyShifts.find(
              (s) => s.date === date
            );
            if (shift && shift.shiftType === shiftName) {
              const staff = staffList.find(
                (s) => s.id === staffSchedule.staffId
              );
              if (staff?.qualifications?.includes(qualReq.qualification)) {
                qualifiedCount++;
              }
            }
          }

          if (qualifiedCount < qualReq.count) {
            violations.push({
              type: 'qualificationMissing',
              severity: 'error',
              description: `${date}の${shiftName}で${qualReq.qualification}が${qualReq.count - qualifiedCount}名不足`,
              affectedDates: [date],
              suggestion: `${qualReq.qualification}保有者を追加配置してください`,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * 休暇希望未反映を検出
   */
  checkLeaveRequestIgnored(
    schedule: StaffSchedule[],
    leaveRequests: LeaveRequest
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const [staffId, requests] of Object.entries(leaveRequests || {})) {
      const staffSchedule = schedule.find((s) => s.staffId === staffId);
      if (!staffSchedule) continue;

      for (const [date, leaveType] of Object.entries(requests || {})) {
        const shift = staffSchedule.monthlyShifts.find((s) => s.date === date);

        if (shift) {
          const shiftType = shift.shiftType || '';
          // 休暇希望日に勤務が入っている場合
          const isWorking =
            shiftType !== '休' &&
            shiftType !== '有給' &&
            shiftType !== '公休' &&
            !shiftType.includes('休');

          if (isWorking) {
            violations.push({
              type: 'leaveRequestIgnored',
              severity: 'warning',
              description: `${staffSchedule.staffName}さんの${date}の${leaveType}希望が反映されていません`,
              affectedStaff: [staffId],
              affectedDates: [date],
              suggestion: `${date}を${leaveType}に変更することを検討してください`,
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * 総合スコアを計算
   *
   * 100点から違反に応じて減点
   * - error: -10点
   * - warning: -5点
   */
  calculateOverallScore(violations: ConstraintViolation[]): number {
    let score = 100;

    for (const violation of violations) {
      if (violation.severity === 'error') {
        score -= 10;
      } else if (violation.severity === 'warning') {
        score -= 5;
      }
    }

    return Math.max(0, score);
  }

  /**
   * 充足率を計算
   *
   * (実際の配置人数 / 必要人数) * 100
   */
  calculateFulfillmentRate(
    schedule: StaffSchedule[],
    requirements: ShiftRequirement
  ): number {
    const targetMonth = requirements.targetMonth;
    const [year, month] = targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let totalRequired = 0;
    let totalAssigned = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${targetMonth}-${String(day).padStart(2, '0')}`;

      for (const [shiftName, requirement] of Object.entries(
        requirements.requirements
      )) {
        totalRequired += requirement.totalStaff;

        // 実際の配置人数をカウント
        let assigned = 0;
        for (const staffSchedule of schedule) {
          const shift = staffSchedule.monthlyShifts.find(
            (s) => s.date === date
          );
          if (shift && shift.shiftType === shiftName) {
            assigned++;
          }
        }
        totalAssigned += Math.min(assigned, requirement.totalStaff);
      }
    }

    if (totalRequired === 0) return 100;
    return Math.round((totalAssigned / totalRequired) * 100);
  }

  /**
   * 改善提案を生成
   */
  private generateRecommendations(
    violations: ConstraintViolation[],
    input: EvaluationInput
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 人員不足が多い場合
    const shortageCount = violations.filter(
      (v) => v.type === 'staffShortage'
    ).length;
    if (shortageCount >= 5) {
      recommendations.push({
        priority: 'high',
        category: 'staffing',
        description: '複数日で人員不足が発生しています',
        action: 'スタッフの追加採用または配置調整を検討してください',
      });
    }

    // 連勤超過が多い場合
    const consecutiveCount = violations.filter(
      (v) => v.type === 'consecutiveWork'
    ).length;
    if (consecutiveCount >= 2) {
      recommendations.push({
        priority: 'high',
        category: 'workload',
        description: '複数スタッフで連勤超過が発生しています',
        action: 'シフトパターンの見直しを検討してください',
      });
    }

    // 夜勤後休息不足がある場合
    const nightRestCount = violations.filter(
      (v) => v.type === 'nightRestViolation'
    ).length;
    if (nightRestCount > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'workload',
        description: '夜勤後の休息が確保されていないケースがあります',
        action: '夜勤翌日に明け休みを設定してください',
      });
    }

    // 休暇希望未反映がある場合
    const leaveIgnoredCount = violations.filter(
      (v) => v.type === 'leaveRequestIgnored'
    ).length;
    if (leaveIgnoredCount > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'fairness',
        description: '一部の休暇希望が反映されていません',
        action: '可能な範囲で休暇希望を調整してください',
      });
    }

    // 違反が少ない場合のポジティブフィードバック
    if (violations.length === 0) {
      recommendations.push({
        priority: 'low',
        category: 'general',
        description: 'すべての制約を満たしています',
        action: 'このシフト案は良好です。確定を検討してください',
      });
    }

    return recommendations;
  }

  /**
   * シミュレーション結果を生成
   */
  private generateSimulation(
    input: EvaluationInput,
    violations: ConstraintViolation[]
  ): SimulationResult {
    // 残業時間予測（簡易計算）
    const shortageViolations = violations.filter(
      (v) => v.type === 'staffShortage'
    );
    // 人員不足1件あたり約2時間の残業と仮定
    const estimatedOvertimeHours = shortageViolations.length * 2;

    // 負荷バランス評価
    let workloadBalance: 'good' | 'fair' | 'poor' = 'good';
    const consecutiveViolations = violations.filter(
      (v) => v.type === 'consecutiveWork'
    );
    if (consecutiveViolations.length >= 3) {
      workloadBalance = 'poor';
    } else if (consecutiveViolations.length >= 1) {
      workloadBalance = 'fair';
    }

    // 有給消化率予測（休暇希望反映率に基づく）
    const leaveIgnoredViolations = violations.filter(
      (v) => v.type === 'leaveRequestIgnored'
    );
    const totalLeaveRequests = Object.values(input.leaveRequests || {}).reduce(
      (sum, requests) => sum + Object.keys(requests || {}).length,
      0
    );
    const paidLeaveUsageRate =
      totalLeaveRequests > 0
        ? Math.round(
            ((totalLeaveRequests - leaveIgnoredViolations.length) /
              totalLeaveRequests) *
              100
          )
        : 100;

    // リスク要因
    const risks: string[] = [];
    if (shortageViolations.length > 0) {
      risks.push('人員不足による業務負荷増加');
    }
    if (consecutiveViolations.length > 0) {
      risks.push('連勤によるスタッフ疲労');
    }
    if (leaveIgnoredViolations.length > 0) {
      risks.push('休暇希望未反映によるモチベーション低下');
    }

    return {
      estimatedOvertimeHours,
      workloadBalance,
      paidLeaveUsageRate,
      risks,
    };
  }
}

/**
 * デフォルトの評価結果を生成（フォールバック用）
 * 呼び出し時にTimestamp.now()を評価するためファクトリ関数として実装
 */
export const createDefaultEvaluation = (): AIEvaluationResult => ({
  overallScore: -1, // 未評価を示す
  fulfillmentRate: -1,
  constraintViolations: [],
  recommendations: [
    {
      priority: 'medium',
      category: 'system',
      description: '評価データの生成に失敗しました',
      action: '手動でシフトを確認してください',
    },
  ],
  simulation: {
    estimatedOvertimeHours: 0,
    workloadBalance: 'fair',
    paidLeaveUsageRate: 0,
    risks: ['評価データが利用できません'],
  },
  generatedAt: Timestamp.now(),
});

/**
 * @deprecated createDefaultEvaluation()を使用してください
 */
export const DEFAULT_EVALUATION = createDefaultEvaluation();
