/**
 * 根本原因分析 - 個別分析関数
 *
 * 各種制約違反の原因を分析する関数群
 * rootCauseAnalysis.ts から抽出
 */

import {
  Staff,
  ShiftRequirement,
  ConstraintViolation,
  LeaveRequest,
  TimeSlotPreference,
} from '../types';
import { RootCause } from './rootCauseAnalysis';

/**
 * 違反から影響日を抽出
 */
export function extractAffectedDates(violations: ConstraintViolation[]): string[] {
  const dates = violations.flatMap((v) => v.affectedDates || []);
  return [...new Set(dates)].sort();
}

/**
 * スタッフ数不足を分析
 */
export function analyzeStaffShortage(
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
export function analyzeTimeSlotConstraint(
  violations: ConstraintViolation[],
  staffList: Staff[],
  _requirements: ShiftRequirement
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
export function analyzeLeaveConcentration(
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
export function analyzeConsecutiveWorkConstraint(
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
