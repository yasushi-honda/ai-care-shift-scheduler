/**
 * Shift Rebalance Module
 *
 * AI生成後のシフトを後処理でリバランスし、日別の人員配置を最適化する。
 *
 * 戦略A: 後処理リバランス（ai-shift-optimization-strategy.md参照）
 *
 * @module shift-rebalance
 */

import { StaffSchedule, ShiftRequirement, Staff, Qualification, TimeSlotPreference } from './types';

/**
 * 日別シフトカウント
 */
interface DailyShiftCount {
  date: string;
  counts: Record<string, number>;  // { '早番': 2, '日勤': 3, '遅番': 1 }
  staffByShift: Record<string, string[]>;  // { '早番': ['staff-1', 'staff-2'], ... }
}

/**
 * リバランス結果
 */
interface RebalanceResult {
  schedules: StaffSchedule[];
  swapsPerformed: number;
  improvements: {
    before: { violations: number; score: number };
    after: { violations: number; score: number };
  };
  swapLog: SwapLogEntry[];
}

/**
 * スワップログエントリ
 */
export interface SwapLogEntry {
  date: string;
  staffId: string;
  staffName: string;
  from: string;
  to: string;
  reason: string;
}

/**
 * シフトスケジュールをリバランスする
 *
 * @param schedules - 元のスケジュール
 * @param requirements - シフト要件
 * @param staffList - スタッフリスト（希望考慮用）
 * @returns リバランス後のスケジュールと統計
 */
export function rebalanceShifts(
  schedules: StaffSchedule[],
  requirements: ShiftRequirement,
  staffList: Staff[]
): RebalanceResult {
  // Deep copy to avoid mutating original
  const rebalanced = JSON.parse(JSON.stringify(schedules)) as StaffSchedule[];
  const swapLog: SwapLogEntry[] = [];
  let swapsPerformed = 0;

  // 営業日を取得
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 夜勤があるかどうかを判定
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
  const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

  // 日曜日を計算
  const sundays: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === 0) sundays.push(day);
  }

  // 各営業日をチェック
  for (let day = 1; day <= daysInMonth; day++) {
    // 日曜日スキップ（夜勤なし施設の場合）
    if (!hasNightShift && sundays.includes(day)) continue;

    const dateStr = `${requirements.targetMonth}-${String(day).padStart(2, '0')}`;
    const dailyCount = getDailyShiftCount(rebalanced, dateStr);

    // 各シフトタイプの過不足をチェック
    for (const [shiftName, req] of Object.entries(requirements.requirements || {})) {
      const currentCount = dailyCount.counts[shiftName] || 0;
      const required = req.totalStaff;
      const shortage = required - currentCount;

      if (shortage > 0) {
        // 不足している場合、過剰なシフトからスワップ
        const swapResult = performSwaps(
          rebalanced,
          dateStr,
          shiftName,
          shortage,
          requirements,
          dailyCount,
          staffList,
          swapLog
        );
        swapsPerformed += swapResult;
      }
    }
  }

  // 資格要件ベースのリバランス
  const qualSwaps = rebalanceQualifications(rebalanced, requirements, staffList, sundays, hasNightShift, swapLog);
  swapsPerformed += qualSwaps;

  // Before/After評価
  const beforeViolations = countViolations(schedules, requirements, sundays, hasNightShift);
  const afterViolations = countViolations(rebalanced, requirements, sundays, hasNightShift);

  console.log(`📊 [Rebalance] スワップ実行: ${swapsPerformed}回`);
  console.log(`📊 [Rebalance] 違反改善: ${beforeViolations} → ${afterViolations}`);

  return {
    schedules: rebalanced,
    swapsPerformed,
    improvements: {
      before: { violations: beforeViolations, score: Math.max(0, 100 - beforeViolations * 12) },
      after: { violations: afterViolations, score: Math.max(0, 100 - afterViolations * 12) },
    },
    swapLog,
  };
}

/**
 * 特定日のシフトカウントを取得
 * @param schedules スタッフスケジュール配列
 * @param date 対象日付（YYYY-MM-DD形式）
 * @returns 日別シフトカウント
 */
export function getDailyShiftCount(schedules: StaffSchedule[], date: string): DailyShiftCount {
  const counts: Record<string, number> = {};
  const staffByShift: Record<string, string[]> = {};

  for (const schedule of schedules) {
    const shift = schedule.monthlyShifts.find(s => s.date === date);
    if (shift && shift.shiftType && shift.shiftType !== '休') {
      const type = shift.shiftType;
      counts[type] = (counts[type] || 0) + 1;
      if (!staffByShift[type]) staffByShift[type] = [];
      staffByShift[type].push(schedule.staffId);
    }
  }

  return { date, counts, staffByShift };
}

/**
 * スワップを実行
 */
