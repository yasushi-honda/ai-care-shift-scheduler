
import { Role, Qualification, TimeSlotPreference, ShiftTime, LeaveType, ShiftColor, ShiftTypeConfig, EmploymentType, CareServiceType, StaffingRequirementEntry } from './types';

export const ROLES: Role[] = [
  Role.Admin,
  Role.CareWorker,
  Role.Nurse,
  Role.CareManager,
  Role.Operator,
  Role.FunctionalTrainer,
];

export const QUALIFICATIONS: Qualification[] = [
  Qualification.CertifiedCareWorker,
  Qualification.RegisteredNurse,
  Qualification.LicensedPracticalNurse,
  Qualification.DriversLicense,
  Qualification.PhysicalTherapist,
  Qualification.SocialWorker,
  Qualification.HomeCareSupportWorker,
];

export const TIME_SLOT_PREFERENCES: TimeSlotPreference[] = [
  TimeSlotPreference.DayOnly,
  TimeSlotPreference.NightOnly,
  TimeSlotPreference.Any,
];

export const LEAVE_TYPES: LeaveType[] = [
  LeaveType.Hope,
  LeaveType.PaidLeave,
  LeaveType.Training,
];

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const DEFAULT_TIME_SLOTS: ShiftTime[] = [
  { name: "早番", start: "07:00", end: "16:00", restHours: 1 },
  { name: "日勤", start: "09:00", end: "18:00", restHours: 1 },
  { name: "遅番", start: "11:00", end: "20:00", restHours: 1 },
  { name: "夜勤", start: "16:00", end: "09:00", restHours: 2 },
];

// ==================== シフトタイプ設定（Phase 38）====================

// シフト表示色プリセット
export const SHIFT_COLOR_PRESETS: Record<string, ShiftColor> = {
  sky: { background: 'bg-sky-100', text: 'text-sky-700' },
  emerald: { background: 'bg-emerald-100', text: 'text-emerald-700' },
  amber: { background: 'bg-amber-100', text: 'text-amber-700' },
  indigo: { background: 'bg-indigo-100', text: 'text-indigo-700' },
  slate: { background: 'bg-slate-100', text: 'text-slate-700' },
  rose: { background: 'bg-rose-100', text: 'text-rose-700' },
  violet: { background: 'bg-violet-100', text: 'text-violet-700' },
  cyan: { background: 'bg-cyan-100', text: 'text-cyan-700' },
  lime: { background: 'bg-lime-100', text: 'text-lime-700' },
  orange: { background: 'bg-orange-100', text: 'text-orange-700' },
};

// デフォルトシフトタイプ設定
export const DEFAULT_SHIFT_TYPES: ShiftTypeConfig[] = [
  {
    id: 'early',
    name: '早番',
    start: '07:00',
    end: '16:00',
    restHours: 1,
    color: SHIFT_COLOR_PRESETS.sky,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'day',
    name: '日勤',
    start: '09:00',
    end: '18:00',
    restHours: 1,
    color: SHIFT_COLOR_PRESETS.emerald,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'late',
    name: '遅番',
    start: '11:00',
    end: '20:00',
    restHours: 1,
    color: SHIFT_COLOR_PRESETS.amber,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'night',
    name: '夜勤',
    start: '16:00',
    end: '09:00',
    restHours: 2,
    color: SHIFT_COLOR_PRESETS.indigo,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'off',
    name: '休',
    start: '',
    end: '',
    restHours: 0,
    color: SHIFT_COLOR_PRESETS.slate,
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'postnight',
    name: '明け休み',
    start: '',
    end: '',
    restHours: 0,
    color: SHIFT_COLOR_PRESETS.rose,
    isActive: true,
    sortOrder: 6,
  },
];

// デフォルトシフトサイクル（ダブルクリック時のサイクル順序）
export const DEFAULT_SHIFT_CYCLE: string[] = ['early', 'day', 'late', 'night', 'off', 'postnight'];

// ==================== 勤務形態区分（Phase 25）====================

// 勤務形態区分ラベルマップ（標準様式第1号）
export const EMPLOYMENT_TYPES: Record<EmploymentType, string> = {
  A: '常勤専従',
  B: '常勤兼務',
  C: '非常勤専従',
  D: '非常勤兼務',
};

// 常勤の週所定労働時間デフォルト値（時間）
export const DEFAULT_STANDARD_WEEKLY_HOURS = 40;

