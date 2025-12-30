/**
 * データ設定診断機能の型定義（フロントエンド用）
 * Phase 55: データ設定診断機能
 */

/**
 * 診断ステータス
 * - ok: 問題なし
 * - warning: 警告（生成は可能だが違反が発生する可能性）
 * - error: エラー（データ設定に重大な問題あり）
 */
export type DiagnosisStatus = 'ok' | 'warning' | 'error';

/**
 * 時間帯別の需給バランス
 */
export interface TimeSlotBalance {
  /** 供給人日数 */
  supply: number;
  /** 需要人日数 */
  demand: number;
  /** 過不足（正=余剰、負=不足） */
  balance: number;
  /** 充足率（0-100%、100超過も可能） */
  fulfillmentRate: number;
}

/**
 * 全体の需給バランス
 */
export interface SupplyDemandBalance {
  /** 総供給人日数 */
  totalSupply: number;
  /** 総需要人日数 */
  totalDemand: number;
  /** 過不足（正=余剰、負=不足） */
  balance: number;
  /** 時間帯別バランス */
  byTimeSlot: {
    [slotName: string]: TimeSlotBalance;
  };
}

/**
 * 検出された問題の重要度
 */
export type IssueSeverity = 'high' | 'medium' | 'low';

/**
 * 問題のカテゴリ
 */
export type IssueCategory = 'supply' | 'timeSlot' | 'leave' | 'other';

/**
 * 検出された問題
 */
export interface DiagnosisIssue {
  /** 一意識別子 */
  id: string;
  /** 重要度 */
  severity: IssueSeverity;
  /** カテゴリ */
  category: IssueCategory;
  /** タイトル（短い説明） */
  title: string;
  /** 詳細説明 */
  description: string;
  /** 影響を受けるスタッフ名 */
  affectedStaff?: string[];
  /** 影響を受ける日付 */
  affectedDates?: string[];
  /** 関連する設定画面へのリンクパス */
  settingsLink?: string;
}

/**
 * 改善提案の優先度
 */
export type SuggestionPriority = 'high' | 'medium' | 'low';

/**
 * 改善提案
 */
export interface DiagnosisSuggestion {
  /** 優先度（★の数で表示） */
  priority: SuggestionPriority;
  /** 提案アクション */
  action: string;
  /** 実行時の効果 */
  impact: string;
  /** 対象スタッフ（特定の場合） */
  targetStaff?: string;
  /** 関連する設定画面へのリンクパス */
  settingsLink?: string;
}

/**
 * 診断結果
 */
export interface DiagnosisResult {
  /** 診断ステータス */
  status: DiagnosisStatus;
  /** サマリーメッセージ */
  summary: string;
  /** 需給バランス */
  supplyDemandBalance: SupplyDemandBalance;
  /** 検出された問題リスト */
  issues: DiagnosisIssue[];
  /** 改善提案リスト */
  suggestions: DiagnosisSuggestion[];
  /** 診断実行日時（ISO8601形式） */
  executedAt: string;
}

/**
 * 根本原因のカテゴリ
 */
export type RootCauseCategory =
  | 'staffShortage' // スタッフ数の絶対的不足
  | 'timeSlotConstraint' // 時間帯制約（「日勤のみ」等）
  | 'leaveConcentration' // 休暇申請の集中
  | 'qualificationMismatch' // 必要資格を持つスタッフの不足
  | 'consecutiveWork'; // 連勤制限による配置不可

/**
 * 根本原因の詳細
 */
export interface RootCause {
  /** カテゴリ */
  category: RootCauseCategory;
  /** 原因の説明 */
  description: string;
  /** 影響度（違反件数や不足人数等） */
  impact: number;
  /** 関連するスタッフ */
  affectedStaff?: string[];
  /** 関連する日付 */
  affectedDates?: string[];
  /** 数値的根拠 */
  metrics?: {
    required?: number;
    available?: number;
    shortage?: number;
  };
}

/**
 * 根本原因分析結果
 */
export interface RootCauseAnalysis {
  /** 主要な根本原因（最も影響が大きいもの） */
  primaryCause: RootCause | null;
  /** その他の根本原因 */
  secondaryCauses: RootCause[];
  /** 根本原因を考慮したAIコメント */
  aiComment: string;
  /** 分析日時 */
  analyzedAt: string;
}
