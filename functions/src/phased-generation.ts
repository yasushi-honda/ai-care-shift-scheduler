/**
 * 段階的シフト生成モジュール
 * Phase 1: 骨子生成（軽量・全スタッフの休日/夜勤パターン）
 * Phase 2: 詳細生成（5名ずつバッチ処理）
 * Phase 3: 統合
 */

import { GoogleGenAI } from '@google/genai';
import {
  TimeSlotPreference,
} from './types';
import type {
  Staff,
  ShiftRequirement,
  LeaveRequest,
  StaffSchedule,
  ScheduleSkeleton
} from './types';
import {
  GENERATION_CONFIGS,
  buildGeminiConfig,
  isValidResponse,
  AI_LOCATION,
  AI_CONFIG_VERSION,
  type ModelConfig,
} from './ai-model-config';
import {
  validateSkeletonOutput,
  validatePhase2Input,
  logValidationResult,
  autoFixSkeleton,
} from './phase-validation';
import { checkResponseHealth } from './ai-response-monitor';

// BUG-022: シングルモデル戦略 (2025-12-30更新)
// 問題: gemini-2.5-flash thinkingBudgetバグ, gemini-2.0-flash/gemini-3-flash等 asia-northeast1未対応
// 対策: asia-northeast1 + gemini-2.5-proのみ使用（日本国内データ処理要件）
const BATCH_SIZE = 10; // 詳細生成時のバッチサイズ（10名 × 30日 = 300セル）

// Phase 51: 429エラー対策 - 指数バックオフリトライ設定
const RETRY_CONFIG = {
  maxRetries: 3,           // 最大リトライ回数
  initialDelayMs: 2000,    // 初期待機時間（2秒）
  maxDelayMs: 32000,       // 最大待機時間（32秒）
  backoffMultiplier: 2,    // バックオフ倍率
};

/**
 * Phase 51: 切り詰めた指数バックオフ（Truncated Exponential Backoff）リトライ
 *
 * 429 (RESOURCE_EXHAUSTED) エラーに対して、Google推奨の指数バックオフを適用
 * @see https://cloud.google.com/vertex-ai/docs/quotas
 *
 * @param operation - リトライ対象の非同期操作
 * @param operationName - ログ出力用の操作名
 * @returns 操作結果
 */
async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;
  let delay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // 429エラーかどうか判定
      const is429Error =
        error?.code === 429 ||
        error?.status === 429 ||
        error?.message?.includes('429') ||
        error?.message?.includes('RESOURCE_EXHAUSTED') ||
        error?.message?.includes('Resource exhausted');

      // 429以外のエラーは即座に再スロー
      if (!is429Error) {
        throw error;
      }

      // 最後のリトライでも失敗した場合
      if (attempt === RETRY_CONFIG.maxRetries) {
        console.error(`❌ ${operationName}: ${RETRY_CONFIG.maxRetries}回のリトライ後も429エラー`);
        throw error;
      }

      // ジッター（ランダム性）を追加して衝突を回避
      const jitter = Math.random() * 1000;
      const waitTime = Math.min(delay + jitter, RETRY_CONFIG.maxDelayMs);

      console.log(`⚠️ ${operationName}: 429エラー発生、${Math.round(waitTime / 1000)}秒後にリトライ (${attempt + 1}/${RETRY_CONFIG.maxRetries})`);

      await new Promise(resolve => setTimeout(resolve, waitTime));

      // 次のリトライ用に待機時間を倍増
      delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
    }
  }

  // ここに到達することはないが、TypeScript用
  throw lastError || new Error(`${operationName}: 不明なエラー`);
}

/**
 * BUG-022: マルチモデルフォールバック機構
 *
 * プライマリモデルで失敗した場合、フォールバックモデルに自動切替
 * - 空レスポンス検出
 * - MAX_TOKENS終了検出
 *
 * @param client - GoogleGenAI クライアント
 * @param prompt - プロンプト
 * @param primaryConfig - プライマリモデル設定
 * @param fallbackConfig - フォールバックモデル設定
 * @param operationName - ログ出力用の操作名
 */
async function generateWithFallback(
  client: GoogleGenAI,
  prompt: string,
  primaryConfig: ModelConfig,
  fallbackConfig: ModelConfig,
  operationName: string
): Promise<{ text: string; model: string }> {
  // プライマリモデルで試行
  try {
    console.log(`🚀 ${operationName}: ${primaryConfig.model} で生成開始...`);

    const result = await withExponentialBackoff(
      () => client.models.generateContent({
        model: primaryConfig.model,
        contents: prompt,
        config: buildGeminiConfig(primaryConfig),
      }),
      `${operationName} (${primaryConfig.model})`
    );

    // レスポンス詳細ログ
    console.log(`📊 ${operationName} Response:`, {
      model: primaryConfig.model,
      finishReason: result.candidates?.[0]?.finishReason || 'N/A',
      usageMetadata: result.usageMetadata || {},
    });

    // AIレスポンス健全性チェック（BUG-022パターン検出）
    checkResponseHealth(result, `${operationName} (${primaryConfig.model})`);

    // レスポンス検証
    if (isValidResponse(result)) {
      console.log(`✅ ${operationName}: ${primaryConfig.model} で成功`);
      return { text: result.text || '', model: primaryConfig.model };
    }

    // 空レスポンスまたはMAX_TOKENS
    console.warn(`⚠️ ${operationName}: ${primaryConfig.model} で無効なレスポンス、フォールバックへ...`);
  } catch (error) {
    console.error(`❌ ${operationName}: ${primaryConfig.model} でエラー:`, error);
    console.warn(`⚠️ フォールバックモデル ${fallbackConfig.model} へ切替...`);
  }

  // フォールバックモデルで試行
  console.log(`🔄 ${operationName}: ${fallbackConfig.model} で再試行...`);

  const fallbackResult = await withExponentialBackoff(
    () => client.models.generateContent({
      model: fallbackConfig.model,
      contents: prompt,
      config: buildGeminiConfig(fallbackConfig),
    }),
    `${operationName} (${fallbackConfig.model} fallback)`
  );

  console.log(`📊 ${operationName} Fallback Response:`, {
    model: fallbackConfig.model,
    finishReason: fallbackResult.candidates?.[0]?.finishReason || 'N/A',
    usageMetadata: fallbackResult.usageMetadata || {},
  });

  // AIレスポンス健全性チェック（BUG-022パターン検出）
  checkResponseHealth(fallbackResult, `${operationName} (${fallbackConfig.model} fallback)`);

  if (!fallbackResult.text || fallbackResult.text.length === 0) {
    throw new Error(`${operationName}: 両モデルとも空レスポンス`);
  }

  console.log(`✅ ${operationName}: ${fallbackConfig.model} (fallback) で成功`);
  return { text: fallbackResult.text, model: fallbackConfig.model };
}

/**
 * Gemini APIからのJSONレスポンスを安全にパース
 *
 * Gemini APIは以下のような問題のあるレスポンスを返すことがあります:
 * 1. Markdownコードブロック形式: ```json\n{...}\n```
 * 2. 無効なJSON構文: トレーリングカンマ、コメント、シングルクォート
 * 3. トークン制限による切り捨て
 *
 * この関数は上記の問題に対処し、エラー時には詳細なデバッグ情報を提供します。
 *
 * @param responseText - Gemini APIからの生のレスポンステキスト
 * @returns パースされたJSONオブジェクト
 * @throws エラー時、parseError プロパティを含む詳細なエラーオブジェクトをスロー
 *
 * @example
 * ```typescript
 * const result = await model.generateContent({...});
 * const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
 * const data = parseGeminiJsonResponse(responseText);
 * ```
 *
 * @see {@link https://github.com/yasushi-honda/ai-care-shift-scheduler/.kiro/memories/gemini_json_parsing_troubleshooting.md}
 */
