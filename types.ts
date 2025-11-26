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

  // 予定シフト（必須）
  plannedShiftType: string; // '早番', '日勤', '遅番', '夜勤', '休', '明け休み'
  plannedStartTime?: string; // HH:mm（例: "08:30"）
  plannedEndTime?: string; // HH:mm（例: "17:30"）

  // 実績シフト（任意）
  actualShiftType?: string; // 実績のシフトタイプ
  actualStartTime?: string; // HH:mm
  actualEndTime?: string; // HH:mm
  breakMinutes?: number; // 休憩時間（分）

  // 備考
  notes?: string; // 特記事項（欠勤理由、変更理由など）

  // 後方互換性のための旧フィールド（非推奨）
  /** @deprecated Use plannedShiftType instead */
  shiftType?: string;
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

// ==================== 認証・データ永続化関連の型定義 ====================

// Result型パターン（型安全なエラーハンドリング）
export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };

// Result型のヘルパー関数（型推論を助けるため）
export function assertResultError<T, E>(
  result: Result<T, E>
): asserts result is { success: false; error: E } {
  if (result.success) {
    throw new Error('Expected result to be an error, but got success');
  }
}

export function assertResultSuccess<T, E>(
  result: Result<T, E>
): asserts result is { success: true; data: T } {
  if (!result.success) {
    throw new Error('Expected result to be success, but got error');
  }
}

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

// ==================== 監査ログ（Phase 13）====================

// 監査ログアクション
export enum AuditLogAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  GRANT_ROLE = 'GRANT_ROLE',
  REVOKE_ROLE = 'REVOKE_ROLE',
  EXPORT = 'EXPORT', // Phase 19.3.1: データエクスポート操作
}

// 監査ログエントリ（Firestore /auditLogs/{logId}）
export interface AuditLog {
  id: string;
  userId: string; // 操作したユーザーのUID
  facilityId: string | null; // 対象施設ID（グローバル操作の場合はnull）
  action: AuditLogAction; // 操作種別
  resourceType: string; // 対象リソース（'staff', 'schedule', 'user', 'facility'など）
  resourceId: string | null; // 対象リソースのID
  details: Record<string, unknown>; // 操作内容の詳細（変更前後の値など）
  deviceInfo: {
    ipAddress: string | null; // IPアドレス
    userAgent: string | null; // ユーザーエージェント
  };
  result: 'success' | 'failure'; // 操作結果
  errorMessage?: string; // 失敗時のエラーメッセージ
  timestamp: Timestamp; // 操作日時
}

// 監査ログサービスエラー型
export type AuditLogError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string };

// ==================== セキュリティアラート（Phase 13.3）====================

// セキュリティアラート種別
export enum SecurityAlertType {
  BULK_EXPORT = 'BULK_EXPORT', // 大量データエクスポート
  UNUSUAL_TIME_ACCESS = 'UNUSUAL_TIME_ACCESS', // 通常外時間帯アクセス
  MULTIPLE_AUTH_FAILURES = 'MULTIPLE_AUTH_FAILURES', // 複数回認証失敗
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT', // 権限なしアクセス試行
  STORAGE_THRESHOLD_EXCEEDED = 'STORAGE_THRESHOLD_EXCEEDED', // ストレージ容量閾値超過
}

// アラート重要度
export enum SecurityAlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// アラートステータス
export enum SecurityAlertStatus {
  NEW = 'NEW', // 新規
  ACKNOWLEDGED = 'ACKNOWLEDGED', // 確認済み
  INVESTIGATING = 'INVESTIGATING', // 調査中
  RESOLVED = 'RESOLVED', // 解決済み
  FALSE_POSITIVE = 'FALSE_POSITIVE', // 誤検知
}

// セキュリティアラート（Firestore /securityAlerts/{alertId}）
export interface SecurityAlert {
  id: string;
  type: SecurityAlertType; // アラート種別
  severity: SecurityAlertSeverity; // 重要度
  status: SecurityAlertStatus; // ステータス
  userId: string | null; // 対象ユーザーID（該当する場合）
  facilityId: string | null; // 対象施設ID（該当する場合）
  title: string; // アラートタイトル
  description: string; // アラート詳細
  metadata: Record<string, unknown>; // 追加情報（検出条件、カウントなど）
  detectedAt: Timestamp; // 検出日時
  acknowledgedBy: string | null; // 確認したユーザーのUID
  acknowledgedAt: Timestamp | null; // 確認日時
  resolvedBy: string | null; // 解決したユーザーのUID
  resolvedAt: Timestamp | null; // 解決日時
  notes: string | null; // 管理者メモ
}

// セキュリティアラートサービスエラー型
export type SecurityAlertError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string };


// ==================== シフトタイプ設定（Phase 38）====================

// シフト表示色
export interface ShiftColor {
  background: string; // Tailwind CSS color class (e.g., 'bg-sky-100')
  text: string; // Tailwind CSS color class (e.g., 'text-sky-700')
}

// シフトタイプ設定
export interface ShiftTypeConfig {
  id: string; // UUID (e.g., 'early', 'day', 'late', 'night', 'off', 'postnight')
  name: string; // 表示名 (e.g., '早番', '日勤')
  start: string; // 開始時間 HH:mm (e.g., '07:00')
  end: string; // 終了時間 HH:mm (e.g., '16:00')
  restHours: number; // 休憩時間（時間単位）
  color: ShiftColor; // 表示色
  isActive: boolean; // 有効/無効フラグ
  sortOrder: number; // 表示順序
}

// 施設シフト設定（Firestore /facilities/{facilityId}/shiftSettings/default）
export interface FacilityShiftSettings {
  facilityId: string;
  shiftTypes: ShiftTypeConfig[];
  defaultShiftCycle: string[]; // シフトサイクル順序（シフトタイプIDの配列）
  updatedAt: Timestamp;
  updatedBy: string; // 更新者のUID
}

// シフトタイプ設定サービスエラー型
export type ShiftTypeSettingsError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string };
