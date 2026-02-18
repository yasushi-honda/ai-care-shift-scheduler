/**
 * complianceService.ts
 *
 * Phase 25: コンプライアンスチェック・常勤換算サービス
 *
 * 機能:
 * - 常勤換算（FTE）計算
 * - 休憩時間コンプライアンスチェック（労基法第34条）
 * - 勤務間インターバルチェック（働き方改革関連法指針）
 *
 * 注意: 全関数は純粋関数（副作用なし）
 */

import type {
  StaffSchedule,
  Staff,
  FacilityShiftSettings,
  FullTimeEquivalentEntry,
  ComplianceViolationItem,
  ComplianceCheckResult,
} from '../../types';
import { DEFAULT_STANDARD_WEEKLY_HOURS } from '../../constants';

// 月平均週数（1ヶ月 = 365/12/7 ≒ 4.33週）
const WEEKS_PER_MONTH = 4.33;

// 休日扱いのシフトタイプ名（時間 = 0）
const REST_SHIFT_NAMES = new Set(['休', '明け休み', '有給休暇', '研修', 'off', 'postnight']);

// ==================== 内部ヘルパー ====================

/**
 * HH:mm → 分（日をまたぐ場合は翌日として+1440分）
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * 2つの時刻の差分（時間）を計算。overnight(end < start)は翌日と見なす
 */
function calcIntervalHours(startTime: string, endTime: string): number {
  let start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end < start) end += 24 * 60; // overnight
  return (end - start) / 60;
}

/**
 * シフト勤務時間（時間）を計算。休日は0を返す。
 * restHours を引いた純勤務時間。
 */
function calcShiftHours(
  shiftTypeName: string,
  startTime: string | undefined,
  endTime: string | undefined,
  restHours: number
): number {
  if (REST_SHIFT_NAMES.has(shiftTypeName) || !startTime || !endTime) return 0;

  let start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end < start) end += 24 * 60; // overnight

  const durationHours = (end - start) / 60;
  return Math.max(0, durationHours - restHours);
}

/**
 * シフトタイプ名からShiftTypeConfigを検索（name or id でマッチ）
 */
function findShiftConfig(shiftSettings: FacilityShiftSettings, typeName: string) {
  return shiftSettings.shiftTypes.find(
    (t) => t.name === typeName || t.id === typeName
  );
}

/**
 * 1シフトの実勤務時間を取得（useActual=true なら実績優先）
 */
function getShiftWorkHours(
  shift: { plannedShiftType: string; plannedStartTime?: string; plannedEndTime?: string; actualShiftType?: string; actualStartTime?: string; actualEndTime?: string },
  shiftSettings: FacilityShiftSettings,
  useActual: boolean
): number {
  const shiftTypeName =
    useActual && shift.actualShiftType ? shift.actualShiftType : shift.plannedShiftType;
  const startTime =
    useActual && shift.actualStartTime ? shift.actualStartTime : shift.plannedStartTime;
  const endTime =
    useActual && shift.actualEndTime ? shift.actualEndTime : shift.plannedEndTime;

  const config = findShiftConfig(shiftSettings, shiftTypeName);
  const resolvedStart = startTime || config?.start;
  const resolvedEnd = endTime || config?.end;
  const restHours = config?.restHours ?? 0;

  return calcShiftHours(shiftTypeName, resolvedStart, resolvedEnd, restHours);
}

// ==================== 公開関数 ====================

/**
 * 常勤換算（FTE）を計算する
 *
 * FTE = 月間勤務時間 / (週所定労働時間 × 4.33)
 *
 * @param staffSchedules - 対象月のスタッフスケジュール一覧
 * @param staffList - スタッフ情報一覧（employmentType取得用）
 * @param shiftSettings - 施設シフト設定（シフト時間取得用）
 * @param standardWeeklyHours - 常勤の週所定労働時間（デフォルト40h）
 * @param useActual - true=実績ベース、false=予定ベース
 */