function performSwaps(
  schedules: StaffSchedule[],
  date: string,
  targetShift: string,  // 不足しているシフト
  shortage: number,
  requirements: ShiftRequirement,
  dailyCount: DailyShiftCount,
  staffList: Staff[],
  swapLog: SwapLogEntry[]
): number {
  let swaps = 0;
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);

  // 過剰なシフトを特定（優先順位: 日勤 > 遅番 > 早番）
  const surplusOrder = ['日勤', '遅番', '早番'].filter(s =>
    s !== targetShift && shiftTypeNames.includes(s)
  );

  for (let i = 0; i < shortage; i++) {
    let swapped = false;

    for (const surplusShift of surplusOrder) {
      const surplusRequired = requirements.requirements?.[surplusShift]?.totalStaff || 0;
      const surplusCount = dailyCount.counts[surplusShift] || 0;

      // 過剰がある場合のみスワップ
      if (surplusCount > surplusRequired) {
        const staffToSwap = findBestStaffToSwap(
          schedules,
          date,
          surplusShift,
          targetShift,
          staffList,
          dailyCount
        );

        if (staffToSwap) {
          // スワップ実行
          const schedule = schedules.find(s => s.staffId === staffToSwap.staffId);
          if (schedule) {
            const shift = schedule.monthlyShifts.find(s => s.date === date);
            if (shift) {
              swapLog.push({
                date,
                staffId: staffToSwap.staffId,
                staffName: staffToSwap.staffName,
                from: surplusShift,
                to: targetShift,
                reason: `${date}の${targetShift}不足を補填`,
              });

              shift.shiftType = targetShift;

              // カウント更新
              dailyCount.counts[surplusShift]--;
              dailyCount.counts[targetShift] = (dailyCount.counts[targetShift] || 0) + 1;

              swaps++;
              swapped = true;
              break;
            }
          }
        }
      }
    }

    if (!swapped) break;  // スワップ不可なら終了
  }

  return swaps;
}

/**
 * スワップに最適なスタッフを選択
 *
 * 優先順位:
 * 1. targetShiftを希望しているスタッフ
 * 2. 「いつでも可」のスタッフ
 * 3. その他
 */
function findBestStaffToSwap(
  schedules: StaffSchedule[],
  date: string,
  fromShift: string,
  toShift: string,
  staffList: Staff[],
  dailyCount: DailyShiftCount
): { staffId: string; staffName: string } | null {
  const candidates = dailyCount.staffByShift[fromShift] || [];

  // スコアリング
  const scored = candidates.map(staffId => {
    const staff = staffList.find(s => s.id === staffId);
    const schedule = schedules.find(s => s.staffId === staffId);

    let score = 0;

    // 希望に基づくスコア
    if (staff) {
      const pref = staff.timeSlotPreference || 'いつでも可';
      if (pref === 'いつでも可') score += 10;
      if (toShift === '早番' && pref.includes('早')) score += 20;
      if (toShift === '日勤' && pref.includes('日')) score += 20;
      if (toShift === '遅番' && pref.includes('遅')) score += 20;

      // 日勤のみの人は早番・遅番へのスワップを避ける
      if (pref === '日勤のみ' && toShift !== '日勤') score -= 100;
    }

    return {
      staffId,
      staffName: schedule?.staffName || staffId,
      score,
    };
  });

  // スコア降順でソート
  scored.sort((a, b) => b.score - a.score);

  // 有効なスワップ候補を返す
  const best = scored.find(s => s.score >= 0);
  return best ? { staffId: best.staffId, staffName: best.staffName } : null;
}

/**
 * 違反数をカウント
 * @param schedules スタッフスケジュール配列
 * @param requirements シフト要件
 * @param sundays 日曜日の日付配列
 * @param hasNightShift 夜勤有無
 * @returns 違反数
 */
export function countViolations(
  schedules: StaffSchedule[],
  requirements: ShiftRequirement,
  sundays: number[],
  hasNightShift: boolean
): number {
  let violations = 0;
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    if (!hasNightShift && sundays.includes(day)) continue;

    const dateStr = `${requirements.targetMonth}-${String(day).padStart(2, '0')}`;
    const dailyCount = getDailyShiftCount(schedules, dateStr);

    for (const [shiftName, req] of Object.entries(requirements.requirements || {})) {
      const currentCount = dailyCount.counts[shiftName] || 0;
      if (currentCount < req.totalStaff) {
        violations++;
      }
    }
  }

  return violations;
}

/**
 * 資格要件ベースのリバランス
 *
 * 各営業日のシフトで資格要件（看護師等）が満たされていない場合、
 * 他シフトにいる有資格者と無資格者を相互スワップして要件を満たす。
 * シフトの人数バランスは維持される（相互スワップのため）。
 */
