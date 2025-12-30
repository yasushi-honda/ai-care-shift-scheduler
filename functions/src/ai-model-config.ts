/**
 * AI Model Configuration Module
 *
 * BUG-022対応: マルチモデルGemini戦略
 * - Gemini 2.5 FlashのthinkingBudgetバグを回避
 * - セクション別に最適なモデルを割り当て
 * - フォールバック機構で安定性確保
 *
 * 重要: asia-northeast1では利用可能モデルが限定的
 * - gemini-2.5-flash-lite: ❌ 未対応
 * - gemini-3-flash: ❌ 未対応 (globalのみ)
 * - gemini-2.5-flash: thinkingBudgetバグあり
 *
 * 対策: Global endpointを使用
 * @see .kiro/steering/gemini-rules.md
 * @see https://github.com/googleapis/python-genai/issues/782
 */

// バージョン情報（デバッグ用）
export const AI_CONFIG_VERSION = '2.1.0-japan';

// Gemini 3用のthinkingLevel (2.5のthinkingBudgetとは別)
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

// リージョン設定
// 日本国内データ処理要件のためasia-northeast1を使用
// CodeRabbit指摘: global endpointはデータ居住地要件に違反
export const AI_LOCATION = 'asia-northeast1';

// モデル定義
// asia-northeast1で利用可能 + 安定動作するモデルのみ
export const MODELS = {
  // Gemini 2.5 Pro - 常にthinking有効、最も安定（GA）
  // asia-northeast1で利用可能、日本国内処理保証
  GEMINI_25_PRO: 'gemini-2.5-pro',

  // 以下は使用非推奨（バグ or リージョン制限）
  // GEMINI_25_FLASH: 'gemini-2.5-flash',  // thinkingBudgetバグ
  // GEMINI_20_FLASH: 'gemini-2.0-flash',  // asia-northeast1未対応
  // GEMINI_25_FLASH_LITE: 'gemini-2.5-flash-lite', // asia-northeast1未対応
  // GEMINI_3_FLASH: 'gemini-3-flash', // asia-northeast1未対応
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

// コスト情報 ($/1M tokens) - 2025年12月時点
export const MODEL_COSTS = {
  [MODELS.GEMINI_25_PRO]: { input: 1.25, output: 10.0, thinking: 3.5 },
} as const;

/**
 * 生成タスク別の設定
 *
 * BUG-022対応 (2025-12-30):
 * - gemini-2.5-flash: thinkingBudgetバグで使用不可
 * - gemini-2.0-flash/gemini-3-flash等: asia-northeast1未対応
 * - 日本国内データ処理要件のためasia-northeast1を使用
 * - 結果: gemini-2.5-proのみ使用（thinking常時ON、コスト高いが安定）
 */
export const GENERATION_CONFIGS = {
  /**
   * Phase 1: 骨子生成 (大規模、深い推論が必要)
   * - 休日・夜勤パターンを全スタッフ分生成
   * - 制約条件の複雑な考慮が必要
   */
  skeleton: {
    primary: {
      model: MODELS.GEMINI_25_PRO,
      // thinking常時ON、深い推論に最適
      temperature: 0.3,
      maxOutputTokens: 65536,
    },
    fallback: {
      model: MODELS.GEMINI_25_PRO,
      temperature: 0.3,
      maxOutputTokens: 65536,
    },
  },

  /**
   * Phase 2: 詳細バッチ生成 (骨子に従う)
   * - 骨子で決まった休日以外にシフト種別を割り当て
   * - gemini-2.5-proを使用（他モデルはasia-northeast1未対応）
   */
  detailBatch: {
    primary: {
      model: MODELS.GEMINI_25_PRO,
      // thinkingはONだが、シンプルタスクなので影響少ない
      temperature: 0.5,
      maxOutputTokens: 65536,
    },
    fallback: {
      model: MODELS.GEMINI_25_PRO,
      temperature: 0.5,
      maxOutputTokens: 65536,
    },
  },

  /**
   * 小規模直接生成 (5名以下、1回で完了)
   */
  smallScale: {
    primary: {
      model: MODELS.GEMINI_25_PRO,
      temperature: 0.5,
      maxOutputTokens: 65536,
    },
    fallback: {
      model: MODELS.GEMINI_25_PRO,
      temperature: 0.5,
      maxOutputTokens: 65536,
    },
  },
} as const;

/**
 * モデル設定からGemini API用のconfig objectを生成
 *
 * BUG-022対応 (2025-12-30):
 * - gemini-2.5-pro: thinkingConfig不要（常時有効）
 * - gemini-2.0-flash: thinkingConfig不要（機能なし）
 * - thinkingBudget/thinkingLevelは使用しない（バグ回避）
 */
export function buildGeminiConfig(config: ModelConfig): object {
  // パラメータ範囲検証
  const temperature = config.temperature ?? 0.5;
  if (temperature < 0 || temperature > 2) {
    throw new Error(`Invalid temperature: ${temperature}. Must be between 0 and 2.`);
  }

  // BUG-022: thinkingConfigは使用しない
  // - gemini-2.5-pro: thinking常時有効（設定不可）
  // - gemini-2.0-flash: thinking機能なし
  const baseConfig: Record<string, unknown> = {
    temperature,
    maxOutputTokens: config.maxOutputTokens ?? 65536,
  };

  // 設定ログ
  console.log(`🔧 AI Config [v${AI_CONFIG_VERSION}]:`, {
    model: config.model,
    temperature,
    maxOutputTokens: baseConfig.maxOutputTokens,
  });

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
