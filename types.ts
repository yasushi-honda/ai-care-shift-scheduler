import { Timestamp } from 'firebase/firestore';

export enum Role {
  Admin = "管理者",
  CareWorker = "介護職員",
  Nurse = "看護職員",
  CareManager = "ケアマネージャー",
  Operator = "オペレーター",
  FunctionalTrainer = "機能訓練指導員",
}

export enum Qualification {
  CertifiedCareWorker = "介護福祉士",
  RegisteredNurse = "看護師",
  LicensedPracticalNurse = "准看護師",
  DriversLicense = "普通自動車免許",
  PhysicalTherapist = "理学療法士",
  SocialWorker = "生活相談員",
  HomeCareSupportWorker = "介護職員初任者研修",
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


// ==================== 休暇残高管理（Phase 39）====================

// 公休残高
export interface PublicHolidayBalance {
  allocated: number;      // 月間付与数
  used: number;           // 当月使用数
  carriedOver: number;    // 前月繰越数
  balance: number;        // 残高 = allocated + carriedOver - used
}

// 有給残高
export interface PaidLeaveBalance {
  annualAllocated: number;  // 年間付与数
  used: number;             // 使用累計
  carriedOver: number;      // 前年繰越数
  balance: number;          // 残高 = annualAllocated + carriedOver - used
  expiresAt: Timestamp;     // 有効期限
}

// 残高調整履歴
export interface LeaveAdjustment {
  type: 'publicHoliday' | 'paidLeave';
  amount: number;           // 正=追加、負=減算
  reason: string;
  adjustedBy: string;
  adjustedAt: Timestamp;
}

// スタッフ休暇残高（Firestore /facilities/{facilityId}/leaveBalances/{yearMonth}_{staffId}）
export interface StaffLeaveBalance {
  id: string;                      // {yearMonth}_{staffId}
  staffId: string;
  yearMonth: string;               // YYYY-MM形式
  publicHoliday: PublicHolidayBalance;
  paidLeave: PaidLeaveBalance;
  adjustments: LeaveAdjustment[];  // 調整履歴
  updatedAt: Timestamp;
  updatedBy: string;
}

// 施設休暇設定（Firestore /facilities/{facilityId}/leaveSettings/default）
export interface FacilityLeaveSettings {
  facilityId: string;
  publicHoliday: {
    monthlyAllocation: number;  // 月間付与日数（デフォルト: 9）
    maxCarryOver: number;       // 繰越上限（-1: 無制限）
  };
  paidLeave: {
    carryOverYears: number;     // 繰越年数（デフォルト: 2）
  };
  updatedAt: Timestamp;
  updatedBy: string;
}

// 休暇残高サービスエラー型
export type LeaveBalanceError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string };


// ==================== AI評価・フィードバック（Phase 40）====================

/**
 * 制約違反タイプ
 */
export type ConstraintViolationType =
  | 'staffShortage'        // 人員不足
  | 'consecutiveWork'      // 連勤超過
  | 'nightRestViolation'   // 夜勤後休息不足
  | 'qualificationMissing' // 資格要件未充足
  | 'leaveRequestIgnored'; // 休暇希望未反映

/**
 * 制約レベル（4段階）
 * Phase 53: 制約レベル別評価システム
 * - 1: 絶対必須（労基法違反 → シフト無効）
 * - 2: 運営必須（人員・資格基準 → 重大減点）
 * - 3: 努力目標（希望休・連勤 → 軽微減点）
 * - 4: 推奨（相性考慮 → 減点なし・情報）
 */
export type ConstraintLevel = 1 | 2 | 3 | 4;

/**
 * 制約違反
 */
export interface ConstraintViolation {
  type: ConstraintViolationType;
  severity: 'error' | 'warning';  // 後方互換性のため維持
  level?: ConstraintLevel;        // Phase 53: 制約レベル（1-4）、未設定時はtypeから推定
  description: string;
  affectedStaff?: string[];   // スタッフID
  affectedDates?: string[];   // YYYY-MM-DD
  suggestion?: string;        // 簡易改善提案
}

/**
 * 改善提案
 */
export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;           // 'staffing', 'workload', 'fairness'
  description: string;
  action: string;             // 具体的なアクション
}

/**
 * シミュレーション結果
 */
export interface SimulationResult {
  estimatedOvertimeHours: number;   // 予想残業時間（月間合計）
  workloadBalance: 'good' | 'fair' | 'poor';  // 負荷バランス
  paidLeaveUsageRate: number;       // 有給消化率予測 (0-100)
  risks: string[];                  // リスク要因
}

// ============================================
// Solver警告 型定義
// ============================================

/**
 * Solver事前検証警告: 制約スキップの検知結果
 */
