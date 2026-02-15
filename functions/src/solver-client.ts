/**
 * Solver Client: Python Cloud Function (CP-SAT Solver) への連携モジュール
 *
 * 統合Solver: LLM不要の単一CP-SATモデルで全制約を一括求解。
 * ADR-0004: ハイブリッドアーキテクチャ採用方針に基づく全体最適化（Phase 3）。
 */

import type {
  Staff,
  ShiftRequirement,
  StaffSchedule,
  ScheduleSkeleton,
} from './types';

/**
 * Solver Cloud FunctionのURL
 * Firebase Functions 2nd gen: 関数ごとに固有URL（パス追加不要）
 */
const SOLVER_FUNCTION_URL = process.env.SOLVER_FUNCTION_URL || '';
const UNIFIED_SOLVER_FUNCTION_URL = process.env.UNIFIED_SOLVER_FUNCTION_URL || '';

interface SolverResponse {
  success: boolean;
  schedule: StaffSchedule[];
  solverStats: {
    status: string;
    solveTimeMs: number;
    numVariables: number;
    numConstraints: number;
    objectiveValue: number;
  };
}

interface SolverErrorResponse {
  success: false;
  error: string;
  errorType: string;
  details: Record<string, unknown>;
}

/**
 * CP-SAT Solver によるPhase 2シフト生成
 *
 * 既存のgenerateDetailedShiftsと同じ入出力インターフェースで、
 * LLMの代わりにSolverを使用する。
 *
 * @param staffList - スタッフリスト
 * @param skeleton - Phase 1で生成されたスケルトン
 * @param requirements - シフト要件
 * @param leaveRequests - 休暇申請（オプション）
 * @returns StaffSchedule[] - Phase 3（リバランス）と互換の形式
 */
export async function generateDetailedShiftsWithSolver(
  staffList: Staff[],
  skeleton: ScheduleSkeleton,
  requirements: ShiftRequirement,
  leaveRequests: Record<string, Record<string, string>> = {},
): Promise<StaffSchedule[]> {
  if (!SOLVER_FUNCTION_URL) {
    throw new Error(
      'SOLVER_FUNCTION_URL が設定されていません。' +
      'Python Cloud Functionのデプロイ後にURLを設定してください。'
    );
  }

  const requestBody = {
    staffList,
    skeleton,
    requirements,
    leaveRequests,
  };

  console.log(`🔧 Solver呼び出し開始（${staffList.length}名）...`);
  const startTime = Date.now();

  const response = await fetch(SOLVER_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    const errorData: SolverErrorResponse = await response.json();
    console.error(`❌ Solver失敗 (${elapsed}ms):`, errorData);
    throw new Error(
      `Solver求解失敗: ${errorData.errorType} - ${errorData.error}`
    );
  }

  const result: SolverResponse = await response.json();

  console.log(`✅ Solver完了 (${elapsed}ms):`, {
    status: result.solverStats.status,
    solveTimeMs: result.solverStats.solveTimeMs,
    objectiveValue: result.solverStats.objectiveValue,
    staffCount: result.schedule.length,
  });

  return result.schedule;
}

/**
 * 統合CP-SAT Solver によるシフト生成（Phase 3: 全体最適化）
 *
 * LLM Phase 1 + Solver Phase 2 + Algorithm Phase 3 を統合した
 * 単一CP-SATモデルで全制約を一括求解する。
 * Skeletonは不要。
 *
 * @param staffList - スタッフリスト
 * @param requirements - シフト要件
 * @param leaveRequests - 休暇申請（オプション）
 * @returns StaffSchedule[] - 既存評価ロジックと互換の形式
 */
export async function generateShiftsWithUnifiedSolver(
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: Record<string, Record<string, string>> = {},
): Promise<StaffSchedule[]> {
  if (!UNIFIED_SOLVER_FUNCTION_URL) {
    throw new Error(
      'UNIFIED_SOLVER_FUNCTION_URL が設定されていません。' +
      'Python Cloud Functionのデプロイ後にURLを設定してください。'
    );
  }

  const requestBody = {
    staffList,
    requirements,
    leaveRequests,
  };

  console.log(`🔧 統合Solver呼び出し開始（${staffList.length}名）...`);
  const startTime = Date.now();

  const response = await fetch(UNIFIED_SOLVER_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    const errorData: SolverErrorResponse = await response.json();
    console.error(`❌ 統合Solver失敗 (${elapsed}ms):`, errorData);
    throw new Error(
      `統合Solver求解失敗: ${errorData.errorType} - ${errorData.error}`
    );
  }

  const result: SolverResponse = await response.json();

  console.log(`✅ 統合Solver完了 (${elapsed}ms):`, {
    status: result.solverStats.status,
    solveTimeMs: result.solverStats.solveTimeMs,
    objectiveValue: result.solverStats.objectiveValue,
    staffCount: result.schedule.length,
  });

  return result.schedule;
}
