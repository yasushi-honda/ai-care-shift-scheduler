/**
 * E2Eテスト用スタッフフィクスチャ
 *
 * seedDemoData.tsと同じ構造でテスト用スタッフデータを定義
 * Emulator環境でのテストに使用
 */

export const TEST_FACILITY_ID = 'test-facility-001';

export interface TestStaff {
  staffId: string;
  name: string;
  position: string;
  certifications: string[];
  nightShiftOnly: boolean;
  maxConsecutiveDays: number;
  weeklyWorkCount: { hope: number; must: number };
  availableWeekdays: number[];
  unavailableDates: string[];
  timeSlotPreference: string;
  facilityId: string;
}

/**
 * テスト用スタッフデータ（8名）
 * デイサービス（通所介護）の実態に即した構成
 */
export const TEST_STAFF: TestStaff[] = [
  {
    staffId: 'staff-tanaka',
    name: '田中太郎',
    position: '管理者',
    certifications: ['介護福祉士', '生活相談員'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: '日勤のみ',
    facilityId: TEST_FACILITY_ID,
  },
  {
    staffId: 'staff-sato',
    name: '佐藤花子',
    position: '看護職員',
    certifications: ['看護師'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: TEST_FACILITY_ID,
  },
  {
    staffId: 'staff-suzuki',
    name: '鈴木美咲',
    position: '看護職員',
    certifications: ['看護師'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 4, must: 3 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: TEST_FACILITY_ID,
  },
  {
    staffId: 'staff-takahashi',
    name: '高橋健太',
    position: '介護職員',
    certifications: ['介護福祉士'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: TEST_FACILITY_ID,
  },
  {
    staffId: 'staff-ito',
    name: '伊藤真理',
    position: '介護職員',
    certifications: ['介護福祉士'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: TEST_FACILITY_ID,
  },
  {
    staffId: 'staff-watanabe',
    name: '渡辺翔太',
    position: '介護職員',
    certifications: ['介護職員初任者研修'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: TEST_FACILITY_ID,
  },
  {
    staffId: 'staff-yamamoto',
    name: '山本さくら',
    position: '介護職員',
    certifications: ['介護職員初任者研修'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 4, must: 3 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: TEST_FACILITY_ID,
  },
  {
    staffId: 'staff-kondo',
    name: '近藤理恵',
    position: '機能訓練指導員',
    certifications: ['理学療法士'],
    nightShiftOnly: false,
    maxConsecutiveDays: 5,
    weeklyWorkCount: { hope: 5, must: 4 },
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: 'いつでも可',
    facilityId: TEST_FACILITY_ID,
  },
];

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
