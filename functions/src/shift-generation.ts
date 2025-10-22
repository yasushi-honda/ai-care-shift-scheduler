import { onRequest } from 'firebase-functions/v2/https';
import { VertexAI } from '@google-cloud/vertexai';
import * as admin from 'firebase-admin';
import type { Staff, ShiftRequirement, LeaveRequest } from './types';

// Firebase Admin初期化（index.tsで行うため、ここでは不要）
// admin.initializeApp();

/**
 * プロンプトインジェクション対策: ユーザー入力をサニタイズ
 */
function sanitizeForPrompt(input: string): string {
  if (!input) return '';
  // 改行を削除し、特殊文字をエスケープ、長さ制限
  return input
    .replace(/[\n\r]/g, ' ')
    .replace(/[{}]/g, '')
    .trim()
    .substring(0, 200);
}

/**
 * AIによるシフト自動生成エンドポイント
 *
 * @description
 * Vertex AI (Gemini 2.5 Flash-Lite-Latest) を使用して、
 * 介護施設のシフト表を自動生成します。
 *
 * @endpoint POST /generateShift
 * @authentication なし（MVP版）
 * @cors 全オリジン許可
 */
export const generateShift = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
    memory: '1GiB', // Vertex AI使用のためメモリ増量
    timeoutSeconds: 120, // AI生成時間を考慮
  },
  async (req, res) => {
    // CORS設定
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONSリクエスト（プリフライト）
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // POSTメソッドのみ許可
    if (req.method !== 'POST') {
      res.status(405).json({
        success: false,
        error: 'Method Not Allowed. Use POST.',
      });
      return;
    }

    try {
      const { staffList, requirements, leaveRequests } = req.body;

      // バリデーション
      if (!staffList || !Array.isArray(staffList) || staffList.length === 0) {
        throw new Error('staffList is required and must be a non-empty array');
      }

      // 入力サイズ制限（リソース枯渇対策）
      if (staffList.length > 100) {
        throw new Error('staffList cannot exceed 100 staff members');
      }

      if (!requirements || !requirements.targetMonth) {
        throw new Error('requirements with targetMonth is required');
      }

      // リクエストボディサイズ制限
      const bodySize = JSON.stringify(req.body).length;
      if (bodySize > 200 * 1024) { // 200KB
        throw new Error('Request body size exceeds 200KB limit');
      }

      // 休暇申請数の制限
      const leaveRequestCount = Object.keys(leaveRequests || {}).reduce(
        (sum, staffId) => sum + Object.keys(leaveRequests[staffId] || {}).length,
        0
      );
      if (leaveRequestCount > 500) {
        throw new Error('Leave requests cannot exceed 500 entries');
      }

      console.log('📅 シフト生成開始:', {
        targetMonth: requirements.targetMonth,
        staffCount: staffList.length,
        leaveRequestCount: Object.keys(leaveRequests || {}).length,
      });

      // Vertex AI 初期化
      const projectId = process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT;
      if (!projectId) {
        throw new Error('GCP_PROJECT_ID environment variable is not set');
      }

      const vertexAI = new VertexAI({
        project: projectId,
        location: 'asia-northeast1', // 東京リージョン
      });

      const model = vertexAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite-latest', // 最新版を自動使用
      });

      // プロンプト生成
      const prompt = buildShiftPrompt(staffList, requirements, leaveRequests);
      console.log('📝 プロンプト生成完了');

      // AIシフト生成実行
      console.log('🤖 Vertex AI 呼び出し開始...');
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: getShiftSchema() as any, // 型定義の互換性のため
          temperature: 0.5,
          maxOutputTokens: 8192,
        },
      });

      // レスポンステキストを取得
      const candidates = result.response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('Vertex AI からレスポンスが返されませんでした');
      }

      const parts = candidates[0].content?.parts;
      if (!parts || parts.length === 0) {
        throw new Error('Vertex AI レスポンスの形式が不正です');
      }

      const responseText = parts[0].text || '';
      console.log('✅ Vertex AI レスポンス受信');

      // JSON解析
      const scheduleData = JSON.parse(responseText);

      // Firestoreに保存
      const docRef = await admin.firestore()
        .collection('schedules')
        .add({
          schedule: scheduleData.schedule,
          targetMonth: requirements.targetMonth,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          staffCount: staffList.length,
          status: 'generated',
          metadata: {
            model: 'gemini-2.5-flash-lite-latest',
            tokensUsed: result.response.usageMetadata?.totalTokenCount || 0,
          },
        });

      console.log('💾 Firestore保存完了:', docRef.id);

      // 成功レスポンス
      res.status(200).json({
        success: true,
        scheduleId: docRef.id,
        schedule: scheduleData.schedule,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: 'gemini-2.5-flash-lite-latest',
          tokensUsed: result.response.usageMetadata?.totalTokenCount || 0,
        },
      });

    } catch (error) {
      console.error('❌ Error generating shift:', error);

      // エラーレスポンス（スタックトレースは含めない）
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
);

