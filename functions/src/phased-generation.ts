/**
 * 段階的シフト生成モジュール
 * Phase 1: 骨子生成（軽量・全スタッフの休日/夜勤パターン）
 * Phase 2: 詳細生成（5名ずつバッチ処理）
 * Phase 3: 統合
 */

import { VertexAI } from '@google-cloud/vertexai';
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

const VERTEX_AI_MODEL = 'gemini-2.5-flash';
const BATCH_SIZE = 10; // 詳細生成時のバッチサイズ（10名 × 30日 = 300セル）

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
    // Markdownコードブロックを削除（```json ... ``` または ``` ... ```）
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```')) {
      // 最初の```行を削除
      cleanedText = cleanedText.replace(/^```(?:json)?\n?/, '');
      // 最後の```行を削除
      cleanedText = cleanedText.replace(/\n?```$/, '');
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
      // 注: 値のシングルクォートは複雑なので、プロパティ名のみ対象
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
function buildDynamicConsecutiveConstraints(staffList: Staff[]): string {
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

**推奨**: 休日を適切に分散させ、連続勤務は3〜4日に抑えることを推奨します。
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
 * Phase 49: 日別必要勤務人数の動的制約生成
 *
 * 各営業日に必要な勤務人数を計算し、AIに明示的に伝えるプロンプトを生成する。
 * パート職員の曜日制限を考慮し、日ごとの最大勤務可能人数も計算して表示。
 *
 * 設計原則（CLAUDE.md「動的制約生成パターン」より）:
 * 1. データ駆動型: スタッフデータ・要件データから動的に計算
 * 2. 条件付き生成: 常に生成（人員充足は最重要制約）
 * 3. 明示的な警告: 不足が発生すると無効になることを明記
 * 4. 可読性重視: 日別の数値を表形式で表示
 *
 * @param staffList スタッフ一覧
 * @param requirements シフト要件
 * @param daysInMonth 月の日数
 * @returns 日別人員制約のプロンプト文字列
 */
function buildDynamicStaffingConstraints(
  staffList: Staff[],
  requirements: ShiftRequirement,
  daysInMonth: number
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

  return `
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
}

/**
 * Phase 1: 骨子生成用スキーマ
 */
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

      return hasNightShift
        ? `${baseInfo}${partTimeLabel}${weekdayRestriction}, 夜勤専従=${s.isNightShiftOnly}`
        : `${baseInfo}${partTimeLabel}${weekdayRestriction}`;
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
## 必須条件
- 各日、合計${totalStaffPerDay}名の勤務者を確保すること
- 夜勤の翌日は「夜勤明け休み」、翌々日は「公休」を割り当てること（連続2日休み）
- スタッフの休暇希望（${JSON.stringify(leaveRequests)}）を必ず反映すること
- 夜勤専従スタッフ（isNightShiftOnly=true）は夜勤と休日のみ

## 努力目標
- スタッフの希望週勤務回数に近づける
- 休日を公平に分散させる

# 出力形式
各スタッフの骨子をJSONで出力してください：
- staffId: スタッフID（文字列）
- staffName: スタッフ名（文字列）
- restDays: 休日の日付リスト（例: [1,5,9,13,17,21,25,29]）
- nightShiftDays: 夜勤の日付リスト（例: [3,10,17,24]）
- nightShiftFollowupDays: 夜勤明け休み・公休の日付リスト（例: [4,5,11,12,18,19,25,26]）

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
3. スタッフの休暇希望（${JSON.stringify(leaveRequests)}）を必ず反映すること
4. **連続勤務制限を厳守**（詳細は下記参照）
5. **パート職員は指定された曜日のみ勤務可能**（詳細は下記参照）
${buildDynamicConsecutiveConstraints(staffList)}
${buildDynamicPartTimeConstraints(staffList)}
${buildDynamicStaffingConstraints(staffList, requirements, daysInMonth)}
## 努力目標
- スタッフの希望週勤務回数に近づける
- 休日を公平に分散させる（週1〜2日の休み）

# 数学的検証
- 必要人日数: ${businessDayCount}営業日 × ${totalStaffPerDay}名 = ${businessDayCount * totalStaffPerDay}人日
- 可能人日数: ${staffList.length}名 × 週${Math.round(staffList.reduce((s, st) => s + st.weeklyWorkCount.hope, 0) / staffList.length)}回 × 4週 ≒ ${Math.round(staffList.reduce((s, st) => s + st.weeklyWorkCount.hope, 0) * 4)}人日
- 余裕あり: 実現可能です

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

  const vertexAI = new VertexAI({
    project: projectId,
    location: 'asia-northeast1',
  });

  const model = vertexAI.getGenerativeModel({
    model: VERTEX_AI_MODEL,
  });

  const prompt = buildSkeletonPrompt(staffList, requirements, leaveRequests, daysInMonth, hasNightShift);

  console.log('🦴 Phase 1: 骨子生成開始...');
  console.log(`   夜勤シフト: ${hasNightShift ? 'あり' : 'なし（デイサービス）'}`);
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: getSkeletonSchema(daysInMonth, hasNightShift) as any,
      temperature: 0.3,
      maxOutputTokens: 65536,  // Gemini 2.5 Flash thinking mode uses tokens from this budget
      // 思考トークンを制限（12名スタッフで65535トークン使い切りエラー対策）
      thinkingConfig: {
        thinkingBudget: 16384,  // 思考に16K、残りを出力に使用
      },
    } as any,
  });

  // Vertex AI レスポンス詳細ログ（デバッグ用）
  const response = result.response;
  const candidate = response.candidates?.[0];
  console.log('📊 Vertex AI Response Details:', {
    candidatesCount: response.candidates?.length || 0,
    finishReason: candidate?.finishReason || 'N/A',
    safetyRatings: candidate?.safetyRatings || [],
    blockReason: (response as any).promptFeedback?.blockReason || 'N/A',
    usageMetadata: response.usageMetadata || {},
  });

  const responseText = candidate?.content?.parts?.[0]?.text || '';
  const skeleton = parseGeminiJsonResponse(responseText) as ScheduleSkeleton;
  console.log(`✅ Phase 1完了: ${skeleton.staffSchedules.length}名分の骨子生成`);

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

  const staffInfo = staffBatch
    .map((s) => {
      const skel = skeleton.staffSchedules.find(sk => sk.staffId === s.id);
      const qualifications = (s.qualifications || []).join('、') || 'なし';
      if (hasNightShift) {
        return `- ${s.name}(ID:${s.id}): 資格=${qualifications}, 休日=${skel?.restDays?.join(',') || 'なし'}, 夜勤=${skel?.nightShiftDays?.join(',') || 'なし'}`;
      } else {
        return `- ${s.name}(ID:${s.id}): 資格=${qualifications}, 休日=${skel?.restDays?.join(',') || 'なし'}`;
      }
    })
    .join('\n');

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

  // 看護師名のリスト（資格要件がある場合）
  const nurses = staffBatch.filter(s =>
    (s.qualifications || []).some(q => q.includes('看護'))
  ).map(s => s.name);
  const nurseInfo = nurses.length > 0 ? `（${nurses.join('、')}）` : '';

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
- 骨子で指定された休日・夜勤日は変更しないこと
- 夜勤以外の日は、${shiftTypeNames.filter(n => !n.includes('夜')).join('・')}のいずれかを割り当てる
- 各シフトの必要人数を**必ず**満たすこと

