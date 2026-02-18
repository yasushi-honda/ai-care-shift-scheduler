/**
 * Solver Client: Python Cloud Function (CP-SAT Solver) への連携モジュール
 *
 * 統合Solver: 単一CP-SATモデルで全制約を一括求解。
 * ADR-0004: ハイブリッドアーキテクチャ採用方針に基づく全体最適化。
 */

import type {
  Staff,
  ShiftRequirement,
  StaffSchedule,
  SolverWarning,
} from './types';

/**
 * requirementsのキー形式を日別形式に展開
 *
 * フロントエンドはシフト名キー（例: "日勤"）で送信するが、
 * Solverは日別キー（例: "2026-03-01_日勤"）を期待する。
 * 既に日別形式の場合はそのまま返す。
 */
function expandRequirementsToDaily(requirements: ShiftRequirement): ShiftRequirement {
  const keys = Object.keys(requirements.requirements);
  if (keys.length === 0) return requirements;

  // 既に日別形式（"_"含む）ならそのまま返す
  if (keys[0].includes('_')) return requirements;

  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const expanded: Record<string, typeof requirements.requirements[string]> = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${requirements.targetMonth}-${String(day).padStart(2, '0')}`;
    for (const [shiftName, dailyReq] of Object.entries(requirements.requirements)) {
      expanded[`${dateStr}_${shiftName}`] = dailyReq;
    }
  }

  return { ...requirements, requirements: expanded };
}

/**
 * 統合Solver Cloud FunctionのURL
 */
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
  warnings?: SolverWarning[];
}

interface SolverErrorResponse {
  success: false;
  error: string;
  errorType: string;
  details: Record<string, unknown>;
}

export interface UnifiedSolverResult {
  schedule: StaffSchedule[];
  warnings: SolverWarning[];
}

/**
 * 統合CP-SAT Solver によるシフト生成
 *
 * 単一CP-SATモデルで全制約を一括求解する。
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
): Promise<UnifiedSolverResult> {
  if (!UNIFIED_SOLVER_FUNCTION_URL) {
    throw new Error(
      'UNIFIED_SOLVER_FUNCTION_URL が設定されていません。' +
      'Python Cloud Functionのデプロイ後にURLを設定してください。'
    );
  }

  const expandedRequirements = expandRequirementsToDaily(requirements);

  const requestBody = {
    staffList,
    requirements: expandedRequirements,
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

  const solverWarnings = result.warnings ?? [];
  console.log(`✅ 統合Solver完了 (${elapsed}ms):`, {
    status: result.solverStats.status,
    solveTimeMs: result.solverStats.solveTimeMs,
    objectiveValue: result.solverStats.objectiveValue,
    staffCount: result.schedule.length,
    warningCount: solverWarnings.length,
  });

  if (solverWarnings.length > 0) {
    console.warn(`⚠️ Solver事前検証警告 (${solverWarnings.length}件):`,
      solverWarnings.map(w => w.detail));
  }

  return { schedule: result.schedule, warnings: solverWarnings };
}
