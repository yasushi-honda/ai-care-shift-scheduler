import { onRequest } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import { TimeSlotPreference } from './types';
import type { Staff, ShiftRequirement, LeaveRequest, StaffSchedule, AIEvaluationResult } from './types';
import { generateSkeleton, generateDetailedShifts, parseGeminiJsonResponse } from './phased-generation';
import { generateDetailedShiftsWithSolver } from './solver-client';
import { rebalanceShifts } from './shift-rebalance';
import { EvaluationService, createDefaultEvaluation } from './evaluation/evaluationLogic';
import {
  GENERATION_CONFIGS,
  buildGeminiConfig,
  isValidResponse,
  AI_LOCATION,
  AI_CONFIG_VERSION,
} from './ai-model-config';

// Firebase Admin初期化は index.ts で実施済み

// BUG-022: シングルモデル戦略 (2025-12-30更新)
// asia-northeast1 + gemini-2.5-proのみ使用（日本国内データ処理要件）

/**
 * 入力サイズ制限
 */
const MAX_STAFF_COUNT = 200; // スタッフ数上限
const MAX_REQUEST_SIZE_BYTES = 200 * 1024; // リクエストサイズ上限（200KB）

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
 * Vertex AI (Gemini 2.5 Flash-Lite) を使用して、
 * 介護施設のシフト表を自動生成します。
 *
 * @endpoint POST /generateShift
 * @authentication なし（MVP版）
 * @cors 全オリジン許可
 */