# 出力
各スタッフの${requirements.targetMonth}の全${daysInMonth}日分の詳細シフトをJSON形式で出力してください。
日付は必ず「${dateExamples}」のように${requirements.targetMonth}の日付を使用してください。
`;
  } else {
    // デイサービスなど夜勤がない施設の場合
    return `
以下のスタッフの${requirements.targetMonth}の詳細シフトを生成してください。
**骨子（休日）は既に決定済み**なので、それに従って詳細シフト区分を割り当ててください。

**重要**: この施設はデイサービスのため、**夜勤はありません**。

# 対象スタッフ（${staffBatch.length}名）
${staffInfo}

# シフト区分（日中のみ）
${shiftDescription}

# 【絶対条件】各日の必要人員
| シフト | 必要人数 | 資格要件 |
|--------|----------|----------|
${requirementsTable}

# ⚠️ シフト配分の優先ルール（必ず守ること）
**日勤に偏った配置をしないでください。以下の順序でシフトを配分してください：**

1. **まず早番${earlyCount}名を確保** ← 最優先！
2. **次に遅番${lateCount}名を確保**
3. **残りのスタッフを日勤${dayCount}名に配置**（看護師${nurseInfo}を必ず1名含む）

❌ 悪い例: 早番1名、日勤4名、遅番0名（日勤に偏りすぎ）
✅ 良い例: 早番${earlyCount}名、日勤${dayCount}名、遅番${lateCount}名（バランス良い）
${dynamicConstraints}
# 制約
- 骨子で指定された休日は変更しないこと
- 休日以外の日は、必要人員を満たすようシフトを割り当てる
- 日曜日は全員「休」とすること
- **夜勤や明け休みは絶対に使用しないこと**
- **日勤に${dayCount + 1}名以上配置しないこと**（他のシフトが不足する原因になる）