export function parseGeminiJsonResponse(responseText: string): any {
  try {
    let cleanedText = responseText.trim();

    // BUG-014対応: テキスト中からJSONを抽出（thinkingモードではテキストが含まれる場合がある）
    // 1. Markdownコードブロック内のJSONを抽出
    const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleanedText = codeBlockMatch[1].trim();
    } else {
      // 2. テキスト中の { ... } または [ ... ] を抽出
      const jsonObjectMatch = cleanedText.match(/(\{[\s\S]*\})/);
      const jsonArrayMatch = cleanedText.match(/(\[[\s\S]*\])/);

      if (jsonObjectMatch) {
        cleanedText = jsonObjectMatch[1];
      } else if (jsonArrayMatch) {
        cleanedText = jsonArrayMatch[1];
      }
    }

    // まず素直にパースを試みる
    try {
      return JSON.parse(cleanedText);
    } catch (firstError) {
      // 失敗したら、JSONクリーニングを試みる
      console.warn('⚠️ Initial JSON parse failed, attempting to clean JSON...');

      // トレーリングカンマを削除（配列とオブジェクト）
      cleanedText = cleanedText.replace(/,(\s*[}\]])/g, '$1');

      // JSONコメントを削除（// ... と /* ... */）
      cleanedText = cleanedText.replace(/\/\/.*$/gm, '');
      cleanedText = cleanedText.replace(/\/\*[\s\S]*?\*\//g, '');

      // シングルクォートをダブルクォートに変換（プロパティ名のみ）
      cleanedText = cleanedText.replace(/([{,]\s*)'/g, '$1"');
      cleanedText = cleanedText.replace(/'\s*:/g, '":');

      // 再度パース
      return JSON.parse(cleanedText);
    }
  } catch (error) {
    // パースエラー時は詳細情報をログ出力
    console.error('❌ JSON Parse Error:', error);
    console.error('Response text length:', responseText.length);
    console.error('Response text (first 500 chars):', responseText.substring(0, 500));
    console.error('Response text (last 500 chars):', responseText.substring(Math.max(0, responseText.length - 500)));

    // エラー位置付近のテキストを表示
    let contextInfo = '';
    if (error instanceof SyntaxError && error.message.includes('position')) {
      const match = error.message.match(/position (\d+)/);
      if (match) {
        const position = parseInt(match[1], 10);
        const start = Math.max(0, position - 200);
        const end = Math.min(responseText.length, position + 200);
        contextInfo = responseText.substring(start, end);
        console.error(`Context around position ${position}:`, contextInfo);
      }
    }

    // エラー詳細をクライアントに返せるように、エラーオブジェクトに含める
    const detailedError: any = new Error(`Failed to parse Gemini JSON response: ${error instanceof Error ? error.message : String(error)}`);
    detailedError.parseError = {
      message: error instanceof Error ? error.message : String(error),
      responseLength: responseText.length,
      firstChars: responseText.substring(0, 500),
      lastChars: responseText.substring(Math.max(0, responseText.length - 500)),
      contextAroundError: contextInfo,
    };
    throw detailedError;
  }
}

/**
 * 曜日配列を日本語文字列に変換
 * @param weekdays 曜日の数値配列（0=日, 1=月, ..., 6=土）
 * @returns 日本語の曜日文字列（例: "月・水・金"）
 */
function formatWeekdays(weekdays: number[]): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  if (!weekdays || weekdays.length === 0) return '指定なし';
  if (weekdays.length === 7) return '全日';
  if (weekdays.length === 6 && !weekdays.includes(0)) return '月〜土';
  return weekdays.map(d => dayNames[d]).join('・');
}

/**
 * Phase 47: パート職員の勤務制約を動的に生成
 *
 * 骨子生成（Phase 1）でパート職員の曜日制限を明示的にプロンプトに含める。
 * これにより、AIが制限外の曜日に配置しようとするのを防ぐ。
 *
 * @param staffList スタッフ一覧
 * @returns パート職員制約のプロンプト文字列（該当者がいない場合は空文字列）
 *
 * @see {@link .kiro/ai-quality-improvement-analysis-2025-12-08.md}
 */
function buildDynamicPartTimeConstraints(staffList: Staff[]): string {
  // パート職員を抽出（週3日以下の希望 または 勤務可能曜日が制限されている）
  const partTimeStaff = staffList.filter(s => {
    const availableWeekdays = s.availableWeekdays || [0, 1, 2, 3, 4, 5, 6];
    const isWeekdayRestricted = availableWeekdays.length < 6 ||
      (availableWeekdays.length === 6 && availableWeekdays.includes(0));
    const isPartTime = s.weeklyWorkCount.hope <= 3;
    return isPartTime || isWeekdayRestricted;
  });

  if (partTimeStaff.length === 0) {
    return '';
  }

  const constraints = partTimeStaff.map(s => {
    const weekdays = formatWeekdays(s.availableWeekdays || [1, 2, 3, 4, 5, 6]);
    return `- ${s.name}: 週${s.weeklyWorkCount.hope}日まで、**${weekdays}のみ**勤務可`;
  }).join('\n');

  return `
## ⚠️ 【パート職員制約】（厳守）
以下のスタッフは勤務日数・曜日に**厳格な制限**があります：
${constraints}

**重要**: 上記スタッフを制限外の曜日に配置すると、シフトが無効になります。
例えば「月・水・金のみ」のスタッフは、火曜・木曜・土曜には**絶対に**配置しないでください。
`;
}


/**
 * Phase 48: 連続勤務制約の動的生成
 *
 * スタッフごとのmaxConsecutiveWorkDays属性を参照し、
 * AIに連続勤務制限を明示的に伝えるプロンプトを生成する。
 *
 * 設計原則（ai-production-quality-review-2025-12-08.mdより）:
 * 1. データ駆動型: スタッフデータから動的に抽出
 * 2. 条件付き生成: 制限があるスタッフのみリスト化
 * 3. 明示的な警告: 違反時の無効化を明記
 * 4. 可読性重視: 具体的なスタッフ名をリスト化
 *
 * @param staffList スタッフ一覧
 * @returns 連続勤務制約のプロンプト文字列
 */
export function buildDynamicConsecutiveConstraints(staffList: Staff[]): string {
  const DEFAULT_MAX_CONSECUTIVE = 5;

  // 連続勤務制限があるスタッフを抽出（デフォルト5日と異なる場合）
  const restrictedStaff = staffList.filter(s => {
    const maxDays = s.maxConsecutiveWorkDays ?? DEFAULT_MAX_CONSECUTIVE;
    return maxDays < DEFAULT_MAX_CONSECUTIVE;
  });

  let constraints = `
## ⚠️ 【連続勤務制約】（厳守）
**基本ルール**: すべてのスタッフは連続勤務**最大${DEFAULT_MAX_CONSECUTIVE}日**までです。
6日以上連続で勤務させると、シフトが無効になります。

**推奨**: 休日を適切に分散させ、連続勤務は4〜5日に抑えることを推奨します。
**休日間隔**: 休日は5日以上間を空けないよう配置してください。
`;

  // 個別制限があるスタッフがいる場合
  if (restrictedStaff.length > 0) {
    const individualConstraints = restrictedStaff.map(s => {
      const maxDays = s.maxConsecutiveWorkDays ?? DEFAULT_MAX_CONSECUTIVE;
      return `- ${s.name}: **最大${maxDays}日**まで`;
    }).join('\n');

    constraints += `
### 個別制限（より厳しい制限）
以下のスタッフは基本ルールより厳しい制限があります：
${individualConstraints}

**重要**: 上記スタッフの連続勤務を制限日数内に抑えてください。
`;
  }

  return constraints;
}


/**
 * 休暇希望を構造化テキストに変換する
 *
 * 生JSONではなく、AIが理解しやすい構造化テキスト形式で休暇希望を表示する。
 *
 * @param staffList スタッフ一覧
 * @param leaveRequests 休暇申請
 * @param targetMonth 対象月（YYYY-MM形式）
 * @returns 構造化された休暇希望テキスト（希望がない場合は空文字列）
 */
export function buildDynamicLeaveConstraints(
  staffList: Staff[],
  leaveRequests: LeaveRequest,
  targetMonth: string
): string {
  if (!leaveRequests || Object.keys(leaveRequests).length === 0) {
    return '';
  }

  const staffMap = new Map(staffList.map(s => [s.id, s.name]));
  const lines: string[] = [];

  for (const [staffId, dateMap] of Object.entries(leaveRequests)) {
    if (!dateMap || Object.keys(dateMap).length === 0) continue;
    const staffName = staffMap.get(staffId) || staffId;
    const dates = Object.entries(dateMap)
      .filter(([date]) => date.startsWith(targetMonth))
      .map(([date, type]) => {
        const day = parseInt(date.split('-')[2], 10);
        return `${day}日(${type})`;
      });
    if (dates.length > 0) {
      lines.push(`- ${staffName}: ${dates.join(', ')}`);
    }
  }

  if (lines.length === 0) {
    return '';
  }

  return `
## ⚠️ 【休暇希望】（厳守）
以下のスタッフの休暇希望を必ず反映してください：
${lines.join('\n')}

**重要**: 上記の日は必ずrestDaysに含めてください。
`;
}


/**
 * Phase 49/52: 日別必要勤務人数の動的制約生成（強化版）
 *
 * 各営業日に必要な勤務人数を計算し、AIに明示的に伝えるプロンプトを生成する。
 * Phase 52で日別分析結果を統合し、リスク日の警告を追加。
 *
 * 設計原則（CLAUDE.md「動的制約生成パターン」より）:
 * 1. データ駆動型: スタッフデータ・要件データから動的に計算
 * 2. 条件付き生成: リスク日がある場合のみ警告を追加
 * 3. 明示的な警告: 不足が発生すると無効になることを明記
 * 4. 可読性重視: 日別の数値を表形式で表示
 *
 * @param staffList スタッフ一覧
 * @param requirements シフト要件
 * @param daysInMonth 月の日数
 * @param leaveRequests 休暇申請（オプション）
 * @returns 日別人員制約のプロンプト文字列
 */
