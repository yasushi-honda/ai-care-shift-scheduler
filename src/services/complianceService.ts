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
  RoleGroupedFTEData,
  ComplianceViolationItem,
  ComplianceCheckResult,
  StaffingStandardConfig,
  DailyFulfillmentResult,
  MonthlyFulfillmentSummary,
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
    const isFullTime = employmentType === 'A' || employmentType === 'B';

    const monthlyHours = ss.monthlyShifts.reduce((sum, shift) => {
      let hours = getShiftWorkHours(shift, shiftSettings, useActual);
      // 常勤(A/B)の有給休暇は所定労働時間（1日分 = 週所定時間 ÷ 5）を計上
      if (hours === 0 && isFullTime) {
        const shiftName = useActual && shift.actualShiftType
          ? shift.actualShiftType
          : shift.plannedShiftType;
        if (shiftName === '有給休暇') {
          hours = standardWeeklyHours / 5;
        }
      }
      return sum + hours;
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
 * FTEエントリを職種別にグループ化し、小計を算出する（Phase 62）
 *
 * @param entries - calculateFullTimeEquivalentの結果
 * @returns 職種別グループデータ（各グループに小計を含む）
 */
export function groupFTEByRole(entries: FullTimeEquivalentEntry[]): RoleGroupedFTEData[] {
  const roleMap = new Map<string, FullTimeEquivalentEntry[]>();

  for (const entry of entries) {
    const role = entry.role || '(未分類)';
    if (!roleMap.has(role)) {
      roleMap.set(role, []);
    }
    roleMap.get(role)!.push(entry);
  }

  return Array.from(roleMap.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'ja'))
    .map(([role, roleEntries]) => {
      const subtotalHours = Math.round(
        roleEntries.reduce((sum, e) => sum + e.monthlyHours, 0) * 10
      ) / 10;
      const subtotalWeeklyAvgHours = Math.round(
        roleEntries.reduce((sum, e) => sum + e.weeklyAverageHours, 0) * 10
      ) / 10;
      const subtotalFte = Math.round(
        roleEntries.reduce((sum, e) => sum + e.fteValue, 0) * 100
      ) / 100;

      return {
        role,
        entries: roleEntries,
        subtotalHours,
        subtotalWeeklyAvgHours,
        subtotalFte,
        staffCount: roleEntries.length,
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

// ==================== Phase 65: 人員配置基準充足率計算 ====================

/**
 * 日次人員配置充足率を計算する（純粋関数）
 *
 * 各日の勤務スタッフを職種別に集計し、配置基準との充足率を算出する。
 * 充足率 = 当日の職種別実績FTE / 必要FTE × 100
 * 日次FTE貢献 = 実勤務時間 / (週所定 ÷ 5)
 *
 * @param staffSchedules - 対象月のスタッフスケジュール
 * @param staffList - スタッフ情報一覧（職種取得用）
 * @param shiftSettings - 施設シフト設定
 * @param standardConfig - 人員配置基準設定
 * @param targetMonth - 対象月 "YYYY-MM"
 * @param standardWeeklyHours - 週所定労働時間（デフォルト40h）
 * @param useActual - 実績ベース（true）/ 予定ベース（false）
 */
export function calculateDailyFulfillment(
  staffSchedules: StaffSchedule[],
  staffList: Staff[],
  shiftSettings: FacilityShiftSettings,
  standardConfig: StaffingStandardConfig,
  targetMonth: string,
  standardWeeklyHours: number = DEFAULT_STANDARD_WEEKLY_HOURS,
  useActual: boolean = false
): DailyFulfillmentResult[] {
  // 日次FTE計算の基準（1日分の標準労働時間）
  const dailyStandardHours = standardWeeklyHours / 5;

  // 対象月の全日付を生成
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${targetMonth}-${String(d).padStart(2, '0')}`);
  }

  // staffId → Staff マッピング
  const staffMap = new Map<string, Staff>();
  for (const s of staffList) {
    staffMap.set(s.id, s);
  }

  return dates.map((date) => {
    // 当日の職種別 実績FTE 集計
    const actualFteByRole = new Map<string, number>();

    for (const ss of staffSchedules) {
      const shift = ss.monthlyShifts.find((s) => s.date === date);
      if (!shift) continue;

      const workHours = getShiftWorkHours(shift, shiftSettings, useActual);
      if (workHours <= 0) continue;

      const staff = staffMap.get(ss.staffId);
      const role = staff?.role ?? '';
      const dailyFte = workHours / dailyStandardHours;

      actualFteByRole.set(role, (actualFteByRole.get(role) ?? 0) + dailyFte);
    }

    // 職種別 充足率算出
    const byRole = standardConfig.requirements.map((req) => {
      const requiredFte =
        req.calculationMethod === 'ratio'
          ? (standardConfig.userCount ?? 0) / (req.ratioNumerator ?? 1)
          : req.requiredFte;

      const actualFte = actualFteByRole.get(req.role) ?? 0;
      const fulfillmentRate = requiredFte > 0 ? (actualFte / requiredFte) * 100 : 100;
      const status = fulfillmentRate >= 100 ? 'met' : fulfillmentRate >= 80 ? 'warning' : 'shortage';

      return {
        role: req.role,
        requiredFte: Math.round(requiredFte * 100) / 100,
        actualFte: Math.round(actualFte * 100) / 100,
        fulfillmentRate: Math.round(fulfillmentRate * 10) / 10,
        status: status as 'met' | 'warning' | 'shortage',
      };
    });

    // 全体充足率（全職種の必要FTE合計 vs 実績FTE合計）
    const totalRequired = byRole.reduce((s, r) => s + r.requiredFte, 0);
    const totalActual = byRole.reduce((s, r) => s + r.actualFte, 0);
    const overallRate = totalRequired > 0 ? (totalActual / totalRequired) * 100 : 100;
    const overallStatus = overallRate >= 100 ? 'met' : overallRate >= 80 ? 'warning' : 'shortage';

    return {
      date,
      overall: {
        requiredFte: Math.round(totalRequired * 100) / 100,
        actualFte: Math.round(totalActual * 100) / 100,
        fulfillmentRate: Math.round(overallRate * 10) / 10,
        status: overallStatus as 'met' | 'warning' | 'shortage',
      },
      byRole,
    };
  });
}

/**
 * 月次充足率サマリーを集計する（純粋関数）
 *
 * @param dailyResults - calculateDailyFulfillment の結果
 * @param targetMonth - 対象月 "YYYY-MM"
 */
export function calculateMonthlyFulfillmentSummary(
  dailyResults: DailyFulfillmentResult[],
  targetMonth: string
): MonthlyFulfillmentSummary {
  const totalDays = dailyResults.length;
  if (totalDays === 0) {
    return {
      targetMonth,
      averageFulfillmentRate: 100,
      shortfallDays: 0,
      totalDays: 0,
      dailyResults: [],
      byRole: [],
    };
  }

  const sumRate = dailyResults.reduce((s, d) => s + d.overall.fulfillmentRate, 0);
  const averageFulfillmentRate = Math.round((sumRate / totalDays) * 10) / 10;
  const shortfallDays = dailyResults.filter((d) => d.overall.status === 'shortage').length;

  // 職種別サマリー
  const roleNames = dailyResults[0]?.byRole.map((r) => r.role) ?? [];
  const byRole = roleNames.map((role) => {
    const roleDays = dailyResults
      .map((d) => d.byRole.find((r) => r.role === role))
      .filter(Boolean) as DailyFulfillmentResult['byRole'];

    const avgRate =
      roleDays.length > 0
        ? Math.round(
            (roleDays.reduce((s, r) => s + r.fulfillmentRate, 0) / roleDays.length) * 10
          ) / 10
        : 100;
    const shortfall = roleDays.filter((r) => r.status === 'shortage').length;

    return { role, averageFulfillmentRate: avgRate, shortfallDays: shortfall };
  });

  return {
    targetMonth,
    averageFulfillmentRate,
    shortfallDays,
    totalDays,
    dailyResults,
    byRole,
  };
}