export function calculateFullTimeEquivalent(
  staffSchedules: StaffSchedule[],
  staffList: Staff[],
  shiftSettings: FacilityShiftSettings,
  standardWeeklyHours: number = DEFAULT_STANDARD_WEEKLY_HOURS,
  useActual: boolean = false
): FullTimeEquivalentEntry[] {
  const standardMonthlyHours = standardWeeklyHours * WEEKS_PER_MONTH;

  return staffSchedules.map((ss) => {
    const staff = staffList.find((s) => s.id === ss.staffId);
    const employmentType = staff?.employmentType ?? 'A';

    const monthlyHours = ss.monthlyShifts.reduce((sum, shift) => {
      return sum + getShiftWorkHours(shift, shiftSettings, useActual);
    }, 0);

    const weeklyAverageHours = monthlyHours / WEEKS_PER_MONTH;
    const fteValue = Math.round((monthlyHours / standardMonthlyHours) * 100) / 100;

    return {
      staffId: ss.staffId,
      staffName: ss.staffName,
      role: staff?.role ?? '',
      employmentType,
      monthlyHours: Math.round(monthlyHours * 10) / 10,
      weeklyAverageHours: Math.round(weeklyAverageHours * 10) / 10,
      fteValue,
    };
  });
}

/**
 * 休憩時間コンプライアンスチェック（労基法第34条）
 *
 * 違反基準:
 * - 勤務時間8時間超 → 休憩60分以上必要（違反: error）
 * - 勤務時間6時間超 → 休憩45分以上必要（違反: warning）
 *
 * @param staffSchedules - 対象月のスタッフスケジュール一覧
 * @param shiftSettings - 施設シフト設定
 * @param useActual - true=実績ベース（breakMinutes使用）、false=予定ベース（restHours使用）
 */
export function checkBreakTimeCompliance(
  staffSchedules: StaffSchedule[],
  shiftSettings: FacilityShiftSettings,
  useActual: boolean = false
): ComplianceViolationItem[] {
  const violations: ComplianceViolationItem[] = [];

  for (const ss of staffSchedules) {
    for (const shift of ss.monthlyShifts) {
      const shiftTypeName =
        useActual && shift.actualShiftType ? shift.actualShiftType : shift.plannedShiftType;

      if (REST_SHIFT_NAMES.has(shiftTypeName)) continue;

      const config = findShiftConfig(shiftSettings, shiftTypeName);
      if (!config) continue;

      const startTime =
        useActual && shift.actualStartTime ? shift.actualStartTime : shift.plannedStartTime;
      const endTime =
        useActual && shift.actualEndTime ? shift.actualEndTime : shift.plannedEndTime;

      if (!startTime || !endTime) continue;

      // 総実働時間（休憩前）
      let start = timeToMinutes(startTime);
      let end = timeToMinutes(endTime);
      if (end < start) end += 24 * 60;
      const totalSpanHours = (end - start) / 60;

      // 休憩時間（分）: 実績breakMinutes優先、なければconfigのrestHours×60
      const breakMinutes =
        useActual && shift.breakMinutes !== undefined
          ? shift.breakMinutes
          : config.restHours * 60;

      // 違反チェック
      if (totalSpanHours > 8 && breakMinutes < 60) {
        violations.push({
          type: 'break_time',
          severity: 'error',
          staffId: ss.staffId,
          staffName: ss.staffName,
          date: shift.date,
          description: `${shift.date} ${shiftTypeName}: 勤務時間${totalSpanHours.toFixed(1)}時間に対し休憩${breakMinutes}分（60分以上必要）`,
          legalBasis: '労働基準法第34条',
          detail: { workHours: totalSpanHours, breakMinutes },
        });
      } else if (totalSpanHours > 6 && breakMinutes < 45) {
        violations.push({
          type: 'break_time',
          severity: 'warning',
          staffId: ss.staffId,
          staffName: ss.staffName,
          date: shift.date,
          description: `${shift.date} ${shiftTypeName}: 勤務時間${totalSpanHours.toFixed(1)}時間に対し休憩${breakMinutes}分（45分以上必要）`,
          legalBasis: '労働基準法第34条',
          detail: { workHours: totalSpanHours, breakMinutes },
        });
      }
    }
  }

  return violations;
}

/**
 * 勤務間インターバルチェック（働き方改革関連法指針: 最低8時間）
 *
 * 前日シフト終了 → 当日シフト開始のインターバルを確認
 *
 * @param staffSchedules - 対象月のスタッフスケジュール一覧
 * @param shiftSettings - 施設シフト設定
 * @param useActual - true=実績ベース、false=予定ベース
 * @param minIntervalHours - 最低インターバル時間（デフォルト8時間）
 */