export function rebalanceQualifications(
  schedules: StaffSchedule[],
  requirements: ShiftRequirement,
  staffList: Staff[],
  sundays: number[],
  hasNightShift: boolean,
  swapLog: SwapLogEntry[]
): number {
  let swaps = 0;
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    if (!hasNightShift && sundays.includes(day)) continue;

    const dateStr = `${requirements.targetMonth}-${String(day).padStart(2, '0')}`;
    const dailyCount = getDailyShiftCount(schedules, dateStr);

    for (const [shiftName, req] of Object.entries(requirements.requirements || {})) {
      for (const qualReq of req.requiredQualifications || []) {
        const staffOnShift = dailyCount.staffByShift[shiftName] || [];
        const qualifiedOnShift = staffOnShift.filter(staffId => {
          const staff = staffList.find(s => s.id === staffId);
          return (staff?.qualifications || []).includes(qualReq.qualification);
        });

        const shortage = qualReq.count - qualifiedOnShift.length;
        if (shortage <= 0) continue;

        for (let i = 0; i < shortage; i++) {
          const swapped = performQualificationSwap(
            schedules, dateStr, shiftName, qualReq.qualification,
            staffList, dailyCount, swapLog
          );
          if (swapped) swaps++;
          else break;
        }
      }
    }
  }

  return swaps;
}

/**
 * 資格要件を満たすための相互スワップ
 *
 * 他シフトにいる有資格者を対象シフトに移動し、
 * 対象シフトにいる無資格者を元のシフトに移動する（人数維持）。
 */
function performQualificationSwap(
  schedules: StaffSchedule[],
  date: string,
  targetShift: string,
  qualification: Qualification,
  staffList: Staff[],
  dailyCount: DailyShiftCount,
  swapLog: SwapLogEntry[]
): boolean {
  const skipShifts = ['休', '夜勤', '明け休み'];

  for (const [otherShift, staffIds] of Object.entries(dailyCount.staffByShift)) {
    if (otherShift === targetShift) continue;
    if (skipShifts.includes(otherShift)) continue;

    for (const qualStaffId of staffIds) {
      const qualStaff = staffList.find(s => s.id === qualStaffId);
      if (!(qualStaff?.qualifications || []).includes(qualification)) continue;

      // 有資格者がtargetShiftで働けるかチェック
      if (qualStaff?.timeSlotPreference === TimeSlotPreference.DayOnly && targetShift !== '日勤') continue;
      if (qualStaff?.timeSlotPreference === TimeSlotPreference.NightOnly) continue;

      // 対象シフトの無資格者を探す
      const targetStaffIds = dailyCount.staffByShift[targetShift] || [];

      for (const nonQualStaffId of targetStaffIds) {
        const nonQualStaff = staffList.find(s => s.id === nonQualStaffId);
        if ((nonQualStaff?.qualifications || []).includes(qualification)) continue;

        // 無資格者がotherShiftで働けるかチェック
        if (nonQualStaff?.timeSlotPreference === TimeSlotPreference.DayOnly && otherShift !== '日勤') continue;
        if (nonQualStaff?.timeSlotPreference === TimeSlotPreference.NightOnly) continue;

        // 相互スワップ実行
        const qualSchedule = schedules.find(s => s.staffId === qualStaffId);
        const nonQualSchedule = schedules.find(s => s.staffId === nonQualStaffId);
        if (!qualSchedule || !nonQualSchedule) continue;

        const qualShiftEntry = qualSchedule.monthlyShifts.find(s => s.date === date);
        const nonQualShiftEntry = nonQualSchedule.monthlyShifts.find(s => s.date === date);
        if (!qualShiftEntry || !nonQualShiftEntry) continue;

        qualShiftEntry.shiftType = targetShift;
        nonQualShiftEntry.shiftType = otherShift;

        // dailyCount更新
        const otherIdx = dailyCount.staffByShift[otherShift]?.indexOf(qualStaffId);
        if (otherIdx !== undefined && otherIdx >= 0) {
          dailyCount.staffByShift[otherShift].splice(otherIdx, 1);
        }
        const targetIdx = dailyCount.staffByShift[targetShift]?.indexOf(nonQualStaffId);
        if (targetIdx !== undefined && targetIdx >= 0) {
          dailyCount.staffByShift[targetShift].splice(targetIdx, 1);
        }

        if (!dailyCount.staffByShift[targetShift]) dailyCount.staffByShift[targetShift] = [];
        dailyCount.staffByShift[targetShift].push(qualStaffId);
        if (!dailyCount.staffByShift[otherShift]) dailyCount.staffByShift[otherShift] = [];
        dailyCount.staffByShift[otherShift].push(nonQualStaffId);

        swapLog.push({
          date,
          staffId: qualStaffId,
          staffName: qualSchedule.staffName || qualStaffId,
          from: otherShift,
          to: targetShift,
          reason: `${String(qualification)}資格要件を満たすためのスワップ`,
        });

        return true;
      }
    }
  }

  return false;
}

/**
 * リバランスログを整形して出力
 */
export function formatRebalanceLog(result: RebalanceResult): string {
  const lines: string[] = [
    '=== Rebalance Summary ===',
    `Swaps: ${result.swapsPerformed}`,
    `Violations: ${result.improvements.before.violations} → ${result.improvements.after.violations}`,
    `Score: ${result.improvements.before.score} → ${result.improvements.after.score}`,
    '',
    '=== Swap Details ===',
  ];

  for (const swap of result.swapLog) {
    lines.push(`${swap.date}: ${swap.staffName} (${swap.from} → ${swap.to}) - ${swap.reason}`);
  }

  return lines.join('\n');
}
