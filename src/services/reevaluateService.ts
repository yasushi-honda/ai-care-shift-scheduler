/**
 * Phase 54: シフト再評価サービス
 *
 * 手動編集後のシフトをCloud Functionで再評価する
 */
import type { Staff, StaffSchedule, ShiftRequirement, LeaveRequest, AIEvaluationResult } from '../../types';

/**
 * 再評価リクエスト型
 */
interface ReevaluateShiftRequest {
  facilityId: string;
  targetMonth: string;
  staffSchedules: StaffSchedule[];
  staffList: Staff[];
  requirements?: ShiftRequirement;
  leaveRequests?: LeaveRequest;
}

/**
 * 再評価レスポンス型
 */
interface ReevaluateShiftResponse {
  success: boolean;
  evaluation?: AIEvaluationResult;
  historyId?: string;
  error?: string;
}

/**
 * Cloud FunctionのベースURL
 */
const FUNCTION_BASE_URL =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_URL ||
  'https://asia-northeast1-ai-care-shift-scheduler.cloudfunctions.net';

/**
 * シフトを再評価
 *
 * @param params 再評価パラメータ
 * @returns 評価結果とエラー
 */
export async function reevaluateShift(
  params: ReevaluateShiftRequest
): Promise<{ evaluation: AIEvaluationResult | null; historyId: string | null; error: string | null }> {
  const url = `${FUNCTION_BASE_URL}/reevaluateShift`;

  console.log('📊 [reevaluateService] 再評価リクエスト送信:', {
    facilityId: params.facilityId,
    targetMonth: params.targetMonth,
    staffCount: params.staffList.length,
    scheduleCount: params.staffSchedules.length,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒タイムアウト

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [reevaluateService] HTTPエラー:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return {
        evaluation: null,
        historyId: null,
        error: `再評価に失敗しました (${response.status}): ${errorText}`,
      };
    }

    const data: ReevaluateShiftResponse = await response.json();

    if (!data.success) {
      console.error('❌ [reevaluateService] 再評価失敗:', data.error);
      return {
        evaluation: null,
        historyId: null,
        error: data.error || '再評価に失敗しました',
      };
    }

    console.log('✅ [reevaluateService] 再評価完了:', {
      score: data.evaluation?.overallScore,
      historyId: data.historyId,
    });

    return {
      evaluation: data.evaluation || null,
      historyId: data.historyId || null,
      error: null,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('❌ [reevaluateService] タイムアウト');
      return {
        evaluation: null,
        historyId: null,
        error: '再評価がタイムアウトしました。しばらくしてから再試行してください。',
      };
    }

    console.error('❌ [reevaluateService] エラー:', err);
    return {
      evaluation: null,
      historyId: null,
      error: err instanceof Error ? err.message : '不明なエラーが発生しました',
    };
  }
}
