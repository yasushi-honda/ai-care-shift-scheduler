/**
 * シミュレーション結果生成
 *
 * シフトスケジュールの評価に基づいてシミュレーション結果を生成する
 */

import {
  ConstraintViolation,
  SimulationResult,
  LeaveRequest,
} from '../types';

/**
 * シミュレーション入力データ
 */
export interface SimulationInput {
  leaveRequests: LeaveRequest;
}

/**
 * シミュレーション結果を生成
 *
 * @param input シミュレーション入力（休暇リクエスト）
 * @param violations 制約違反リスト
 * @returns シミュレーション結果
 */
export function generateSimulation(
  input: SimulationInput,
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