export interface SolverWarning {
  date: string;
  shiftType: string;
  constraintType: 'staffShortage' | 'qualificationMissing';
  requiredCount: number;
  availableCount: number;
  detail: string;
}

/**
 * 評価結果
 */
export interface EvaluationResult {
  overallScore: number;           // 0-100
  fulfillmentRate: number;        // 0-100（充足率%）
  constraintViolations: ConstraintViolation[];
  recommendations: Recommendation[];
  simulation: SimulationResult;
  generatedAt: Timestamp;
  aiComment?: string;             // AI総合コメント（200文字以内）
  positiveSummary?: string;       // Phase 53: ポジティブサマリー
  solverWarnings?: SolverWarning[];  // Solver事前検証警告
  rootCauseAnalysis?: {           // Phase 55: 根本原因分析結果
    primaryCause: {
      category: string;
      description: string;
      impact: number;
      affectedStaff?: string[];
      affectedDates?: string[];
      metrics?: {
        required?: number;
        available?: number;
        shortage?: number;
      };
    } | null;
    secondaryCauses: Array<{
      category: string;
      description: string;
      impact: number;
      affectedStaff?: string[];
      affectedDates?: string[];
    }>;
    aiComment: string;
    analyzedAt: string;
  };
}

/**
 * 評価タイプ（Phase 54）
 * - ai_generated: AI生成時の自動評価
 * - manual_reevaluate: 手動編集後の再評価
 */
export type EvaluationType = 'ai_generated' | 'manual_reevaluate';

/**
 * AI生成履歴（Firestore保存用）
 */
export interface AIGenerationHistory {
  id: string;
  targetMonth: string;           // YYYY-MM
  schedule: StaffSchedule[];     // 生成されたシフト
  evaluation: EvaluationResult; // 評価結果
  generatedBy: string;           // ユーザーID
  createdAt: Timestamp;
  // Phase 54 追加フィールド
  evaluationType?: EvaluationType;  // 評価タイプ（後方互換性のためオプショナル）
  metadata?: {
    model?: string;
    tokensUsed?: number;
    generationDuration?: number;
    reevaluatedFrom?: string;     // 再評価元の履歴ID
  };
}

/**
 * 評価サービスエラー型
 */
export type EvaluationError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'EVALUATION_FAILED'; message: string };

/**
 * generateShift Cloud Functionのレスポンス型
 */
export interface GenerateShiftResponse {
  success: boolean;
  schedule?: StaffSchedule[];
  evaluation?: EvaluationResult;  // Phase 40で追加（後方互換性のためオプショナル）
  metadata?: {
    generatedAt: string;
    model: string;
    tokensUsed: number;
  };
  solverWarnings?: SolverWarning[];  // Solver事前検証警告
  error?: string;
  parseError?: unknown;  // デバッグ用
}


// ==================== 月次レポート機能（Phase 41）====================

/**
 * 勤務時間警告タイプ
 */
export type WorkTimeWarning = 'overtime' | 'consecutive_work' | 'insufficient_rest';

/**
 * 日次勤務詳細
 */
export interface DailyWorkDetail {
  date: string;           // YYYY-MM-DD
  shiftType: string;      // シフト種別名
  hours: number;          // 勤務時間
  isNightShift: boolean;  // 夜勤フラグ
}

/**
 * 勤務時間集計（スタッフ別）
 */
export interface WorkTimeAggregation {
  staffId: string;
  staffName: string;
  totalHours: number;           // 総勤務時間
  regularHours: number;         // 通常勤務時間（日勤等）
  nightHours: number;           // 夜勤時間
  estimatedOvertimeHours: number; // 推定残業時間（160h基準超過分）
  dailyDetails: DailyWorkDetail[];
  warningFlags: WorkTimeWarning[];
}

/**
 * シフト種別カウント
 */
export interface ShiftTypeCount {
  shiftType: string;
  count: number;
  percentage: number;
  color: string;          // Tailwind CSS class
}

/**
 * スタッフ別シフト種別内訳
 */
export interface StaffShiftTypeBreakdown {
  staffId: string;
  staffName: string;
  breakdown: ShiftTypeCount[];
  nightShiftWarning: boolean;  // 夜勤8回以上の警告
}

/**
 * シフト種別集計
 */
export interface ShiftTypeAggregation {
  overall: ShiftTypeCount[];          // 全体集計
  byStaff: StaffShiftTypeBreakdown[]; // スタッフ別内訳
}

/**
 * 日別ステータス
 */
export interface DayStatus {
  date: string;           // YYYY-MM-DD
  status: 'work' | 'rest' | 'paid_leave' | 'public_holiday' | 'absent';
  shiftType?: string;     // 勤務の場合のシフト種別
}