// 介護サービス種類一覧（厚生労働省告示・標準様式第1号ヘッダー用）
export const CARE_SERVICE_TYPES: CareServiceType[] = [
  '訪問介護',
  '訪問入浴介護',
  '訪問看護',
  '通所介護',
  '通所リハビリテーション',
  '短期入所生活介護',
  '特定施設入居者生活介護',
  '介護老人福祉施設',
  '介護老人保健施設',
  '認知症対応型共同生活介護',
  'その他',
];

// ==================== 休暇残高管理（Phase 39）====================

// デフォルト休暇設定
export const DEFAULT_LEAVE_SETTINGS = {
  publicHoliday: {
    monthlyAllocation: 9,  // 月9日
    maxCarryOver: -1,      // 無制限
  },
  paidLeave: {
    carryOverYears: 2,     // 2年繰越
  },
};

// ==================== 人員配置基準（Phase 65）====================

/**
 * サービス種別ごとのデフォルト配置基準マスタ
 * 根拠: 指定居宅サービス等の事業の人員・設備及び運営に関する基準
 */
export const DEFAULT_STAFFING_STANDARDS: Record<CareServiceType, StaffingRequirementEntry[]> = {
  '訪問介護': [
    {
      role: Role.CareWorker,
      requiredFte: 2.5,
      calculationMethod: 'fixed',
      notes: '常勤換算2.5人以上（介護職員）',
    },
    {
      role: Role.Operator,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 40,
      notes: 'サービス提供責任者: 利用者40人に1名以上',
    },
  ],
  '訪問入浴介護': [
    {
      role: Role.CareWorker,
      requiredFte: 1,
      calculationMethod: 'fixed',
      notes: '介護職員 常勤換算1人以上',
    },
  ],
  '訪問看護': [
    {
      role: Role.Nurse,
      requiredFte: 2.5,
      calculationMethod: 'fixed',
      notes: '看護職員 常勤換算2.5人以上',
    },
  ],
  '通所介護': [
    {
      role: Role.CareWorker,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 5,
      notes: '介護職員: 利用者÷5 + 1名以上',
    },
    {
      role: Role.Nurse,
      requiredFte: 1,
      calculationMethod: 'fixed',
      notes: '看護職員 1名以上',
    },
    {
      role: Role.Operator,
      requiredFte: 1,
      calculationMethod: 'fixed',
      notes: '生活相談員 1名以上（資格要件あり）',
    },
    {
      role: Role.FunctionalTrainer,
      requiredFte: 1,
      calculationMethod: 'fixed',
      notes: '機能訓練指導員 1名以上',
    },
  ],
  '通所リハビリテーション': [
    {
      role: Role.CareWorker,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 5,
      notes: '介護職員: 利用者÷5以上',
    },
    {
      role: Role.FunctionalTrainer,
      requiredFte: 1,
      calculationMethod: 'fixed',
      notes: '理学療法士等 1名以上',
    },
  ],
  '短期入所生活介護': [
    {
      role: Role.CareWorker,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 3,
      notes: '介護・看護合計: 利用者3:1以上',
    },
    {
      role: Role.Nurse,
      requiredFte: 1,
      calculationMethod: 'fixed',
      notes: '看護職員 1名以上',
    },
  ],
  '特定施設入居者生活介護': [
    {
      role: Role.CareWorker,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 3,
      notes: '介護・看護合計: 入居者3:1以上',
    },
  ],
  '介護老人福祉施設': [
    {
      role: Role.CareWorker,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 3,
      notes: '介護・看護合計: 入所者3:1以上（常勤換算）',
    },
    {
      role: Role.Nurse,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 30,
      notes: 'うち看護職員: 入所者30:1以上（最低1名）',
    },
  ],
  '介護老人保健施設': [
    {
      role: Role.Nurse,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 6,
      notes: '看護職員: 入所者6:1以上',
    },
    {
      role: Role.CareWorker,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 5,
      notes: '介護職員: 入所者5:1以上',
    },
  ],
  '認知症対応型共同生活介護': [
    {
      role: Role.CareWorker,
      requiredFte: 0,
      calculationMethod: 'ratio',
      ratioNumerator: 3,
      notes: '介護・看護: 入居者3:1以上',
    },
  ],
  'その他': [
    {
      role: Role.CareWorker,
      requiredFte: 1,
      calculationMethod: 'fixed',
      notes: '（各サービス基準を参照して設定してください）',
    },
  ],
};
