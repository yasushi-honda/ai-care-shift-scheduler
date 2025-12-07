/**
 * デモデータ検証スクリプト
 *
 * Firestoreに投入されたデモデータが正しいかを検証します。
 *
 * 期待値:
 * - スタッフ: 8名（夜勤専従なし）
 * - シフト種類: 3種類（早番・日勤・遅番）
 * - 夜勤シフト: 存在しない
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEMO_FACILITY_ID = 'demo-facility-001';

async function verifyDemoData() {
  console.log('🔍 デモデータ検証開始...\n');

  // Firebase Admin SDK初期化
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'ai-care-shift-scheduler';

  try {
    initializeApp({
      projectId,
    });
  } catch (e) {
    // Already initialized
  }

  const db = getFirestore();

  // 1. 施設の確認
  console.log('📋 1. 施設データの確認');
  const facilityDoc = await db.collection('facilities').doc(DEMO_FACILITY_ID).get();

  if (!facilityDoc.exists) {
    console.error('❌ 施設が見つかりません: ', DEMO_FACILITY_ID);
    process.exit(1);
  }

  const facility = facilityDoc.data();
  console.log(`   ✓ 施設名: ${facility?.name}`);
  console.log(`   ✓ 施設ID: ${DEMO_FACILITY_ID}\n`);

  // 2. スタッフの確認
  console.log('👥 2. スタッフデータの確認');
  const staffSnapshot = await db.collection(`facilities/${DEMO_FACILITY_ID}/staff`).get();

  const staffCount = staffSnapshot.size;
  console.log(`   スタッフ数: ${staffCount}名`);

  if (staffCount !== 8) {
    console.error(`   ❌ 期待値: 8名, 実際: ${staffCount}名`);
  } else {
    console.log(`   ✓ 期待通り8名`);
  }

  let nightShiftOnlyCount = 0;
  const staffList: string[] = [];

  staffSnapshot.forEach(doc => {
    const data = doc.data();
    staffList.push(`${data.name} (${data.position})`);
    if (data.nightShiftOnly === true) {
      nightShiftOnlyCount++;
    }
  });

  console.log('\n   スタッフ一覧:');
  staffList.forEach((s, i) => console.log(`     ${i + 1}. ${s}`));

  if (nightShiftOnlyCount > 0) {
    console.error(`\n   ❌ 夜勤専従スタッフが${nightShiftOnlyCount}名います（デイサービスには不要）`);
  } else {
    console.log('\n   ✓ 夜勤専従スタッフ: 0名（デイサービス仕様OK）');
  }

  // 3. シフト要件の確認
  console.log('\n📅 3. シフト要件の確認');
  // シフト要件は /requirements/default に保存される
  const requirementsSnapshot = await db
    .collection(`facilities/${DEMO_FACILITY_ID}/requirements`)
    .get();

  if (requirementsSnapshot.empty) {
    console.error('   ❌ シフト要件が見つかりません');
    process.exit(1);
  }

  const reqDoc = requirementsSnapshot.docs[0];
  const reqData = reqDoc.data();

  console.log(`   対象月: ${reqData.targetMonth}`);

  const timeSlots = reqData.timeSlots || [];
  console.log(`   シフト種類数: ${timeSlots.length}種類`);

  if (timeSlots.length !== 3) {
    console.error(`   ❌ 期待値: 3種類, 実際: ${timeSlots.length}種類`);
  } else {
    console.log(`   ✓ 期待通り3種類`);
  }

  console.log('\n   シフト一覧:');
  let hasNightShift = false;
  timeSlots.forEach((slot: any, i: number) => {
    console.log(`     ${i + 1}. ${slot.name} (${slot.start}-${slot.end})`);
    if (slot.name === '夜勤' || slot.name.includes('夜')) {
      hasNightShift = true;
    }
  });

  if (hasNightShift) {
    console.error('\n   ❌ 夜勤シフトが存在します（デイサービスには不要）');
  } else {
    console.log('\n   ✓ 夜勤シフト: なし（デイサービス仕様OK）');
  }

  // 4. 要件詳細の確認
  console.log('\n📊 4. 各シフトの必要人員');
  const requirements = reqData.requirements || {};

  Object.entries(requirements).forEach(([shiftName, req]: [string, any]) => {
    console.log(`   ${shiftName}: ${req.totalStaff}名`);
    if (req.requiredQualifications?.length > 0) {
      req.requiredQualifications.forEach((q: any) => {
        console.log(`     - ${q.qualification}: ${q.count}名必須`);
      });
    }
  });

  // 5. 休暇申請の確認
  console.log('\n🏖️ 5. 休暇申請の確認');
  const leaveSnapshot = await db
    .collection(`facilities/${DEMO_FACILITY_ID}/leaveRequests`)
    .get();

  console.log(`   休暇申請数: ${leaveSnapshot.size}件`);

  // 総合判定
  console.log('\n' + '='.repeat(50));
  console.log('📋 検証結果サマリー');
  console.log('='.repeat(50));

  const errors: string[] = [];

  if (staffCount !== 8) errors.push(`スタッフ数: ${staffCount}名 (期待: 8名)`);
  if (nightShiftOnlyCount > 0) errors.push(`夜勤専従: ${nightShiftOnlyCount}名 (期待: 0名)`);
  if (timeSlots.length !== 3) errors.push(`シフト種類: ${timeSlots.length}種類 (期待: 3種類)`);
  if (hasNightShift) errors.push('夜勤シフトが存在 (期待: なし)');

  if (errors.length === 0) {
    console.log('\n✅ すべての検証に合格しました！');
    console.log('\nデモデータはデイサービス仕様として正しく投入されています。');
    console.log('AIシフト生成のテストを実行できます。\n');
  } else {
    console.error('\n❌ 以下の問題があります:');
    errors.forEach(e => console.error(`   - ${e}`));
    console.log('\nscripts/seedDemoData.ts を確認し、再度シードを実行してください。\n');
    process.exit(1);
  }
}

verifyDemoData().catch(console.error);
