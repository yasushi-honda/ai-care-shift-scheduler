/**
 * デモシフトリセットサービス
 *
 * デモ環境でシフト生成を何度でもやり直せるよう、
 * 指定月のシフトデータを Cloud Function 経由で削除する
 */

const FUNCTION_BASE_URL =
  import.meta.env.VITE_FIREBASE_FUNCTIONS_URL ||
  'https://asia-northeast1-ai-care-shift-scheduler.cloudfunctions.net';

/**
 * デモ環境の指定月シフトをリセット
 *
 * @param targetMonth 対象月（YYYY-MM 形式）
 * @returns 削除件数またはエラー
 */
export async function resetDemoShifts(
  targetMonth: string
): Promise<{ deletedCount: number; error: string | null }> {
  const url = `${FUNCTION_BASE_URL}/resetDemoShifts`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetMonth }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { deletedCount: 0, error: `リセットに失敗しました (${response.status}): ${errorText}` };
    }

    const data = await response.json() as { success: boolean; deletedCount: number; error?: string };

    if (!data.success) {
      return { deletedCount: 0, error: data.error || 'リセットに失敗しました' };
    }

    return { deletedCount: data.deletedCount, error: null };
  } catch (err) {
    return {
      deletedCount: 0,
      error: err instanceof Error ? err.message : '不明なエラーが発生しました',
    };
  }
}