export function buildDynamicStaffingConstraints(
  staffList: Staff[],
  requirements: ShiftRequirement,
  daysInMonth: number,
  leaveRequests?: LeaveRequest
): string {
  const [year, month] = requirements.targetMonth.split('-').map(Number);

  // 1日の合計必要人員
  const totalStaffPerDay = Object.values(requirements.requirements || {})
    .reduce((sum, req) => sum + req.totalStaff, 0);

  // 日曜日の数を計算
  let sundayCount = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow === 0) sundayCount++;
  }
  const businessDays = daysInMonth - sundayCount;

  // 必要人日数と供給可能人日数を計算
  const requiredPersonDays = businessDays * totalStaffPerDay;
  const supplyPersonDays = staffList.reduce((sum, s) => sum + s.weeklyWorkCount.hope * 4, 0);

  // 各スタッフが勤務すべき日数を計算
  const avgWorkDays = Math.ceil(requiredPersonDays / staffList.length);

  // Phase 52: 日別分析を実行してリスク日を特定
  const analysis = buildDailyAvailabilityAnalysis(staffList, requirements, daysInMonth, leaveRequests);

  // 各スタッフの勤務可能日数と必要勤務日数を計算
  const staffWorkTable = staffList.map(s => {
    const weeklyHope = s.weeklyWorkCount.hope;
    const monthlyTarget = weeklyHope * 4;  // 月間目標
    const availableWeekdays = s.availableWeekdays || [0, 1, 2, 3, 4, 5, 6];
    // その人が勤務できる営業日数を計算
    const availableBusinessDays = analysis.dailyStats.filter(stat =>
      availableWeekdays.includes(stat.weekdayNum)
    ).length;
    // 休暇希望数を計算
    const leaveCount = leaveRequests && leaveRequests[s.id]
      ? Object.keys(leaveRequests[s.id]).filter(date =>
          date.startsWith(requirements.targetMonth)
        ).length
      : 0;
    const totalRestDays = daysInMonth - monthlyTarget;
    return {
      name: s.name,
      weeklyHope,
      monthlyTarget,
      availableBusinessDays,
      leaveCount,
      totalRestDays,
      // ゼロ除算を防ぐ（勤務可能日数が0の場合は100%とする）
      mustWorkRatio: availableBusinessDays > 0
        ? Math.round(monthlyTarget / availableBusinessDays * 100)
        : 100,
    };
  });

  // 週勤務希望が少ないスタッフ（パート）をハイライト
  const partTimeWarning = staffWorkTable
    .filter(s => s.weeklyHope <= 3)
    .map(s => `- ${s.name}: 週${s.weeklyHope}日希望 → 月${s.monthlyTarget}日勤務（勤務可能日の${s.mustWorkRatio}%）`)
    .join('\n');

  let result = `
## ⚠️ 【日別人員配置制約】（最重要・厳守）

**絶対条件**: 各営業日（月〜土）に**必ず${totalStaffPerDay}名**を勤務させてください。
1人でも不足すると、そのシフトは**無効**になります。

### 計算根拠
- 必要人日: ${businessDays}営業日 × ${totalStaffPerDay}名 = **${requiredPersonDays}人日**
- 供給可能: ${staffList.length}名 × 週平均勤務 × 4週 ≒ **${supplyPersonDays}人日**
- 各スタッフは平均**${avgWorkDays}日/月**勤務が必要

### 休日ルール（厳守）
- 週5回勤務 → 月20日勤務、平日休み**${businessDays - 20}日**、合計休日**${sundayCount + Math.max(0, businessDays - 20)}日**
- 週4回勤務 → 月16日勤務、平日休み**${businessDays - 16}日**、合計休日**${sundayCount + Math.max(0, businessDays - 16)}日**
- 週3回勤務 → 月12日勤務、平日休み**${businessDays - 12}日**、合計休日**${sundayCount + Math.max(0, businessDays - 12)}日**

**⚠️ 休日を入れすぎないこと！** 休日が多すぎると人員不足になります。
`;

  // Phase 52: パート職員の警告
  if (partTimeWarning) {
    result += `
### パート職員の勤務目安
以下のスタッフは勤務日数が限られています。勤務可能日はできるだけ勤務させてください：
${partTimeWarning}
`;
  }

  // スタッフ別休日予算テーブル
  const budgetRows = staffWorkTable.map(s =>
    `| ${s.name} | ${s.weeklyHope}回 | ${s.monthlyTarget}日 | ${s.totalRestDays}日 | ${s.leaveCount}日 |`
  ).join('\n');
  result += `
### スタッフ別休日予算（目安）
| スタッフ | 週希望 | 月間勤務 | 休日合計 | うち希望休 |
|---------|--------|---------|---------|-----------|
${budgetRows}

**重要**: 休日数が上記より多いと人員不足になります。各スタッフの休日数は±1日の範囲に収めてください。
`;

  // Phase 52: リスク日の警告を追加
  if (analysis.riskDays.length > 0) {
    result += analysis.summary;
  }

  return result;
}


// ============================================================================
// Phase 52: 日別分析とトレーサビリティログ
// ============================================================================

/**
 * Phase 52: 日別勤務可能人数分析インターフェース
 *
 * 各営業日に勤務可能なスタッフ数を計算し、人員不足リスクを特定する。
 * トレーサビリティログおよびプロンプト生成で使用。
 */
interface DailyAvailability {
  day: number;
  weekday: string;
  weekdayNum: number;  // 0=日, 1=月, ...
  availableCount: number;
  requiredCount: number;
  margin: number;
  isRisk: boolean;
  availableStaff: string[];
}

interface DailyAvailabilityAnalysis {
  dailyStats: DailyAvailability[];
  riskDays: number[];
  businessDays: number;
  sundays: number[];
  summary: string;
}

/**
 * Phase 56: 資格保有者の休日分散制約を生成
 *
 * requirements.requiredQualificationsからデータ駆動で制約を生成。
 * 看護師に限定せず、全資格要件に汎用的に対応する。
 *
 * @param staffList スタッフ一覧
 * @param requirements シフト要件
 * @returns 資格保有者の休日分散制約テキスト
 */
export function buildDynamicQualificationDistributionConstraints(
  staffList: Staff[],
  requirements: ShiftRequirement
): string {
  const constraints: string[] = [];

  // 全シフトの資格要件を収集（重複排除）
  const qualReqMap = new Map<string, number>();
  for (const [, dailyReq] of Object.entries(requirements.requirements || {})) {
    for (const qr of dailyReq.requiredQualifications || []) {
      const existing = qualReqMap.get(String(qr.qualification)) || 0;
      qualReqMap.set(String(qr.qualification), Math.max(existing, qr.count));
    }
  }

  if (qualReqMap.size === 0) return '';

  for (const [qualName, requiredCount] of qualReqMap) {
    // 該当資格を持つスタッフを検索（完全一致で判定）
    const qualifiedStaff = staffList.filter(s =>
      (s.qualifications || []).some(q => String(q) === qualName)
    );

    if (qualifiedStaff.length === 0) continue;

    const staffNames = qualifiedStaff.map(s => s.name).join('、');

    if (qualifiedStaff.length <= requiredCount) {
      // 対象者数 ≤ 必要数 → 全員毎日出勤が必要
      constraints.push(
        `## ⚠️ 【資格保有者の休日分散】\n` +
        `### ${qualName}（毎営業日${requiredCount}名以上必要）\n` +
        `対象: ${staffNames}（計${qualifiedStaff.length}名）\n` +
        `→ 対象者全員で${requiredCount}名ちょうどのため、全員が毎営業日出勤する必要があります\n` +
        `→ **休日は日曜日のみとし、営業日には必ず全員出勤させてください**`
      );
    } else {
      // 対象者数 > 必要数 → 休日分散が重要
      const maxSimultaneousOff = qualifiedStaff.length - requiredCount;
      constraints.push(
        `## ⚠️ 【資格保有者の休日分散】\n` +
        `### ${qualName}（毎営業日${requiredCount}名以上必要）\n` +
        `対象: ${staffNames}（計${qualifiedStaff.length}名）\n` +
        `→ ${qualifiedStaff.length}名中${requiredCount}名が毎営業日必要なので、同時に休めるのは最大${maxSimultaneousOff}名です\n` +
        `→ **休日が重ならないよう交互に配置してください**`
      );
    }
  }

  return constraints.length > 0 ? '\n' + constraints.join('\n\n') + '\n' : '';
}

