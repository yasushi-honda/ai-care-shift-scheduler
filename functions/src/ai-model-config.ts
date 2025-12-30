/**
 * AI Model Configuration Module
 *
 * BUG-022対応: マルチモデルGemini戦略
 * - Gemini 2.5 FlashのthinkingBudgetバグを回避
 * - セクション別に最適なモデルを割り当て
 * - フォールバック機構で安定性確保
 *
 * @see .kiro/steering/gemini-rules.md
 * @see https://github.com/googleapis/python-genai/issues/782
 */

// Gemini 3用のthinkingLevel (2.5のthinkingBudgetとは別)
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

// モデル定義
export const MODELS = {
  // Gemini 3 Flash - thinkingLevelで安定動作
  GEMINI_3_FLASH: 'gemini-3-flash-preview',

  // Gemini 2.5 Pro - 常にthinking有効、最も安定
  GEMINI_25_PRO: 'gemini-2.5-pro',

  // Gemini 2.5 Flash - thinkingBudgetバグあり (使用非推奨)
  GEMINI_25_FLASH: 'gemini-2.5-flash',

  // Gemini 2.5 Flash-Lite - thinkingBudget:0で安定、最安
  GEMINI_25_FLASH_LITE: 'gemini-2.5-flash-lite',
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

// モデル設定の型
export interface ModelConfig {
  model: ModelName;
  // Gemini 3用
  thinkingLevel?: ThinkingLevel;
  // Gemini 2.5用
  thinkingBudget?: number;
  // 共通設定
  temperature?: number;
  maxOutputTokens?: number;
}

// コスト情報 ($/1M tokens)
export const MODEL_COSTS = {
  [MODELS.GEMINI_3_FLASH]: { input: 0.5, output: 3.0 },
  [MODELS.GEMINI_25_PRO]: { input: 1.25, output: 10.0 },
  [MODELS.GEMINI_25_FLASH]: { input: 0.3, output: 2.5 },
  [MODELS.GEMINI_25_FLASH_LITE]: { input: 0.1, output: 0.4 },
} as const;

/**
 * 生成タスク別の設定
 * 各セクションにプライマリとフォールバックモデルを定義
 */
export const GENERATION_CONFIGS = {
  /**
   * Phase 1: 骨子生成 (大規模、深い推論が必要)
   * - 休日・夜勤パターンを全スタッフ分生成
   * - 制約条件の複雑な考慮が必要
   */
  skeleton: {
    primary: {
      model: MODELS.GEMINI_3_FLASH,
      thinkingLevel: 'high' as ThinkingLevel,
      temperature: 0.3,
      maxOutputTokens: 65536,
    },
    fallback: {
      model: MODELS.GEMINI_25_PRO,
      // 2.5 Proはthinking無効化不可、デフォルトで動作
      temperature: 0.3,
      maxOutputTokens: 65536,
    },
  },

  /**
   * Phase 2: 詳細バッチ生成 (骨子に従う、シンプル)
   * - 骨子で決まった休日以外にシフト種別を割り当て
   * - 深い推論は不要、コスト重視
   */
  detailBatch: {
    primary: {
      model: MODELS.GEMINI_25_FLASH_LITE,
      thinkingBudget: 0, // 思考完全無効化
      temperature: 0.5,
      maxOutputTokens: 65536,
    },
    fallback: {
      model: MODELS.GEMINI_3_FLASH,
      thinkingLevel: 'low' as ThinkingLevel,
      temperature: 0.5,
      maxOutputTokens: 65536,
    },
  },

  /**
   * 小規模直接生成 (5名以下、1回で完了)
   * - シンプルなケース、バランス重視
   */
  smallScale: {
    primary: {
      model: MODELS.GEMINI_3_FLASH,
      thinkingLevel: 'medium' as ThinkingLevel,
      temperature: 0.5,
      maxOutputTokens: 65536,
    },
    fallback: {
      model: MODELS.GEMINI_25_FLASH_LITE,
      thinkingBudget: 0,
      temperature: 0.5,
      maxOutputTokens: 65536,
    },
  },
} as const;

/**
 * モデル設定からGemini API用のconfig objectを生成
 * CodeRabbit指摘: パラメータ検証を追加
 */
export function buildGeminiConfig(config: ModelConfig): object {
  // Gemini 3はthinkingLevel、Gemini 2.5はthinkingBudgetを使用
  const isGemini3 = config.model.includes('gemini-3');

  if (isGemini3 && config.thinkingBudget !== undefined && config.thinkingLevel === undefined) {
    console.warn(`⚠️ Model ${config.model} uses thinkingLevel, not thinkingBudget. Ignoring thinkingBudget.`);
  }
  if (!isGemini3 && config.thinkingLevel !== undefined && config.thinkingBudget === undefined) {
    console.warn(`⚠️ Model ${config.model} uses thinkingBudget, not thinkingLevel. Ignoring thinkingLevel.`);
  }

  // パラメータ範囲検証
  const temperature = config.temperature ?? 0.5;
  if (temperature < 0 || temperature > 2) {
    throw new Error(`Invalid temperature: ${temperature}. Must be between 0 and 2.`);
  }

  const baseConfig: Record<string, unknown> = {
    temperature,
    maxOutputTokens: config.maxOutputTokens ?? 65536,
  };

  // thinkingLevel (Gemini 3) と thinkingBudget (Gemini 2.5) を適切に設定
  if (config.thinkingLevel !== undefined) {
    baseConfig.thinkingConfig = {
      thinkingLevel: config.thinkingLevel,
    };
  } else if (config.thinkingBudget !== undefined) {
    baseConfig.thinkingConfig = {
      thinkingBudget: config.thinkingBudget,
    };
  }

  return baseConfig;
}

/**
 * レスポンスが有効かどうかを検証
 * 空レスポンスやMAX_TOKENS終了を検出
 */
export function isValidResponse(result: {
  text?: string;
  candidates?: Array<{ finishReason?: string }>;
}): boolean {
  // テキストが空でないこと
  if (!result.text || result.text.length === 0) {
    return false;
  }

  // finishReasonがMAX_TOKENSでないこと
  const finishReason = result.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    return false;
  }

  return true;
}
