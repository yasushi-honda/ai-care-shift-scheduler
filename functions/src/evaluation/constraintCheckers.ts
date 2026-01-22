/**
 * Phase 40: AI評価・フィードバック機能
 * 制約違反チェック関数群
 *
 * EvaluationServiceから抽出した制約チェックロジック
 */

import {
  Staff,
  StaffSchedule,
  ShiftRequirement,
  LeaveRequest,
  ConstraintViolation,
  TimeSlotPreference,
} from '../types';

/**
 * 営業日かどうかを判定
 * @param date 日付文字列（YYYY-MM-DD）
 * @param hasNightShift 夜勤があるかどうか
 * @returns 営業日ならtrue
 */
export function isBusinessDay(date: string, hasNightShift: boolean): boolean {
  if (hasNightShift) {
    // 24時間営業の施設（老健など）は毎日営業
    return true;
  }

  // デイサービス: 日曜日は休業
  const dayOfWeek = new Date(date).getDay();
  return dayOfWeek !== 0; // 0 = 日曜日
}

/**
 * 人員不足をチェック
 * @param schedule スケジュール
 * @param requirements シフト要件
 * @returns 制約違反リスト
 */
export function checkStaffShortage(
  schedule: StaffSchedule[],
  requirements: ShiftRequirement
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const targetMonth = requirements.targetMonth;

  // 対象月の日数を取得
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 夜勤があるかどうかを判定
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
  const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

  // 各日の配置人数をカウント
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${targetMonth}-${String(day).padStart(2, '0')}`;

    // 営業外の日はスキップ
    if (!isBusinessDay(date, hasNightShift)) {
      continue;
    }

    const dailyStaffByShift: Record<string, string[]> = {};

    // 各スタッフのシフトをカウント
    for (const staffSchedule of schedule) {
      const shift = staffSchedule.monthlyShifts.find((s) => s.date === date);
      if (shift && shift.shiftType && shift.shiftType !== '休') {
        const shiftType = shift.shiftType;
        if (!dailyStaffByShift[shiftType]) {
          dailyStaffByShift[shiftType] = [];
        }
        dailyStaffByShift[shiftType].push(staffSchedule.staffId);
      }
    }

    // 要件と比較
    for (const [shiftName, requirement] of Object.entries(
      requirements.requirements
    )) {
      const assignedStaff = dailyStaffByShift[shiftName] || [];
      const shortage = requirement.totalStaff - assignedStaff.length;

      if (shortage > 0) {
        violations.push({
          type: 'staffShortage',
          severity: 'error',
          description: `${date}の${shiftName}で${shortage}名の人員不足`,
          affectedDates: [date],
          suggestion: `${shiftName}に追加の配置を検討してください`,
        });
      }
    }
  }

  return violations;
}

/**
 * 連続勤務超過を検出
 * @param schedule スケジュール
 * @param staffList スタッフリスト
 * @returns 制約違反リスト
 */
export function checkConsecutiveWorkViolation(
  schedule: StaffSchedule[],
  staffList: Staff[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const DEFAULT_MAX_CONSECUTIVE = 5; // デフォルト連勤上限

  for (const staffSchedule of schedule) {
    const staff = staffList.find((s) => s.id === staffSchedule.staffId);
    if (!staff) continue;

    const maxConsecutive = staff.maxConsecutiveWorkDays ?? DEFAULT_MAX_CONSECUTIVE;
    const shifts = [...staffSchedule.monthlyShifts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let consecutiveDays = 0;
    let startDate = '';
    const violatingPeriods: { start: string; end: string }[] = [];

    for (let i = 0; i < shifts.length; i++) {
      const shift = shifts[i];
      const isWorkDay =
        shift.shiftType && shift.shiftType !== '休' && shift.shiftType !== '明け休み';

      if (isWorkDay) {
        if (consecutiveDays === 0) {
          startDate = shift.date;
        }
        consecutiveDays++;

        // 連勤超過を検出（境界値：ちょうど上限は違反にならない）
        if (consecutiveDays > maxConsecutive) {
          // 前日までの期間を記録（まだ記録していない場合）
          if (
            violatingPeriods.length === 0 ||
            violatingPeriods[violatingPeriods.length - 1].end !== shifts[i - 1]?.date
          ) {
            violatingPeriods.push({
              start: startDate,
              end: shift.date,
            });
          } else {
            // 継続中の違反期間を更新
            violatingPeriods[violatingPeriods.length - 1].end = shift.date;
          }
        }
      } else {
        consecutiveDays = 0;
      }
    }

    // 違反期間があれば報告
    for (const period of violatingPeriods) {
      violations.push({
        type: 'consecutiveWork',
        severity: 'warning',
        description: `${staff.name}さんが${period.start}から${period.end}まで${maxConsecutive}日を超える連勤`,
        affectedStaff: [staffSchedule.staffId],
        affectedDates: [period.start, period.end],
        suggestion: `連勤を${maxConsecutive}日以内に調整してください`,
      });
    }
  }

  return violations;
}

/**
 * 夜勤後の休息違反を検出
 * @param schedule スケジュール
 * @returns 制約違反リスト
 */
export function checkNightRestViolation(schedule: StaffSchedule[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const staffSchedule of schedule) {
    const shifts = [...staffSchedule.monthlyShifts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (let i = 0; i < shifts.length - 1; i++) {
      const currentShift = shifts[i];
      const nextShift = shifts[i + 1];

      // 夜勤かどうかをチェック（「夜勤」または「夜」を含むシフト）
      const isNightShift =
        currentShift.shiftType?.includes('夜勤') ||
        currentShift.shiftType?.includes('夜');

      if (isNightShift) {
        // 翌日が連続しているかチェック（DST対策: UTC日付で比較）
        const currentDate = new Date(currentShift.date + 'T00:00:00Z');
        const nextDate = new Date(nextShift.date + 'T00:00:00Z');
        const diffDays =
          (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          // 翌日が「休み」または「明け休み」でない場合は違反
          const nextShiftType = nextShift.shiftType || '';
          const isRest =
            nextShiftType === '休' ||
            nextShiftType.includes('明け') ||
            nextShiftType.includes('公休');

          if (!isRest) {
            violations.push({
              type: 'nightRestViolation',
              severity: 'warning',
              description: `${staffSchedule.staffName}さんの${currentShift.date}の夜勤後に休息がありません`,
              affectedStaff: [staffSchedule.staffId],
              affectedDates: [currentShift.date, nextShift.date],
              suggestion: `夜勤の翌日は「明け休み」または「休」を設定してください`,
            });
          }
        }
      }
    }
  }

  return violations;
}

/**
 * 資格不足を検出
 * @param schedule スケジュール
 * @param staffList スタッフリスト
 * @param requirements シフト要件
 * @returns 制約違反リスト
 */
export function checkQualificationMissing(
  schedule: StaffSchedule[],
  staffList: Staff[],
  requirements: ShiftRequirement
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const targetMonth = requirements.targetMonth;

  // 対象月の日数を取得
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 夜勤があるかどうかを判定
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
  const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

  // 各日の資格保有者をカウント
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${targetMonth}-${String(day).padStart(2, '0')}`;

    // 営業外の日はスキップ
    if (!isBusinessDay(date, hasNightShift)) {
      continue;
    }

    for (const [shiftName, requirement] of Object.entries(
      requirements.requirements
    )) {
      // 各資格要件をチェック
      for (const qualReq of requirement.requiredQualifications || []) {
        let qualifiedCount = 0;

        for (const staffSchedule of schedule) {
          const shift = staffSchedule.monthlyShifts.find(
            (s) => s.date === date
          );
          if (shift && shift.shiftType === shiftName) {
            const staff = staffList.find(
              (s) => s.id === staffSchedule.staffId
            );
            if (staff?.qualifications?.includes(qualReq.qualification)) {
              qualifiedCount++;
            }
          }
        }

        if (qualifiedCount < qualReq.count) {
          violations.push({
            type: 'qualificationMissing',
            severity: 'error',
            description: `${date}の${shiftName}で${qualReq.qualification}が${qualReq.count - qualifiedCount}名不足`,
            affectedDates: [date],
            suggestion: `${qualReq.qualification}保有者を追加配置してください`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * 休暇希望無視を検出
 * @param schedule スケジュール
 * @param leaveRequests 休暇希望
 * @returns 制約違反リスト
 */
export function checkLeaveRequestIgnored(
  schedule: StaffSchedule[],
  leaveRequests: LeaveRequest
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const [staffId, requests] of Object.entries(leaveRequests || {})) {
    const staffSchedule = schedule.find((s) => s.staffId === staffId);
    if (!staffSchedule) continue;

    for (const [date, leaveType] of Object.entries(requests || {})) {
      const shift = staffSchedule.monthlyShifts.find((s) => s.date === date);

      if (shift) {
        const shiftType = shift.shiftType || '';
        // 休暇希望日に勤務が入っている場合
        const isWorking =
          shiftType !== '休' &&
          shiftType !== '有給' &&
          shiftType !== '公休' &&
          !shiftType.includes('休');

        if (isWorking) {
          violations.push({
            type: 'leaveRequestIgnored',
            severity: 'warning',
            description: `${staffSchedule.staffName}さんの${date}の${leaveType}希望が反映されていません`,
            affectedStaff: [staffId],
            affectedDates: [date],
            suggestion: `${date}を${leaveType}に変更することを検討してください`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * 時間帯希望違反を検出
 * @param schedule スケジュール
 * @param staffList スタッフリスト
 * @returns 制約違反リスト
 */
export function checkTimeSlotPreferenceViolation(
  schedule: StaffSchedule[],
  staffList: Staff[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const staffSchedule of schedule) {
    const staff = staffList.find((s) => s.id === staffSchedule.staffId);
    if (!staff) continue;

    const preference = staff.timeSlotPreference;
    const staffName = staff.name;

    // 各日のシフトをチェック
    for (const shift of staffSchedule.monthlyShifts) {
      const shiftType = shift.shiftType || '';

      // 休みや明け休みは違反対象外
      if (shiftType === '休' || shiftType.includes('休') || shiftType === '') {
        continue;
      }

      // 日勤のみスタッフが日勤以外に配置されている場合
      if (preference === TimeSlotPreference.DayOnly) {
        const isDayShift = shiftType === '日勤' || shiftType.includes('日勤');
        if (!isDayShift) {
          violations.push({
            type: 'leaveRequestIgnored', // 既存タイプを流用（timeSlotPreferenceViolationがないため）
            severity: 'error',
            description: `${staffName}さん（日勤のみ希望）が${shift.date}に${shiftType}に配置されています`,
            affectedStaff: [staffSchedule.staffId],
            affectedDates: [shift.date],
            suggestion: `${staffName}さんは日勤のみに配置してください`,
          });
        }
      }

      // 夜勤のみスタッフが夜勤以外に配置されている場合
      if (preference === TimeSlotPreference.NightOnly) {
        const isNightShift = shiftType === '夜勤' || shiftType.includes('夜');
        if (!isNightShift) {
          violations.push({
            type: 'leaveRequestIgnored',
            severity: 'error',
            description: `${staffName}さん（夜勤のみ希望）が${shift.date}に${shiftType}に配置されています`,
            affectedStaff: [staffSchedule.staffId],
            affectedDates: [shift.date],
            suggestion: `${staffName}さんは夜勤のみに配置してください`,
          });
        }
      }
    }
  }

  return violations;
}
