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
  TimeSlotPreference,
} from '../types';

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
  const staffShortageCause = analyzeStaffShortage(violations, staffList, requirements);
  if (staffShortageCause) {
    causes.push(staffShortageCause);
  }

  // 2. 時間帯制約を分析
  const timeSlotCause = analyzeTimeSlotConstraint(violations, staffList, requirements);
  if (timeSlotCause) {
    causes.push(timeSlotCause);
  }

  // 3. 休暇申請の集中を分析
  const leaveCause = analyzeLeaveConcentration(violations, staffList, leaveRequests);
  if (leaveCause) {
    causes.push(leaveCause);
  }

  // 4. 連勤制限を分析
  const consecutiveCause = analyzeConsecutiveWorkConstraint(violations);
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
 * スタッフ数不足を分析
 */
function analyzeStaffShortage(
  violations: ConstraintViolation[],
  staffList: Staff[],
  requirements: ShiftRequirement
): RootCause | null {
  const shortageViolations = violations.filter((v) => v.type === 'staffShortage');
  if (shortageViolations.length === 0) return null;

  // 必要な総人員を計算
  const timeSlots = requirements.timeSlots || [];
  const shiftNames = timeSlots.map((t) => t.name);
  const targetMonth = requirements.targetMonth;
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 営業日数を概算（週末含む単純計算）
  let totalRequired = 0;
  for (const shiftName of shiftNames) {
    const req = requirements.requirements[shiftName];
    if (req) {
      totalRequired += req.totalStaff * daysInMonth;
    }
  }

  // 供給可能人日数を計算
  let totalSupply = 0;
  for (const staff of staffList) {
    const weeksInMonth = daysInMonth / 7;
    const hopeCount = staff.weeklyWorkCount?.hope || 5;
    totalSupply += hopeCount * weeksInMonth;
  }

  const shortage = totalRequired - totalSupply;

  if (shortage <= 0) {
    // 全体的には足りているが、特定日・時間帯で不足
    return {
      category: 'staffShortage',
      description: `特定の日・時間帯で人員不足が発生しています（${shortageViolations.length}件）`,
      impact: shortageViolations.length,
      affectedDates: extractAffectedDates(shortageViolations),
      metrics: {
        required: totalRequired,
        available: Math.round(totalSupply),
        shortage: 0,
      },
    };
  }

  return {
    category: 'staffShortage',
    description: `スタッフ数が絶対的に不足しています。月間で約${Math.ceil(shortage)}人日不足しています。`,
    impact: shortageViolations.length + shortage,
    affectedDates: extractAffectedDates(shortageViolations),
    metrics: {
      required: totalRequired,
      available: Math.round(totalSupply),
      shortage: Math.ceil(shortage),
    },
  };
}

/**
 * 時間帯制約を分析
 */
function analyzeTimeSlotConstraint(
  violations: ConstraintViolation[],
  staffList: Staff[],
  requirements: ShiftRequirement
): RootCause | null {
  const shortageViolations = violations.filter((v) => v.type === 'staffShortage');
  if (shortageViolations.length === 0) return null;

  // 「日勤のみ」「早番のみ」などの制約を持つスタッフを特定
  const constrainedStaff = staffList.filter(
    (s) => s.timeSlotPreference && s.timeSlotPreference !== TimeSlotPreference.Any
  );

  if (constrainedStaff.length === 0) return null;

  // 早番・遅番の違反があるか確認
  const earlyLateViolations = shortageViolations.filter(
    (v) => v.description.includes('早番') || v.description.includes('遅番')
  );

  if (earlyLateViolations.length === 0) return null;

  const affectedStaffNames = constrainedStaff.map((s) => s.name);
  const dayOnlyCount = constrainedStaff.filter(
    (s) => s.timeSlotPreference === TimeSlotPreference.DayOnly
  ).length;

  return {
    category: 'timeSlotConstraint',
    description: `${dayOnlyCount}名のスタッフが「日勤のみ」に設定されているため、早番・遅番の配置が困難になっています。`,
    impact: earlyLateViolations.length,
    affectedStaff: affectedStaffNames,
    affectedDates: extractAffectedDates(earlyLateViolations),
    metrics: {
      required: undefined,
      available: staffList.length - dayOnlyCount,
      shortage: dayOnlyCount,
    },
  };
}

/**
 * 休暇申請の集中を分析
 */
function analyzeLeaveConcentration(
  violations: ConstraintViolation[],
  staffList: Staff[],
  leaveRequests: LeaveRequest
): RootCause | null {
  if (!leaveRequests || Object.keys(leaveRequests).length === 0) return null;

  // 日付ごとの休暇申請数をカウント
  const dateLeaveCount: Record<string, string[]> = {};

  for (const [staffId, dates] of Object.entries(leaveRequests)) {
    const datesRecord = dates as Record<string, unknown>;
    for (const date of Object.keys(datesRecord)) {
      if (!dateLeaveCount[date]) {
        dateLeaveCount[date] = [];
      }
      const staff = staffList.find((s) => s.id === staffId);
      const name = staff?.name || staffId;
      dateLeaveCount[date].push(name);
    }
  }

  // 集中している日を特定（スタッフの30%以上が休暇）
  const concentrationThreshold = Math.max(1, Math.floor(staffList.length * 0.3));
  const concentratedDates = Object.entries(dateLeaveCount)
    .filter(([, names]) => names.length >= concentrationThreshold)
    .sort((a, b) => b[1].length - a[1].length);

  if (concentratedDates.length === 0) return null;

  // 違反日と休暇集中日の一致を確認
  const violationDates = extractAffectedDates(violations);
  const matchedDates = concentratedDates.filter(([date]) =>
    violationDates.includes(date)
  );

  if (matchedDates.length === 0) return null;

  const allAffectedStaff = matchedDates.flatMap(([, names]) => names);
  const uniqueStaff = [...new Set(allAffectedStaff)];

  return {
    category: 'leaveConcentration',
    description: `${matchedDates.length}日で休暇申請が集中しています（各日${concentrationThreshold}名以上）。`,
    impact: matchedDates.length * 2,
    affectedStaff: uniqueStaff,
    affectedDates: matchedDates.map(([date]) => date),
    metrics: {
      required: undefined,
      available: undefined,
      shortage: matchedDates.length,
    },
  };
}

/**
 * 連勤制限を分析
 */
function analyzeConsecutiveWorkConstraint(
  violations: ConstraintViolation[]
): RootCause | null {
  const consecutiveViolations = violations.filter(
    (v) => v.type === 'consecutiveWork'
  );

  if (consecutiveViolations.length === 0) return null;

  const affectedStaff = consecutiveViolations
    .flatMap((v) => v.affectedStaff || [])
    .filter((v, i, a) => a.indexOf(v) === i);

  return {
    category: 'consecutiveWork',
    description: `${affectedStaff.length}名のスタッフが連勤制限に達しています。`,
    impact: consecutiveViolations.length,
    affectedStaff,
    affectedDates: extractAffectedDates(consecutiveViolations),
  };
}

/**
 * 違反から影響日を抽出
 */
function extractAffectedDates(violations: ConstraintViolation[]): string[] {
  const dates = violations.flatMap((v) => v.affectedDates || []);
  return [...new Set(dates)].sort();
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
