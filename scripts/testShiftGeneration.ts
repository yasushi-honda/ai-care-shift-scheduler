/**
 * シフト生成テストスクリプト
 *
 * Cloud Functionに直接リクエストを送信し、
 * データ形式と生成結果を確認します。
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEMO_FACILITY_ID = 'demo-facility-001';
const CLOUD_FUNCTION_URL = 'https://asia-northeast1-ai-care-shift-scheduler.cloudfunctions.net/generateShift';

async function testShiftGeneration() {
  console.log('🧪 シフト生成テスト開始...\n');

  // Firebase Admin SDK初期化
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'ai-care-shift-scheduler';
  try {
    initializeApp({ projectId });
  } catch (e) {
    // Already initialized
  }

  const db = getFirestore();

  // 1. Firestoreからデータを取得
  console.log('📋 1. Firestoreからデータ取得\n');

  // スタッフ
  const staffSnapshot = await db.collection(`facilities/${DEMO_FACILITY_ID}/staff`).get();
  const staffList = staffSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,  // Firestore document ID
      name: data.name,
      role: data.position || data.role,  // position -> role
      qualifications: data.certifications || data.qualifications || [],  // certifications -> qualifications
      weeklyWorkCount: data.weeklyWorkCount || { hope: 5, must: 4 },
      maxConsecutiveWorkDays: data.maxConsecutiveDays || data.maxConsecutiveWorkDays || 5,
      availableWeekdays: data.availableWeekdays || [0, 1, 2, 3, 4, 5, 6],
      unavailableDates: data.unavailableDates || [],
      timeSlotPreference: data.timeSlotPreference || 'いつでも可',
      isNightShiftOnly: data.nightShiftOnly || data.isNightShiftOnly || false,
    };
  });

  console.log(`   スタッフ数: ${staffList.length}名`);
  staffList.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name} (id: ${s.id})`);
    console.log(`      - 役職: ${s.role}`);
    console.log(`      - 資格: ${s.qualifications.join(', ') || 'なし'}`);
    console.log(`      - 週勤務: 希望${s.weeklyWorkCount.hope}日、必須${s.weeklyWorkCount.must}日`);
    console.log(`      - 勤務可能曜日: ${s.availableWeekdays.join(',')}`);
    console.log(`      - 夜勤専従: ${s.isNightShiftOnly}`);
  });

  // シフト要件
  const reqSnapshot = await db.collection(`facilities/${DEMO_FACILITY_ID}/requirements`).get();
  if (reqSnapshot.empty) {
    console.error('\n❌ シフト要件が見つかりません');
    process.exit(1);
  }

  const reqDoc = reqSnapshot.docs[0];
  const reqData = reqDoc.data();

  const requirements = {
    targetMonth: reqData.targetMonth,
    timeSlots: reqData.timeSlots || [],
    requirements: reqData.requirements || {},
  };

  console.log(`\n   対象月: ${requirements.targetMonth}`);
  console.log(`   シフト種類: ${requirements.timeSlots.length}種類`);
  requirements.timeSlots.forEach((slot: any) => {
    console.log(`     - ${slot.name}: ${slot.start}〜${slot.end}`);
  });

  console.log('\n   各シフトの要件:');
  Object.entries(requirements.requirements).forEach(([name, req]: [string, any]) => {
    console.log(`     ${name}: ${req.totalStaff}名`);
    if (req.requiredQualifications?.length > 0) {
      req.requiredQualifications.forEach((q: any) => {
        console.log(`       - ${q.qualification}: ${q.count}名必須`);
      });
    }
  });

  // 休暇申請
  const leaveSnapshot = await db.collection(`facilities/${DEMO_FACILITY_ID}/leaveRequests`).get();
  const leaveRequests: Record<string, Record<string, string>> = {};

  leaveSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const staffId = data.staffId;
    const date = data.date;
    const leaveType = data.leaveType;

    if (!leaveRequests[staffId]) {
      leaveRequests[staffId] = {};
    }
    leaveRequests[staffId][date] = leaveType;
  });

  console.log(`\n   休暇申請: ${leaveSnapshot.size}件`);
  Object.entries(leaveRequests).forEach(([staffId, dates]) => {
    const staff = staffList.find(s => s.id === staffId);
    console.log(`     ${staff?.name || staffId}:`);
    Object.entries(dates).forEach(([date, type]) => {
      console.log(`       - ${date}: ${type}`);
    });
  });

  // 2. リクエストデータを構築
  console.log('\n📦 2. リクエストデータ構築');

  const requestBody = {
    staffList,
    requirements,
    leaveRequests,
  };

  console.log('\n   リクエストボディ:');
  console.log(JSON.stringify(requestBody, null, 2).substring(0, 2000) + '...');

  // 3. Cloud Functionにリクエスト
  console.log('\n🚀 3. Cloud Functionにリクエスト送信...');
  console.log(`   URL: ${CLOUD_FUNCTION_URL}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000);

  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`   ステータス: ${response.status} ${response.statusText}`);

    const result = await response.json();

    if (!result.success) {
      console.error('\n❌ エラー:', result.error);
      if (result.parseError) {
        console.error('   Parse Error:', result.parseError);
      }
      process.exit(1);
    }

    // 4. 結果を分析
    console.log('\n✅ 4. 結果分析');

    console.log(`\n   生成されたスケジュール: ${result.schedule?.length || 0}名分`);

    if (result.schedule && result.schedule.length > 0) {
      // 最初のスタッフのスケジュールを表示
      const firstSchedule = result.schedule[0];
      console.log(`\n   サンプル（${firstSchedule.staffName}）:`);
      console.log(`     staffId: ${firstSchedule.staffId}`);
      console.log(`     最初の5日間のシフト:`);
      firstSchedule.monthlyShifts.slice(0, 5).forEach((shift: any) => {
        console.log(`       ${shift.date}: ${shift.shiftType}`);
      });

      // 各日のシフト割当数をカウント
      const dailyAssignments: Record<string, Record<string, number>> = {};

      for (const schedule of result.schedule) {
        for (const shift of schedule.monthlyShifts) {
          const date = shift.date;
          const type = shift.shiftType;

          if (!dailyAssignments[date]) {
            dailyAssignments[date] = {};
          }
          if (type && type !== '休' && type !== '明け休み') {
            dailyAssignments[date][type] = (dailyAssignments[date][type] || 0) + 1;
          }
        }
      }

      // 最初の7日間の割当状況
      console.log('\n   最初の7日間の割当状況:');
      const dates = Object.keys(dailyAssignments).sort().slice(0, 7);
      for (const date of dates) {
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][new Date(date).getDay()];
        console.log(`     ${date}(${dayOfWeek}):`);
        Object.entries(dailyAssignments[date] || {}).forEach(([type, count]) => {
          const required = requirements.requirements[type]?.totalStaff || 0;
          const status = count >= required ? '✅' : '❌';
          console.log(`       ${type}: ${count}名 (必要: ${required}名) ${status}`);
        });
      }
    }

    // 評価結果
    if (result.evaluation) {
      console.log('\n   AI評価結果:');
      console.log(`     総合スコア: ${result.evaluation.overallScore}点`);
      console.log(`     充足率: ${result.evaluation.fulfillmentRate}%`);
      console.log(`     違反数: ${result.evaluation.constraintViolations?.length || 0}件`);

      if (result.evaluation.constraintViolations?.length > 0) {
        console.log('\n   最初の5件の違反:');
        result.evaluation.constraintViolations.slice(0, 5).forEach((v: any, i: number) => {
          console.log(`     ${i + 1}. [${v.severity}] ${v.description}`);
        });
      }

      if (result.evaluation.aiComment) {
        console.log(`\n   AIコメント: ${result.evaluation.aiComment}`);
      }
    }

  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      console.error('\n❌ タイムアウト（3分）');
    } else {
      console.error('\n❌ エラー:', error.message);
    }
    process.exit(1);
  }

  console.log('\n✅ テスト完了');
}

testShiftGeneration().catch(console.error);