/**
 * シフト生成用プロンプトを構築
 */
function buildShiftPrompt(
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest
): string {
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 時間帯情報のフォーマット（サニタイズ済み）
  const timeSlotsInfo = (requirements.timeSlots || [])
    .map((slot) => `  - ${sanitizeForPrompt(slot.name)}: ${sanitizeForPrompt(slot.start)}〜${sanitizeForPrompt(slot.end)} (休憩${slot.restHours || 0}時間)`)
    .join('\n');

  // 要件情報のフォーマット（サニタイズ済み）
  const requirementsInfo = Object.entries(requirements.requirements || {})
    .map(([shiftName, req]) => {
      const qualifications = (req.requiredQualifications || [])
        .map((q) => `${sanitizeForPrompt(String(q.qualification))} ${q.count}名`)
        .join(', ');
      const roles = (req.requiredRoles || [])
        .map((r) => `${sanitizeForPrompt(String(r.role))} ${r.count}名`)
        .join(', ');
      return `  【${sanitizeForPrompt(shiftName)}】\n    - 必要人員: ${req.totalStaff}名\n    - 必要資格: ${qualifications || 'なし'}\n    - 必要役職: ${roles || 'なし'}`;
    })
    .join('\n');

  // スタッフ情報のフォーマット（サニタイズ済み）
  const staffInfo = staffList.map((staff, index) => {
    const qualificationsStr = (staff.qualifications || [])
      .map(q => sanitizeForPrompt(String(q)))
      .join(', ') || 'なし';
    const unavailableDatesStr = (staff.unavailableDates || [])
      .map(d => sanitizeForPrompt(d))
      .join(', ') || 'なし';

    return `${index + 1}. ${sanitizeForPrompt(staff.name)} (${sanitizeForPrompt(String(staff.role))})
   - 資格: ${qualificationsStr}
   - 週の勤務回数: 希望${staff.weeklyWorkCount?.hope || 0}日、必須${staff.weeklyWorkCount?.must || 0}日
   - 連続勤務上限: ${staff.maxConsecutiveWorkDays || 0}日
   - 勤務可能曜日: ${formatWeekdays(staff.availableWeekdays || [])}
   - 勤務不可日: ${unavailableDatesStr}
   - 時間帯希望: ${sanitizeForPrompt(String(staff.timeSlotPreference))}
   - 夜勤専従: ${staff.isNightShiftOnly ? 'はい' : 'いいえ'}`;
  }).join('\n\n');

  // 休暇希望のフォーマット
  const leaveRequestsInfo = formatLeaveRequests(leaveRequests, staffList);

  return `あなたは介護・福祉事業所向けのAIシフト自動作成アシスタントです。
以下のスタッフ情報、事業所のシフト要件、休暇希望に基づいて、${requirements.targetMonth}の1ヶ月分（${daysInMonth}日間）の最適なシフト表をJSON形式で生成してください。

# スタッフ情報
${staffInfo}

# 事業所のシフト要件
対象月: ${requirements.targetMonth} (${daysInMonth}日間)

時間帯区分:
${timeSlotsInfo}

各シフトの必要体制:
${requirementsInfo}

# 休暇希望
${leaveRequestsInfo}

# シフト生成の制約条件

## 【絶対条件】（必ず守る）
1. 各日付・各時間帯で、事業所が設定した「必要な人員体制（人数、役職、資格）」を必ず満たしてください
2. スタッフが「勤務できない日」として設定した日には、シフトを割り当てないでください
3. スタッフから提出された「有給休暇」の希望は、必ず休日（「休」）として割り当ててください
4. スタッフの「連続勤務の上限」を超えないようにシフトを組んでください
5. isNightShiftOnlyがtrueのスタッフには、「夜勤」以外の勤務シフトを割り当てないでください（休日は可）
6. 「夜勤」シフトの翌日は必ず「明け休み」とし、翌々日は必ず「休」（公休）としてください
7. 1日の勤務が終わってから次の勤務が始まるまで、最低8時間以上の休息時間を確保してください
8. 週の必須勤務日数（must）は必ず守ってください

## 【努力目標】（可能な限り考慮）
1. スタッフの「希望休」や「研修」の希望日も、可能な限り休日または該当シフトを割り当ててください
2. スタッフが希望する「週の勤務回数」にできるだけ近づけてください
3. 特定のスタッフに勤務が偏らないよう、できるだけ公平に割り振ってください
4. 勤務可能な時間帯の希望（日勤のみ、夜勤のみなど）を尊重してください
5. 夜勤の回数が特定のスタッフに偏らないようにしてください

# 出力形式
- 必ず以下のJSONスキーマに従った有効なJSONオブジェクトのみを出力してください
- 説明文などは一切含めないでください
- staffIdは、入力されたスタッフ情報のIDと一致させてください
- monthlyShifts配列には、対象月の日数（${daysInMonth}日）分のデータを必ず含めてください
- shiftTypeには、定義された時間帯区分名（「早番」、「日勤」、「遅番」、「夜勤」）または休日を示す「休」、夜勤明けの休みを示す「明け休み」を入れてください

# 重要な注意事項
- すべての日付について、各シフトの必要人員を確実に満たすシフト表を作成してください
- 制約条件を満たせない場合は、その旨をエラーメッセージとして返してください
- 公平性と効率性を両立させたシフトを生成してください`;
}

