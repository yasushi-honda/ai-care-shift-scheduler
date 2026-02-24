/**
 * デモシフトリセット Cloud Function
 *
 * デモ環境で生成済みシフトを月単位でリセットする
 * - 対象: facilities/demo-facility-001/schedules（指定月）
 * - 対象: facilities/demo-facility-001/aiGenerationHistory（指定月）
 * - セキュリティ: デモ施設固定、POSTメソッドのみ
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const DEMO_FACILITY_ID = 'demo-facility-001';

/**
 * デモシフトリセット
 *
 * POST /resetDemoShifts
 * Body: { targetMonth: string }  例: "2026-02"
 *
 * @returns { success: boolean, deletedCount: number }
 */
export const resetDemoShifts = onRequest({
  cors: [
    'https://ai-care-shift-scheduler.web.app',
    'https://ai-care-shift-scheduler.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  timeoutSeconds: 30,
  memory: '256MiB',
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { targetMonth } = req.body as { targetMonth?: string };

  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    res.status(400).json({ error: 'targetMonth は YYYY-MM 形式で指定してください' });
    return;
  }

  try {
    const db = admin.firestore();
    const facilityRef = db.collection('facilities').doc(DEMO_FACILITY_ID);

    // 指定月のシフト（schedules）と評価履歴（aiGenerationHistory）を並行取得
    const [schedulesSnapshot, historySnapshot] = await Promise.all([
      facilityRef.collection('schedules').where('targetMonth', '==', targetMonth).get(),
      facilityRef.collection('aiGenerationHistory').where('targetMonth', '==', targetMonth).get(),
    ]);

    const totalCount = schedulesSnapshot.size + historySnapshot.size;

    if (totalCount === 0) {
      console.log(`✅ resetDemoShifts: ${targetMonth} のデータは存在しません`);
      res.status(200).json({ success: true, deletedCount: 0 });
      return;
    }

    // バッチ削除（schedules + aiGenerationHistory）
    const batch = db.batch();
    schedulesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    historySnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`✅ resetDemoShifts: ${targetMonth} のシフト ${schedulesSnapshot.size} 件・評価履歴 ${historySnapshot.size} 件を削除しました`);
    res.status(200).json({ success: true, deletedCount: schedulesSnapshot.size });
  } catch (error: any) {
    console.error('❌ resetDemoShifts エラー:', error);
    res.status(500).json({
      error: 'シフトのリセットに失敗しました',
      debug: { message: error.message },
    });
  }
});
