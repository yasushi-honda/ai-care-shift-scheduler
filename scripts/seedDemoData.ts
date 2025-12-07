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

/**
 * Staff型（Firestoreスキーマ）
 * - StaffServiceのフィールド名変換に合わせた形式
 * - position, certifications, maxConsecutiveDays, nightShiftOnlyはFirestoreスキーマ名
 */
interface Staff {
  staffId: string;
  name: string;
  position: string;  // Firestore: position → App: role
  certifications: string[];  // Firestore: certifications → App: qualifications
  nightShiftOnly: boolean;  // Firestore: nightShiftOnly → App: isNightShiftOnly
  maxConsecutiveDays: number;  // Firestore: maxConsecutiveDays → App: maxConsecutiveWorkDays
  // 以下はFirestore/App共通フィールド
  weeklyWorkCount: { hope: number; must: number };
  availableWeekdays: number[];  // 0=日, 1=月, ..., 6=土
  unavailableDates: string[];  // YYYY-MM-DD形式
  timeSlotPreference: string;  // '日勤のみ', '夜勤のみ', 'いつでも可'
  facilityId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * ShiftTime型（時間帯定義）
 */
interface ShiftTime {
  name: string;
  start: string;  // HH:mm
  end: string;    // HH:mm
  restHours: number;
}

/**
 * DailyRequirement型（各シフトの要件）
 */
interface DailyRequirement {
  totalStaff: number;
  requiredQualifications: { qualification: string; count: number }[];
  requiredRoles: { role: string; count: number }[];
}

/**
 * ShiftRequirement型（シフト要件設定）
 * - RequirementServiceが期待する形式
 * - Firestoreパス: /facilities/{facilityId}/requirements/default
 */
interface ShiftRequirement {
  targetMonth: string;  // YYYY-MM
  timeSlots: ShiftTime[];
  requirements: Record<string, DailyRequirement>;
  updatedAt: admin.firestore.Timestamp;
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

// 対象月を動的に設定（現在月の翌月）
function getTargetMonth(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

const TARGET_MONTH = getTargetMonth();

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

/**
 * デモスタッフデータ（8名）
 *
 * デイサービス（通所介護）の実態に即した人員構成
 * 参考: 厚生労働省 通所介護の人員配置基準
 *
 * AI生成に必要な全フィールドを含む:
 * - weeklyWorkCount: 週の勤務回数（希望・必須）
 * - availableWeekdays: 勤務可能曜日（0=日〜6=土）
 * - unavailableDates: 勤務不可日
 * - timeSlotPreference: 時間帯希望
 *
 * 人員構成（定員20名のデイサービス基準）:
 * - 管理者 1名（兼生活相談員）
 * - 看護職員 2名
 * - 介護職員 4名
 * - 機能訓練指導員 1名
 *
 * 注意: デイサービスは日中のみ営業のため夜勤なし
 */
const demoStaffs: Omit<Staff, 'createdAt' | 'updatedAt'>[] = [
  {
    staffId: 'staff-tanaka',
    name: '田中太郎',
    position: '管理者',
    certifications: ['介護福祉士', '生活相談員'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],  // 月〜土（営業日）
    unavailableDates: [],
    timeSlotPreference: '日勤のみ',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-sato',
    name: '佐藤花子',
    position: '看護職員',
    certifications: ['看護師'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],  // 月〜土
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-suzuki',
    name: '鈴木美咲',
    position: '看護職員',
    certifications: ['看護師'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 4, must: 3 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],  // 月〜土
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-takahashi',
    name: '高橋健太',
    position: '介護職員',
    certifications: ['介護福祉士'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],  // 月〜土
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-ito',
    name: '伊藤真理',
    position: '介護職員',
    certifications: ['介護福祉士'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],  // 月〜土
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-watanabe',
    name: '渡辺翔太',
    position: '介護職員',
    certifications: ['介護職員初任者研修'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],  // 月〜土
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-yamamoto',
    name: '山本さくら',
    position: '介護職員',
    certifications: ['介護職員初任者研修'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 4, must: 3 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],  // 月〜土
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-kondo',
    name: '近藤理恵',
    position: '機能訓練指導員',
    certifications: ['理学療法士'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],  // 月〜土
    unavailableDates: [],
    // Phase 44: 根本原因分析により「いつでも可」に変更
    // 理由: 日勤のみスタッフが多すぎると早番・遅番に配置できるスタッフが不足する
    // 詳細: docs/phase44-root-cause-analysis-2025-12-07.md
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
];

/**
 * デモシフト要件（デイサービス版）
 *
 * RequirementService形式（timeSlots + requirements Record）に準拠
 * Firestoreパス: /facilities/{facilityId}/requirements/default
 *
 * デイサービス（通所介護）の実態に即したシフト設定:
 * - 営業時間: 8:30〜18:00（送迎含む）
 * - 営業日: 月〜土（日曜休み）
 * - 夜勤なし（日中のみ営業）
 *
 * 人員配置（定員20名の基準準拠）:
 * - 早番: 2名（送迎開始時間に合わせて出勤）
 * - 日勤: 2名（看護師1名以上 - 法定基準）
 * - 遅番: 1名（送迎終了まで対応）
 *
 * 計算根拠:
 * - 必要人日数: 26日（月〜土）× 5名/日 = 130人日
 * - 可能人日数: 8名 × 週4.5回平均 × 4週 ≒ 144人日
 * - 余裕率: 約11%
 *
 * 参考:
 * - 通所介護の人員配置基準（厚生労働省）
 * - https://shiftlife.jp/ds-kijun/
 * - https://ads.kaipoke.biz/day-service/opening/post-93.html
 */
const demoShiftRequirement: Omit<ShiftRequirement, 'updatedAt'> = {
  targetMonth: TARGET_MONTH,
  timeSlots: [
    { name: '早番', start: '08:00', end: '17:00', restHours: 1 },  // 送迎開始に対応
    { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },  // コア時間帯
    { name: '遅番', start: '10:00', end: '19:00', restHours: 1 },  // 送迎終了まで
  ],
  requirements: {
    '早番': {
      totalStaff: 2,  // 送迎要員として2名
      requiredQualifications: [],  // 資格要件なし
      requiredRoles: [],
    },
    '日勤': {
      totalStaff: 2,  // 法定基準（看護師1名以上）
      requiredQualifications: [
        { qualification: '看護師', count: 1 },  // 看護師1名以上（法定）
      ],
      requiredRoles: [],
    },
    '遅番': {
      totalStaff: 1,  // 送迎終了対応
      requiredQualifications: [],  // 資格要件なし
      requiredRoles: [],
    },
  },
};

/**
 * 休暇申請データを動的に生成
 * 対象月の日付に合わせて休暇申請を作成
 */
function generateLeaveRequests(): Omit<LeaveRequest, 'createdAt'>[] {
  const [year, month] = TARGET_MONTH.split('-').map(Number);

  // 対象月の10日、15日、22日、23日を使用
  const formatDate = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return [
    {
      requestId: `leave-tanaka-${year}${String(month).padStart(2, '0')}15`,
      staffId: 'staff-tanaka',
      date: formatDate(15),
      leaveType: '有給休暇',
      facilityId: DEMO_FACILITY_ID,
    },
    {
      requestId: `leave-sato-${year}${String(month).padStart(2, '0')}22`,
      staffId: 'staff-sato',
      date: formatDate(22),
      leaveType: '希望休',
      facilityId: DEMO_FACILITY_ID,
    },
    {
      requestId: `leave-sato-${year}${String(month).padStart(2, '0')}23`,
      staffId: 'staff-sato',
      date: formatDate(23),
      leaveType: '希望休',
      facilityId: DEMO_FACILITY_ID,
    },
    {
      requestId: `leave-takahashi-${year}${String(month).padStart(2, '0')}10`,
      staffId: 'staff-takahashi',
      date: formatDate(10),
      leaveType: '希望休',
      facilityId: DEMO_FACILITY_ID,
    },
  ];
}

const demoLeaveRequests = generateLeaveRequests();

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
    console.log(`   - シフト要件: 1件`);
    console.log(`   - 休暇申請: ${demoLeaveRequests.length}件`);
    console.log('');

    if (!isDryRun && !isYes) {
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
  console.log(`   - シフト要件: 1件（対象月: ${TARGET_MONTH}）`);
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

  // リセットモード: 既存データを削除
  if (isReset && facilityExists) {
    console.log('');
    console.log('🗑️ 既存データを削除中...');

    // スタッフを削除
    const staffSnapshot = await db.collection(`facilities/${DEMO_FACILITY_ID}/staff`).get();
    for (const doc of staffSnapshot.docs) {
      await doc.ref.delete();
    }
    console.log(`  ✓ スタッフ: ${staffSnapshot.size}件削除`);

    // シフト要件を削除
    const reqSnapshot = await db.collection(`facilities/${DEMO_FACILITY_ID}/requirements`).get();
    for (const doc of reqSnapshot.docs) {
      await doc.ref.delete();
    }
    console.log(`  ✓ シフト要件: ${reqSnapshot.size}件削除`);

    // シフト要件（旧パス shiftRequirements）も削除
    const oldReqSnapshot = await db.collection(`facilities/${DEMO_FACILITY_ID}/shiftRequirements`).get();
    for (const doc of oldReqSnapshot.docs) {
      await doc.ref.delete();
    }
    if (oldReqSnapshot.size > 0) {
      console.log(`  ✓ シフト要件(旧): ${oldReqSnapshot.size}件削除`);
    }

    // 休暇申請を削除
    const leaveSnapshot = await db.collection(`facilities/${DEMO_FACILITY_ID}/leaveRequests`).get();
    for (const doc of leaveSnapshot.docs) {
      await doc.ref.delete();
    }
    console.log(`  ✓ 休暇申請: ${leaveSnapshot.size}件削除`);

    console.log('');
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

  // デモシフト要件の投入（RequirementService形式: /requirements/default）
  const reqRef = db.collection('facilities').doc(DEMO_FACILITY_ID).collection('requirements').doc('default');
  const reqData: ShiftRequirement = {
    ...demoShiftRequirement,
    updatedAt: now,
  };
  batch.set(reqRef, reqData);
  console.log(`  ✓ シフト要件: 1件（対象月: ${TARGET_MONTH}）`);

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