export const generateShift = onRequest(
  {
    region: 'asia-northeast1', // 東京リージョン（日本国内データ処理完結）
    cors: true,
    memory: '1GiB', // Vertex AI使用のためメモリ増量
    timeoutSeconds: 540, // BUG-022: gemini-2.5-pro（thinking常時ON）は12名規模で約5-6分
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
      const { staffList: rawStaffList, requirements, leaveRequests, useSolver } = req.body;

      // バリデーション
      if (!rawStaffList || !Array.isArray(rawStaffList) || rawStaffList.length === 0) {
        throw new Error('staffList is required and must be a non-empty array');
      }

      // Firestoreのフィールド名をCloud Functions内部で使用するフィールド名にマッピング
      // - staffId → id
      // - certifications → qualifications
      // 互換性のため、既に正しいフィールドが存在する場合はそのまま使用
      const staffList = rawStaffList.map((staff: Record<string, unknown>) => ({
        ...staff,
        id: staff.id || staff.staffId,
        qualifications: staff.qualifications || staff.certifications || [],
      })) as Staff[];

      // 入力サイズ制限（リソース枯渇対策）
      if (staffList.length > MAX_STAFF_COUNT) {
        throw new Error(`staffList cannot exceed ${MAX_STAFF_COUNT} staff members. Current: ${staffList.length}`);
      }

      if (!requirements || !requirements.targetMonth) {
        throw new Error('requirements with targetMonth is required');
      }

      // リクエストボディサイズ制限（DoS対策）
      const bodySize = JSON.stringify(req.body).length;
      if (bodySize > MAX_REQUEST_SIZE_BYTES) {
        res.status(413).json({
          success: false,
          error: `Request too large. Maximum: ${MAX_REQUEST_SIZE_BYTES / 1024}KB, Current: ${Math.round(bodySize / 1024)}KB`,
        });
        return;
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

      // キャッシュ機能削除（フロントエンド側でバージョン履歴管理するため）
      console.log('🚀 AI生成開始（キャッシュなし）');

      // スタッフ数に応じて生成方法を選択
      let scheduleData: { schedule: any[] };
      let tokensUsed = 0;
      let usedModel = 'multi-model';  // BUG-022: マルチモデル戦略

      if (staffList.length <= 5) {
        // 5名以下：従来の一括生成（高速）
        console.log(`📊 小規模シフト生成（${staffList.length}名）: 一括生成モード`);
        console.log(`🇯🇵 AI Config Version: ${AI_CONFIG_VERSION}, Location: ${AI_LOCATION}`);

        // BUG-022: 日本リージョン + gemini-2.5-proのみ使用
        const client = new GoogleGenAI({
          vertexai: true,
          project: projectId,
          location: AI_LOCATION,
        });

        const basePrompt = buildShiftPrompt(staffList, requirements, leaveRequests);

        // BUG-014/022: responseMimeType削除、プロンプトでJSON出力を強制
        const jsonPrompt = `${basePrompt}

# 🔴 絶対厳守: JSON出力形式
以下の形式で**純粋なJSONのみ**を出力してください。説明文は不要です。

\`\`\`json
{
  "schedule": [
    {
      "staffId": "スタッフID",
      "staffName": "スタッフ名",
      "monthlyShifts": [
        { "date": "YYYY-MM-DD", "shiftType": "シフト種別" }
      ]
    }
  ]
}
\`\`\``;

        console.log('📝 プロンプト生成完了');
        console.log('🤖 Vertex AI 呼び出し開始...');

        // BUG-022: マルチモデル戦略 - フォールバック付き
        const primaryConfig = GENERATION_CONFIGS.smallScale.primary;
        const fallbackConfig = GENERATION_CONFIGS.smallScale.fallback;

        let responseText = '';

        // プライマリモデルで試行
        try {
          console.log(`🚀 小規模生成: ${primaryConfig.model} で開始...`);
          const result = await client.models.generateContent({
            model: primaryConfig.model,
            contents: jsonPrompt,
            config: buildGeminiConfig(primaryConfig),
          });

          console.log('📊 Response:', {
            model: primaryConfig.model,
            finishReason: result.candidates?.[0]?.finishReason || 'N/A',
            usageMetadata: result.usageMetadata || {},
          });

          if (isValidResponse(result)) {
            responseText = result.text || '';
            usedModel = primaryConfig.model;
            tokensUsed = result.usageMetadata?.totalTokenCount || 0;
            console.log(`✅ ${primaryConfig.model} で成功`);
          } else {
            throw new Error('Invalid response from primary model');
          }
        } catch (primaryError) {
          console.warn(`⚠️ ${primaryConfig.model} 失敗、フォールバックへ...`, primaryError);

          // フォールバックモデルで試行
          console.log(`🔄 ${fallbackConfig.model} で再試行...`);
          const fallbackResult = await client.models.generateContent({
            model: fallbackConfig.model,
            contents: jsonPrompt,
            config: buildGeminiConfig(fallbackConfig),
          });

          console.log('📊 Fallback Response:', {
            model: fallbackConfig.model,
            finishReason: fallbackResult.candidates?.[0]?.finishReason || 'N/A',
            usageMetadata: fallbackResult.usageMetadata || {},
          });

          // CodeRabbit指摘: フォールバックレスポンスも検証
          if (!isValidResponse(fallbackResult)) {
            throw new Error('Invalid response from fallback model');
          }

          responseText = fallbackResult.text || '';
          usedModel = fallbackConfig.model;
          tokensUsed = fallbackResult.usageMetadata?.totalTokenCount || 0;
          console.log(`✅ ${fallbackConfig.model} (fallback) で成功`);
        }

        scheduleData = parseGeminiJsonResponse(responseText);
        console.log(`✅ 一括生成完了 (使用モデル: ${usedModel})`);

      } else {
        // 6名以上：段階的生成（骨子→詳細バッチ処理）
        console.log(`📊 大規模シフト生成（${staffList.length}名）: 段階的生成モード`);

        // Phase 1: 骨子生成
        const skeleton = await generateSkeleton(
          staffList,
          requirements,
          leaveRequests,
          projectId
        );

        // Phase 2: 詳細生成
        // useSolver=true の場合、CP-SAT Solverを使用（ADR-0004 PoC）
        let detailedSchedules: StaffSchedule[];
        if (useSolver) {
          console.log('🔧 Solver版Phase 2を使用（PoC）');
          detailedSchedules = await generateDetailedShiftsWithSolver(
            staffList,
            skeleton,
            requirements,
            leaveRequests || {},
          );
        } else {
          detailedSchedules = await generateDetailedShifts(
            staffList,
            skeleton,
            requirements,
            projectId
          );
        }

        scheduleData = { schedule: detailedSchedules };
        tokensUsed = 0; // 複数回呼び出しのため集計は省略
        console.log('✅ 段階的生成完了');

        // 戦略A: 後処理リバランス（ai-shift-optimization-strategy.md参照）
        // バッチ処理の独立性によるシフト配分の偏りを修正
        console.log('📊 リバランス処理開始...');
        const rebalanceResult = rebalanceShifts(
          scheduleData.schedule as StaffSchedule[],
          requirements as ShiftRequirement,
          staffList
        );
        scheduleData = { schedule: rebalanceResult.schedules };
        console.log('✅ リバランス完了:', {
          swaps: rebalanceResult.swapsPerformed,
          violationsBefore: rebalanceResult.improvements.before.violations,
          violationsAfter: rebalanceResult.improvements.after.violations,
          scoreBefore: rebalanceResult.improvements.before.score,
          scoreAfter: rebalanceResult.improvements.after.score,
        });
      }

      // Firestore保存はフロントエンド側で実施（バージョン履歴管理のため）
      console.log('✅ AI生成完了（Firestore保存はスキップ）');

      // Phase 40: 評価ロジック実行
      let evaluation: AIEvaluationResult;
      try {
        console.log('📊 評価ロジック実行開始...');
        const evaluationService = new EvaluationService();
        evaluation = evaluationService.evaluateSchedule({
          schedule: scheduleData.schedule as StaffSchedule[],
          staffList: staffList as Staff[],
          requirements: requirements as ShiftRequirement,
          leaveRequests: leaveRequests || {},
        });
        console.log('✅ 評価完了:', {
          overallScore: evaluation.overallScore,
          fulfillmentRate: evaluation.fulfillmentRate,
          violationCount: evaluation.constraintViolations.length,
        });
      } catch (evalError) {
        console.error('⚠️ 評価エラー（フォールバック使用）:', evalError);
        evaluation = createDefaultEvaluation();
      }

      // 成功レスポンス（scheduleデータ + 評価データ）
      res.status(200).json({
        success: true,
        schedule: scheduleData.schedule,
        evaluation: evaluation,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: usedModel,  // BUG-022: マルチモデル戦略で使用されたモデル
          tokensUsed: tokensUsed,
        },
      });

    } catch (error) {
      console.error('❌ Error generating shift:', error);

      // エラーレスポンス（スタックトレースは含めない）
      const errorResponse: any = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };

      // parseError情報があれば含める（デバッグ用）
      if (error && typeof error === 'object' && 'parseError' in error) {
        errorResponse.parseError = (error as any).parseError;
      }

      res.status(500).json(errorResponse);
    }
  }
);

