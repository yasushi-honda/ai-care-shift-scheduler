import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import type { StaffSchedule, AIEvaluationResult, EvaluationType } from '../../types';

/**
 * Phase 40/54: AI生成履歴
 *
 * シフト生成とその評価結果を保存する履歴データ
 * Phase 54で evaluationType を追加
 */
export interface AIGenerationHistory {
  id?: string;
  facilityId: string;
  targetMonth: string;
  schedule: StaffSchedule[];
  evaluation: AIEvaluationResult;
  createdBy: string;
  createdAt: Timestamp;
  // Phase 54 追加フィールド
  evaluationType?: EvaluationType;  // 'ai_generated' | 'manual_reevaluate'
  metadata?: {
    model?: string;
    tokensUsed?: number;
    generationDuration?: number;
    reevaluatedFrom?: string;       // 再評価元の履歴ID
  };
}

/**
 * AI生成履歴を保存
 *
 * @param facilityId 施設ID
 * @param targetMonth 対象月（YYYY-MM形式）
 * @param schedule 生成されたスケジュール
 * @param evaluation 評価結果
 * @param userId 作成者ID
 * @param evaluationType 評価タイプ（Phase 54追加）
 * @param metadata オプションのメタデータ
 * @returns 保存された履歴のID
 */
export async function saveEvaluationHistory(
  facilityId: string,
  targetMonth: string,
  schedule: StaffSchedule[],
  evaluation: AIEvaluationResult,
  userId: string,
  evaluationType: EvaluationType = 'ai_generated',
  metadata?: {
    model?: string;
    tokensUsed?: number;
    generationDuration?: number;
    reevaluatedFrom?: string;
  }
): Promise<string> {
  const historyRef = collection(db, 'facilities', facilityId, 'aiGenerationHistory');

  const historyData: Omit<AIGenerationHistory, 'id'> = {
    facilityId,
    targetMonth,
    schedule,
    evaluation,
    createdBy: userId,
    createdAt: serverTimestamp() as Timestamp,
    evaluationType,
    metadata,
  };

  const docRef = await addDoc(historyRef, historyData);
  return docRef.id;
}

/**
 * AI生成履歴を取得
 *
 * @param facilityId 施設ID
 * @param targetMonth 対象月でフィルタ（オプション）
 * @param limitCount 取得件数（デフォルト: 10）
 * @returns 履歴一覧
 */
export async function getEvaluationHistory(
  facilityId: string,
  targetMonth?: string,
  limitCount: number = 10
): Promise<AIGenerationHistory[]> {
  const historyRef = collection(db, 'facilities', facilityId, 'aiGenerationHistory');

  let q;
  if (targetMonth) {
    q = query(
      historyRef,
      where('targetMonth', '==', targetMonth),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );
  } else {
    q = query(
      historyRef,
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<AIGenerationHistory, 'id'>;
    return {
      id: docSnap.id,
      ...data,
    };
  });
}

/**
 * 特定月の最新の評価を取得
 *
 * @param facilityId 施設ID
 * @param targetMonth 対象月
 * @returns 最新の評価履歴、または null
 */
export async function getLatestEvaluationForMonth(
  facilityId: string,
  targetMonth: string
): Promise<AIGenerationHistory | null> {
  const history = await getEvaluationHistory(facilityId, targetMonth, 1);
  return history.length > 0 ? history[0] : null;
}

export const EvaluationHistoryService = {
  saveEvaluationHistory,
  getEvaluationHistory,
  getLatestEvaluationForMonth,
};

export default EvaluationHistoryService;
