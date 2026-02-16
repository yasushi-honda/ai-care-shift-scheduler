/**
 * 自動生成プログレス表示の型定義
 */

/**
 * 生成処理の状態
 */
export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error' | 'cancelled';

/**
 * 生成結果のサマリーデータ
 * 完了時にユーザーへ表示する情報
 */
export interface GenerationResult {
  /** 総合スコア（0-100） */
  overallScore: number;
  /** 要件充足率（%） */
  fulfillmentRate: number;
  /** 制約違反数 */
  violationCount: number;
  /** 推奨事項数 */
  recommendationCount: number;
  /** 処理時間（秒） */
  elapsedSeconds: number;
}

/**
 * 生成進行状況の状態
 */
export interface GenerationProgressState {
  status: GenerationStatus;
  elapsedSeconds: number;
  errorMessage?: string;
  /** 完了時の結果サマリー */
  result?: GenerationResult;
}

/**
 * useGenerationProgress フックの戻り値
 */
export interface UseGenerationProgressReturn {
  state: GenerationProgressState;
  startGeneration: () => void;
  completeGeneration: (result: GenerationResult) => void;
  failGeneration: (errorMessage: string) => void;
  cancelGeneration: () => void;
  reset: () => void;
}