/**
 * 曜日配列を日本語文字列に変換
 */
function formatWeekdays(weekdays: number[]): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  if (weekdays.length === 7) return '全日';
  if (weekdays.length === 0) return 'なし';
  return weekdays.map(d => dayNames[d]).join('、');
}

/**
 * 休暇希望をフォーマット（サニタイズ済み）
 */
function formatLeaveRequests(leaveRequests: LeaveRequest, staffList: Staff[]): string {
  if (!leaveRequests || Object.keys(leaveRequests).length === 0) {
    return '今月の休暇希望はありません。';
  }

  let formatted = '';

  for (const staffId in leaveRequests) {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) continue;

    formatted += `【${sanitizeForPrompt(staff.name)}】\n`;
    for (const date in leaveRequests[staffId]) {
      formatted += `  - ${sanitizeForPrompt(date)}: ${sanitizeForPrompt(String(leaveRequests[staffId][date]))}\n`;
    }
  }

  return formatted || '今月の休暇希望はありません。';
}

/**
 * Vertex AI のJSONスキーマ定義
 */
function getShiftSchema() {
  return {
    type: 'object',
    properties: {
      schedule: {
        type: 'array',
        description: '全スタッフの月間スケジュール',
        items: {
          type: 'object',
          properties: {
            staffId: {
              type: 'string',
              description: 'スタッフの一意のID',
            },
            staffName: {
              type: 'string',
              description: 'スタッフ名',
            },
            monthlyShifts: {
              type: 'array',
              description: 'そのスタッフの1ヶ月分のシフト',
              items: {
                type: 'object',
                properties: {
                  date: {
                    type: 'string',
                    description: '日付 (YYYY-MM-DD)',
                  },
                  shiftType: {
                    type: 'string',
                    description: "シフト区分 ('早番', '日勤', '遅番', '夜勤', '休', '明け休み')",
                  },
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
