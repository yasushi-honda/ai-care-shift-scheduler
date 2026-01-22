/**
 * Phase 56: スコア計算関数
 *
 * EvaluationServiceから抽出したスコア計算ロジック
 */

import {
  StaffSchedule,
  ShiftRequirement,
  ConstraintViolation,
  ConstraintLevel,
} from '../types';
import {
  getViolationLevel,
  LEVEL_DEDUCTIONS,
} from './constraintLevelMapping';
import { isBusinessDay } from './constraintCheckers';

/**
 * 総合スコアを計算
 *
 * Phase 53: 4段階レベル評価システム
 * - レベル1（絶対必須）違反: 即0点
 * - レベル2（運営必須）違反: -12点/件
 * - レベル3（努力目標）違反: -4点/件
 * - レベル4（推奨）: 減点なし
 *
 * @param violations 制約違反リスト
 * @returns 0-100のスコア
 */
export function calculateOverallScore(violations: ConstraintViolation[]): number {
  // 違反をレベル別にグループ化
  const violationsByLevel: Record<ConstraintLevel, ConstraintViolation[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
  };

  for (const violation of violations) {
    const level = getViolationLevel(violation);
    violationsByLevel[level].push(violation);
  }

  // Phase 53: デバッグログ
  console.log('📊 [Phase 53] レベル別違反件数:', {
    level1: violationsByLevel[1].length,
    level2: violationsByLevel[2].length,
    level3: violationsByLevel[3].length,
    level4: violationsByLevel[4].length,
    level1Types: violationsByLevel[1].map(v => v.type),
  });

  // レベル1（絶対必須）違反がある場合は即座に0点
  if (violationsByLevel[1].length > 0) {
    console.log('⚠️ [Phase 53] レベル1違反があるため0点:', violationsByLevel[1].map(v => v.type));
    return 0;
  }

  // レベル2-4の減点を計算
  let score = 100;

  // レベル2（運営必須）: 1件あたり12点減点
  score -= violationsByLevel[2].length * LEVEL_DEDUCTIONS[2];

  // レベル3（努力目標）: 1件あたり4点減点
  score -= violationsByLevel[3].length * LEVEL_DEDUCTIONS[3];

  // レベル4（推奨）: 減点なし（情報のみ）

  // スコアを0〜100の範囲に正規化
  return Math.max(0, Math.min(100, score));
}

/**
 * 人員充足率を計算
 *
 * @param schedule スケジュール
 * @param requirements シフト要件
 * @returns 0-100の充足率
 */
export function calculateFulfillmentRate(
  schedule: StaffSchedule[],
  requirements: ShiftRequirement
): number {
  const targetMonth = requirements.targetMonth;
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 夜勤があるかどうかを判定
  const shiftTypeNames = (requirements.timeSlots || []).map(t => t.name);
  const hasNightShift = shiftTypeNames.some(name => name.includes('夜'));

  let totalRequired = 0;
  let totalAssigned = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${targetMonth}-${String(day).padStart(2, '0')}`;

    // 営業外の日はスキップ
    if (!isBusinessDay(date, hasNightShift)) {
      continue;
    }

    for (const [shiftName, requirement] of Object.entries(
      requirements.requirements
    )) {
      totalRequired += requirement.totalStaff;

      // 実際の配置人数をカウント
      let assigned = 0;
      for (const staffSchedule of schedule) {
        const shift = staffSchedule.monthlyShifts.find(
          (s) => s.date === date
        );
        if (shift && shift.shiftType === shiftName) {
          assigned++;
        }
      }
      totalAssigned += Math.min(assigned, requirement.totalStaff);
    }
  }

  if (totalRequired === 0) return 100;
  return Math.round((totalAssigned / totalRequired) * 100);
}
