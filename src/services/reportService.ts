/**
 * ReportService - 月次レポートサービス
 * Phase 41: 月次レポート機能
 */

import { getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Result,
  ReportError,
  MonthlyReportData,
  ManagementReportData,
  PersonalReportData,
  ReportSummary,
  Schedule,
  Staff,
  StaffLeaveBalance,
  FacilityShiftSettings,
  FacilityRole,
  ShiftRequirement,
  CostEstimateData,
  MonthComparisonData,
  QualificationCoverageData,
  Qualification,
  StaffSchedule,
} from '../../types';
import {
  aggregateWorkTime,
  aggregateShiftTypes,
  aggregateStaffActivity,
  calculateFulfillmentRate,
  calculatePaidLeaveUsageRate,
} from './aggregationService';

// キャッシュ設定
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const reportCache = new Map<string, CacheEntry<MonthlyReportData>>();

/**
 * キャッシュキーを生成
 */
function getCacheKey(facilityId: string, targetMonth: string): string {
  return `${facilityId}:${targetMonth}`;
}

/**
 * キャッシュが有効かチェック
 */
function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Firestoreからスケジュールデータを取得
 */
async function fetchSchedules(
  facilityId: string,
  targetMonth: string
): Promise<Schedule[]> {
  const schedulesRef = collection(db, `facilities/${facilityId}/schedules`);
  const q = query(
    schedulesRef,
    where('targetMonth', '==', targetMonth),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Schedule[];
}

/**
 * Firestoreからスタッフデータを取得
 */
async function fetchStaff(facilityId: string): Promise<Staff[]> {
  const staffRef = collection(db, `facilities/${facilityId}/staff`);
  const snapshot = await getDocs(staffRef);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Staff[];
}

/**
 * Firestoreから休暇残高データを取得
 */
async function fetchLeaveBalances(
  facilityId: string,
  targetMonth: string
): Promise<StaffLeaveBalance[]> {
  const balancesRef = collection(db, `facilities/${facilityId}/leaveBalances`);
  const q = query(
    balancesRef,
    where('yearMonth', '==', targetMonth)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as StaffLeaveBalance[];
}

/**
 * Firestoreからシフト設定を取得
 */
async function fetchShiftSettings(
  facilityId: string
): Promise<FacilityShiftSettings | null> {
  try {
    const settingsRef = collection(db, `facilities/${facilityId}/shiftSettings`);
    const snapshot = await getDocs(settingsRef);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as FacilityShiftSettings;
  } catch {
    return null;
  }
}

/**
 * Firestoreから要件設定を取得
 */
async function fetchRequirements(
  facilityId: string,
  targetMonth: string
): Promise<ShiftRequirement | null> {
  try {
    const reqRef = collection(db, `facilities/${facilityId}/requirements`);
    const q = query(
      reqRef,
      where('targetMonth', '==', targetMonth),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as ShiftRequirement;
  } catch {
    return null;
  }
}

/**
 * サマリーを計算
 */
function calculateSummary(
  workTimeData: ReturnType<typeof aggregateWorkTime>,
  fulfillmentRate: number,
  paidLeaveUsageRate: number,
  schedules: Schedule[]
): ReportSummary {
  const totalWorkHours = workTimeData.reduce((sum, w) => sum + w.totalHours, 0);
  const totalStaffCount = workTimeData.length;
  const averageWorkHoursPerStaff = totalStaffCount > 0
    ? Math.round(totalWorkHours / totalStaffCount)
    : 0;

  // 稼働日数計算（シフトデータから重複なしの日付をカウント）
  const workDatesSet = new Set<string>();
  for (const schedule of schedules) {
    for (const staffSchedule of schedule.staffSchedules) {
      for (const shift of staffSchedule.monthlyShifts) {
        const shiftType = shift.actualShiftType || shift.plannedShiftType || shift.shiftType || '';
        if (!['休', '休み', '公休', '有給'].some(r => shiftType.includes(r))) {
          workDatesSet.add(shift.date);
        }
      }
    }
  }

  return {
    totalWorkHours,
    totalStaffCount,
    averageWorkHoursPerStaff,
    fulfillmentRate,
    paidLeaveUsageRate,
    workDaysCount: workDatesSet.size,
  };
}

/**
 * 月次レポートデータを取得
 */
export async function getMonthlyReport(
  facilityId: string,
  targetMonth: string,
  forceRefresh = false
): Promise<Result<MonthlyReportData, ReportError>> {
  try {
    // キャッシュチェック
    const cacheKey = getCacheKey(facilityId, targetMonth);
    if (!forceRefresh) {
      const cached = reportCache.get(cacheKey);
      if (isCacheValid(cached)) {
        return { success: true, data: cached.data };
      }
    }

    // データ取得（並列）
    const [schedules, staff, leaveBalances, shiftSettings, requirements] = await Promise.all([
      fetchSchedules(facilityId, targetMonth),
      fetchStaff(facilityId),
      fetchLeaveBalances(facilityId, targetMonth),
      fetchShiftSettings(facilityId),
      fetchRequirements(facilityId, targetMonth),
    ]);

    // データなしチェック
    if (schedules.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_SCHEDULE_DATA',
          message: `対象月（${targetMonth}）のシフトデータがありません`,
          targetMonth,
        },
      };
    }

    // 集計実行
    const workTimeData = aggregateWorkTime(schedules, staff, shiftSettings ?? undefined);
    const shiftTypeData = aggregateShiftTypes(schedules, shiftSettings ?? undefined);
    const staffActivityData = aggregateStaffActivity(schedules, staff, leaveBalances);

    // 充足率計算
    const fulfillmentResult = requirements?.requirements
      ? calculateFulfillmentRate(schedules, requirements.requirements)
      : { overall: 100, byTimeSlot: [] };

    // 有給消化率計算
    const paidLeaveUsageRate = calculatePaidLeaveUsageRate(leaveBalances);

    // サマリー計算
    const summary = calculateSummary(
      workTimeData,
      fulfillmentResult.overall,
      paidLeaveUsageRate,
      schedules
    );

    const reportData: MonthlyReportData = {
      targetMonth,
      facilityId,
      summary,
      workTimeData,
      shiftTypeData,
      staffActivityData,
      generatedAt: new Date(),
    };

    // キャッシュ保存
    reportCache.set(cacheKey, {
      data: reportData,
      timestamp: Date.now(),
    });

    return { success: true, data: reportData };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AGGREGATION_FAILED',
        message: 'レポートデータの集計に失敗しました',
        reason: error instanceof Error ? error.message : '不明なエラー',
      },
    };
  }
}

