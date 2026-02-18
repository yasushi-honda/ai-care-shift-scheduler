import { Staff, LeaveRequest, ShiftRequirement, Qualification } from '../../types';

/**
 * 希望休と資格要件の競合を表す警告
 */
export interface LeaveConflictWarning {
  /** 問題が発生する日付（YYYY-MM-DD） */
  date: string;
  /** 不足する資格 */
  qualification: Qualification;
  /** 全シフト合計で必要な有資格者数 */
  requiredCount: number;
  /** 希望休を除いた配置可能な有資格者数 */
  availableCount: number;
  /** 希望休を申請した有資格者の名前リスト */
  affectedStaff: string[];
}

/**
 * 希望休が資格要件を満たせなくなる日付を事前に検出する
 *
 * 各日・各資格について「全シフト合計で必要な有資格者数 > 希望休を除いた有資格者数」
 * となる場合に警告を返す。
 *
 * @param staffList スタッフリスト（資格情報を含む）
 * @param leaveRequests 希望休データ { staffId: { date: LeaveType } }
 * @param requirements シフト要件（資格要件を含む）
 * @returns 資格不足を引き起こす希望休の警告リスト
 */
export function detectLeaveQualificationConflicts(
  staffList: Staff[],
  leaveRequests: LeaveRequest,
  requirements: ShiftRequirement
): LeaveConflictWarning[] {
  // 全シフトの資格ごとに必要人数を合算
  const qualRequirements = new Map<Qualification, number>();
  for (const dailyReq of Object.values(requirements.requirements)) {
    for (const { qualification, count } of dailyReq.requiredQualifications ?? []) {
      qualRequirements.set(qualification, (qualRequirements.get(qualification) ?? 0) + count);
    }
  }

  if (qualRequirements.size === 0) return [];

  const warnings: LeaveConflictWarning[] = [];
  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${requirements.targetMonth}-${String(day).padStart(2, '0')}`;

    for (const [qualification, requiredCount] of qualRequirements) {
      const qualifiedStaff = staffList.filter((s) =>
        s.qualifications?.includes(qualification)
      );
      const onLeave = qualifiedStaff.filter((s) => leaveRequests[s.id]?.[date]);
      const availableCount = qualifiedStaff.length - onLeave.length;

      // 有資格者が最初から不足している場合は別問題（leave conflictではない）
      // leave requestsが原因で不足するケースのみ警告する
      if (qualifiedStaff.length >= requiredCount && availableCount < requiredCount) {
        warnings.push({
          date,
          qualification,
          requiredCount,
          availableCount,
          affectedStaff: onLeave.map((s) => s.name),
        });
      }
    }
  }

  return warnings;
}