/**
 * Phase 52: 日別勤務可能人数を分析
 *
 * パート職員の曜日制限を考慮し、各営業日に何人勤務可能かを計算する。
 * 人員不足リスクのある日を特定し、プロンプトに警告を追加する。
 *
 * 設計原則:
 * 1. データ駆動型: staffList.availableWeekdaysから動的に計算
 * 2. 条件付き生成: リスク日がある場合のみ警告を追加
 * 3. 明示的な警告: 具体的な日付と勤務可能スタッフ名を表示
 * 4. 可読性重視: 日別の表形式で表示
 *
 * @param staffList スタッフ一覧
 * @param requirements シフト要件
 * @param daysInMonth 月の日数
 * @param leaveRequests 休暇申請（オプション）
 * @returns 日別分析結果
 */
function buildDailyAvailabilityAnalysis(
  staffList: Staff[],
  requirements: ShiftRequirement,
  daysInMonth: number,
  leaveRequests?: LeaveRequest
): DailyAvailabilityAnalysis {
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

  // 1日の合計必要人員
  const totalStaffPerDay = Object.values(requirements.requirements || {})
    .reduce((sum, req) => sum + req.totalStaff, 0);

  // 日曜日リスト
  const sundays: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow === 0) sundays.push(day);
  }

  // 休暇申請を日付→スタッフIDのマップに変換
  // LeaveRequest型は { [staffId: string]: { [date: string]: LeaveType } } のRecord型
  const leaveByDate: Map<string, Set<string>> = new Map();
  if (leaveRequests && typeof leaveRequests === 'object') {
    for (const [staffId, dateMap] of Object.entries(leaveRequests)) {
      if (dateMap && typeof dateMap === 'object') {
        for (const dateStr of Object.keys(dateMap)) {
          if (!leaveByDate.has(dateStr)) {
            leaveByDate.set(dateStr, new Set());
          }
          leaveByDate.get(dateStr)!.add(staffId);
        }
      }
    }
  }

  const dailyStats: DailyAvailability[] = [];
  const riskDays: number[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();

    // 日曜日はスキップ
    if (dow === 0) continue;

    const dateStr = `${requirements.targetMonth}-${String(day).padStart(2, '0')}`;
    const leavingStaff = leaveByDate.get(dateStr) || new Set();

    // その日に勤務可能なスタッフをフィルタリング
    const availableStaff = staffList.filter(s => {
      // 休暇申請があるスタッフは除外
      if (leavingStaff.has(s.id)) return false;

      // 曜日制限をチェック
      const availableWeekdays = s.availableWeekdays || [0, 1, 2, 3, 4, 5, 6];
      return availableWeekdays.includes(dow);
    });

    const margin = availableStaff.length - totalStaffPerDay;
    const isRisk = margin < 2;  // 余裕が2名未満はリスク

    if (isRisk) {
      riskDays.push(day);
    }

    dailyStats.push({
      day,
      weekday: weekdayNames[dow],
      weekdayNum: dow,
      availableCount: availableStaff.length,
      requiredCount: totalStaffPerDay,
      margin,
      isRisk,
      availableStaff: availableStaff.map(s => s.name),
    });
  }

  // サマリー生成
  let summary = '';
  if (riskDays.length > 0) {
    summary = `
### ⚠️ 【人員不足リスク日】（特に注意）
以下の日は勤務可能スタッフが少ないため、**休日を入れないこと**を強く推奨します：

${riskDays.map(d => {
  const stat = dailyStats.find(s => s.day === d)!;
  return `- **${d}日（${stat.weekday}）**: 勤務可能${stat.availableCount}名（必要${stat.requiredCount}名）→ ${stat.availableStaff.join('、')}`;
}).join('\n')}

**重要**: 上記の日に休日を入れると人員不足になります。全員勤務させてください。
`;
  }

  return {
    dailyStats,
    riskDays,
    businessDays: dailyStats.length,
    sundays,
    summary,
  };
}


// NOTE: buildShiftDistributionGuide関数は削除（Phase 52で未使用のためTS6133エラー回避）
// 将来必要に応じて再実装予定


/**
 * Phase 52: トレーサビリティログ - Phase 1開始
 *
 * 構造化ログでPhase 1の入力情報を記録する。
 * Cloud Loggingで検索・分析可能な形式。
 */
function logPhase1Start(
  staffList: Staff[],
  requirements: ShiftRequirement,
  analysis: DailyAvailabilityAnalysis
): void {
  const logData = {
    phase: 'phase1_start',
    timestamp: new Date().toISOString(),
    targetMonth: requirements.targetMonth,
    staffCount: staffList.length,
    businessDays: analysis.businessDays,
    sundayCount: analysis.sundays.length,
    riskDays: analysis.riskDays,
    riskDayCount: analysis.riskDays.length,
    staffSummary: staffList.map(s => ({
      id: s.id,
      name: s.name,
      weeklyHope: s.weeklyWorkCount.hope,
      timeSlotPreference: s.timeSlotPreference,
      availableWeekdays: s.availableWeekdays || [0, 1, 2, 3, 4, 5, 6],
    })),
    requirementsSummary: Object.entries(requirements.requirements || {}).map(([name, req]) => ({
      shiftName: name,
      totalStaff: req.totalStaff,
      qualifications: req.requiredQualifications,
    })),
  };

  console.log('📋 [Phase 1 Start]', JSON.stringify(logData, null, 2));
}


/**
 * Phase 52: トレーサビリティログ - Phase 1完了
 *
 * 骨子生成結果のサマリーを記録する。
 * 各スタッフの休日数・勤務日数を集計。
 */
function logPhase1Complete(
  skeleton: ScheduleSkeleton,
  analysis: DailyAvailabilityAnalysis
): void {
  // 日別勤務者数を計算
  const dailyWorkerCount: Record<number, number> = {};
  for (const stat of analysis.dailyStats) {
    dailyWorkerCount[stat.day] = 0;
  }

  for (const staff of skeleton.staffSchedules) {
    const restDays = new Set(staff.restDays || []);
    for (const stat of analysis.dailyStats) {
      if (!restDays.has(stat.day)) {
        dailyWorkerCount[stat.day]++;
      }
    }
  }

  // 不足日を検出
  const requiredCount = analysis.dailyStats[0]?.requiredCount || 5;
  const shortageDays = Object.entries(dailyWorkerCount)
    .filter(([_, count]) => count < requiredCount)
    .map(([day, count]) => ({ day: Number(day), count, shortage: requiredCount - count }));

  const logData = {
    phase: 'phase1_complete',
    timestamp: new Date().toISOString(),
    staffScheduleCount: skeleton.staffSchedules.length,
    skeletonSummary: skeleton.staffSchedules.map(s => ({
      staffId: s.staffId,
      staffName: s.staffName,
      restDayCount: s.restDays?.length || 0,
      workDayCount: analysis.businessDays - (s.restDays?.filter(d => !analysis.sundays.includes(d)).length || 0),
    })),
    dailyWorkerCount,
    shortageDays,
    shortageDayCount: shortageDays.length,
  };

  console.log('✅ [Phase 1 Complete]', JSON.stringify(logData, null, 2));

  // 警告ログ
  if (shortageDays.length > 0) {
    console.warn(`⚠️ [Phase 1 Warning] ${shortageDays.length}日で人員不足の可能性:`,
      shortageDays.map(d => `${d.day}日(${d.count}名)`).join(', ')
    );
  }
}


/**
 * Phase 52: トレーサビリティログ - Phase 2バッチ完了
 *
 * 各バッチの生成結果を記録する。
 * シフト配分を集計して偏りを検出。
 */
