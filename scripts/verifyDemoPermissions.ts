#!/usr/bin/env tsx

/**
 * デモユーザー権限検証スクリプト
 *
 * BUG-009対策: デモユーザーの権限がusers.facilitiesとfacilities.membersの両方で一致しているか検証
 *
 * 使用方法:
 *   npx tsx scripts/verifyDemoPermissions.ts
 *
 * 検証項目:
 *   1. users/{demo-user-fixed-uid}.facilities[].role
 *   2. facilities/{demo-facility-001}.members[].role
 *   3. 両者が一致しているか（Single Source of Truth問題の検出）
 */

import admin from 'firebase-admin';

// ==================== 設定 ====================

const DEMO_USER_UID = 'demo-user-fixed-uid';
const DEMO_FACILITY_ID = 'demo-facility-001';

// ==================== Firebase Admin初期化 ====================

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'ai-care-shift-scheduler';

console.log(`🔧 プロジェクトID: ${projectId}`);

try {
  admin.initializeApp({
    projectId: projectId,
  });
  console.log('✅ Firebase Admin SDK initialized');
} catch (error: any) {
  console.error('❌ Firebase Admin SDK initialization failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// ==================== メイン処理 ====================

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  デモユーザー権限検証スクリプト (BUG-009)');
  console.log('========================================');
  console.log('');

  let hasError = false;

  // 1. users/{demo-user-fixed-uid}を取得
  console.log('📋 1. users コレクションのデモユーザー権限を確認...');
  const userDoc = await db.collection('users').doc(DEMO_USER_UID).get();

  if (!userDoc.exists) {
    console.error('   ❌ デモユーザーが見つかりません: users/' + DEMO_USER_UID);
    hasError = true;
  } else {
    const userData = userDoc.data();
    console.log(`   ✓ ユーザーが存在します: ${userData?.email}`);

    const facilities = userData?.facilities || [];
    console.log(`   施設数: ${facilities.length}`);

    const demoFacility = facilities.find((f: any) => f.facilityId === DEMO_FACILITY_ID);
    if (!demoFacility) {
      console.error(`   ❌ デモ施設へのアクセス権限がありません: ${DEMO_FACILITY_ID}`);
      hasError = true;
    } else {
      console.log(`   ✓ デモ施設へのアクセス権限: ${demoFacility.role}`);

      if (demoFacility.role !== 'editor') {
        console.error(`   ❌ 期待される権限: editor, 実際: ${demoFacility.role}`);
        hasError = true;
      } else {
        console.log(`   ✅ 権限OK: editor`);
      }
    }
  }

  // 2. facilities/{demo-facility-001}を取得
  console.log('');
  console.log('📋 2. facilities コレクションのメンバー権限を確認...');
  const facilityDoc = await db.collection('facilities').doc(DEMO_FACILITY_ID).get();

  if (!facilityDoc.exists) {
    console.error('   ❌ デモ施設が見つかりません: facilities/' + DEMO_FACILITY_ID);
    hasError = true;
  } else {
    const facilityData = facilityDoc.data();
    console.log(`   ✓ 施設が存在します: ${facilityData?.name}`);

    const members = facilityData?.members || [];
    console.log(`   メンバー数: ${members.length}`);

    const demoMember = members.find((m: any) => m.userId === DEMO_USER_UID);
    if (!demoMember) {
      console.error(`   ❌ デモユーザーがメンバーに含まれていません: ${DEMO_USER_UID}`);
      hasError = true;
    } else {
      console.log(`   ✓ デモユーザーがメンバーに含まれています: ${demoMember.userId}`);

      if (demoMember.role !== 'editor') {
        console.error(`   ❌ 期待される権限: editor, 実際: ${demoMember.role}`);
        hasError = true;
      } else {
        console.log(`   ✅ 権限OK: editor`);
      }
    }
  }

  // 3. データ整合性チェック（二重管理問題の検出）
  console.log('');
  console.log('🔍 3. データ整合性チェック（二重管理問題の検出）');

  if (!userDoc.exists || !facilityDoc.exists) {
    console.error('   ❌ ドキュメントが存在しないため整合性チェックをスキップします');
    hasError = true;
  } else {
    const userData = userDoc.data();
    const facilityData = facilityDoc.data();

    const userFacilities = userData?.facilities || [];
    const facilityMembers = facilityData?.members || [];

    const userRole = userFacilities.find((f: any) => f.facilityId === DEMO_FACILITY_ID)?.role;
    const memberRole = facilityMembers.find((m: any) => m.userId === DEMO_USER_UID)?.role;

    console.log(`   users.facilities[].role:      ${userRole || '(なし)'}`);
    console.log(`   facilities.members[].role:    ${memberRole || '(なし)'}`);

    if (!userRole || !memberRole) {
      console.error('   ❌ どちらかの権限が存在しません');
      hasError = true;
    } else if (userRole !== memberRole) {
      console.error(`   ❌ 権限が一致しません！データ不整合が発生しています`);
      console.error(`      users側:      ${userRole}`);
      console.error(`      facilities側: ${memberRole}`);
      hasError = true;
    } else {
      console.log(`   ✅ 両方の権限が一致しています: ${userRole}`);
    }
  }

  // 4. Firestoreセキュリティルールの参照先を確認
  console.log('');
  console.log('📝 4. Firestoreセキュリティルールの参照先');
  console.log('   firestore.rules (L14-34):');
  console.log('   function hasRole(facilityId, requiredRole) {');
  console.log('     let userProfile = getUserProfile();  // users/{uid}を取得');
  console.log('     let facilities = userProfile.facilities;  // users.facilitiesを参照');
  console.log('     ...');
  console.log('   }');
  console.log('');
  console.log('   ⚠️  セキュリティルールは users.facilities を参照しています');
  console.log('   ⚠️  facilities.members は非正規化データであり、権限判定には使われません');

  // 5. 結果サマリー
  console.log('');
  console.log('========================================');
  console.log('  検証結果サマリー');
  console.log('========================================');
  console.log('');

  if (hasError) {
    console.error('❌ エラーが検出されました！');
    console.error('');
    console.error('対処方法:');
    console.error('  1. npm run seed:demo -- --reset を実行してデモデータを再投入');
    console.error('  2. または、Firebaseコンソールで手動修正:');
    console.error('     - users/demo-user-fixed-uid.facilities[].role を editor に変更');
    console.error('     - facilities/demo-facility-001.members[].role を editor に変更');
    console.error('');
    process.exit(1);
  } else {
    console.log('✅ すべての検証に合格しました！');
    console.log('');
    console.log('デモユーザーは以下の環境で正しく動作します:');
    console.log('  - デモログイン');
    console.log('  - AI自動シフト生成');
    console.log('  - シフト保存・更新');
    console.log('  - 月次レポート表示');
    console.log('');
  }
}

// ==================== エントリーポイント ====================

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ エラーが発生しました:', error);
    console.error('');
    process.exit(1);
  });