export function checkRestIntervalCompliance(
  staffSchedules: StaffSchedule[],
  shiftSettings: FacilityShiftSettings,
  useActual: boolean = false,
  minIntervalHours: number = 8
): ComplianceViolationItem[] {
  const violations: ComplianceViolationItem[] = [];

  for (const ss of staffSchedules) {
    const sortedShifts = [...ss.monthlyShifts].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    for (let i = 1; i < sortedShifts.length; i++) {
      const prev = sortedShifts[i - 1];
      const curr = sortedShifts[i];

      const prevTypeName =
        useActual && prev.actualShiftType ? prev.actualShiftType : prev.plannedShiftType;
      const currTypeName =
        useActual && curr.actualShiftType ? curr.actualShiftType : curr.plannedShiftType;

      // どちらかが休日なら skip
      if (REST_SHIFT_NAMES.has(prevTypeName) || REST_SHIFT_NAMES.has(currTypeName)) continue;

      const prevConfig = findShiftConfig(shiftSettings, prevTypeName);
      const currConfig = findShiftConfig(shiftSettings, currTypeName);

      const prevEnd =
        (useActual && prev.actualEndTime ? prev.actualEndTime : prev.plannedEndTime) ||
        prevConfig?.end;
      const currStart =
        (useActual && curr.actualStartTime ? curr.actualStartTime : curr.plannedStartTime) ||
        currConfig?.start;

      if (!prevEnd || !currStart) continue;

      // 日付が連続していない場合（1日以上空いている）は skip
      const prevDate = new Date(prev.date);
      const currDate = new Date(curr.date);
      const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff > 1) continue;

      // インターバル計算（前日終了→当日開始）
      // overnight: 前日の終了が翌日にまたがる場合を考慮
      const prevEndMinutes = timeToMinutes(prevEnd);
      const currStartMinutes = timeToMinutes(currStart);

      // 前日終了 → 翌日開始のインターバル
      // 前日終了が深夜（例: 09:00 = 翌朝）の場合、currStartは当日の時刻
      // 前日終了が通常時刻の場合は単純計算
      let intervalMinutes: number;
      if (prevEndMinutes > currStartMinutes) {
        // 前日終了時刻が当日開始時刻より遅い → overnight扱い（夜勤明け）
        intervalMinutes = (24 * 60 - prevEndMinutes) + currStartMinutes;
      } else {
        intervalMinutes = currStartMinutes - prevEndMinutes;
      }

      const intervalHours = intervalMinutes / 60;

      if (intervalHours < minIntervalHours) {
        violations.push({
          type: 'rest_interval',
          severity: 'warning',
          staffId: ss.staffId,
          staffName: ss.staffName,
          date: curr.date,
          description: `${curr.date} ${currTypeName}: 前日${prevTypeName}終了から${intervalHours.toFixed(1)}時間後に勤務開始（${minIntervalHours}時間以上推奨）`,
          legalBasis: '労働時間等設定改善法指針',
          detail: { intervalHours },
        });
      }
    }
  }

  return violations;
}

/**
 * 全コンプライアンスチェックを統合実行
 */
export function runComplianceCheck(
  staffSchedules: StaffSchedule[],
  staffList: Staff[],
  shiftSettings: FacilityShiftSettings,
  targetMonth: string,
  standardWeeklyHours: number = DEFAULT_STANDARD_WEEKLY_HOURS,
  useActual: boolean = false
): ComplianceCheckResult {
  const fteEntries = calculateFullTimeEquivalent(
    staffSchedules,
    staffList,
    shiftSettings,
    standardWeeklyHours,
    useActual
  );

  const breakViolations = checkBreakTimeCompliance(staffSchedules, shiftSettings, useActual);
  const intervalViolations = checkRestIntervalCompliance(staffSchedules, shiftSettings, useActual);

  // 役職別FTE合計
  const fteTotalByRole: Record<string, number> = {};
  for (const entry of fteEntries) {
    if (!fteTotalByRole[entry.role]) fteTotalByRole[entry.role] = 0;
    fteTotalByRole[entry.role] = Math.round(
      (fteTotalByRole[entry.role] + entry.fteValue) * 100
    ) / 100;
  }

  return {
    targetMonth,
    checkedAt: new Date(),
    useActual,
    violations: [...breakViolations, ...intervalViolations],
    fteEntries,
    fteTotalByRole,
  };
}