function logPhase2BatchComplete(
  batchIndex: number,
  batchStaff: Staff[],
  batchResult: Array<{ staffId: string; staffName: string; shifts: Record<string, string> }>,
  requirements: ShiftRequirement
): void {
  // シフト配分を集計
  const shiftDistribution: Record<string, number> = {};
  const dailyDistribution: Record<number, Record<string, number>> = {};

  for (const schedule of batchResult) {
    for (const [day, shiftType] of Object.entries(schedule.shifts || {})) {
      shiftDistribution[shiftType] = (shiftDistribution[shiftType] || 0) + 1;

      const dayNum = Number(day);
      if (!dailyDistribution[dayNum]) {
        dailyDistribution[dayNum] = {};
      }
      dailyDistribution[dayNum][shiftType] = (dailyDistribution[dayNum][shiftType] || 0) + 1;
    }
  }

  // 期待値との比較
  const totalDays = Object.keys(batchResult[0]?.shifts || {}).filter(d => batchResult[0].shifts[d] !== '休').length;
  const expectedEarly = (requirements.requirements?.['早番']?.totalStaff || 0) * totalDays / batchStaff.length * batchResult.length;
  const expectedDay = (requirements.requirements?.['日勤']?.totalStaff || 0) * totalDays / batchStaff.length * batchResult.length;
  const expectedLate = (requirements.requirements?.['遅番']?.totalStaff || 0) * totalDays / batchStaff.length * batchResult.length;

  const logData = {
    phase: 'phase2_batch_complete',
    timestamp: new Date().toISOString(),
    batchIndex,
    batchStaffCount: batchStaff.length,
    staffNames: batchStaff.map(s => s.name),
    shiftDistribution,
    expectedDistribution: {
      early: Math.round(expectedEarly),
      day: Math.round(expectedDay),
      late: Math.round(expectedLate),
    },
  };

  console.log(`📝 [Phase 2 Batch ${batchIndex}]`, JSON.stringify(logData, null, 2));

  // 偏り警告
  const actualEarly = shiftDistribution['早番'] || 0;
  const actualLate = shiftDistribution['遅番'] || 0;
  if (actualEarly < expectedEarly * 0.5) {
    console.warn(`⚠️ [Phase 2 Batch ${batchIndex} Warning] 早番が不足: 実際${actualEarly} < 期待${Math.round(expectedEarly)}`);
  }
  if (actualLate < expectedLate * 0.5) {
    console.warn(`⚠️ [Phase 2 Batch ${batchIndex} Warning] 遅番が不足: 実際${actualLate} < 期待${Math.round(expectedLate)}`);
  }
}


/**
 * Phase 1: 骨子生成用スキーマ
 * NOTE: BUG-013により現在未使用（responseSchemaとthinkingBudgetの非互換性）
 * Googleが修正後に再度使用予定
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getSkeletonSchema(daysInMonth: number, hasNightShift: boolean) {
  // 夜勤がない場合は夜勤関連フィールドを含めない
  const staffProperties: Record<string, any> = {
    staffId: { type: 'string', description: 'スタッフID' },
    staffName: { type: 'string', description: 'スタッフ名' },
    restDays: {
      type: 'array',
      description: '休日の日付リスト（1-31の数値配列）',
      items: { type: 'integer', minimum: 1, maximum: daysInMonth },
    },
  };

  const requiredFields = ['staffId', 'staffName', 'restDays'];
  const propertyOrder = ['staffId', 'staffName', 'restDays'];

  if (hasNightShift) {
    staffProperties.nightShiftDays = {
      type: 'array',
      description: '夜勤の日付リスト（1-31の数値配列）',
      items: { type: 'integer', minimum: 1, maximum: daysInMonth },
    };
    staffProperties.nightShiftFollowupDays = {
      type: 'array',
      description: '夜勤明け休み・公休の日付リスト（1-31の数値配列）',
      items: { type: 'integer', minimum: 1, maximum: daysInMonth },
    };
    requiredFields.push('nightShiftDays', 'nightShiftFollowupDays');
    propertyOrder.push('nightShiftDays', 'nightShiftFollowupDays');
  }

  return {
    type: 'object',
    properties: {
      staffSchedules: {
        type: 'array',
        description: '全スタッフの休日パターン（骨子）',
        items: {
          type: 'object',
          properties: staffProperties,
          propertyOrdering: propertyOrder,
          required: requiredFields,
        },
      },
    },
    propertyOrdering: ['staffSchedules'],
    required: ['staffSchedules'],
  };
}

/**
 * Phase 1: 骨子生成用プロンプト
 */
function buildSkeletonPrompt(
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest,
  daysInMonth: number,
  hasNightShift: boolean
): string {
  // シフト種類名を取得
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name).join('、');

  // 必要人員テーブルを作成
  const requirementsTable = Object.entries(requirements.requirements || {})
    .map(([shiftName, req]) => {
      const quals = (req.requiredQualifications || [])
        .map(q => `${q.qualification}${q.count}名`)
        .join('、') || 'なし';
      return `| ${shiftName} | ${req.totalStaff}名 | ${quals} |`;
    })
    .join('\n');

  // 1日の合計必要人員
  const totalStaffPerDay = Object.values(requirements.requirements || {})
    .reduce((sum, req) => sum + req.totalStaff, 0);

  // Phase 47: パート職員の勤務可能曜日制限を含めた情報生成
  const staffInfo = staffList
    .map((s) => {
      // 基本情報
      const baseInfo = `- ${s.name}(ID:${s.id}): 週${s.weeklyWorkCount.hope}回希望（必須${s.weeklyWorkCount.must}回）`;

      // 勤務可能曜日の制限チェック（月〜土の6日より少ない場合は制限あり）
      const availableWeekdays = s.availableWeekdays || [0, 1, 2, 3, 4, 5, 6];
      const isRestricted = availableWeekdays.length < 6 ||
        (availableWeekdays.length === 6 && availableWeekdays.includes(0)); // 日曜含む6日も制限あり
      const weekdayRestriction = isRestricted
        ? ` ⚠️ 【${formatWeekdays(availableWeekdays)}のみ勤務可】`
        : '';

      // パート職員の識別（週3日以下の希望）
      const isPartTime = s.weeklyWorkCount.hope <= 3;
      const partTimeLabel = isPartTime ? ' [パート]' : '';

      // 資格情報
      const qualLabel = (s.qualifications || []).length > 0
        ? ` 資格=[${(s.qualifications || []).join(',')}]`
        : '';

      return hasNightShift
        ? `${baseInfo}${partTimeLabel}${qualLabel}${weekdayRestriction}, 夜勤専従=${s.isNightShiftOnly}`
        : `${baseInfo}${partTimeLabel}${qualLabel}${weekdayRestriction}`;
    })
    .join('\n');

  // 日曜日のリストを計算（デイサービス用）
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const sundays: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === 0) {
      sundays.push(day);
    }
  }

  // 営業日数（日曜除く）
  const businessDayCount = daysInMonth - sundays.length;

  // 数学的検証用の計算
  const totalLeaveCount = Object.values(leaveRequests || {}).reduce(
    (sum, dateMap) => sum + Object.keys(dateMap || {}).filter(d => d.startsWith(requirements.targetMonth)).length,
    0
  );
  const avgWeeklyWork = staffList.reduce((s, st) => s + st.weeklyWorkCount.hope, 0) / staffList.length;
  const grossSupply = Math.round(staffList.reduce((s, st) => s + st.weeklyWorkCount.hope, 0) * 4);
  const netSupply = grossSupply - totalLeaveCount;
  const requiredDays = businessDayCount * totalStaffPerDay;
  const marginDays = netSupply - requiredDays;

  // 夜勤がある場合とない場合で異なるプロンプト
  if (hasNightShift) {
    return `
あなたは介護施設のシフト管理AIです。
まず、全スタッフの「休日」「夜勤日」「夜勤明け休み・公休」のパターン（骨子）だけを決定してください。
詳細なシフト区分（${shiftTypeNames}など）は後で決めるので、今回は骨子のみです。

# スタッフ情報（全${staffList.length}名）
${staffInfo}

# 対象期間
- ${requirements.targetMonth}（全${daysInMonth}日間）

# 各日の必要人員
| シフト | 必要人数 | 資格要件 |
|--------|----------|----------|
${requirementsTable}

# 制約条件
## 🔴 絶対厳守（労基法違反回避）
**夜勤後の休息ルール**:
- 夜勤日がX日の場合 → X+1日は「明け休み」、X+2日は「公休」
- 例: 夜勤が3日なら → 4日は明け休み、5日は公休
- **nightShiftFollowupDaysには X+1 と X+2 の両方を含めること**

## 必須条件
- 各日、合計${totalStaffPerDay}名の勤務者を確保すること
- 休暇希望を必ず反映すること（詳細は下記参照）
- 夜勤専従スタッフ（isNightShiftOnly=true）は夜勤と休日のみ
${buildDynamicLeaveConstraints(staffList, leaveRequests, requirements.targetMonth)}
${buildDynamicQualificationDistributionConstraints(staffList, requirements)}
## 努力目標
- スタッフの希望週勤務回数に近づける
- 休日を公平に分散させる

# 出力形式
各スタッフの骨子をJSONで出力してください：
- staffId: スタッフID（文字列）
- staffName: スタッフ名（文字列）
- restDays: 通常の公休日リスト（例: [1,9,17,25]）※夜勤明け休みは含めない
- nightShiftDays: 夜勤の日付リスト（例: [3,10,17,24]）
- nightShiftFollowupDays: **夜勤翌日（明け休み）+ 翌々日（公休）の両方**（例: 夜勤が3,10日なら [4,5,11,12]）

# 出力前チェック
□ nightShiftDaysの各日付X に対して、X+1とX+2がnightShiftFollowupDaysに含まれているか
□ 全${staffList.length}名分の骨子があるか
□ 同じ資格の全員が同日に休んでいないか（資格要件がある場合）

重要：全${staffList.length}名分の骨子を必ず出力してください。
`;
  } else {
    // デイサービスなど夜勤がない施設の場合
    return `
あなたはデイサービス（通所介護）のシフト管理AIです。
まず、全スタッフの「休日」のパターン（骨子）だけを決定してください。
詳細なシフト区分（${shiftTypeNames}）は後で決めるので、今回は骨子のみです。

**重要**: この施設はデイサービスのため、**夜勤はありません**。日中営業のみです。

# スタッフ情報（全${staffList.length}名）
${staffInfo}

# 対象期間
- ${requirements.targetMonth}（全${daysInMonth}日間）
- 営業日: ${businessDayCount}日（日曜休み）
- 日曜日: ${sundays.join(', ')}日 ← **全員休日**

# 各日の必要人員（営業日のみ）
| シフト | 必要人数 | 資格要件 |
|--------|----------|----------|
${requirementsTable}
| **合計** | **${totalStaffPerDay}名/日** | - |

# 制約条件
## 必須条件（厳守）
1. **日曜日（${sundays.join(', ')}日）は全員「休」とすること**
2. 営業日（月〜土）は毎日${totalStaffPerDay}名の勤務者を確保すること
3. **休暇希望を必ず反映すること**（詳細は下記参照）
4. **連続勤務制限を厳守**（詳細は下記参照）
5. **パート職員は指定された曜日のみ勤務可能**（詳細は下記参照）
${buildDynamicLeaveConstraints(staffList, leaveRequests, requirements.targetMonth)}
${buildDynamicConsecutiveConstraints(staffList)}
${buildDynamicPartTimeConstraints(staffList)}
${buildDynamicStaffingConstraints(staffList, requirements, daysInMonth, leaveRequests)}
${buildDynamicQualificationDistributionConstraints(staffList, requirements)}
## 努力目標
- スタッフの希望週勤務回数に近づける
- 休日を公平に分散させる（週1〜2日の休み）

# 数学的検証
- 必要人日数: ${businessDayCount}営業日 × ${totalStaffPerDay}名 = ${requiredDays}人日
- 可能人日数: ${staffList.length}名 × 週平均${avgWeeklyWork.toFixed(1)}回 × 4週 ≒ ${grossSupply}人日
- 休暇希望による減算: ${totalLeaveCount}人日
- 実質可能人日数: ${netSupply}人日
- 余裕: ${marginDays}人日（${marginDays >= 0 ? '実現可能' : '⚠️ タイト'}）

# 出力形式
各スタッフの骨子をJSONで出力してください：
- staffId: スタッフID（文字列）
- staffName: スタッフ名（文字列）
- restDays: 休日の日付リスト
  - **日曜日（${sundays.join(', ')}）は必ず含めること**
  - 例: [${sundays[0]},${sundays[0] + 1},${sundays[1]},${sundays[1] + 2},...]

# 出力前チェック
□ 全${staffList.length}名分の骨子があるか
□ 日曜日（${sundays.join(', ')}日）が全員のrestDaysに含まれているか
□ 各営業日に${totalStaffPerDay}名以上が勤務可能か
□ **連続勤務が5日を超えていないか**（休日が適切に分散されているか）
□ パート職員が制限外の曜日に勤務していないか（例: 月・水・金のみの人が火曜に勤務していないか）
□ 休暇希望日が全員のrestDaysに含まれているか
□ 各スタッフの休日数が予算テーブルの範囲内か（±1日）
□ 同じ資格の全員が同日に休んでいないか（資格要件がある場合）

重要：全${staffList.length}名分の骨子を必ず出力してください。
`;
  }
}

