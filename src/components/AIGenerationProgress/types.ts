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
 *
 * BUG-022対応 (2025-12-30):
 * gemini-2.5-pro（thinking常時ON）は処理時間が大幅に増加
 * - Phase 1（骨子生成）: ~180秒（ステップ2）
 * - Phase 2（詳細生成）: ~120秒（ステップ3）
 * - 評価: ~10秒（ステップ4）
 *
 * @see .kiro/steering/gemini-rules.md
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
    label: '骨子を生成中',
    description: 'AIが休日パターンと基本構造を決定しています...',
    startTimeSeconds: 5,
  },
  {
    id: 3,
    label: 'シフト詳細を生成中',
    description: 'AIが各スタッフのシフトを割り当てています...',
    startTimeSeconds: 180,
  },
  {
    id: 4,
    label: '評価・最適化中',
    description: '制約違反をチェックし、品質を評価しています...',
    startTimeSeconds: 300,
  },
  {
    id: 5,
    label: '完了処理中',
    description: '結果を準備しています...',
    startTimeSeconds: 320,
  },
];

/**
 * デフォルトの予測処理時間（秒）
 *
 * BUG-022対応 (2025-12-30):
 * gemini-2.5-pro（thinking常時ON）は処理時間が大幅に増加
 *
 * スタッフ数による目安:
 * - 5名以下: 180秒
 * - 6-10名: 300秒
 * - 11-15名: 360秒
 * - 16名以上: 420秒
 *
 * クライアントタイムアウト: 360秒
 * サーバータイムアウト: 540秒
 */
export const DEFAULT_ESTIMATED_SECONDS = 360;
