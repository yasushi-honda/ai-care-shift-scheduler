/**
 * E2Eテスト用スタッフフィクスチャ
 *
 * Single Source of Truth: scripts/demoData.ts
 * デモデータと同じ構造でテスト用スタッフデータを提供
 */

import {
  demoStaffs,
  DEMO_FACILITY_ID as SEED_DEMO_FACILITY_ID,
  getFullTimeStaffs,
  getPartTimeStaffs,
  type DemoStaff,
} from '../../scripts/demoData';

// E2Eテスト用に施設IDを再エクスポート
export const TEST_FACILITY_ID = SEED_DEMO_FACILITY_ID;

// E2Eテスト用型定義（DemoStaffと互換）
export type TestStaff = DemoStaff;

/**
 * テスト用スタッフデータ（12名）
 * デイサービス（通所介護）の実態に即した構成
 *
 * Source: scripts/demoData.ts
 */
export const TEST_STAFF: TestStaff[] = demoStaffs;

/**
 * 常勤スタッフ（8名）
 */
export const TEST_FULL_TIME_STAFF: TestStaff[] = getFullTimeStaffs();

/**
 * パートスタッフ（4名）
 */
export const TEST_PART_TIME_STAFF: TestStaff[] = getPartTimeStaffs();

/**
 * スタッフ名からスタッフデータを取得
 */
export function getStaffByName(name: string): TestStaff | undefined {
  return TEST_STAFF.find((staff) => staff.name === name);
}

/**
 * スタッフIDからスタッフデータを取得
 */
export function getStaffById(staffId: string): TestStaff | undefined {
  return TEST_STAFF.find((staff) => staff.staffId === staffId);
}