/**
 * Phase 1: 骨子生成実行
 */
export async function generateSkeleton(
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest,
  projectId: string
): Promise<ScheduleSkeleton> {
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const actualDaysInMonth = new Date(year, month, 0).getDate();
  const daysInMonth = requirements.daysToGenerate || actualDaysInMonth;

  // 夜勤があるかどうかを判定（シフト名に「夜」が含まれるかどうか）
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
  const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

  // Phase 52: 日別分析を実行（トレーサビリティログ用）
  const analysis = buildDailyAvailabilityAnalysis(staffList, requirements, daysInMonth, leaveRequests);

  // Phase 52: トレーサビリティログ - Phase 1開始
  logPhase1Start(staffList, requirements, analysis);

  // BUG-022: 日本リージョン + gemini-2.5-proのみ使用
  console.log(`🇯🇵 AI Config Version: ${AI_CONFIG_VERSION}, Location: ${AI_LOCATION}`);
  const client = new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: AI_LOCATION,
  });

  const prompt = buildSkeletonPrompt(staffList, requirements, leaveRequests, daysInMonth, hasNightShift);

  console.log('🦴 Phase 1: 骨子生成開始...');
  console.log(`   夜勤シフト: ${hasNightShift ? 'あり' : 'なし（デイサービス）'}`);

  // BUG-014: responseMimeType='application/json'もthinkingBudgetを無視する
  // https://discuss.ai.google.dev/t/latest-google-genai-with-2-5-flash-ignoring-thinking-budget/102497
  // 解決策: responseMimeTypeを削除し、プロンプトでJSON出力を強制
  const jsonPrompt = `${prompt}

# 🔴 絶対厳守: JSON出力形式
以下の形式で**純粋なJSONのみ**を出力してください。説明文や余分なテキストは一切不要です。

\`\`\`json
{
  "staffSchedules": [
    {
      "staffId": "スタッフID",
      "staffName": "スタッフ名",
      "restDays": [休日の日付リスト]
    }
  ]
}
\`\`\`

**重要**: JSONコードブロック以外のテキストを出力しないでください。`;

  // BUG-022: マルチモデル戦略 - フォールバック付きで生成
  // プライマリ: Gemini 3 Flash (thinkingLevel: high)
  // フォールバック: Gemini 2.5 Pro (常に安定)
  const { text: responseText, model: usedModel } = await generateWithFallback(
    client,
    jsonPrompt,
    GENERATION_CONFIGS.skeleton.primary,
    GENERATION_CONFIGS.skeleton.fallback,
    'Phase 1 骨子生成'
  );

  console.log(`🦴 Phase 1: ${usedModel} で生成完了`);
  let skeleton = parseGeminiJsonResponse(responseText) as ScheduleSkeleton;
  console.log(`✅ Phase 1完了: ${skeleton.staffSchedules.length}名分の骨子生成`);

  // Phase 改善: バリデーション実行（BUG-023防止）
  const validationResult = validateSkeletonOutput(skeleton, staffList, hasNightShift, daysInMonth);
  logValidationResult('Phase1', validationResult);

  // バリデーションエラーがある場合、自動修正を試行
  if (!validationResult.isValid && hasNightShift) {
    console.log('🔧 Phase 1: 骨子データの自動修正を実行...');
    skeleton = autoFixSkeleton(skeleton, daysInMonth);

    // 再バリデーション
    const revalidationResult = validateSkeletonOutput(skeleton, staffList, hasNightShift, daysInMonth);
    logValidationResult('Phase1(修正後)', revalidationResult);
  }

  // Phase 52: トレーサビリティログ - Phase 1完了
  logPhase1Complete(skeleton, analysis);

  return skeleton;
}

/**
 * Phase 44: 詳細生成用の動的制約を生成
 * スタッフのtimeSlotPreferenceに基づいて動的に制約文を生成
 */
function buildDetailedDynamicConstraints(
  staffBatch: Staff[],
  requirements: ShiftRequirement
): string {
  const constraints: string[] = [];

  // 「日勤のみ」スタッフを動的に収集
  const dayOnlyStaff = staffBatch.filter(
    s => s.timeSlotPreference === TimeSlotPreference.DayOnly
  );

  // 「夜勤のみ」スタッフを動的に収集
  const nightOnlyStaff = staffBatch.filter(
    s => s.timeSlotPreference === TimeSlotPreference.NightOnly
  );

  if (dayOnlyStaff.length > 0) {
    const names = dayOnlyStaff.map(s => s.name).join('、');
    constraints.push(
      `## ⚠️ 【時間帯制約】日勤のみスタッフ\n` +
      `以下のスタッフは**日勤のみ**に配置してください。\n` +
      `**早番・遅番には絶対に配置しないでください**：\n` +
      `- ${names}\n` +
      `\nこれは絶対条件です。違反したシフトは無効になります。`
    );
  }

  if (nightOnlyStaff.length > 0) {
    const names = nightOnlyStaff.map(s => s.name).join('、');
    constraints.push(
      `## ⚠️ 【時間帯制約】夜勤のみスタッフ\n` +
      `以下のスタッフは**夜勤のみ**に配置してください。\n` +
      `**早番・日勤・遅番には絶対に配置しないでください**：\n` +
      `- ${names}`
    );
  }

  // 看護師配置制約を動的に生成
  const nurses = staffBatch.filter(staff =>
    (staff.qualifications || []).some(q =>
      String(q).includes('看護師') || String(q).includes('看護')
    )
  );

  const dayShiftReq = requirements.requirements?.['日勤'];
  const nurseRequired = dayShiftReq?.requiredQualifications?.some(q =>
    String(q.qualification).includes('看護')
  );

  if (nurses.length > 0 && nurseRequired) {
    const nurseNames = nurses.map(s => s.name).join('、');
    const requiredCount = dayShiftReq?.requiredQualifications?.find(q =>
      String(q.qualification).includes('看護')
    )?.count || 1;

    constraints.push(
      `## ⚠️ 【看護師配置制約】\n` +
      `毎日の日勤には、以下の看護師のうち**必ず${requiredCount}名以上**を配置してください：\n` +
      `- ${nurseNames}\n` +
      `\n看護師が日勤に入っていない日は資格要件違反です。`
    );
  }

  return constraints.length > 0 ? '\n' + constraints.join('\n\n') + '\n' : '';
}

