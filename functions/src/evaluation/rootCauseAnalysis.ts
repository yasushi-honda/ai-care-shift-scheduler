/**
 * 根本原因分析サービス
 * Phase 55: データ設定診断機能
 *
 * シフト生成で発生した違反の根本原因を分析し、
 * ユーザーにわかりやすい説明を提供する
 */

import {
  Staff,
  ShiftRequirement,
  ConstraintViolation,
  StaffSchedule,
  LeaveRequest,
} from '../types';
import {
  analyzeStaffShortage as analyzeStaffShortageFn,
  analyzeTimeSlotConstraint as analyzeTimeSlotConstraintFn,
  analyzeLeaveConcentration as analyzeLeaveConcentrationFn,
  analyzeConsecutiveWorkConstraint as analyzeConsecutiveWorkConstraintFn,
} from './rootCauseAnalyzers';

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
  category: RootCauseCategory;
  description: string;
  impact: number;
  affectedStaff?: string[];
  affectedDates?: string[];
  metrics?: {
    required?: number;
    available?: number;
    shortage?: number;
  };
}

/**
 * 根本原因分析結果
 */
export interface RootCauseAnalysisResult {
  primaryCause: RootCause | null;
  secondaryCauses: RootCause[];
  aiComment: string;
  analyzedAt: string;
}

/**
 * 根本原因分析の入力
 */
export interface RootCauseAnalysisInput {
  violations: ConstraintViolation[];
  staffList: Staff[];
  requirements: ShiftRequirement;
  leaveRequests: LeaveRequest;
  schedule: StaffSchedule[];
}

/**
 * 根本原因分析を実行する
 */
export function analyzeRootCauses(
  input: RootCauseAnalysisInput
): RootCauseAnalysisResult {
  // scheduleは将来の拡張用（連勤分析等）に使用予定
  const { violations, staffList, requirements, leaveRequests } = input;

  // 違反がない場合
  if (violations.length === 0) {
    return {
      primaryCause: null,
      secondaryCauses: [],
      aiComment: 'シフト生成に問題なし。すべての制約を満たしています。',
      analyzedAt: new Date().toISOString(),
    };
  }

  const causes: RootCause[] = [];

  // 1. スタッフ数不足を分析
  const staffShortageCause = analyzeStaffShortageFn(violations, staffList, requirements);
  if (staffShortageCause) {
    causes.push(staffShortageCause);
  }

  // 2. 時間帯制約を分析
  const timeSlotCause = analyzeTimeSlotConstraintFn(violations, staffList, requirements);
  if (timeSlotCause) {
    causes.push(timeSlotCause);
  }

  // 3. 休暇申請の集中を分析
  const leaveCause = analyzeLeaveConcentrationFn(violations, staffList, leaveRequests);
  if (leaveCause) {
    causes.push(leaveCause);
  }

  // 4. 連勤制限を分析
  const consecutiveCause = analyzeConsecutiveWorkConstraintFn(violations);
  if (consecutiveCause) {
    causes.push(consecutiveCause);
  }

  // 影響度でソート
  causes.sort((a, b) => b.impact - a.impact);

  const primaryCause = causes.length > 0 ? causes[0] : null;
  const secondaryCauses = causes.slice(1);

  // AIコメントを生成
  const aiComment = generateAIComment(primaryCause, secondaryCauses, violations);

  return {
    primaryCause,
    secondaryCauses,
    aiComment,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * AIコメントを生成
 */
function generateAIComment(
  primaryCause: RootCause | null,
  secondaryCauses: RootCause[],
  violations: ConstraintViolation[]
): string {
  if (!primaryCause) {
    return 'シフト生成に問題なし。すべての制約を満たしています。';
  }

  const parts: string[] = [];

  // 主要原因の説明
  parts.push(`【根本原因】${primaryCause.description}`);

  // 数値的根拠
  if (primaryCause.metrics) {
    const { required, available, shortage } = primaryCause.metrics;
    if (required !== undefined && available !== undefined) {
      parts.push(`（必要: ${required}人日, 利用可能: ${available}人日）`);
    }
    if (shortage !== undefined && shortage > 0) {
      parts.push(`約${shortage}人日の不足が見込まれます。`);
    }
  }

  // 影響を受けるスタッフ
  if (primaryCause.affectedStaff && primaryCause.affectedStaff.length > 0) {
    const staffList =
      primaryCause.affectedStaff.length <= 3
        ? primaryCause.affectedStaff.join('、')
        : `${primaryCause.affectedStaff.slice(0, 3).join('、')}他${primaryCause.affectedStaff.length - 3}名`;
    parts.push(`関連スタッフ: ${staffList}`);
  }

  // 副次的原因
  if (secondaryCauses.length > 0) {
    parts.push('');
    parts.push('【その他の要因】');
    for (const cause of secondaryCauses.slice(0, 2)) {
      parts.push(`・${cause.description}`);
    }
  }

  // 改善提案
  parts.push('');
  parts.push('【改善提案】');
  switch (primaryCause.category) {
    case 'staffShortage':
      parts.push('・スタッフの追加採用を検討してください');
      parts.push('・週当たりの希望勤務日数の見直しを検討してください');
      break;
    case 'timeSlotConstraint':
      if (primaryCause.affectedStaff && primaryCause.affectedStaff.length > 0) {
        parts.push(
          `・${primaryCause.affectedStaff[0]}さんの時間帯設定を「制限なし」に変更することを検討してください`
        );
      }
      parts.push('・早番・遅番に対応可能なスタッフを増やすことを検討してください');
      break;
    case 'leaveConcentration':
      parts.push('・休暇申請日の分散を検討してください');
      if (primaryCause.affectedDates && primaryCause.affectedDates.length > 0) {
        parts.push(
          `・${primaryCause.affectedDates[0]}の休暇申請について調整を検討してください`
        );
      }
      break;
    case 'consecutiveWork':
      parts.push('・連勤制限値の見直しを検討してください');
      parts.push('・休日の配置を調整してください');
      break;
    default:
      parts.push('・データ設定を見直してください');
  }

  return parts.join('\n');
}
