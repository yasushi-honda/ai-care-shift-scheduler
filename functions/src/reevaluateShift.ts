/**
 * Phase 54: reevaluateShift Cloud Function
 *
 * 手動編集後のシフトをAIで再評価し、履歴として保存する
 */
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { EvaluationService, EvaluationInput } from './evaluation/evaluationLogic';
import type {
  Staff,
  StaffSchedule,
  ShiftRequirement,
  LeaveRequest,
  EvaluationResult,
} from './types';

// CORS設定
const CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ai-care-shift-scheduler.web.app',
  'https://ai-care-shift-scheduler.firebaseapp.com',
];

/**
 * リクエスト型
 */
interface ReevaluateShiftRequest {
  facilityId: string;
  targetMonth: string;
  staffSchedules: StaffSchedule[];
  staffList: Staff[];
  requirements?: ShiftRequirement;
  leaveRequests?: LeaveRequest;
}

/**
 * レスポンス型
 */
interface ReevaluateShiftResponse {
  success: boolean;
  evaluation?: EvaluationResult;
  historyId?: string;
  error?: string;
}

/**
 * reevaluateShift Cloud Function
 *
 * 手動編集後のシフトを評価し、履歴として保存
 */
export const reevaluateShift = onRequest(
  {
    region: 'asia-northeast1',
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: CORS_ORIGINS,
  },
  async (req, res) => {
    console.log('📊 [reevaluateShift] リクエスト受信');

    // OPTIONSリクエスト（CORS preflight）
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // POSTのみ許可
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method Not Allowed' });
      return;
    }

    try {
      const body = req.body as ReevaluateShiftRequest;

      // 必須パラメータの検証
      if (!body.facilityId || !body.targetMonth || !body.staffSchedules || !body.staffList) {
        console.error('❌ [reevaluateShift] パラメータ不足:', {
          hasFacilityId: !!body.facilityId,
          hasTargetMonth: !!body.targetMonth,
          hasStaffSchedules: !!body.staffSchedules,
          hasStaffList: !!body.staffList,
        });
        res.status(400).json({
          success: false,
          error: '必須パラメータが不足しています (facilityId, targetMonth, staffSchedules, staffList)',
        });
        return;
      }

      console.log('📊 [reevaluateShift] パラメータ検証OK:', {
        facilityId: body.facilityId,
        targetMonth: body.targetMonth,
        staffCount: body.staffList.length,
        scheduleCount: body.staffSchedules.length,
      });

      // Firestoreから要件設定を取得（指定がない場合）
      let requirements = body.requirements;
      if (!requirements) {
        const db = admin.firestore();
        const reqDoc = await db
          .collection('facilities')
          .doc(body.facilityId)
          .collection('requirements')
          .doc(body.targetMonth)
          .get();

        if (reqDoc.exists) {
          requirements = reqDoc.data() as ShiftRequirement;
          console.log('📊 [reevaluateShift] Firestoreから要件設定を取得');
        } else {
          // デフォルト要件を生成
          requirements = createDefaultRequirements(body.targetMonth);
          console.log('📊 [reevaluateShift] デフォルト要件を使用');
        }
      }

      // Firestoreから休暇希望を取得（指定がない場合）
      let leaveRequests = body.leaveRequests || {};
      if (!body.leaveRequests) {
        const db = admin.firestore();
        const leaveSnapshot = await db
          .collection('facilities')
          .doc(body.facilityId)
          .collection('leaveRequests')
          .where('date', '>=', `${body.targetMonth}-01`)
          .where('date', '<=', `${body.targetMonth}-31`)
          .get();

        leaveRequests = {};
        for (const doc of leaveSnapshot.docs) {
          const data = doc.data();
          if (!leaveRequests[data.staffId]) {
            leaveRequests[data.staffId] = {};
          }
          leaveRequests[data.staffId][data.date] = data.leaveType;
        }
        console.log('📊 [reevaluateShift] Firestoreから休暇希望を取得:', {
          count: leaveSnapshot.docs.length,
        });
      }

      // 評価実行
      const evaluationService = new EvaluationService();
      const evaluationInput: EvaluationInput = {
        schedule: body.staffSchedules,
        staffList: body.staffList,
        requirements,
        leaveRequests,
      };

      const startTime = Date.now();
      const evaluation = evaluationService.evaluateSchedule(evaluationInput);
      const processingTime = Date.now() - startTime;

      console.log('📊 [reevaluateShift] 評価完了:', {
        overallScore: evaluation.overallScore,
        fulfillmentRate: evaluation.fulfillmentRate,
        violationCount: evaluation.constraintViolations.length,
        processingTimeMs: processingTime,
      });

      // 履歴として保存
      const db = admin.firestore();
      const historyRef = db
        .collection('facilities')
        .doc(body.facilityId)
        .collection('aiGenerationHistory');

      const historyData = {
        facilityId: body.facilityId,
        targetMonth: body.targetMonth,
        schedule: body.staffSchedules,
        evaluation,
        createdBy: 'manual_reevaluate', // システム識別子
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        evaluationType: 'manual_reevaluate' as const,
        metadata: {
          processingTimeMs: processingTime,
        },
      };

      const docRef = await historyRef.add(historyData);
      console.log('📊 [reevaluateShift] 履歴保存完了:', { historyId: docRef.id });

      const response: ReevaluateShiftResponse = {
        success: true,
        evaluation,
        historyId: docRef.id,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('❌ [reevaluateShift] エラー:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '不明なエラーが発生しました',
      });
    }
  }
);

/**
 * デフォルトの要件設定を生成
 */
export function createDefaultRequirements(targetMonth: string): ShiftRequirement {
  return {
    targetMonth,
    timeSlots: [
      { name: '早番', start: '07:00', end: '16:00', restHours: 1 },
      { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
      { name: '遅番', start: '11:00', end: '20:00', restHours: 1 },
    ],
    requirements: {
      '早番': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
      '日勤': { totalStaff: 3, requiredQualifications: [], requiredRoles: [] },
      '遅番': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
    },
  };
}
