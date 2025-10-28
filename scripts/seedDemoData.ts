#!/usr/bin/env tsx

/**
 * デモデータ投入スクリプト
 *
 * Phase 0: デモ環境整備
 * - デモ施設、デモスタッフ、シフト要件、休暇申請を投入
 * - 開発・デモ・テスト用のサンプルデータ
 *
 * 使用方法:
 *   npm run seed:demo                  # 新規投入（既存データがある場合はスキップ）
 *   npm run seed:demo -- --reset       # 既存データを削除して再投入
 *   npm run seed:demo -- --dry-run     # 実行内容を表示のみ（実際には投入しない）
 *   npm run seed:demo -- --force       # 本番環境への投入を許可（公開前のみ使用）
 *   npm run seed:demo -- --yes         # 確認プロンプトをスキップ
 *   npm run seed:demo -- --force --yes # 本番環境に確認なしで投入（非推奨）
 *
 * 安全策:
 *   - 本番環境での実行を防止（--forceで許可可能）
 *   - 冪等性確保（既存データチェック）
 *   - ドライランモード
 *   - バッチ書き込み（トランザクション）
 */

import admin from 'firebase-admin';
import readline from 'readline';

// ==================== 型定義 ====================

interface Staff {
  staffId: string;
  name: string;
  position: string;
  certifications: string[];
  nightShiftOnly: boolean;
  maxConsecutiveDays: number;
  maxWorkDays: number;
  minRestDays: number;
  facilityId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface ShiftRequirement {
  requirementId: string;
  targetMonth: string;
  shiftTypes: ShiftType[];
  facilityId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface ShiftType {
  name: string;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  requiredCertifications: string[];
}

interface LeaveRequest {
  requestId: string;
  staffId: string;
  date: string;
  leaveType: string;
  facilityId: string;
  createdAt: admin.firestore.Timestamp;
}

interface Facility {
  facilityId: string;
  name: string;
  members: FacilityMember[];
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface FacilityMember {
  userId: string;
  role: string;
  grantedAt: admin.firestore.Timestamp;
}

// ==================== 設定 ====================

const DEMO_FACILITY_ID = 'demo-facility-001';
const DEMO_FACILITY_NAME = 'サンプル介護施設';
const TARGET_MONTH = '2025-11';

// ==================== コマンドライン引数 ====================

const args = process.argv.slice(2);
const isReset = args.includes('--reset');
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const isYes = args.includes('--yes') || args.includes('-y');

// ==================== Firebase Admin初期化 ====================

// 環境変数チェック（本番環境での実行防止）
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  console.error('❌ エラー: VITE_FIREBASE_PROJECT_IDまたはFIREBASE_PROJECT_IDが設定されていません');
  console.error('   .envファイルに以下を設定してください:');
  console.error('   VITE_FIREBASE_PROJECT_ID=your-project-id');
  process.exit(1);
}

console.log(`🔧 プロジェクトID: ${projectId}`);

// 本番環境での実行を防止
if (projectId === 'ai-care-shift-scheduler' && !isForce) {
  console.error('');
  console.error('❌❌❌ 本番環境では実行できません！ ❌❌❌');
  console.error('');
  console.error('デモデータの投入は開発環境でのみ実行してください。');
  console.error('本番環境でこのスクリプトを実行すると、実データが破壊される可能性があります。');
  console.error('');
  console.error('💡 公開前のテスト目的で本番環境に投入する場合は --force オプションを使用してください。');
  console.error('   例: npm run seed:demo -- --force');
  console.error('');
  process.exit(1);
}

// 本番環境への強制実行の警告
if (projectId === 'ai-care-shift-scheduler' && isForce) {
  console.warn('');
  console.warn('⚠️  警告: --force オプションが指定されているため、本番環境への投入を続行します');
  console.warn('');
}

// Firebase Admin SDK初期化
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

// ==================== デモデータ定義 ====================

const demoStaffs: Omit<Staff, 'createdAt' | 'updatedAt'>[] = [
  {
    staffId: 'staff-tanaka',
    name: '田中太郎',
    position: '管理者',
    certifications: ['介護福祉士', '管理者研修修了'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    maxWorkDays: 22,
    minRestDays: 8,
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-sato',
    name: '佐藤花子',
    position: '看護師',
    certifications: ['正看護師'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    maxWorkDays: 20,
    minRestDays: 10,
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-suzuki',
    name: '鈴木美咲',
    position: '看護師',
    certifications: ['正看護師'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    maxWorkDays: 20,
    minRestDays: 10,
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-takahashi',
    name: '高橋健太',
    position: '介護士',
    certifications: ['介護職員初任者研修'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    maxWorkDays: 22,
    minRestDays: 8,
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-ito',
    name: '伊藤真理',
    position: '介護士',
    certifications: ['介護福祉士'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    maxWorkDays: 22,
    minRestDays: 8,
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-watanabe',
    name: '渡辺翔太',
    position: '介護士',
    certifications: ['介護職員初任者研修'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    maxWorkDays: 22,
    minRestDays: 8,
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-yamamoto',
    name: '山本さくら',
    position: '介護士',
    certifications: ['介護福祉士'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    maxWorkDays: 22,
    minRestDays: 8,
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-nakamura',
    name: '中村優子',
    position: '介護士',
    certifications: ['介護職員初任者研修'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    maxWorkDays: 20,
    minRestDays: 10,
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-kobayashi',
    name: '小林次郎',
    position: '介護士（夜勤専従）',
    certifications: ['介護福祉士'],
    nightShiftOnly: true,
    maxConsecutiveDays: 5,
    maxWorkDays: 15,
    minRestDays: 15,
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-kato',
    name: '加藤三郎',
    position: '介護士（夜勤専従）',
    certifications: ['介護福祉士'],
    nightShiftOnly: true,
    maxConsecutiveDays: 5,
    maxWorkDays: 15,
    minRestDays: 15,
    facilityId: DEMO_FACILITY_ID,
  },
];

const demoShiftRequirements: Omit<ShiftRequirement, 'createdAt' | 'updatedAt'>[] = [
  {
    requirementId: 'req-demo-2025-11',
    targetMonth: TARGET_MONTH,
    shiftTypes: [
      {
        name: '早番',
        startTime: '07:00',
        endTime: '16:00',
        requiredStaff: 2,
        requiredCertifications: ['介護福祉士'],
      },
      {
        name: '日勤',
        startTime: '09:00',
        endTime: '18:00',
        requiredStaff: 3,
        requiredCertifications: ['正看護師'],
      },
      {
        name: '遅番',
        startTime: '11:00',
        endTime: '20:00',
        requiredStaff: 2,
        requiredCertifications: [],
      },
      {
        name: '夜勤',
        startTime: '17:00',
        endTime: '09:00',
        requiredStaff: 2,
        requiredCertifications: ['介護福祉士'],
      },
    ],
    facilityId: DEMO_FACILITY_ID,
  },
];

const demoLeaveRequests: Omit<LeaveRequest, 'createdAt'>[] = [
  {
    requestId: 'leave-tanaka-20251115',
    staffId: 'staff-tanaka',
    date: '2025-11-15',
    leaveType: '有給休暇',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    requestId: 'leave-sato-20251122',
    staffId: 'staff-sato',
    date: '2025-11-22',
    leaveType: '希望休',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    requestId: 'leave-sato-20251123',
    staffId: 'staff-sato',
    date: '2025-11-23',
    leaveType: '希望休',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    requestId: 'leave-takahashi-20251110',
    staffId: 'staff-takahashi',
    date: '2025-11-10',
    leaveType: '希望休',
    facilityId: DEMO_FACILITY_ID,
  },
];

// ==================== ヘルパー関数 ====================

function promptQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ==================== メイン処理 ====================

async function main() {
  console.log('');
  console.log('========================================');
  console.log('  デモデータ投入スクリプト (Phase 0)');
  console.log('========================================');
  console.log('');

  if (isDryRun) {
    console.log('🔍 ドライランモード: 実際にはデータを投入しません');
    console.log('');
  }

  if (isReset) {
    console.log('⚠️  リセットモード: 既存のデモデータを削除します');
    console.log('');
  }

  // 既存データチェック
  console.log('📋 既存データをチェック中...');
  const facilityDoc = await db.collection('facilities').doc(DEMO_FACILITY_ID).get();
  const facilityExists = facilityDoc.exists;

  if (facilityExists && !isReset) {
    console.log('');
    console.log('✅ デモ施設は既に存在します。');
    console.log('');
    console.log('再投入する場合は、以下のコマンドを実行してください:');
    console.log('  npm run seed:demo -- --reset');
    console.log('');
    process.exit(0);
  }

  if (facilityExists && isReset) {
    console.log('');
    console.log('⚠️  既存のデモデータを削除します:');
    console.log(`   - 施設: ${DEMO_FACILITY_NAME} (${DEMO_FACILITY_ID})`);
    console.log(`   - スタッフ: ${demoStaffs.length}名`);
    console.log(`   - シフト要件: ${demoShiftRequirements.length}件`);
    console.log(`   - 休暇申請: ${demoLeaveRequests.length}件`);
    console.log('');

    if (!isDryRun) {
      const answer = await promptQuestion('本当に削除しますか？ (yes/no): ');
      if (answer.toLowerCase() !== 'yes') {
        console.log('キャンセルしました。');
        process.exit(0);
      }
    }
  }

  // 投入データサマリー
  console.log('');
  console.log('📦 投入するデモデータ:');
  console.log(`   - 施設: ${DEMO_FACILITY_NAME} (${DEMO_FACILITY_ID})`);
  console.log(`   - スタッフ: ${demoStaffs.length}名`);
  console.log(`   - シフト要件: ${demoShiftRequirements.length}件（対象月: ${TARGET_MONTH}）`);
  console.log(`   - 休暇申請: ${demoLeaveRequests.length}件`);
  console.log('');

  if (!isDryRun && !isReset && !isYes) {
    const answer = await promptQuestion('投入してもよろしいですか？ (yes/no): ');
    if (answer.toLowerCase() !== 'yes') {
      console.log('キャンセルしました。');
      process.exit(0);
    }
  }

  if (isDryRun) {
    console.log('');
    console.log('✅ ドライラン完了（実際には投入していません）');
    console.log('');
    process.exit(0);
  }

  // バッチ書き込み開始
  console.log('');
  console.log('🔄 デモデータを投入中...');

  const batch = db.batch();

  // デモ施設の作成/更新
  const now = admin.firestore.Timestamp.now();
  const facilityRef = db.collection('facilities').doc(DEMO_FACILITY_ID);

  // super-adminを取得（初回ユーザー）
  const usersSnapshot = await db.collection('users').limit(1).get();
  let superAdminId = '';

  if (!usersSnapshot.empty) {
    superAdminId = usersSnapshot.docs[0].id;
  }

  const facilityData: Facility = {
    facilityId: DEMO_FACILITY_ID,
    name: DEMO_FACILITY_NAME,
    members: superAdminId ? [{
      userId: superAdminId,
      role: 'super-admin',
      grantedAt: now,
    }] : [],
    createdAt: now,
    updatedAt: now,
  };

  batch.set(facilityRef, facilityData);
  console.log(`  ✓ 施設: ${DEMO_FACILITY_NAME}`);

  // デモスタッフの投入
  for (const staff of demoStaffs) {
    const staffRef = db.collection('facilities').doc(DEMO_FACILITY_ID).collection('staff').doc(staff.staffId);
    const staffData: Staff = {
      ...staff,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(staffRef, staffData);
  }
  console.log(`  ✓ スタッフ: ${demoStaffs.length}名`);

  // デモシフト要件の投入
  for (const req of demoShiftRequirements) {
    const reqRef = db.collection('facilities').doc(DEMO_FACILITY_ID).collection('requirements').doc(req.requirementId);
    const reqData: ShiftRequirement = {
      ...req,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(reqRef, reqData);
  }
  console.log(`  ✓ シフト要件: ${demoShiftRequirements.length}件`);

  // デモ休暇申請の投入
  for (const leave of demoLeaveRequests) {
    const leaveRef = db.collection('facilities').doc(DEMO_FACILITY_ID).collection('leaveRequests').doc(leave.requestId);
    const leaveData: LeaveRequest = {
      ...leave,
      createdAt: now,
    };
    batch.set(leaveRef, leaveData);
  }
  console.log(`  ✓ 休暇申請: ${demoLeaveRequests.length}件`);

  // バッチコミット
  await batch.commit();

  console.log('');
  console.log('✅ デモデータの投入が完了しました！');
  console.log('');
  console.log('📝 次のステップ:');
  console.log('   1. アプリケーションを起動: npm run dev');
  console.log('   2. ブラウザで https://localhost:5173 にアクセス');
  console.log('   3. スタッフ管理ページでデモスタッフを確認');
  console.log('   4. シフト作成ページでAIシフト生成を実行');
  console.log('');
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
