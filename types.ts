import { Timestamp } from 'firebase/firestore';

export enum Role {
  Admin = "管理者",
  CareWorker = "介護職員",
  Nurse = "看護職員",
  CareManager = "ケアマネージャー",
  Operator = "オペレーター",
}

export enum Qualification {
  CertifiedCareWorker = "介護福祉士",
  RegisteredNurse = "看護師",
  LicensedPracticalNurse = "准看護師",
  DriversLicense = "普通自動車免許",
}

export enum TimeSlotPreference {
  DayOnly = "日勤のみ",
  NightOnly = "夜勤のみ",
  Any = "いつでも可",
}

export enum LeaveType {
  Hope = "希望休",
  PaidLeave = "有給休暇",
  Training = "研修",
}

export interface LeaveRequest {
  [staffId: string]: {
    [date: string]: LeaveType;
  };
}

// Firestoreドキュメント用の休暇申請型
// Firestoreパス: /facilities/{facilityId}/leaveRequests/{requestId}
export interface LeaveRequestDocument {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  leaveType: LeaveType;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Staff {
  id: string;
  name: string;
  role: Role;
  qualifications: Qualification[];
  weeklyWorkCount: { hope: number; must: number };
  maxConsecutiveWorkDays: number;
  availableWeekdays: number[]; // 0 for Sun, 1 for Mon...
  unavailableDates: string[]; // YYYY-MM-DD
  timeSlotPreference: TimeSlotPreference;
  isNightShiftOnly: boolean;
  createdAt?: Timestamp; // Firestore永続化時に使用
  updatedAt?: Timestamp; // Firestore永続化時に使用
}

export interface ShiftTime {
  name: string;
  start: string; // HH:mm
  end: string; // HH:mm
  restHours: number;
}

export interface DailyRequirement {
  totalStaff: number;
  requiredQualifications: { qualification: Qualification; count: number }[];
  requiredRoles: { role: Role; count: number }[];
}

export interface ShiftRequirement {
  targetMonth: string; // YYYY-MM
  timeSlots: ShiftTime[];
  // Key is shift name, value is requirement for that shift
  requirements: Record<string, DailyRequirement>;
}

export interface GeneratedShift {
  date: string; // YYYY-MM-DD
  shiftType: string; // e.g., '早番', '日勤', '夜勤', or '休'
}

export interface StaffSchedule {
  staffId: string;
  staffName: string;
  monthlyShifts: GeneratedShift[];
}

export interface Schedule {
  id: string;
  targetMonth: string;     // 'YYYY-MM'
  staffSchedules: StaffSchedule[];
  createdAt: Timestamp;
  createdBy: string;       // UID
  updatedAt: Timestamp;
  updatedBy: string;       // UID
  version: number;         // 1から開始
  status: 'draft' | 'confirmed' | 'archived';
}

export interface ScheduleVersion {
  id: string;
  versionNumber: number;
  targetMonth: string;
  staffSchedules: StaffSchedule[];
  createdAt: Timestamp;
  createdBy: string;
  changeDescription: string;
  previousVersion: number;
}

export interface WorkLogDetails {
  workDetails: string;
  notes: string;
}

export interface WorkLogs {
  [date: string]: { // YYYY-MM-DD
    [staffId: string]: WorkLogDetails;
  };
}

// ==================== 認証・データ永続化関連の型定義 ====================

// Result型パターン（型安全なエラーハンドリング）
export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

// 認証エラー型
export type AuthError =
  | { code: 'AUTH_FAILED'; message: string }
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'USER_NOT_FOUND'; message: string }
  | { code: 'NETWORK_ERROR'; message: string }
  | { code: 'UNKNOWN_ERROR'; message: string };

// スタッフサービスエラー型
export type StaffError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string };

// シフトサービスエラー型
export type ScheduleError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'CONFLICT'; message: string; currentVersion: number }
  | { code: 'FIRESTORE_ERROR'; message: string };

// 休暇申請サービスエラー型
export type LeaveRequestError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string };

// 要件設定サービスエラー型
export type RequirementError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string };

// ロール（RBAC）
export enum FacilityRole {
  SuperAdmin = 'super-admin',
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
}

// 施設アクセス権限
export interface FacilityAccess {
  facilityId: string;
  role: FacilityRole;
  grantedAt: Timestamp;
  grantedBy: string; // UID
}

// ユーザー情報（Firestore users コレクション）
export interface User {
  userId: string; // Firebase Auth UID
  email: string;
  name: string;
  photoURL: string;
  provider: 'google';
  facilities: FacilityAccess[]; // アクセス可能な施設リスト
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

// 施設情報（Firestore facilities コレクション）
export interface Facility {
  facilityId: string;
  name: string;
  createdAt: Timestamp;
  createdBy: string; // super-admin UID
  members: FacilityMember[]; // 非正規化（パフォーマンス最適化）
}

// 施設メンバー（非正規化）
export interface FacilityMember {
  userId: string;
  email: string;
  name: string;
  role: FacilityRole;
}

// 招待ステータス
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

// 招待情報（Firestore /facilities/{facilityId}/invitations/{invitationId}）
export interface Invitation {
  id: string;
  email: string; // 招待先メールアドレス
  role: 'editor' | 'viewer'; // 付与する権限（admin権限で招待可能なのはeditorとviewerのみ）
  token: string; // ランダムトークン（UUID）
  status: InvitationStatus;
  createdBy: string; // 招待したユーザーのUID
  createdAt: Timestamp;
  expiresAt: Timestamp; // 有効期限（7日間）
}