/**
 * 経営分析レポートを取得
 */
export async function getManagementReport(
  facilityId: string,
  targetMonth: string
): Promise<Result<ManagementReportData, ReportError>> {
  try {
    // 当月のレポートデータ取得
    const currentResult = await getMonthlyReport(facilityId, targetMonth);
    if (currentResult.success === false) {
      return {
        success: false,
        error: currentResult.error,
      };
    }

    const [schedules, staff, shiftSettings, requirements] = await Promise.all([
      fetchSchedules(facilityId, targetMonth),
      fetchStaff(facilityId),
      fetchShiftSettings(facilityId),
      fetchRequirements(facilityId, targetMonth),
    ]);

    // 充足率詳細
    const fulfillmentResult = requirements?.requirements
      ? calculateFulfillmentRate(schedules, requirements.requirements)
      : { overall: 100, byTimeSlot: [] };

    // 資格別配置状況
    const qualificationCoverage = calculateQualificationCoverage(staff, requirements);

    // コスト推計
    const costEstimate = calculateCostEstimate(currentResult.data.workTimeData);

    // 前月比較
    const previousMonth = getPreviousMonth(targetMonth);
    let monthComparison: MonthComparisonData | null = null;

    const previousResult = await getMonthlyReport(facilityId, previousMonth);
    if (previousResult.success) {
      const previousCost = calculateCostEstimate(previousResult.data.workTimeData);
      monthComparison = {
        previousMonth,
        workHoursDiff: currentResult.data.summary.totalWorkHours - previousResult.data.summary.totalWorkHours,
        fulfillmentRateDiff: currentResult.data.summary.fulfillmentRate - previousResult.data.summary.fulfillmentRate,
        costDiff: costEstimate.totalEstimate - previousCost.totalEstimate,
      };
    }

    // 改善提案生成
    const recommendations = generateRecommendations(
      currentResult.data.summary,
      fulfillmentResult.byTimeSlot,
      qualificationCoverage
    );

    return {
      success: true,
      data: {
        summary: currentResult.data.summary,
        timeSlotFulfillment: fulfillmentResult.byTimeSlot,
        qualificationCoverage,
        costEstimate,
        monthComparison,
        recommendations,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AGGREGATION_FAILED',
        message: '経営分析レポートの生成に失敗しました',
        reason: error instanceof Error ? error.message : '不明なエラー',
      },
    };
  }
}

