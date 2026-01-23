/**
 * Phase 44: スタッフ制約分析
 *
 * timeSlotPreference、週勤務希望などを考慮して、
 * 数学的にシフト配置が実現可能かを分析する
 */

import {
  Staff,
  ShiftRequirement,
  TimeSlotPreference,
} from '../types';
import { isBusinessDay } from './constraintCheckers';

/**
 * スタッフ制約分析結果
 */
export interface StaffConstraintAnalysis {
  /** スタッフ総数 */
  totalStaff: number;
  /** 営業日数 */
  businessDays: number;
  /** 総供給可能人日数 */
  totalSupplyPersonDays: number;
  /** 総必要人日数 */
  totalRequiredPersonDays: number;
  /** シフト種別ごとの分析 */
  shiftAnalysis: {
    [shiftName: string]: {
      required: number;
      available: number;
      shortage: number;
      excess: number;
    };
  };
  /** timeSlotPreference別のスタッフ数 */
  preferenceDistribution: {
    [preference: string]: {
      count: number;
      personDays: number;
      staffNames: string[];
    };
  };
  /** 数学的に実現可能か */
  isFeasible: boolean;
  /** 実現不可能な場合の理由 */
  infeasibilityReasons: string[];
  /** 改善提案 */
  suggestions: string[];
}

/**
 * スタッフ制約を数学的に分析
 *
 * @param staffList スタッフリスト
 * @param requirements シフト要件
 * @returns 制約分析結果
 */
export function analyzeStaffConstraints(
  staffList: Staff[],
  requirements: ShiftRequirement
): StaffConstraintAnalysis {
  const targetMonth = requirements.targetMonth;
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 夜勤があるかどうかを判定
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
  const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

  // 営業日数を計算
  let businessDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${targetMonth}-${String(day).padStart(2, '0')}`;
    if (isBusinessDay(date, hasNightShift)) {
      businessDays++;
    }
  }

  // timeSlotPreference別にスタッフを分類
  const preferenceDistribution: StaffConstraintAnalysis['preferenceDistribution'] = {};
  for (const pref of Object.values(TimeSlotPreference)) {
    preferenceDistribution[pref] = { count: 0, personDays: 0, staffNames: [] };
  }

  let totalSupplyPersonDays = 0;
  for (const staff of staffList) {
    const pref = staff.timeSlotPreference || TimeSlotPreference.Any;
    const monthlyDays = Math.round(staff.weeklyWorkCount.hope * 4.5);

    if (!preferenceDistribution[pref]) {
      preferenceDistribution[pref] = { count: 0, personDays: 0, staffNames: [] };
    }
    preferenceDistribution[pref].count++;
    preferenceDistribution[pref].personDays += monthlyDays;
    preferenceDistribution[pref].staffNames.push(staff.name);
    totalSupplyPersonDays += monthlyDays;
  }

  // 1日あたりの必要人数を計算
  let dailyRequired = 0;
  for (const req of Object.values(requirements.requirements)) {
    dailyRequired += req.totalStaff;
  }
  const totalRequiredPersonDays = businessDays * dailyRequired;

  // シフト種別ごとの分析
  const shiftAnalysis: StaffConstraintAnalysis['shiftAnalysis'] = {};
  const infeasibilityReasons: string[] = [];
  const suggestions: string[] = [];

  // 各シフト種別の必要人日数
  for (const [shiftName, req] of Object.entries(requirements.requirements)) {
    const required = businessDays * req.totalStaff;
    shiftAnalysis[shiftName] = {
      required,
      available: 0,
      shortage: 0,
      excess: 0,
    };
  }

  // 「日勤のみ」スタッフの影響を分析
  const dayOnlyPref = preferenceDistribution[TimeSlotPreference.DayOnly];
  if (dayOnlyPref && dayOnlyPref.personDays > 0) {
    // 日勤のシフト名を検索
    const dayShiftName = Object.keys(requirements.requirements).find(
      name => name.includes('日勤') || name === '日'
    );

    if (dayShiftName && shiftAnalysis[dayShiftName]) {
      const dayRequired = shiftAnalysis[dayShiftName].required;
      const dayOnlyConsumption = dayOnlyPref.personDays;
      const percentage = Math.round((dayOnlyConsumption / dayRequired) * 100);

      if (dayOnlyConsumption > dayRequired * 0.7) {
        infeasibilityReasons.push(
          `「日勤のみ」スタッフ${dayOnlyPref.count}名（${dayOnlyPref.staffNames.join('・')}）で` +
          `${dayOnlyConsumption}人日を消費し、日勤必要数${dayRequired}人日の${percentage}%を占有`
        );

        // 改善提案を生成
        if (dayOnlyPref.staffNames.length > 1) {
          suggestions.push(
            `${dayOnlyPref.staffNames[dayOnlyPref.staffNames.length - 1]}の` +
            `timeSlotPreferenceを「いつでも可」に変更すると柔軟性が向上します`
          );
        }
      }
    }
  }

  // 早番・遅番に回せる人員を計算
  const flexiblePref = preferenceDistribution[TimeSlotPreference.Any] || { personDays: 0 };
  const earlyShiftName = Object.keys(requirements.requirements).find(
    name => name.includes('早')
  );
  const lateShiftName = Object.keys(requirements.requirements).find(
    name => name.includes('遅')
  );

  if (earlyShiftName || lateShiftName) {
    let earlyLateRequired = 0;
    if (earlyShiftName) earlyLateRequired += shiftAnalysis[earlyShiftName]?.required || 0;
    if (lateShiftName) earlyLateRequired += shiftAnalysis[lateShiftName]?.required || 0;

    // 日勤のみスタッフを除いた柔軟なスタッフの人日数
    const earlyLateAvailable = flexiblePref.personDays;

    if (earlyLateAvailable < earlyLateRequired) {
      infeasibilityReasons.push(
        `早番・遅番に必要な${earlyLateRequired}人日に対し、柔軟に配置可能なスタッフは${earlyLateAvailable}人日しか確保できません`
      );
    }
  }

  // 数学的に実現可能かを判定
  const isFeasible = infeasibilityReasons.length === 0 &&
                     totalSupplyPersonDays >= totalRequiredPersonDays;

  if (!isFeasible && totalSupplyPersonDays < totalRequiredPersonDays) {
    infeasibilityReasons.push(
      `総供給人日数${totalSupplyPersonDays}が必要人日数${totalRequiredPersonDays}を下回っています`
    );
  }

  return {
    totalStaff: staffList.length,
    businessDays,
    totalSupplyPersonDays,
    totalRequiredPersonDays,
    shiftAnalysis,
    preferenceDistribution,
    isFeasible,
    infeasibilityReasons,
    suggestions,
  };
}
