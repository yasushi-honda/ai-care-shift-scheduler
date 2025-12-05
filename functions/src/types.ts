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

// ============================================
// Phase 40: AI評価・フィードバック機能 型定義
// ============================================

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
 * 制約違反
 */
export interface ConstraintViolation {
  type: ConstraintViolationType;
  severity: 'error' | 'warning';
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

/**
 * AI評価結果
 */
export interface AIEvaluationResult {
  overallScore: number;           // 0-100
  fulfillmentRate: number;        // 0-100（充足率%）
  constraintViolations: ConstraintViolation[];
  recommendations: Recommendation[];
  simulation: SimulationResult;
  generatedAt: FirebaseFirestore.Timestamp;
  aiComment?: string;             // AI総合コメント（200文字以内）
}

/**
 * AI生成履歴（Firestore保存用）
 */
export interface AIGenerationHistory {
  id: string;
  targetMonth: string;           // YYYY-MM
  schedule: StaffSchedule[];     // 生成されたシフト
  evaluation: AIEvaluationResult; // 評価結果
  generatedBy: string;           // ユーザーID
  createdAt: FirebaseFirestore.Timestamp;
}

/**
 * generateShift Cloud Functionのレスポンス型
 */
export interface GenerateShiftResponse {
  success: boolean;
  schedule?: StaffSchedule[];
  evaluation?: AIEvaluationResult;  // Phase 40で追加（後方互換性のためオプショナル）
  metadata?: {
    generatedAt: string;
    model: string;
    tokensUsed: number;
  };
  error?: string;
  parseError?: unknown;  // デバッグ用
}
