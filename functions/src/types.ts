/**
 * 型定義ファイル
 * フロントエンド（/types.ts）の型定義と一致させる
 */

export enum Role {
  Admin = '管理者',
  CareWorker = '介護職員',
  Nurse = '看護職員',
  CareManager = 'ケアマネージャー',
  Operator = 'オペレーター',
}

export enum Qualification {
  CertifiedCareWorker = '介護福祉士',
  RegisteredNurse = '看護師',
  LicensedPracticalNurse = '准看護師',
  DriversLicense = '普通自動車免許',
}

export enum TimeSlotPreference {
  DayOnly = '日勤のみ',
  NightOnly = '夜勤のみ',
  Any = 'いつでも可',
}

export enum LeaveType {
  Hope = '希望休',
  PaidLeave = '有給休暇',
  Training = '研修',
}

export interface LeaveRequest {
  [staffId: string]: {
    [date: string]: LeaveType;
  };
}

export interface Staff {
  id: string;
  name: string;
  role: Role;
  qualifications: Qualification[];
  weeklyWorkCount: { hope: number; must: number };
  maxConsecutiveWorkDays: number;
  availableWeekdays: number[];
  unavailableDates: string[];
  timeSlotPreference: TimeSlotPreference;
  isNightShiftOnly: boolean;
}

export interface ShiftTime {
  name: string;
  start: string;
  end: string;
  restHours: number;
}

export interface DailyRequirement {
  totalStaff: number;
  requiredQualifications: { qualification: Qualification; count: number }[];
  requiredRoles: { role: Role; count: number }[];
}

export interface ShiftRequirement {
  targetMonth: string;
  timeSlots: ShiftTime[];
  requirements: Record<string, DailyRequirement>;
  daysToGenerate?: number; // テスト用：生成する日数を制限（未指定の場合は月全体）
  startDay?: number; // 生成開始日（1-31、未指定の場合は1日から）
  endDay?: number; // 生成終了日（1-31、未指定の場合は月末まで）
}

export interface GeneratedShift {
  date: string;
  shiftType: string;
}

export interface StaffSchedule {
  staffId: string;
  staffName: string;
  monthlyShifts: GeneratedShift[];
}

/**
 * Phase 1: 骨子スケジュール（軽量版）
 * 全スタッフの休日・夜勤パターンのみを決定
 */
export interface StaffScheduleSkeleton {
  staffId: string;
  staffName: string;
  restDays: number[];  // 休日の日付リスト（1-31）
  nightShiftDays: number[];  // 夜勤の日付リスト（1-31）
  nightShiftFollowupDays: number[];  // 夜勤明け・公休の日付リスト（1-31）
}

export interface ScheduleSkeleton {
  staffSchedules: StaffScheduleSkeleton[];
}
