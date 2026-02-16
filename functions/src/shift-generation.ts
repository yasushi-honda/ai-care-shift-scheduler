import { onRequest } from 'firebase-functions/v2/https';
import type { Staff, ShiftRequirement, StaffSchedule, EvaluationResult } from './types';
import { generateShiftsWithUnifiedSolver } from './solver-client';
import { EvaluationService, createDefaultEvaluation } from './evaluation/evaluationLogic';

// Firebase Admin初期化は index.ts で実施済み

/**
 * 入力サイズ制限
 */
const MAX_STAFF_COUNT = 200; // スタッフ数上限
const MAX_REQUEST_SIZE_BYTES = 200 * 1024; // リクエストサイズ上限（200KB）

/**
 * シフト自動生成エンドポイント
 *
 * @description
 * CP-SAT Solver（統合Solver）を使用して、
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
    memory: '512MiB', // Solver呼び出しのみのためメモリ削減
    timeoutSeconds: 120, // Solverは最大30秒で完了
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
      const { staffList: rawStaffList, requirements, leaveRequests } = req.body;

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

      // 統合Solver（CP-SAT）で全スタッフ数のシフトを一括生成
      console.log(`📊 統合Solver生成（${staffList.length}名）`);

      const schedules = await generateShiftsWithUnifiedSolver(
        staffList,
        requirements as ShiftRequirement,
        leaveRequests || {},
      );

      const scheduleData = { schedule: schedules };
      console.log('✅ 統合Solver生成完了');

      // 評価ロジック実行
      let evaluation: EvaluationResult;
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
          model: 'cp-sat-unified',
          tokensUsed: 0,
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
