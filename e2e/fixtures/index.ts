/**
 * E2Eテストフィクスチャ エントリポイント
 *
 * 全フィクスチャデータをエクスポート
 */

// スタッフ
export {
  TEST_STAFF,
  TEST_FACILITY_ID,
  getStaffByName,
  getStaffById,
} from './test-staff';
export type { TestStaff } from './test-staff';

// 施設
export {
  TEST_FACILITY,
  TEST_FACILITY_NAME,
} from './test-facility';
export type { TestFacility } from './test-facility';

// シフト要件
export {
  TEST_TIME_SLOTS,
  TEST_DAILY_REQUIREMENTS,
  getTestTargetMonth,
  getTestShiftRequirement,
} from './test-shift-requirements';
export type {
  TimeSlot,
  DailyRequirement,
  TestShiftRequirement,
} from './test-shift-requirements';
