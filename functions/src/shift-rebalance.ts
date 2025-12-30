/**
 * Shift Rebalance Module
 *
 * AI生成後のシフトを後処理でリバランスし、日別の人員配置を最適化する。
 *
 * 戦略A: 後処理リバランス（ai-shift-optimization-strategy.md参照）
 *
 * @module shift-rebalance
 */

import { StaffSchedule, ShiftRequirement, Staff } from './types';

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
interface SwapLogEntry {
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
 */
function getDailyShiftCount(schedules: StaffSchedule[], date: string): DailyShiftCount {
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
 */
function countViolations(
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
