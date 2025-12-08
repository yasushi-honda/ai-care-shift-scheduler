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
 * バックエンド処理との対応:
 * - Phase 1（骨子生成）: ステップ2-3（約60秒）
 * - Phase 2（詳細生成）: ステップ3-4（約90秒、バッチ処理）
 * - 評価: ステップ4（約10秒）
 *
 * 将来の段階的プロンプト分割対応時に更新予定
 * @see .kiro/progress-display-improvement.md
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
    description: '休日パターンと基本構造を決定しています...',
    startTimeSeconds: 5,
  },
  {
    id: 3,
    label: 'シフト詳細を生成中',
    description: 'AIが各スタッフのシフトを割り当てています...',
    startTimeSeconds: 60,
  },
  {
    id: 4,
    label: '評価・最適化中',
    description: '制約違反をチェックし、品質を評価しています...',
    startTimeSeconds: 150,
  },
  {
    id: 5,
    label: '完了処理中',
    description: '結果を準備しています...',
    startTimeSeconds: 180,
  },
];

/**
 * デフォルトの予測処理時間（秒）
 * BUG-010でタイムアウトを240秒に延長したため、それに合わせて更新
 *
 * スタッフ数による目安:
 * - 5名以下: 90秒（一括生成）
 * - 6-10名: 150秒（2段階生成、2バッチ）
 * - 11-15名: 210秒（2段階生成、3バッチ）
 * - 16名以上: 240秒（最大）
 */
export const DEFAULT_ESTIMATED_SECONDS = 210;
