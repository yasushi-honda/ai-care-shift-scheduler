/**
 * デモデータ定義（共有モジュール）
 *
 * 複数のコンテキストで再利用可能なデモデータ定義
 * - scripts/seedDemoData.ts: Firestore投入
 * - e2e/fixtures: E2Eテスト
 * - functions/__tests__: ユニットテスト
 *
 * Phase 0+: デモ環境テスト整備
 */

// ==================== 定数 ====================

export const DEMO_FACILITY_ID = 'demo-facility-001';
export const DEMO_FACILITY_NAME = 'サンプル介護施設';

// ==================== 型定義（Firebase非依存） ====================

/**
 * Staff型（Firestoreスキーマ）
 * - StaffServiceのフィールド名変換に合わせた形式
 * - position, certifications, maxConsecutiveDays, nightShiftOnlyはFirestoreスキーマ名
 */
export interface DemoStaff {
  staffId: string;
  name: string;
  position: string; // Firestore: position → App: role
  certifications: string[]; // Firestore: certifications → App: qualifications
  nightShiftOnly: boolean; // Firestore: nightShiftOnly → App: isNightShiftOnly
  maxConsecutiveDays: number; // Firestore: maxConsecutiveDays → App: maxConsecutiveWorkDays
  // 以下はFirestore/App共通フィールド
  weeklyWorkCount: { hope: number; must: number };
  availableWeekdays: number[]; // 0=日, 1=月, ..., 6=土
  unavailableDates: string[]; // YYYY-MM-DD形式
  timeSlotPreference: string; // '日勤のみ', '夜勤のみ', 'いつでも可'
  facilityId: string;
}

/**
 * ShiftTime型（時間帯定義）
 */
export interface DemoShiftTime {
  name: string;
  start: string; // HH:mm
  end: string; // HH:mm
  restHours: number;
}

/**
 * DailyRequirement型（各シフトの要件）
 */
export interface DemoDailyRequirement {
  totalStaff: number;
  requiredQualifications: { qualification: string; count: number }[];
  requiredRoles: { role: string; count: number }[];
}

/**
 * ShiftRequirement型（シフト要件設定）
 * - RequirementServiceが期待する形式
 */
export interface DemoShiftRequirement {
  targetMonth: string; // YYYY-MM
  timeSlots: DemoShiftTime[];
  requirements: Record<string, DemoDailyRequirement>;
}

/**
 * LeaveRequest型（休暇申請）
 */
export interface DemoLeaveRequest {
  requestId: string;
  staffId: string;
  date: string;
  leaveType: string;
  facilityId: string;
}

// ==================== ヘルパー関数 ====================

/**
 * 対象月を動的に設定（現在月の翌月）
 */
