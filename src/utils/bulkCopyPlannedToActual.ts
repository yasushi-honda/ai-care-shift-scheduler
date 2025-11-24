import type { StaffSchedule } from '../../types';

/**
 * 一括コピーオプション
 */
export interface BulkCopyOptions {
  /** 対象スタッフIDリスト（未指定=全員） */
  staffIds?: string[];
  /** 対象期間 */
  dateRange?: { start: string; end: string };
  /** 既存実績を上書きするか（デフォルト: false） */
  overwrite?: boolean;
}

/**
 * 予定シフトを実績シフトに一括コピー
 *
 * @param schedules - スタッフスケジュール配列
 * @param options - コピーオプション
 * @returns 更新されたスタッフスケジュール配列
 *
 * @example
 * ```typescript
 * const updatedSchedules = bulkCopyPlannedToActual(schedules, {
 *   staffIds: ['staff_001', 'staff_002'],
 *   dateRange: { start: '2025-11-01', end: '2025-11-30' },
 *   overwrite: false
 * });
 * ```
 */
export function bulkCopyPlannedToActual(
  schedules: StaffSchedule[],
  options: BulkCopyOptions = {}
): StaffSchedule[] {
  return schedules.map(staff => {
    // 対象スタッフでない場合はスキップ
    if (options.staffIds && !options.staffIds.includes(staff.staffId)) {
      return staff;
    }

    return {
      ...staff,
      monthlyShifts: staff.monthlyShifts.map(shift => {
        // 対象期間外はスキップ
        if (options.dateRange) {
          if (shift.date < options.dateRange.start || shift.date > options.dateRange.end) {
            return shift;
          }
        }

        // 実績が既にある場合
        if (shift.actualShiftType && !options.overwrite) {
          return shift;
        }

        // 予定を実績にコピー
        const hasPlannedData = shift.plannedShiftType && shift.plannedStartTime && shift.plannedEndTime;

        if (!hasPlannedData) {
          return shift;
        }

        return {
          ...shift,
          actualShiftType: shift.plannedShiftType,
          actualStartTime: shift.plannedStartTime,
          actualEndTime: shift.plannedEndTime,
          // breakMinutesとnotesは空のまま（手動入力推奨）
        };
      })
    };
  });
}

/**
 * 実績未入力のシフト件数を計算
 *
 * @param staff - スタッフスケジュール
 * @param dateRange - 対象期間（オプション）
 * @returns 実績未入力件数
 */
export function getUnfilledActualCount(
  staff: StaffSchedule,
  dateRange?: { start: string; end: string }
): number {
  return staff.monthlyShifts.filter(shift => {
    // 既に実績がある場合はカウントしない
    if (shift.actualShiftType) {
      return false;
    }

    // 期間指定がある場合は期間内のみカウント
    if (dateRange) {
      return shift.date >= dateRange.start && shift.date <= dateRange.end;
    }

    return true;
  }).length;
}