/**
 * 個人勤務実績レポートを取得
 */
export async function getPersonalReport(
  facilityId: string,
  staffId: string,
  targetMonth: string
): Promise<Result<PersonalReportData, ReportError>> {
  try {
    const [schedules, staff, leaveBalances, shiftSettings] = await Promise.all([
      fetchSchedules(facilityId, targetMonth),
      fetchStaff(facilityId),
      fetchLeaveBalances(facilityId, targetMonth),
      fetchShiftSettings(facilityId),
    ]);

    // スタッフ存在確認
    const targetStaff = staff.find(s => s.id === staffId);
    if (!targetStaff) {
      return {
        success: false,
        error: {
          code: 'STAFF_NOT_FOUND',
          message: 'スタッフが見つかりません',
          staffId,
        },
      };
    }

    // 該当スタッフのデータのみ集計
    const workTimeData = aggregateWorkTime(schedules, [targetStaff], shiftSettings ?? undefined);
    const shiftTypeData = aggregateShiftTypes(schedules, shiftSettings ?? undefined);
    const staffActivityData = aggregateStaffActivity(schedules, [targetStaff], leaveBalances);

    const personalWorkTime = workTimeData[0];
    const personalActivity = staffActivityData[0];
    const personalShiftBreakdown = shiftTypeData.byStaff.find(s => s.staffId === staffId);

    // 休暇残高取得
    const staffBalance = leaveBalances.find(b => b.staffId === staffId);

    return {
      success: true,
      data: {
        staffId,
        staffName: targetStaff.name,
        targetMonth,
        workSummary: {
          workDays: personalActivity?.workDays ?? 0,
          totalHours: personalWorkTime?.totalHours ?? 0,
          nightShiftCount: personalShiftBreakdown?.breakdown.find(b => b.shiftType === '夜勤')?.count ?? 0,
          restDays: personalActivity?.restDays ?? 0,
        },
        shiftBreakdown: personalShiftBreakdown?.breakdown ?? [],
        leaveBalance: {
          paidLeaveRemaining: staffBalance?.paidLeave.balance ?? 0,
          paidLeaveUsed: staffBalance?.paidLeave.used ?? 0,
          publicHolidayRemaining: staffBalance?.publicHoliday.balance ?? 0,
          publicHolidayUsed: staffBalance?.publicHoliday.used ?? 0,
        },
        calendar: personalActivity?.monthlyCalendar ?? [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AGGREGATION_FAILED',
        message: '個人レポートの生成に失敗しました',
        reason: error instanceof Error ? error.message : '不明なエラー',
      },
    };
  }
}

/**
 * キャッシュをクリア
 */
export function clearReportCache(): void {
  reportCache.clear();
}

// ========== ヘルパー関数 ==========

/**
 * 前月を取得
 */
function getPreviousMonth(targetMonth: string): string {
  const [year, month] = targetMonth.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 資格別配置状況を計算
 */
function calculateQualificationCoverage(
  staff: Staff[],
  requirements: ShiftRequirement | null
): QualificationCoverageData[] {
  const qualifications = Object.values(Qualification);
  const result: QualificationCoverageData[] = [];

  for (const qualification of qualifications) {
    const availableCount = staff.filter(s =>
      s.qualifications.includes(qualification)
    ).length;

    // 要件から必要数を取得（簡易版：全シフトの最大値）
    let requiredCount = 0;
    if (requirements?.requirements) {
      for (const req of Object.values(requirements.requirements)) {
        const qualReq = req.requiredQualifications.find(
          q => q.qualification === qualification
        );
        if (qualReq && qualReq.count > requiredCount) {
          requiredCount = qualReq.count;
        }
      }
    }

    result.push({
      qualification,
      requiredCount,
      availableCount,
      coverageRate: requiredCount > 0
        ? Math.min(100, Math.round((availableCount / requiredCount) * 100))
        : 100,
    });
  }

  return result.filter(r => r.requiredCount > 0 || r.availableCount > 0);
}

/**
 * コスト推計を計算
 */
function calculateCostEstimate(
  workTimeData: ReturnType<typeof aggregateWorkTime>
): CostEstimateData {
  // 仮の時給設定（将来的には設定から取得）
  const HOURLY_RATE = 1200; // 通常時給
  const OVERTIME_RATE = 1500; // 残業時給（1.25倍）
  const NIGHT_ALLOWANCE = 300; // 夜勤手当/時間

  let regularHoursCost = 0;
  let overtimeHoursCost = 0;
  let nightShiftAllowance = 0;

  for (const data of workTimeData) {
    regularHoursCost += data.regularHours * HOURLY_RATE;
    overtimeHoursCost += data.estimatedOvertimeHours * OVERTIME_RATE;
    nightShiftAllowance += data.nightHours * NIGHT_ALLOWANCE;
  }

  return {
    regularHoursCost,
    overtimeHoursCost,
    nightShiftAllowance,
    totalEstimate: regularHoursCost + overtimeHoursCost + nightShiftAllowance,
    currency: 'JPY',
  };
}

/**
 * 改善提案を生成
 */
function generateRecommendations(
  summary: ReportSummary,
  timeSlotFulfillment: ReturnType<typeof calculateFulfillmentRate>['byTimeSlot'],
  qualificationCoverage: QualificationCoverageData[]
): string[] {
  const recommendations: string[] = [];

  // 充足率が低い場合
  if (summary.fulfillmentRate < 80) {
    recommendations.push(
      `人員充足率が${summary.fulfillmentRate}%と低下しています。採用活動の強化を検討してください。`
    );
  }

  // 特定時間帯の充足率が低い場合
  for (const slot of timeSlotFulfillment) {
    if (slot.fulfillmentRate < 80) {
      recommendations.push(
        `${slot.timeSlot}の充足率が${slot.fulfillmentRate}%です。${slot.shortfallDays}日間人員不足が発生しました。`
      );
    }
  }

  // 資格カバー率が低い場合
  for (const qual of qualificationCoverage) {
    if (qual.coverageRate < 100 && qual.requiredCount > 0) {
      recommendations.push(
        `${qual.qualification}保有者が不足しています（必要: ${qual.requiredCount}名、現在: ${qual.availableCount}名）。`
      );
    }
  }

  // 有給消化率が低い場合
  if (summary.paidLeaveUsageRate < 50) {
    recommendations.push(
      `有給消化率が${summary.paidLeaveUsageRate}%です。スタッフの有給取得を促進してください。`
    );
  }

  return recommendations;
}

// ==================== Phase 25: コンプライアンスチェック用データ取得 ====================

export interface ComplianceRawData {
  staffSchedules: StaffSchedule[];
  staffList: Staff[];
  shiftSettings: FacilityShiftSettings | null;
}

/**
 * コンプライアンスチェックに必要な生データを取得する
 */
export async function getComplianceData(
  facilityId: string,
  targetMonth: string
): Promise<Result<ComplianceRawData, ReportError>> {
  try {
    const [schedules, staffList, shiftSettings] = await Promise.all([
      fetchSchedules(facilityId, targetMonth),
      fetchStaff(facilityId),
      fetchShiftSettings(facilityId),
    ]);

    if (schedules.length === 0) {
      return {
        success: false,
        error: { code: 'NO_SCHEDULE_DATA', message: `${targetMonth}のシフトデータがありません`, targetMonth },
      };
    }

    const staffSchedules = schedules[0].staffSchedules ?? [];

    return {
      success: true,
      data: { staffSchedules, staffList, shiftSettings },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'AGGREGATION_FAILED',
        message: error instanceof Error ? error.message : 'データ取得に失敗しました',
        reason: 'fetchError',
      },
    };
  }
}
