/**
 * AIレスポンス監視モジュール
 *
 * Gemini APIレスポンスを分析し、品質問題を早期検出する。
 * BUG-022（thinkingトークン消費）のようなパターンを検出。
 */

/**
 * AIレスポンスの使用量メトリクス
 */
export interface UsageMetrics {
  promptTokenCount?: number;
  thoughtsTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

/**
 * AIレスポンスの健全性チェック結果
 */
export interface HealthCheckResult {
  isHealthy: boolean;
  issues: string[];
  metrics: {
    thinkingRatio: number | null;  // 思考トークン比率
    outputRatio: number | null;    // 出力トークン比率
    finishReason: string;
    responseLength: number;
  };
}

/**
 * finishReasonの説明
 */
const FINISH_REASON_DESCRIPTIONS: Record<string, string> = {
  'STOP': '正常完了',
  'MAX_TOKENS': 'トークン上限到達 - maxOutputTokensの増加を検討',
  'SAFETY': '安全性フィルタ - プロンプトの見直しを検討',
  'RECITATION': '引用制限 - プロンプトの見直しを検討',
  'OTHER': '不明な理由 - 詳細調査が必要',
};

/**
 * AIレスポンスの健全性チェック
 *
 * 以下の問題パターンを検出:
 * 1. 思考トークンがtotalの90%以上（BUG-022パターン）
 * 2. 出力トークンが異常に少ない
 * 3. finishReasonがSTOP以外
 * 4. レスポンス本文が空
 */
export function checkResponseHealth(
  response: {
    text?: string;
    candidates?: Array<{ finishReason?: string }>;
    usageMetadata?: UsageMetrics;
  },
  operationName: string
): HealthCheckResult {
  const issues: string[] = [];
  const usageMetadata = response.usageMetadata || {};
  const finishReason = response.candidates?.[0]?.finishReason || 'UNKNOWN';
  const responseLength = response.text?.length || 0;

  // 思考トークン比率を計算
  let thinkingRatio: number | null = null;
  let outputRatio: number | null = null;

  if (usageMetadata.totalTokenCount && usageMetadata.totalTokenCount > 0) {
    if (usageMetadata.thoughtsTokenCount !== undefined) {
      thinkingRatio = usageMetadata.thoughtsTokenCount / usageMetadata.totalTokenCount;
    }
    if (usageMetadata.candidatesTokenCount !== undefined) {
      outputRatio = usageMetadata.candidatesTokenCount / usageMetadata.totalTokenCount;
    }
  }

  // 問題検出

  // 1. 思考トークン過剰消費（BUG-022パターン）
  if (thinkingRatio !== null && thinkingRatio > 0.90) {
    issues.push(
      `⚠️ 思考トークン過剰消費: ${(thinkingRatio * 100).toFixed(1)}% ` +
      `(${usageMetadata.thoughtsTokenCount}/${usageMetadata.totalTokenCount}) - ` +
      `BUG-022パターンの可能性`
    );
  }

  // 2. 出力トークンが異常に少ない
  if (outputRatio !== null && outputRatio < 0.05 && responseLength > 0) {
    issues.push(
      `⚠️ 出力トークン比率が低い: ${(outputRatio * 100).toFixed(1)}% - ` +
      `思考に多くのトークンを消費している可能性`
    );
  }

  // 3. finishReasonが正常でない
  if (finishReason !== 'STOP') {
    const description = FINISH_REASON_DESCRIPTIONS[finishReason] || '不明な終了理由';
    issues.push(`⚠️ 終了理由: ${finishReason} - ${description}`);
  }

  // 4. レスポンス本文が空
  if (responseLength === 0) {
    issues.push('❌ レスポンス本文が空です');
  }

  // 5. レスポンスが異常に短い（JSONとして解析不能の可能性）
  if (responseLength > 0 && responseLength < 100) {
    issues.push(`⚠️ レスポンスが非常に短い: ${responseLength}文字`);
  }

  const isHealthy = issues.length === 0;

  // ログ出力
  if (!isHealthy) {
    console.warn(`🔍 [${operationName}] AIレスポンス健全性チェック: 問題検出`);
    for (const issue of issues) {
      console.warn(`   ${issue}`);
    }
  } else {
    console.log(`✅ [${operationName}] AIレスポンス健全性: OK`);
  }

  return {
    isHealthy,
    issues,
    metrics: {
      thinkingRatio,
      outputRatio,
      finishReason,
      responseLength,
    },
  };
}

/**
 * AIレスポンスの詳細ログ出力
 */
export function logDetailedResponseMetrics(
  response: {
    text?: string;
    candidates?: Array<{ finishReason?: string }>;
    usageMetadata?: UsageMetrics;
  },
  operationName: string,
  processingTimeMs: number
): void {
  const usageMetadata = response.usageMetadata || {};
  const finishReason = response.candidates?.[0]?.finishReason || 'N/A';
  const responseLength = response.text?.length || 0;

  console.log(`📊 [${operationName}] AI Response Details:`, {
    finishReason,
    responseLength,
    processingTimeMs,
    usageMetadata: {
      promptTokenCount: usageMetadata.promptTokenCount || 'N/A',
      thoughtsTokenCount: usageMetadata.thoughtsTokenCount || 'N/A',
      candidatesTokenCount: usageMetadata.candidatesTokenCount || 'N/A',
      totalTokenCount: usageMetadata.totalTokenCount || 'N/A',
    },
  });

  // 健全性チェック実行
  checkResponseHealth(response, operationName);
}
