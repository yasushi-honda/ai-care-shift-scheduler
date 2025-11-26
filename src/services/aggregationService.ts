/**
 * AggregationService - シフトデータ集計サービス
 * Phase 41: 月次レポート機能
 */

import {
  Schedule,
  Staff,
  StaffLeaveBalance,
  FacilityShiftSettings,
  ShiftTypeConfig,
  WorkTimeAggregation,
  WorkTimeWarning,
  DailyWorkDetail,
  ShiftTypeAggregation,
  ShiftTypeCount,
  StaffShiftTypeBreakdown,
  StaffActivityAggregation,
  DayStatus,
  TimeSlotFulfillmentData,
  DailyRequirement,
} from '../../types';

// デフォルトのシフト色設定
const DEFAULT_SHIFT_COLORS: Record<string, string> = {
  '早番': 'bg-sky-100',
  '日勤': 'bg-green-100',
  '遅番': 'bg-amber-100',
  '夜勤': 'bg-purple-100',
  '休': 'bg-gray-100',
  '明け休み': 'bg-gray-200',
  '有給': 'bg-blue-100',
  '公休': 'bg-slate-100',
};

// 夜勤判定用のシフト名リスト
const NIGHT_SHIFT_NAMES = ['夜勤', 'night'];

// 休みと判定するシフト名リスト
const REST_SHIFT_NAMES = ['休', '休み', '公休', 'off', '明け休み'];

// 有給休暇と判定するシフト名リスト
const PAID_LEAVE_NAMES = ['有給', '有給休暇', 'paid_leave'];

/**
 * シフト設定から勤務時間を取得
 */
function getShiftHours(
  shiftType: string,
  shiftSettings?: FacilityShiftSettings
): number {
  if (shiftSettings?.shiftTypes) {
    const config = shiftSettings.shiftTypes.find(
      (s: ShiftTypeConfig) => s.name === shiftType
    );
    if (config) {
      const start = parseTimeToMinutes(config.start);
      const end = parseTimeToMinutes(config.end);
      const duration = end >= start ? end - start : (24 * 60 - start) + end;
      return (duration / 60) - config.restHours;
    }
  }

  // デフォルト時間設定
  const defaultHours: Record<string, number> = {
    '早番': 8,
    '日勤': 8,
    '遅番': 8,
    '夜勤': 16,
    '休': 0,
    '明け休み': 0,
  };
  return defaultHours[shiftType] ?? 8;
}

/**
 * 時刻文字列を分に変換
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 夜勤かどうか判定
 */
function isNightShift(shiftType: string): boolean {
  return NIGHT_SHIFT_NAMES.some(name =>
    shiftType.toLowerCase().includes(name.toLowerCase())
  );
}

/**
 * 休みかどうか判定
 */
function isRestShift(shiftType: string): boolean {
  return REST_SHIFT_NAMES.some(name =>
    shiftType.toLowerCase().includes(name.toLowerCase())
  );
}

/**
 * 有給かどうか判定
 */
function isPaidLeave(shiftType: string): boolean {
  return PAID_LEAVE_NAMES.some(name =>
    shiftType.toLowerCase().includes(name.toLowerCase())
  );
}

/**
 * シフト色を取得
 */
function getShiftColor(
  shiftType: string,
  shiftSettings?: FacilityShiftSettings
): string {
  if (shiftSettings?.shiftTypes) {
    const config = shiftSettings.shiftTypes.find(
      (s: ShiftTypeConfig) => s.name === shiftType
    );
    if (config?.color?.background) {
      return config.color.background;
    }
  }
  return DEFAULT_SHIFT_COLORS[shiftType] ?? 'bg-gray-100';
}

/**
 * 連続勤務日数を計算
 */
