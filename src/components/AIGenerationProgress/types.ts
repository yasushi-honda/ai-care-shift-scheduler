/**
 * AI生成プログレス表示の型定義
 * Phase 45: AIシフト生成進行状況表示機能
 */

/**
 * 生成処理の状態
 */
export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error' | 'cancelled';

/**
 * ステップ定義
 */
export interface StepDefinition {
  id: number;
  label: string;
  description: string;
  startTimeSeconds: number;
}

/**
 * 生成進行状況の状態
 */
export interface GenerationProgressState {
  status: GenerationStatus;
  currentStep: number;
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
  errorMessage?: string;
}

/**
 * useAIGenerationProgress フックの戻り値
 */
export interface UseAIGenerationProgressReturn {
  state: GenerationProgressState;
  startGeneration: () => void;
  completeGeneration: () => void;
  failGeneration: (errorMessage: string) => void;
  cancelGeneration: () => void;
  reset: () => void;
}

/**
 * AI生成の5段階ステップ定義
 * 各ステップは経過時間に基づいて自動的に進行する
 */
export const GENERATION_STEPS: StepDefinition[] = [
  {
    id: 1,
    label: 'リクエスト送信中',
    description: 'サーバーにリクエストを送信しています...',
    startTimeSeconds: 0,
  },
  {
    id: 2,
    label: 'AIがシフトを分析中',
    description: 'スタッフ情報と制約条件を分析しています...',
    startTimeSeconds: 5,
  },
  {
    id: 3,
    label: 'シフト案を生成中',
    description: 'AIがシフト案を生成しています...',
    startTimeSeconds: 30,
  },
  {
    id: 4,
    label: '評価・最適化中',
    description: '生成されたシフトを評価・最適化しています...',
    startTimeSeconds: 90,
  },
  {
    id: 5,
    label: '結果を保存中',
    description: 'シフトデータを保存しています...',
    startTimeSeconds: 150,
  },
];

/**
 * デフォルトの予測処理時間（秒）
 */
export const DEFAULT_ESTIMATED_SECONDS = 180;
