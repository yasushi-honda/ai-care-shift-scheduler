/**
 * 段階的シフト生成モジュール
 * Phase 1: 骨子生成（軽量・全スタッフの休日/夜勤パターン）
 * Phase 2: 詳細生成（5名ずつバッチ処理）
 * Phase 3: 統合
 */

import { VertexAI } from '@google-cloud/vertexai';
import type {
  Staff,
  ShiftRequirement,
  LeaveRequest,
  StaffSchedule,
  ScheduleSkeleton
} from './types';

const VERTEX_AI_MODEL = 'gemini-2.5-flash-lite';
const BATCH_SIZE = 10; // 詳細生成時のバッチサイズ（10名 × 30日 = 300セル）

/**
 * JSONレスポンスをクリーンアップしてパース
 * Gemini APIが時々Markdownコードブロック形式で返すため、それを削除
 */
function parseGeminiJsonResponse(responseText: string): any {
  try {
    // Markdownコードブロックを削除（```json ... ``` または ``` ... ```）
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```')) {
      // 最初の```行を削除
      cleanedText = cleanedText.replace(/^```(?:json)?\n?/, '');
      // 最後の```行を削除
      cleanedText = cleanedText.replace(/\n?```$/, '');
    }

    return JSON.parse(cleanedText);
  } catch (error) {
    // パースエラー時は詳細情報をログ出力
    console.error('❌ JSON Parse Error:', error);
    console.error('Response text (first 500 chars):', responseText.substring(0, 500));
    console.error('Response text (last 500 chars):', responseText.substring(Math.max(0, responseText.length - 500)));
    throw new Error(`Failed to parse Gemini JSON response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Phase 1: 骨子生成用スキーマ
 */
function getSkeletonSchema(daysInMonth: number) {
  return {
    type: 'object',
    properties: {
      staffSchedules: {
        type: 'array',
        description: '全スタッフの休日・夜勤パターン（骨子）',
        items: {
          type: 'object',
          properties: {
            staffId: { type: 'string' },
            staffName: { type: 'string' },
            restDays: {
              type: 'array',
              description: '休日の日付リスト（1-31の数値配列）',
              items: { type: 'number', minimum: 1, maximum: daysInMonth },
            },
            nightShiftDays: {
              type: 'array',
              description: '夜勤の日付リスト（1-31の数値配列）',
              items: { type: 'number', minimum: 1, maximum: daysInMonth },
            },
            nightShiftFollowupDays: {
              type: 'array',
              description: '夜勤明け休み・公休の日付リスト（1-31の数値配列）',
              items: { type: 'number', minimum: 1, maximum: daysInMonth },
            },
          },
          required: ['staffId', 'staffName', 'restDays', 'nightShiftDays', 'nightShiftFollowupDays'],
        },
      },
    },
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
  daysInMonth: number
): string {
  const staffInfo = staffList
    .map((s) => `- ${s.name}(ID:${s.id}): 週${s.weeklyWorkCount.hope}回希望, 夜勤専従=${s.isNightShiftOnly}`)
    .join('\n');

  return `
あなたは介護施設のシフト管理AIです。
まず、全スタッフの「休日」「夜勤日」「夜勤明け休み・公休」のパターン（骨子）だけを決定してください。
詳細なシフト区分（早番・日勤・遅番など）は後で決めるので、今回は骨子のみです。

# スタッフ情報（全${staffList.length}名）
${staffInfo}

# 対象期間
- ${requirements.targetMonth}（全${daysInMonth}日間）

# 制約条件
## 必須条件
- 各日、各時間帯で必要な人員体制（${JSON.stringify(requirements.requirements)}）を満たすこと
- 夜勤の翌日は「夜勤明け休み」、翌々日は「公休」を割り当てること（連続2日休み）
- スタッフの休暇希望（${JSON.stringify(leaveRequests)}）を必ず反映すること
- 夜勤専従スタッフ（isNightShiftOnly=true）は夜勤と休日のみ

## 努力目標
- スタッフの希望週勤務回数に近づける
- 休日を公平に分散させる

# 出力形式
骨子のみをJSONで出力してください。
- restDays: 休日の日付リスト（例: [1,5,9,13,17,21,25,29]）
- nightShiftDays: 夜勤の日付リスト（例: [3,10,17,24]）
- nightShiftFollowupDays: 夜勤明け休み・公休の日付リスト（例: [4,5,11,12,18,19,25,26]）

重要：全スタッフ分の骨子を出力してください。
`;
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

  const vertexAI = new VertexAI({
    project: projectId,
    location: 'us-central1',
  });

  const model = vertexAI.getGenerativeModel({
    model: VERTEX_AI_MODEL,
  });

  const prompt = buildSkeletonPrompt(staffList, requirements, leaveRequests, daysInMonth);

  console.log('🦴 Phase 1: 骨子生成開始...');
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: getSkeletonSchema(daysInMonth) as any,
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const skeleton = parseGeminiJsonResponse(responseText) as ScheduleSkeleton;
  console.log(`✅ Phase 1完了: ${skeleton.staffSchedules.length}名分の骨子生成`);

  return skeleton;
}

/**
 * Phase 2: 詳細シフト生成用プロンプト
 */
function buildDetailedPrompt(
  staffBatch: Staff[],
  skeleton: ScheduleSkeleton,
  requirements: ShiftRequirement,
  daysInMonth: number
): string {
  const staffInfo = staffBatch
    .map((s) => {
      const skel = skeleton.staffSchedules.find(sk => sk.staffId === s.id);
      return `- ${s.name}(ID:${s.id}): 休日=${skel?.restDays.join(',')}, 夜勤=${skel?.nightShiftDays.join(',')}`;
    })
    .join('\n');

  return `
以下のスタッフの詳細シフトを生成してください。
**骨子（休日・夜勤）は既に決定済み**なので、それに従って詳細シフト区分を割り当ててください。

# 対象スタッフ（${staffBatch.length}名）
${staffInfo}

# シフト区分
${requirements.timeSlots.map(t => `- ${t.name}: ${t.start}-${t.end}`).join('\n')}

# 制約
- 骨子で指定された休日・夜勤日は変更しないこと
- 夜勤以外の日は、早番・日勤・遅番のいずれかを割り当てる
- 各日の必要人員を満たすよう調整する

# 出力
各スタッフの全${daysInMonth}日分の詳細シフトをJSON形式で出力してください。
`;
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

  const vertexAI = new VertexAI({
    project: projectId,
    location: 'us-central1',
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

    const prompt = buildDetailedPrompt(batch, skeleton, requirements, daysInMonth);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: getDetailedShiftSchema(daysInMonth) as any,
        temperature: 0.5,
        maxOutputTokens: 8192,
      },
    });

    const batchResponseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const batchResult = parseGeminiJsonResponse(batchResponseText);
    allSchedules.push(...batchResult.schedule);
  }

  console.log(`✅ Phase 2完了: ${allSchedules.length}名分の詳細シフト生成`);
  return allSchedules;
}

/**
 * 詳細シフト用スキーマ（既存のgetShiftSchemaと同じ）
 */
function getDetailedShiftSchema(daysInMonth: number) {
  return {
    type: 'object',
    properties: {
      schedule: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            staffId: { type: 'string' },
            staffName: { type: 'string' },
            monthlyShifts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  shiftType: { type: 'string' },
                },
                required: ['date', 'shiftType'],
              },
            },
          },
          required: ['staffId', 'staffName', 'monthlyShifts'],
        },
      },
    },
    required: ['schedule'],
  };
}