function calculateMaxConsecutiveWorkDays(
  shifts: { date: string; shiftType: string }[]
): number {
  if (shifts.length === 0) return 0;

  // 日付でソート
  const sortedShifts = [...shifts].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  let maxConsecutive = 0;
  let currentConsecutive = 0;
  let lastDate: Date | null = null;

  for (const shift of sortedShifts) {
    if (isRestShift(shift.shiftType) || isPaidLeave(shift.shiftType)) {
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      currentConsecutive = 0;
      lastDate = null;
      continue;
    }

    const currentDate = new Date(shift.date);

    if (lastDate === null) {
      currentConsecutive = 1;
    } else {
      const diffDays = Math.round(
        (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) {
        currentConsecutive++;
      } else {
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        currentConsecutive = 1;
      }
    }

    lastDate = currentDate;
  }

  return Math.max(maxConsecutive, currentConsecutive);
}

/**
 * 勤務時間集計
 */
export function aggregateWorkTime(
  schedules: Schedule[],
  staff: Staff[],
  shiftSettings?: FacilityShiftSettings
): WorkTimeAggregation[] {
  const result: WorkTimeAggregation[] = [];

  // スケジュールからスタッフ別のシフトを抽出
  const staffScheduleMap = new Map<string, { date: string; shiftType: string }[]>();

  for (const schedule of schedules) {
    for (const staffSchedule of schedule.staffSchedules) {
      const existing = staffScheduleMap.get(staffSchedule.staffId) || [];
      for (const shift of staffSchedule.monthlyShifts) {
        const shiftType = shift.actualShiftType || shift.plannedShiftType || shift.shiftType || '';
        existing.push({
          date: shift.date,
          shiftType,
        });
      }
      staffScheduleMap.set(staffSchedule.staffId, existing);
    }
  }

  // スタッフごとに集計
  for (const s of staff) {
    const shifts = staffScheduleMap.get(s.id) || [];

    let totalHours = 0;
    let regularHours = 0;
    let nightHours = 0;
    const dailyDetails: DailyWorkDetail[] = [];
    const warningFlags: WorkTimeWarning[] = [];

    for (const shift of shifts) {
      if (isRestShift(shift.shiftType) || isPaidLeave(shift.shiftType)) {
        continue;
      }

      const hours = getShiftHours(shift.shiftType, shiftSettings);
      const isNight = isNightShift(shift.shiftType);

      totalHours += hours;
      if (isNight) {
        nightHours += hours;
      } else {
        regularHours += hours;
      }

      dailyDetails.push({
        date: shift.date,
        shiftType: shift.shiftType,
        hours,
        isNightShift: isNight,
      });
    }

    // 残業時間計算（月160時間基準）
    const estimatedOvertimeHours = Math.max(0, totalHours - 160);

    // 警告フラグ設定
    if (estimatedOvertimeHours > 0) {
      warningFlags.push('overtime');
    }

    const maxConsecutive = calculateMaxConsecutiveWorkDays(shifts);
    if (maxConsecutive > 6) {
      warningFlags.push('consecutive_work');
    }

    result.push({
      staffId: s.id,
      staffName: s.name,
      totalHours,
      regularHours,
      nightHours,
      estimatedOvertimeHours,
      dailyDetails: dailyDetails.sort((a, b) => a.date.localeCompare(b.date)),
      warningFlags,
    });
  }

  return result;
}

/**
 * シフト種別集計
 */
export function aggregateShiftTypes(
  schedules: Schedule[],
  shiftSettings?: FacilityShiftSettings
): ShiftTypeAggregation {
  const overallCounts = new Map<string, number>();
  const staffCounts = new Map<string, { name: string; counts: Map<string, number> }>();
  let totalShifts = 0;

  for (const schedule of schedules) {
    for (const staffSchedule of schedule.staffSchedules) {
      if (!staffCounts.has(staffSchedule.staffId)) {
        staffCounts.set(staffSchedule.staffId, {
          name: staffSchedule.staffName,
          counts: new Map(),
        });
      }
      const staffData = staffCounts.get(staffSchedule.staffId)!;

      for (const shift of staffSchedule.monthlyShifts) {
        const shiftType = shift.actualShiftType || shift.plannedShiftType || shift.shiftType || '未設定';

        // 全体カウント
        overallCounts.set(shiftType, (overallCounts.get(shiftType) || 0) + 1);
        totalShifts++;

        // スタッフ別カウント
        staffData.counts.set(shiftType, (staffData.counts.get(shiftType) || 0) + 1);
      }
    }
  }

  // 全体集計
  const overall: ShiftTypeCount[] = Array.from(overallCounts.entries()).map(
    ([shiftType, count]) => ({
      shiftType,
      count,
      percentage: totalShifts > 0 ? Math.round((count / totalShifts) * 100) : 0,
      color: getShiftColor(shiftType, shiftSettings),
    })
  );

  // スタッフ別集計
  const byStaff: StaffShiftTypeBreakdown[] = Array.from(staffCounts.entries()).map(
    ([staffId, data]) => {
      const staffTotal = Array.from(data.counts.values()).reduce((a, b) => a + b, 0);
      const nightShiftCount = data.counts.get('夜勤') || 0;

      return {
        staffId,
        staffName: data.name,
        breakdown: Array.from(data.counts.entries()).map(([shiftType, count]) => ({
          shiftType,
          count,
          percentage: staffTotal > 0 ? Math.round((count / staffTotal) * 100) : 0,
          color: getShiftColor(shiftType, shiftSettings),
        })),
        nightShiftWarning: nightShiftCount >= 8,
      };
    }
  );

  return { overall, byStaff };
}

/**
 * スタッフ稼働統計集計
 */
export function aggregateStaffActivity(
  schedules: Schedule[],
  staff: Staff[],
  leaveBalances: StaffLeaveBalance[]
): StaffActivityAggregation[] {
  const result: StaffActivityAggregation[] = [];

  // スケジュールからスタッフ別のシフトを抽出
  const staffScheduleMap = new Map<string, { date: string; shiftType: string }[]>();

  for (const schedule of schedules) {
    for (const staffSchedule of schedule.staffSchedules) {
      const existing = staffScheduleMap.get(staffSchedule.staffId) || [];
      for (const shift of staffSchedule.monthlyShifts) {
        const shiftType = shift.actualShiftType || shift.plannedShiftType || shift.shiftType || '';
        existing.push({
          date: shift.date,
          shiftType,
        });
      }
      staffScheduleMap.set(staffSchedule.staffId, existing);
    }
  }

  for (const s of staff) {
    const shifts = staffScheduleMap.get(s.id) || [];

    let workDays = 0;
    let restDays = 0;
    let paidLeaveDays = 0;
    let publicHolidayDays = 0;
    let totalWorkHours = 0;
    const monthlyCalendar: DayStatus[] = [];

    for (const shift of shifts) {
      let status: DayStatus['status'] = 'work';

      if (isPaidLeave(shift.shiftType)) {
        status = 'paid_leave';
        paidLeaveDays++;
      } else if (shift.shiftType === '公休') {
        status = 'public_holiday';
        publicHolidayDays++;
      } else if (isRestShift(shift.shiftType)) {
        status = 'rest';
        restDays++;
      } else {
        workDays++;
        totalWorkHours += 8; // 簡易計算
      }

      monthlyCalendar.push({
        date: shift.date,
        status,
        shiftType: shift.shiftType,
      });
    }

    const maxConsecutiveWorkDays = calculateMaxConsecutiveWorkDays(shifts);

    // 週平均勤務時間（月4週と仮定）
    const averageWeeklyHours = totalWorkHours / 4;

    result.push({
      staffId: s.id,
      staffName: s.name,
      workDays,
      restDays,
      paidLeaveDays,
      publicHolidayDays,
      maxConsecutiveWorkDays,
      averageWeeklyHours: Math.round(averageWeeklyHours * 10) / 10,
      monthlyCalendar: monthlyCalendar.sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  return result;
}

/**
 * 充足率計算
 */
export function calculateFulfillmentRate(
  schedules: Schedule[],
  requirements: Record<string, DailyRequirement>
): { overall: number; byTimeSlot: TimeSlotFulfillmentData[] } {
  const timeSlotData = new Map<string, { required: number; actual: number; shortfallDays: number; days: number }>();

  // 各日付のシフト配置をカウント
  const dailyAssignments = new Map<string, Map<string, number>>();

  for (const schedule of schedules) {
    for (const staffSchedule of schedule.staffSchedules) {
      for (const shift of staffSchedule.monthlyShifts) {
        const shiftType = shift.actualShiftType || shift.plannedShiftType || shift.shiftType || '';
        if (isRestShift(shiftType) || isPaidLeave(shiftType)) continue;

        const dateKey = shift.date;
        if (!dailyAssignments.has(dateKey)) {
          dailyAssignments.set(dateKey, new Map());
        }
        const dayMap = dailyAssignments.get(dateKey)!;
        dayMap.set(shiftType, (dayMap.get(shiftType) || 0) + 1);
      }
    }
  }

  // 要件との比較
  let totalRequired = 0;
  let totalActual = 0;

  for (const [shiftType, requirement] of Object.entries(requirements)) {
    if (!timeSlotData.has(shiftType)) {
      timeSlotData.set(shiftType, { required: 0, actual: 0, shortfallDays: 0, days: 0 });
    }
    const data = timeSlotData.get(shiftType)!;

    for (const [, dayAssignments] of dailyAssignments) {
      const actualCount = dayAssignments.get(shiftType) || 0;
      const requiredCount = requirement.totalStaff;

      data.required += requiredCount;
      data.actual += actualCount;
      data.days++;

      if (actualCount < requiredCount) {
        data.shortfallDays++;
      }

      totalRequired += requiredCount;
      totalActual += actualCount;
    }
  }

  // 結果生成
  const byTimeSlot: TimeSlotFulfillmentData[] = Array.from(timeSlotData.entries()).map(
    ([timeSlot, data]) => ({
      timeSlot,
      requiredCount: data.required,
      actualCount: data.actual,
      fulfillmentRate: data.required > 0 ? Math.round((data.actual / data.required) * 100) : 100,
      shortfallDays: data.shortfallDays,
    })
  );

  const overall = totalRequired > 0 ? Math.round((totalActual / totalRequired) * 100) : 100;

  return { overall, byTimeSlot };
}

/**
 * 有給消化率計算
 */
export function calculatePaidLeaveUsageRate(
  leaveBalances: StaffLeaveBalance[]
): number {
  if (leaveBalances.length === 0) return 0;

  let totalAllocated = 0;
  let totalUsed = 0;

  for (const balance of leaveBalances) {
    totalAllocated += balance.paidLeave.annualAllocated + balance.paidLeave.carriedOver;
    totalUsed += balance.paidLeave.used;
  }

  return totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 100) : 0;
}