export function getTargetMonth(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ==================== デモデータ定義 ====================

/**
 * デモスタッフデータ（12名: 常勤8名 + パート4名）
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
 * 【常勤職員 8名】
 * - 管理者 1名（兼生活相談員）
 * - 看護職員 2名
 * - 介護職員 4名
 * - 機能訓練指導員 1名
 *
 * 【パート職員 4名】
 * - 介護職員 4名（週2〜3日勤務、早番・遅番の送迎対応）
 *
 * 計算根拠（更新版）:
 * - 必要人日数: 26日 × 5名/日 = 130人日
 * - 可能人日数:
 *   - 常勤8名 × 週4.5回 × 4週 ≒ 144人日
 *   - パート4名 × 週2.5回 × 4週 ≒ 40人日
 *   - 合計: 約184人日
 * - 余裕率: 約41%（十分な余裕）
 *
 * 注意: デイサービスは日中のみ営業のため夜勤なし
 */
export const demoStaffs: DemoStaff[] = [
  {
    staffId: 'staff-tanaka',
    name: '田中太郎',
    position: '管理者',
    certifications: ['介護福祉士', '生活相談員'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土（営業日）
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
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
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
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
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
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
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
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
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
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
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
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
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
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
    unavailableDates: [],
    // Phase 44: 根本原因分析により「いつでも可」に変更
    // 理由: 日勤のみスタッフが多すぎると早番・遅番に配置できるスタッフが不足する
    // 詳細: docs/phase44-root-cause-analysis-2025-12-07.md
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
  // ==================== パート職員（4名）====================
  // デイサービスの実態: パート職員が早番・遅番（送迎）を担当
  // 週2〜3日勤務で常勤職員の不足を補う
  {
    staffId: 'staff-nakamura',
    name: '中村由美',
    position: '介護職員',
    certifications: ['介護職員初任者研修'],
    nightShiftOnly: false,
    maxConsecutiveDays: 3, // パートは連勤制限を緩く
    weeklyWorkCount: { hope: 3, must: 2 }, // 週3日希望
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
    unavailableDates: [],
    timeSlotPreference: 'いつでも可', // 早番・遅番も対応可
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-kobayashi',
    name: '小林誠',
    position: '介護職員',
    certifications: ['介護職員初任者研修'],
    nightShiftOnly: false,
    maxConsecutiveDays: 3,
    weeklyWorkCount: { hope: 3, must: 2 }, // 週3日希望
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-kato',
    name: '加藤明子',
    position: '介護職員',
    certifications: [], // 資格なし（無資格でも介護補助可能）
    nightShiftOnly: false,
    maxConsecutiveDays: 2,
    weeklyWorkCount: { hope: 2, must: 1 }, // 週2日希望
    availableWeekdays: [1, 3, 5], // 月・水・金のみ可
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: DEMO_FACILITY_ID,
  },
  {
    staffId: 'staff-yoshida',
    name: '吉田雅也',
    position: '介護職員',
    certifications: ['普通自動車免許'], // 送迎ドライバー兼任
    nightShiftOnly: false,
    maxConsecutiveDays: 3,
    weeklyWorkCount: { hope: 3, must: 2 }, // 週3日希望
    availableWeekdays: [1, 2, 3, 4, 5, 6], // 月〜土
    unavailableDates: [],
    timeSlotPreference: 'いつでも可', // 送迎のため早番・遅番も可
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
export function getDemoShiftRequirement(targetMonth?: string): DemoShiftRequirement {
  return {
    targetMonth: targetMonth ?? getTargetMonth(),
    timeSlots: [
      { name: '早番', start: '08:00', end: '17:00', restHours: 1 }, // 送迎開始に対応
      { name: '日勤', start: '09:00', end: '18:00', restHours: 1 }, // コア時間帯
      { name: '遅番', start: '10:00', end: '19:00', restHours: 1 }, // 送迎終了まで
    ],
    requirements: {
      早番: {
        totalStaff: 2, // 送迎要員として2名
        requiredQualifications: [], // 資格要件なし
        requiredRoles: [],
      },
      日勤: {
        totalStaff: 2, // 法定基準（看護師1名以上）
        requiredQualifications: [
          { qualification: '看護師', count: 1 }, // 看護師1名以上（法定）
        ],
        requiredRoles: [],
      },
      遅番: {
        totalStaff: 1, // 送迎終了対応
        requiredQualifications: [], // 資格要件なし
        requiredRoles: [],
      },
    },
  };
}

/**
 * 休暇申請データを動的に生成
 * 対象月の日付に合わせて休暇申請を作成
 */
export function generateLeaveRequests(targetMonth?: string): DemoLeaveRequest[] {
  const month = targetMonth ?? getTargetMonth();
  const [year, monthNum] = month.split('-').map(Number);

  // 対象月の10日、15日、22日、23日を使用
  const formatDate = (day: number) =>
    `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return [
    {
      requestId: `leave-tanaka-${year}${String(monthNum).padStart(2, '0')}15`,
      staffId: 'staff-tanaka',
      date: formatDate(15),
      leaveType: '有給休暇',
      facilityId: DEMO_FACILITY_ID,
    },
    {
      requestId: `leave-sato-${year}${String(monthNum).padStart(2, '0')}22`,
      staffId: 'staff-sato',
      date: formatDate(22),
      leaveType: '希望休',
      facilityId: DEMO_FACILITY_ID,
    },
    {
      requestId: `leave-sato-${year}${String(monthNum).padStart(2, '0')}23`,
      staffId: 'staff-sato',
      date: formatDate(23),
      leaveType: '希望休',
      facilityId: DEMO_FACILITY_ID,
    },
    {
      requestId: `leave-takahashi-${year}${String(monthNum).padStart(2, '0')}10`,
      staffId: 'staff-takahashi',
      date: formatDate(10),
      leaveType: '希望休',
      facilityId: DEMO_FACILITY_ID,
    },
  ];
}

/**
 * デモデータ一式を取得
 */
export function getDemoData(targetMonth?: string) {
  const month = targetMonth ?? getTargetMonth();
  return {
    facilityId: DEMO_FACILITY_ID,
    facilityName: DEMO_FACILITY_NAME,
    staffs: demoStaffs,
    shiftRequirement: getDemoShiftRequirement(month),
    leaveRequests: generateLeaveRequests(month),
  };
}

/**
 * 常勤スタッフ（8名）を取得
 */
export function getFullTimeStaffs(): DemoStaff[] {
  return demoStaffs.slice(0, 8);
}

/**
 * パートスタッフ（4名）を取得
 */
export function getPartTimeStaffs(): DemoStaff[] {
  return demoStaffs.slice(8);
}