/**
 * スタッフ稼働統計
 */
export interface StaffActivityAggregation {
  staffId: string;
  staffName: string;
  workDays: number;                 // 出勤日数
  restDays: number;                 // 休日数（公休）
  paidLeaveDays: number;            // 有給休暇日数
  publicHolidayDays: number;        // 公休日数
  maxConsecutiveWorkDays: number;   // 連続勤務最大日数
  averageWeeklyHours: number;       // 平均週間勤務時間
  monthlyCalendar: DayStatus[];     // 月間カレンダー
}

/**
 * レポートサマリー
 */
export interface ReportSummary {
  totalWorkHours: number;           // 総勤務時間（全スタッフ合計）
  totalStaffCount: number;          // スタッフ数
  averageWorkHoursPerStaff: number; // スタッフ平均勤務時間
  fulfillmentRate: number;          // 人員充足率 (0-100)
  paidLeaveUsageRate: number;       // 有給消化率 (0-100)
  workDaysCount: number;            // 稼働日数（休日除く）
}

/**
 * 月次レポートデータ
 */
export interface MonthlyReportData {
  targetMonth: string;                      // YYYY-MM
  facilityId: string;
  summary: ReportSummary;
  workTimeData: WorkTimeAggregation[];
  shiftTypeData: ShiftTypeAggregation;
  staffActivityData: StaffActivityAggregation[];
  generatedAt: Date;
}

/**
 * 時間帯別充足率データ
 */
export interface TimeSlotFulfillmentData {
  timeSlot: string;           // シフト種別名
  requiredCount: number;      // 必要人数
  actualCount: number;        // 実際の配置人数
  fulfillmentRate: number;    // 充足率 (0-100)
  shortfallDays: number;      // 人員不足日数
}

/**
 * 資格別配置状況データ
 */
export interface QualificationCoverageData {
  qualification: string;      // 資格名
  requiredCount: number;      // 必要人数
  availableCount: number;     // 配置可能人数
  coverageRate: number;       // カバー率 (0-100)
}

/**
 * コスト推計データ
 */
export interface CostEstimateData {
  regularHoursCost: number;   // 通常勤務コスト
  overtimeHoursCost: number;  // 残業コスト
  nightShiftAllowance: number; // 夜勤手当
  totalEstimate: number;      // 合計推計
  currency: 'JPY';
}

/**
 * 月次比較データ
 */
export interface MonthComparisonData {
  previousMonth: string;       // YYYY-MM
  workHoursDiff: number;       // 勤務時間差
  fulfillmentRateDiff: number; // 充足率差
  costDiff: number;            // コスト差
}

/**
 * 経営分析レポートデータ
 */
export interface ManagementReportData {
  summary: ReportSummary;
  timeSlotFulfillment: TimeSlotFulfillmentData[];
  qualificationCoverage: QualificationCoverageData[];
  costEstimate: CostEstimateData;
  monthComparison: MonthComparisonData | null;
  recommendations: string[];   // 改善提案
}

/**
 * 個人勤務サマリー
 */
export interface PersonalWorkSummary {
  workDays: number;           // 出勤日数
  totalHours: number;         // 総勤務時間
  nightShiftCount: number;    // 夜勤回数
  restDays: number;           // 休日数
}

/**
 * 個人休暇残高
 */
export interface PersonalLeaveBalance {
  paidLeaveRemaining: number;     // 有給残日数
  paidLeaveUsed: number;          // 有給使用日数
  publicHolidayRemaining: number; // 公休残日数
  publicHolidayUsed: number;      // 公休使用日数
}

/**
 * 個人勤務実績レポートデータ
 */
export interface PersonalReportData {
  staffId: string;
  staffName: string;
  targetMonth: string;              // YYYY-MM
  workSummary: PersonalWorkSummary;
  shiftBreakdown: ShiftTypeCount[];
  leaveBalance: PersonalLeaveBalance;
  calendar: DayStatus[];
}

/**
 * レポートサービスエラー型
 */
export type ReportError =
  | { code: 'FACILITY_NOT_FOUND'; message: string; facilityId: string }
  | { code: 'NO_SCHEDULE_DATA'; message: string; targetMonth: string }
  | { code: 'AGGREGATION_FAILED'; message: string; reason: string }
  | { code: 'PDF_GENERATION_FAILED'; message: string; reason: string }
  | { code: 'PERMISSION_DENIED'; message: string; requiredRole: FacilityRole }
  | { code: 'NETWORK_ERROR'; message: string; originalError: Error }
  | { code: 'STAFF_NOT_FOUND'; message: string; staffId: string };