/**
 * Phase 44: timeSlotPreferenceに基づいて動的にスタッフ制約を生成
 *
 * @returns 動的に生成された絶対条件の追加セクション
 */
function buildDynamicTimeSlotConstraints(staffList: Staff[]): string {
  const constraints: string[] = [];

  // 「日勤のみ」スタッフを動的に収集（TimeSlotPreference enumの値は日本語）
  const dayOnlyStaff = staffList.filter(
    s => s.timeSlotPreference === TimeSlotPreference.DayOnly
  );

  // 「夜勤のみ」スタッフを動的に収集
  const nightOnlyStaff = staffList.filter(
    s => s.timeSlotPreference === TimeSlotPreference.NightOnly
  );

  if (dayOnlyStaff.length > 0) {
    const names = dayOnlyStaff.map(s => sanitizeForPrompt(s.name)).join('、');
    constraints.push(
      `## 【時間帯制約】日勤のみスタッフ（${dayOnlyStaff.length}名）\n` +
      `以下のスタッフは**日勤のみ**に配置してください。早番・遅番・夜勤には**絶対に配置しないでください**：\n` +
      `- ${names}\n` +
      `\n⚠️ この制約に違反したシフトは無効です。`
    );
  }

  if (nightOnlyStaff.length > 0) {
    const names = nightOnlyStaff.map(s => sanitizeForPrompt(s.name)).join('、');
    constraints.push(
      `## 【時間帯制約】夜勤のみスタッフ（${nightOnlyStaff.length}名）\n` +
      `以下のスタッフは**夜勤のみ**に配置してください。早番・日勤・遅番には**絶対に配置しないでください**：\n` +
      `- ${names}\n` +
      `\n⚠️ この制約に違反したシフトは無効です。`
    );
  }

  return constraints.length > 0 ? '\n' + constraints.join('\n\n') : '';
}

