/**
 * Phase間データバリデーションモジュール
 *
 * Phase 1（骨子生成）→ Phase 2（詳細生成）のデータ受け渡しを検証し、
 * BUG-023のようなデータ欠落を防止する。
 *
 * @see .kiro/steering/phased-generation-contract.md
 */

import type { ScheduleSkeleton, StaffScheduleSkeleton } from './types';
import type { Staff } from './types';

/**
 * バリデーションエラー
 */
export interface ValidationError {
  type: 'missing_field' | 'invalid_data' | 'constraint_violation';
  staffId?: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Phase 1出力（骨子）のバリデーション
 *
 * 検証項目:
 * 1. 全スタッフが含まれているか
 * 2. 必須フィールドが存在するか
 * 3. 夜勤後の休息日が正しく設定されているか
 */
export function validateSkeletonOutput(
  skeleton: ScheduleSkeleton,
  staffList: Staff[],
  hasNightShift: boolean
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. 全スタッフが含まれているかチェック
  const skeletonStaffIds = new Set(skeleton.staffSchedules.map(s => s.staffId));
  for (const staff of staffList) {
    if (!skeletonStaffIds.has(staff.id)) {
      errors.push({
        type: 'missing_field',
        staffId: staff.id,
        field: 'staffSchedule',
        message: `スタッフ ${staff.name} (${staff.id}) の骨子データがありません`,
        severity: 'error',
      });
    }
  }

  // 2. 各スタッフの必須フィールドをチェック
  for (const staffSkel of skeleton.staffSchedules) {
    // restDays チェック
    if (!Array.isArray(staffSkel.restDays)) {
      errors.push({
        type: 'missing_field',
        staffId: staffSkel.staffId,
        field: 'restDays',
        message: `${staffSkel.staffName} の restDays が配列ではありません`,
        severity: 'error',
      });
    }

    // 夜勤がある施設の場合のみ追加チェック
    if (hasNightShift) {
      // nightShiftDays チェック
      if (!Array.isArray(staffSkel.nightShiftDays)) {
        errors.push({
          type: 'missing_field',
          staffId: staffSkel.staffId,
          field: 'nightShiftDays',
          message: `${staffSkel.staffName} の nightShiftDays が配列ではありません`,
          severity: 'error',
        });
      }

      // nightShiftFollowupDays チェック
      if (!Array.isArray(staffSkel.nightShiftFollowupDays)) {
        errors.push({
          type: 'missing_field',
          staffId: staffSkel.staffId,
          field: 'nightShiftFollowupDays',
          message: `${staffSkel.staffName} の nightShiftFollowupDays が配列ではありません`,
          severity: 'error',
        });
      }

      // 3. 夜勤後休息の整合性チェック（BUG-023防止）
      if (Array.isArray(staffSkel.nightShiftDays) && Array.isArray(staffSkel.nightShiftFollowupDays)) {
        validateNightShiftFollowup(staffSkel, errors, warnings);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 夜勤後休息日の整合性検証
 *
 * 夜勤日Xに対して、X+1（明け休み）とX+2（公休）が
 * nightShiftFollowupDaysに含まれているかチェック
 */
function validateNightShiftFollowup(
  staffSkel: StaffScheduleSkeleton,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  const followupSet = new Set(staffSkel.nightShiftFollowupDays);

  for (const nightDay of staffSkel.nightShiftDays) {
    const nextDay = nightDay + 1;
    const dayAfterNext = nightDay + 2;

    // X+1（明け休み）チェック
    if (!followupSet.has(nextDay)) {
      errors.push({
        type: 'constraint_violation',
        staffId: staffSkel.staffId,
        field: 'nightShiftFollowupDays',
        message: `${staffSkel.staffName}: 夜勤${nightDay}日の翌日(${nextDay}日)が明け休みに設定されていません`,
        severity: 'error',
      });
    }

    // X+2（公休）チェック - 月末を超える場合はスキップ
    if (dayAfterNext <= 31 && !followupSet.has(dayAfterNext)) {
      warnings.push({
        type: 'constraint_violation',
        staffId: staffSkel.staffId,
        field: 'nightShiftFollowupDays',
        message: `${staffSkel.staffName}: 夜勤${nightDay}日の翌々日(${dayAfterNext}日)が公休に設定されていません`,
        severity: 'warning',
      });
    }
  }
}

/**
 * Phase 2入力データの検証
 *
 * Phase 2に渡されるデータが完全であることを確認
 */
export function validatePhase2Input(
  skeleton: ScheduleSkeleton,
  staffBatch: Staff[],
  hasNightShift: boolean
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  for (const staff of staffBatch) {
    const skel = skeleton.staffSchedules.find(s => s.staffId === staff.id);

    if (!skel) {
      errors.push({
        type: 'missing_field',
        staffId: staff.id,
        field: 'skeleton',
        message: `Phase 2: ${staff.name} の骨子データが見つかりません`,
        severity: 'error',
      });
      continue;
    }

    // 夜勤施設で nightShiftFollowupDays が欠落していないか（BUG-023防止）
    if (hasNightShift) {
      if (!skel.nightShiftFollowupDays || skel.nightShiftFollowupDays.length === 0) {
        if (skel.nightShiftDays && skel.nightShiftDays.length > 0) {
          errors.push({
            type: 'missing_field',
            staffId: staff.id,
            field: 'nightShiftFollowupDays',
            message: `Phase 2: ${staff.name} に夜勤(${skel.nightShiftDays.join(',')})があるが明け休み日がありません`,
            severity: 'error',
          });
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * バリデーション結果をログ出力
 */
export function logValidationResult(
  phase: string,
  result: ValidationResult
): void {
  if (result.isValid && result.warnings.length === 0) {
    console.log(`✅ ${phase} バリデーション: OK`);
    return;
  }

  if (result.errors.length > 0) {
    console.error(`❌ ${phase} バリデーションエラー (${result.errors.length}件):`);
    for (const error of result.errors) {
      console.error(`   - [${error.type}] ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.warn(`⚠️ ${phase} バリデーション警告 (${result.warnings.length}件):`);
    for (const warning of result.warnings) {
      console.warn(`   - [${warning.type}] ${warning.message}`);
    }
  }
}

/**
 * 骨子データの自動修正（可能な場合）
 *
 * nightShiftFollowupDaysが欠落している場合、
 * nightShiftDaysから自動生成
 */
export function autoFixSkeleton(
  skeleton: ScheduleSkeleton,
  daysInMonth: number
): ScheduleSkeleton {
  const fixedSchedules = skeleton.staffSchedules.map(staff => {
    // nightShiftFollowupDaysが空で、nightShiftDaysがある場合
    if (
      (!staff.nightShiftFollowupDays || staff.nightShiftFollowupDays.length === 0) &&
      staff.nightShiftDays &&
      staff.nightShiftDays.length > 0
    ) {
      const followupDays: number[] = [];
      for (const nightDay of staff.nightShiftDays) {
        const nextDay = nightDay + 1;
        const dayAfterNext = nightDay + 2;
        if (nextDay <= daysInMonth) followupDays.push(nextDay);
        if (dayAfterNext <= daysInMonth) followupDays.push(dayAfterNext);
      }
      // 重複排除してソート
      const uniqueFollowupDays = [...new Set(followupDays)].sort((a, b) => a - b);

      console.log(`🔧 自動修正: ${staff.staffName} の nightShiftFollowupDays を生成 [${uniqueFollowupDays.join(',')}]`);

      return {
        ...staff,
        nightShiftFollowupDays: uniqueFollowupDays,
      };
    }
    return staff;
  });

  return {
    staffSchedules: fixedSchedules,
  };
}
