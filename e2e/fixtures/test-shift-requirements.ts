/**
 * E2Eテスト用シフト要件フィクスチャ
 *
 * Single Source of Truth: scripts/demoData.ts
 * デイサービス（夜勤なし）のシフト要件を提供
 */

import {
  getDemoShiftRequirement,
  getTargetMonth,
  type DemoShiftTime,
  type DemoDailyRequirement,
  type DemoShiftRequirement,
} from '../../scripts/demoData';

// E2Eテスト用型定義（demoDataと互換）
export type TimeSlot = DemoShiftTime;
export type DailyRequirement = DemoDailyRequirement;
export type TestShiftRequirement = DemoShiftRequirement;

/**
 * テスト用タイムスロット（3種類：夜勤なし）
 */
export const TEST_TIME_SLOTS: TimeSlot[] = getDemoShiftRequirement().timeSlots;

/**
 * テスト用日別要件
 */
export const TEST_DAILY_REQUIREMENTS: Record<string, DailyRequirement> =
  getDemoShiftRequirement().requirements;

/**
 * テスト用対象月を取得（翌月）
 */
export const getTestTargetMonth = getTargetMonth;

/**
 * テスト用シフト要件データ
 */
export function getTestShiftRequirement(targetMonth?: string): TestShiftRequirement {
  return getDemoShiftRequirement(targetMonth);
}