/**
 * Phase 44: 看護師配置制約を動的に生成
 *
 * @returns 動的に生成された看護師配置セクション
 */
function buildDynamicNurseConstraints(
  staffList: Staff[],
  requirements: ShiftRequirement
): string {
  // 看護師資格を持つスタッフを動的に収集
  const nurses = staffList.filter(staff =>
    (staff.qualifications || []).some(q =>
      String(q).includes('看護師') || String(q).includes('Nurse')
    )
  );

  if (nurses.length === 0) {
    return '';
  }

  // 日勤に看護師配置が必要かチェック
  const dayShiftReq = requirements.requirements?.['日勤'];
  const nurseRequired = dayShiftReq?.requiredQualifications?.some(q =>
    String(q.qualification).includes('看護')
  );

  if (!nurseRequired) {
    return '';
  }

  const nurseNames = nurses.map(s => sanitizeForPrompt(s.name)).join('、');
  const requiredCount = dayShiftReq?.requiredQualifications?.find(q =>
    String(q.qualification).includes('看護')
  )?.count || 1;

  return `
## 【看護師配置制約】
毎日の日勤には、以下の看護師のうち**必ず${requiredCount}名以上**を配置してください：
- ${nurseNames}

⚠️ 看護師が日勤に入っていない日は**資格要件違反**です。
`;
}

/**
 * シフト生成用プロンプトを構築
 */
function buildShiftPrompt(
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest
): string {
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const daysInMonth = requirements.daysToGenerate || new Date(year, month, 0).getDate();

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

  // Phase 44: 動的制約を生成
  const dynamicTimeSlotConstraints = buildDynamicTimeSlotConstraints(staffList);
  const dynamicNurseConstraints = buildDynamicNurseConstraints(staffList, requirements);

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
${dynamicTimeSlotConstraints}${dynamicNurseConstraints}
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
 *
 * @param targetMonth 対象月 (YYYY-MM)
 * @param shiftTypeNames シフト種類名のリスト（例: ['早番', '日勤', '遅番']）
 * NOTE: BUG-013により現在未使用（responseSchemaとthinkingBudgetの非互換性）
 */
function _getShiftSchema(targetMonth: string, shiftTypeNames: string[]) {
  // シフト種類に「休」と「明け休み」を追加（夜勤がある場合のみ明け休み）
  const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));
  const allShiftTypes = [...shiftTypeNames, '休'];
  if (hasNightShift) {
    allShiftTypes.push('明け休み');
  }
  const shiftTypesDescription = allShiftTypes.map(s => `'${s}'`).join(', ');

  // 年月から日付範囲を計算
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dateExample = `${targetMonth}-01 〜 ${targetMonth}-${String(daysInMonth).padStart(2, '0')}`;

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
              description: `そのスタッフの${targetMonth}の1ヶ月分（${daysInMonth}日間）のシフト`,
              items: {
                type: 'object',
                properties: {
                  date: {
                    type: 'string',
                    description: `日付 (${dateExample}の形式、必ず${targetMonth}の日付を使用)`,
                  },
                  shiftType: {
                    type: 'string',
                    description: `シフト区分 (${shiftTypesDescription})`,
                  },
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
void _getShiftSchema;
