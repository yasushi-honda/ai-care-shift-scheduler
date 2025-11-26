import type { Staff, ShiftRequirement, StaffSchedule, LeaveRequest } from '../types';

/**
 * Cloud Functions 経由でAIシフトを生成
 *
 * @description
 * セキュリティのため、ブラウザから直接Gemini APIを呼び出さず、
 * Cloud Functions経由でVertex AIを使用します。
 */

// Cloud Functions エンドポイントURL
// 環境変数から取得（必須）
const getCloudFunctionUrl = (): string => {
  const url = import.meta.env.VITE_CLOUD_FUNCTION_URL;

  if (!url) {
    // フォールバック: FirebaseプロジェクトIDから構築
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error(
        'VITE_CLOUD_FUNCTION_URL or VITE_FIREBASE_PROJECT_ID environment variable must be set.\n' +
        'Please check your Firebase configuration in .env.local'
      );
    }
    return `https://asia-northeast1-${projectId}.cloudfunctions.net/generateShift`;
  }

  return url;
};

export const generateShiftSchedule = async (
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest
): Promise<StaffSchedule[]> => {
  const CLOUD_FUNCTION_URL = getCloudFunctionUrl();

  try {
    console.log('🚀 Cloud Functions経由でシフト生成開始...', {
      url: CLOUD_FUNCTION_URL,
      staffCount: staffList.length,
      targetMonth: requirements.targetMonth,
    });

    // タイムアウト設定（60秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // Cloud Functions に POST リクエスト
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        staffList,
        requirements,
        leaveRequests,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // HTTPエラーチェック
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Cloud Functions エラー:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });

      // parseError情報があれば詳細をログ出力
      if (errorData.parseError) {
        console.error('🔍 JSON Parse Error Details:', errorData.parseError);
        console.error('📝 Error Context:', errorData.parseError.contextAroundError);
      }

      throw new Error(
        errorData.error ||
        `Cloud Functions エラー: ${response.status} ${response.statusText}`
      );
    }

    // レスポンスのJSON解析
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'シフト生成に失敗しました');
    }

    // レスポンスバリデーション
    if (!Array.isArray(result.schedule)) {
      throw new Error('Invalid response: schedule must be an array');
    }

    if (result.schedule.length === 0) {
      throw new Error('Empty schedule returned from Cloud Function');
    }

    // 最初の要素の構造チェック
    const firstSchedule = result.schedule[0];
    if (!firstSchedule?.staffId || !firstSchedule?.staffName || !Array.isArray(firstSchedule?.monthlyShifts)) {
      throw new Error('Invalid schedule format in response');
    }

    console.log('✅ シフト生成成功:', {
      staffCount: result.schedule.length,
      tokensUsed: result.metadata?.tokensUsed || 0,
    });

    return result.schedule as StaffSchedule[];

  } catch (error) {
    console.error('❌ generateShiftSchedule エラー:', error);

    // タイムアウトエラーの場合
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'リクエストがタイムアウトしました。\n' +
        'シフト生成に時間がかかっています。もう一度お試しください。'
      );
    }

    // ネットワークエラーの場合
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        'ネットワークエラー: Cloud Functionsに接続できません。\n' +
        'インターネット接続を確認してください。'
      );
    }

    // その他のエラー
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('シフト生成中に予期しないエラーが発生しました');
  }
};