# 出力前チェックリスト
□ 各営業日の早番が${earlyCount}名いるか ← 最重要！
□ 各営業日の遅番が${lateCount}名いるか
□ 各営業日の日勤が${dayCount}名いるか（看護師1名含む）
□ 日勤が${dayCount + 1}名以上の日がないか
□ 日曜日は全員「休」になっているか
□ 休日のスタッフは「休」になっているか

# 出力
各スタッフの${requirements.targetMonth}の全${daysInMonth}日分の詳細シフトをJSON形式で出力してください。
日付は必ず「${dateExamples}」のように${requirements.targetMonth}の日付を使用してください。
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

  const vertexAI = new VertexAI({
    project: projectId,
    location: 'asia-northeast1',
  });

  const model = vertexAI.getGenerativeModel({
    model: VERTEX_AI_MODEL,
  });

  const allSchedules: StaffSchedule[] = [];
  const batches = Math.ceil(staffList.length / BATCH_SIZE);

  console.log(`📝 Phase 2: 詳細生成開始（${batches}バッチ）...`);

  for (let i = 0; i < staffList.length; i += BATCH_SIZE) {
    const batch = staffList.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`  バッチ ${batchNum}/${batches}: ${batch.map(s => s.name).join(', ')}`);

    const prompt = buildDetailedPrompt(batch, skeleton, requirements, daysInMonth, hasNightShift);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: getDetailedShiftSchema(requirements.targetMonth, daysInMonth, shiftTypeNames) as any,
        temperature: 0.5,
        maxOutputTokens: 65536,  // Gemini 2.5 Flash thinking mode uses tokens from this budget
        // 思考トークンを制限（バッチ処理用）
        thinkingConfig: {
          thinkingBudget: 8192,  // バッチなので8Kで十分
        },
      } as any,
    });

    // Vertex AI レスポンス詳細ログ（デバッグ用）
    const batchResponse = result.response;
    const batchCandidate = batchResponse.candidates?.[0];
    console.log(`  📊 Batch ${batchNum} Response:`, {
      finishReason: batchCandidate?.finishReason || 'N/A',
      blockReason: (batchResponse as any).promptFeedback?.blockReason || 'N/A',
      outputTokens: batchResponse.usageMetadata?.candidatesTokenCount || 0,
    });

    const batchResponseText = batchCandidate?.content?.parts?.[0]?.text || '';
    const batchResult = parseGeminiJsonResponse(batchResponseText);
    allSchedules.push(...batchResult.schedule);
  }

  console.log(`✅ Phase 2完了: ${allSchedules.length}名分の詳細シフト生成`);
  return allSchedules;
}

/**
 * 詳細シフト用スキーマ
 *
 * @param targetMonth 対象月 (YYYY-MM)
 * @param daysInMonth 月の日数
 * @param shiftTypeNames シフト種類名のリスト（例: ['早番', '日勤', '遅番']）
 */
function getDetailedShiftSchema(targetMonth: string, daysInMonth: number, shiftTypeNames: string[]) {
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