/**
 * Phase 2: スタッフ情報を構造化テキストで生成
 * staffInfoのCSV形式(join(','))をAIが解釈しやすい形式に変換
 */
export function buildPhase2StaffInfo(
  staffBatch: Staff[],
  skeleton: ScheduleSkeleton,
  daysInMonth: number,
  hasNightShift: boolean
): string {
  return staffBatch
    .map((s) => {
      const skel = skeleton.staffSchedules.find(sk => sk.staffId === s.id);
      const qualifications = (s.qualifications || []).join('、') || 'なし';
      const restDays = skel?.restDays || [];

      if (hasNightShift) {
        const nightDays = skel?.nightShiftDays || [];
        const followupDays = skel?.nightShiftFollowupDays || [];
        const restDisplay = restDays.length > 0
          ? restDays.map(d => `${d}日`).join(', ') + `（計${restDays.length}日）`
          : 'なし';
        const nightDisplay = nightDays.length > 0
          ? nightDays.map(d => `${d}日`).join(', ') + `（計${nightDays.length}日）`
          : 'なし';
        const followupDisplay = followupDays.length > 0
          ? followupDays.map(d => `${d}日`).join(', ') + `（計${followupDays.length}日）`
          : 'なし';
        const nonWorkDays = restDays.length + nightDays.length + followupDays.length;
        const workDays = daysInMonth - nonWorkDays;
        return `- ${s.name}(ID:${s.id}): 資格=${qualifications}\n  休日: ${restDisplay}\n  夜勤: ${nightDisplay}\n  明け休み: ${followupDisplay}\n  → 勤務${workDays}日`;
      } else {
        const restDisplay = restDays.length > 0
          ? restDays.map(d => `${d}日`).join(', ') + `（計${restDays.length}日）`
          : 'なし';
        const workDays = daysInMonth - restDays.length;
        return `- ${s.name}(ID:${s.id}): 資格=${qualifications}\n  休日: ${restDisplay} → 勤務${workDays}日`;
      }
    })
    .join('\n');
}

/**
 * Phase 2: 詳細シフト生成用プロンプト
 */
function buildDetailedPrompt(
  staffBatch: Staff[],
  skeleton: ScheduleSkeleton,
  requirements: ShiftRequirement,
  daysInMonth: number,
  hasNightShift: boolean
): string {
  // シフト種類名を取得
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);

  const staffInfo = buildPhase2StaffInfo(staffBatch, skeleton, daysInMonth, hasNightShift);

  // シフト区分の説明
  const shiftDescription = requirements.timeSlots.map(t => `- ${t.name}: ${t.start}-${t.end}`).join('\n');

  // 日付の例（正しい年月を使用）
  const dateExamples = [1, 2, 3].map(d =>
    `${requirements.targetMonth}-${String(d).padStart(2, '0')}`
  ).join(', ');

  // 必要人員テーブルを作成
  const requirementsTable = Object.entries(requirements.requirements || {})
    .map(([shiftName, req]) => {
      const quals = (req.requiredQualifications || [])
        .map(q => `${q.qualification}${q.count}名以上`)
        .join('、') || 'なし';
      return `| ${shiftName} | ${req.totalStaff}名 | ${quals} |`;
    })
    .join('\n');

  // 1日の合計必要人員
  const totalStaffPerDay = Object.values(requirements.requirements || {})
    .reduce((sum, req) => sum + req.totalStaff, 0);

  // 各シフトの必要人数を取得
  const earlyCount = requirements.requirements?.['早番']?.totalStaff || 2;
  const dayCount = requirements.requirements?.['日勤']?.totalStaff || 2;
  const lateCount = requirements.requirements?.['遅番']?.totalStaff || 1;

  // Phase 44: 動的なtimeSlotPreference制約を生成
  const dynamicConstraints = buildDetailedDynamicConstraints(staffBatch, requirements);

  if (hasNightShift) {
    return `
以下のスタッフの${requirements.targetMonth}の詳細シフトを生成してください。
**骨子（休日・夜勤）は既に決定済み**なので、それに従って詳細シフト区分を割り当ててください。

# 対象スタッフ（${staffBatch.length}名）
${staffInfo}

# シフト区分
${shiftDescription}

# 【絶対条件】各日の必要人員
| シフト | 必要人数 | 資格要件 |
|--------|----------|----------|
${requirementsTable}

**重要**: 各営業日、上記の人員配置を**必ず**満たしてください。
1日の合計勤務者数: ${totalStaffPerDay}名

# 制約
## 🔴 絶対厳守（労基法違反回避）
1. **夜勤の翌日は必ず「明け休み」を割り当てること**（上記の「明け休み=」の日付）
2. **夜勤明け休みの翌日は必ず「休」を割り当てること**
3. 骨子で指定された休日・夜勤日は変更しないこと
${dynamicConstraints}
## 必須条件
- 夜勤以外・休日以外の日は、${shiftTypeNames.filter(n => !n.includes('夜')).join('・')}のいずれかを割り当てる
- 各シフトの必要人数を**必ず**満たすこと
- **連続勤務は5日以内に抑えること**（骨子の休日パターンに従えば自動的に満たされます）

# シフト割り当てルール
| 骨子の指定 | 割り当てるシフト |
|-----------|----------------|
| 夜勤日 | 「夜勤」 |
| 明け休み日 | 「明け休み」 |
| 休日 | 「休」 |
| 上記以外 | 早番・日勤・遅番のいずれか |

# 出力チェックリスト
□ 骨子の休日・夜勤日が正しく反映されているか
□ 夜勤翌日が「明け休み」になっているか
□ 早番・日勤・遅番がバランスよく配分されているか
□ 毎営業日の日勤に必要な資格保有者（看護師等）が配置されているか
□ 連続勤務が5日以内に収まっているか

# 出力
各スタッフの${requirements.targetMonth}の全${daysInMonth}日分の詳細シフトをJSON形式で出力してください。
日付は必ず「${dateExamples}」のように${requirements.targetMonth}の日付を使用してください。
`;
  } else {
    // デイサービスなど夜勤がない施設の場合
    // Phase 50: 日別配置要件を明示的に計算
    const [year, month] = requirements.targetMonth.split('-').map(Number);
    const sundays: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === 0) sundays.push(day);
    }
    const businessDays = daysInMonth - sundays.length;

    // 各スタッフの休日数を計算
    const staffRestInfo = staffBatch.map(s => {
      const skel = skeleton.staffSchedules.find(sk => sk.staffId === s.id);
      const restDays = skel?.restDays || [];
      const nonSundayRest = restDays.filter(d => !sundays.includes(d)).length;
      const workDays = businessDays - nonSundayRest;
      return `- ${s.name}: 休日${restDays.length}日（日曜${sundays.filter(d => restDays.includes(d)).length}日＋平日${nonSundayRest}日）→ **勤務${workDays}日**`;
    }).join('\n');

    // 全スタッフ数を計算するための注記を追加
    const totalStaffCount = skeleton.staffSchedules.length;

    return `
# 🔴 重要: このバッチについて
**このバッチは全${totalStaffCount}名中の${staffBatch.length}名分です。**
他のバッチと合わせて全体の人員配置を満たします。
このバッチのスタッフについてのみ、骨子に従って詳細シフトを割り当ててください。

## このバッチの勤務予定（骨子に基づく）
${staffRestInfo}

**タスク**: 上記の「勤務日」に対して早番・日勤・遅番のいずれかを割り当ててください。
休日以外の日に「休」を入れないでください。

# 対象スタッフ（${staffBatch.length}名）
${staffInfo}

# シフト区分（日中のみ）
${shiftDescription}

# シフト配分目標
| シフト | 必要人数/日 | このバッチ目安 |
|--------|-------------|---------------|
| 早番 | ${earlyCount}名 | ${Math.max(1, Math.round(earlyCount * staffBatch.length / totalStaffCount))}名程度 |
| 日勤 | ${dayCount}名 | ${Math.max(1, Math.round(dayCount * staffBatch.length / totalStaffCount))}名程度 |
| 遅番 | ${lateCount}名 | ${Math.max(1, Math.round(lateCount * staffBatch.length / totalStaffCount))}名程度 |

**配分ルール**: 早番・日勤・遅番を ${earlyCount}:${dayCount}:${lateCount} の比率でバランスよく配分してください。

# 制約
${dynamicConstraints}
- 骨子で指定された休日の日だけ「休」を出力すること
- **休日以外の日は、必ず早番・日勤・遅番のいずれかを割り当てること**
- 日曜日（${sundays.join(', ')}日）は全員「休」とすること
- **夜勤や明け休みは絶対に使用しないこと**
- 各シフト（早番・日勤・遅番）をバランスよく配分すること
- **連続勤務は5日以内に抑えること**（骨子の休日パターンに従えば自動的に満たされます）

# 出力チェックリスト
□ 日曜日（${sundays.join(', ')}日）は全員「休」になっているか
□ 休日のスタッフだけ「休」になっているか（休日以外に「休」がないか確認！）
□ 早番・日勤・遅番が ${earlyCount}:${dayCount}:${lateCount} の比率でバランスよく配分されているか
□ 毎営業日の日勤に必要な資格保有者（看護師等）が配置されているか
□ 連続勤務が5日以内に収まっているか

# 🔴 出力形式（必須）
**必ずJSON形式で出力してください。説明文は不要です。**
各スタッフの${requirements.targetMonth}の全${daysInMonth}日分の詳細シフトを以下の形式で出力:

\`\`\`json
{
  "schedule": [
    {
      "staffId": "スタッフID",
      "staffName": "スタッフ名",
      "shifts": { "1": "シフト種別", "2": "シフト種別", ... }
    }
  ]
}
\`\`\`

日付のキーは「1」「2」...「${daysInMonth}」の数字です。
shiftTypeは「${shiftTypeNames.join('」「')}」「休」のいずれかを使用してください。
`;
  }
}

