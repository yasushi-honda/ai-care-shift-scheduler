import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ projectId: 'ai-care-shift-scheduler' });
const db = getFirestore(app);

async function checkLatestShift() {
  // 最新のシフトを取得
  const shiftsSnap = await db
    .collection('facilities')
    .doc('demo-facility-001')
    .collection('shifts')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (shiftsSnap.empty) {
    console.log('シフトが見つかりません');
    return;
  }

  const shift = shiftsSnap.docs[0].data();
  console.log('=== 最新シフト評価結果 ===');
  console.log('対象月:', shift.targetMonth);
  console.log('作成日時:', shift.createdAt?.toDate?.() || shift.createdAt);

  if (shift.evaluation) {
    console.log('\n--- 評価サマリー ---');
    console.log('総合スコア:', shift.evaluation.overallScore);
    console.log('充足率:', shift.evaluation.fulfillmentRate);
    console.log('制約違反数:', shift.evaluation.constraintViolations?.length || 0);

    if (shift.evaluation.constraintViolations?.length > 0) {
      console.log('\n--- 制約違反詳細 ---');
      shift.evaluation.constraintViolations.slice(0, 10).forEach((v: any, i: number) => {
        console.log(`${i+1}. [Level ${v.level}] ${v.type}: ${v.message}`);
      });
      if (shift.evaluation.constraintViolations.length > 10) {
        console.log(`... 他 ${shift.evaluation.constraintViolations.length - 10} 件`);
      }
    }

    if (shift.evaluation.levelBreakdown) {
      console.log('\n--- レベル別内訳 ---');
      Object.entries(shift.evaluation.levelBreakdown).forEach(([level, data]: [string, any]) => {
        console.log(`Level ${level}: 違反${data.count}件, 減点${data.penalty}点`);
      });
    }
  }

  // スタッフ配置数を確認
  const assignments = shift.assignments || {};
  const staffIds = new Set<string>();
  Object.values(assignments).forEach((dayAssignments: any) => {
    if (Array.isArray(dayAssignments)) {
      dayAssignments.forEach((a: any) => staffIds.add(a.staffId));
    }
  });

  console.log('\n--- 配置サマリー ---');
  console.log('配置スタッフ数:', staffIds.size);
  console.log('配置日数:', Object.keys(assignments).length);

  process.exit(0);
}

checkLatestShift().catch(e => {
  console.error(e);
  process.exit(1);
});