/**
 * Phase 2: 詳細シフト生成（バッチ処理）
 */
export async function generateDetailedShifts(
  staffList: Staff[],
  skeleton: ScheduleSkeleton,
  requirements: ShiftRequirement,
  projectId: string
): Promise<StaffSchedule[]> {
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const actualDaysInMonth = new Date(year, month, 0).getDate();
  const daysInMonth = requirements.daysToGenerate || actualDaysInMonth;

  // 夜勤があるかどうかを判定
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
  const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

  // BUG-022: 日本リージョン + gemini-2.5-proのみ使用
  const client = new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: AI_LOCATION,
  });

  const allSchedules: StaffSchedule[] = [];
  const batches = Math.ceil(staffList.length / BATCH_SIZE);

  // Phase 改善: Phase 2入力バリデーション（BUG-023防止）
  const phase2Validation = validatePhase2Input(skeleton, staffList, hasNightShift);
  logValidationResult('Phase2', phase2Validation);

  if (!phase2Validation.isValid) {
    console.error('❌ Phase 2: 入力データに問題があります。処理を続行しますが、品質に影響する可能性があります。');
  }

  console.log(`📝 Phase 2: 詳細生成開始（${batches}バッチ）...`);

  for (let i = 0; i < staffList.length; i += BATCH_SIZE) {
    const batch = staffList.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`  バッチ ${batchNum}/${batches}: ${batch.map(s => s.name).join(', ')}`);

    const prompt = buildDetailedPrompt(batch, skeleton, requirements, daysInMonth, hasNightShift);

    // BUG-014: responseMimeType='application/json'もthinkingBudgetを無視する
    const jsonPrompt = `${prompt}

# 🔴 絶対厳守: JSON出力形式
以下の形式で**純粋なJSONのみ**を出力してください。説明文は不要です。

\`\`\`json
{
  "schedule": [
    {
      "staffId": "スタッフID",
      "staffName": "スタッフ名",
      "shifts": { "1": "シフト種別", "2": "シフト種別", ... }
    }
  ]
}
\`\`\``;

    // BUG-022: マルチモデル戦略 - フォールバック付きで生成
    // プライマリ: Gemini 2.5 Flash-Lite (thinkingBudget: 0, 最安)
    // フォールバック: Gemini 3 Flash (thinkingLevel: low)
    const { text: batchResponseText, model: usedModel } = await generateWithFallback(
      client,
      jsonPrompt,
      GENERATION_CONFIGS.detailBatch.primary,
      GENERATION_CONFIGS.detailBatch.fallback,
      `Phase 2 バッチ${batchNum}`
    );

    console.log(`  ✅ Batch ${batchNum}: ${usedModel} で生成完了`);
    const batchResult = parseGeminiJsonResponse(batchResponseText);

    // Phase 52: トレーサビリティログ - バッチ完了
    logPhase2BatchComplete(batchNum, batch, batchResult.schedule, requirements);

    allSchedules.push(...batchResult.schedule);
  }

  console.log(`✅ Phase 2完了: ${allSchedules.length}名分の詳細シフト生成`);

  // Phase 50: デバッグログ追加 - シフト配分の確認
  const shiftCounts: Record<string, number> = {};
  for (const schedule of allSchedules as any[]) {
    for (const shiftType of Object.values(schedule.shifts || {})) {
      shiftCounts[shiftType as string] = (shiftCounts[shiftType as string] || 0) + 1;
    }
  }
  console.log('📊 シフト配分:', shiftCounts);

  // 形式変換: { shifts: { "1": "日勤", ... } } → { monthlyShifts: [{ date: "2025-01-01", shiftType: "日勤" }, ...] }
  const convertedSchedules: StaffSchedule[] = allSchedules.map((schedule: any) => {
    const monthlyShifts = Object.entries(schedule.shifts || {}).map(([day, shiftType]) => ({
      date: `${requirements.targetMonth}-${String(day).padStart(2, '0')}`,
      shiftType: shiftType as string,
    }));

    return {
      staffId: schedule.staffId,
      staffName: schedule.staffName,
      monthlyShifts,
    };
  });

  console.log(`✅ 形式変換完了: ${convertedSchedules.length}名分をmonthlyShifts形式に変換`);
  return convertedSchedules;
}

/**
 * 詳細シフト用スキーマ
 *
 * @param targetMonth 対象月 (YYYY-MM)
 * @param daysInMonth 月の日数
 * @param shiftTypeNames シフト種類名のリスト（例: ['早番', '日勤', '遅番']）
 * NOTE: BUG-013により現在未使用（responseSchemaとthinkingBudgetの非互換性）
 */
function _getDetailedShiftSchema(targetMonth: string, daysInMonth: number, shiftTypeNames: string[]) {
  // シフト種類に「休」を追加（夜勤がある場合のみ「明け休み」も追加）
  const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));
  const allShiftTypes = [...shiftTypeNames, '休'];
  if (hasNightShift) {
    allShiftTypes.push('明け休み');
  }
  const shiftTypesDescription = allShiftTypes.map(s => `'${s}'`).join(', ');

  // 日付範囲の例
  const dateExample = `${targetMonth}-01 〜 ${targetMonth}-${String(daysInMonth).padStart(2, '0')}`;

  return {
    type: 'object',
    properties: {
      schedule: {
        type: 'array',
        description: 'スタッフごとの月間シフトスケジュール',
        items: {
          type: 'object',
          properties: {
            staffId: { type: 'string', description: 'スタッフID' },
            staffName: { type: 'string', description: 'スタッフ名' },
            monthlyShifts: {
              type: 'array',
              description: `${targetMonth}の月間シフト配列（${daysInMonth}日分）`,
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: `日付（${dateExample}の形式、必ず${targetMonth}の日付を使用）` },
                  shiftType: { type: 'string', description: `シフト種別（${shiftTypesDescription}）` },
                },
                propertyOrdering: ['date', 'shiftType'],
                required: ['date', 'shiftType'],
              },
            },
          },
          propertyOrdering: ['staffId', 'staffName', 'monthlyShifts'],
          required: ['staffId', 'staffName', 'monthlyShifts'],
        },
      },
    },
    propertyOrdering: ['schedule'],
    required: ['schedule'],
  };
}

// BUG-013: responseSchemaとthinkingBudgetの非互換性により一時的に未使用
// Googleが修正後に再度使用予定
void getSkeletonSchema;
void _getDetailedShiftSchema;
