/**
 * テストフィクスチャ: 標準テストデータ
 * 統合テスト・E2Eテストで使用する一貫したテストデータ
 */

import {
  Staff,
  ShiftRequirement,
  LeaveRequest,
  StaffSchedule,
  Role,
  Qualification,
  TimeSlotPreference,
  LeaveType,
} from '../../src/types';

/**
 * 5名の標準スタッフリスト
 * 多様なスキル、資格、制約を持つスタッフ構成
 */
export const STANDARD_STAFF_LIST: Staff[] = [
  {
    id: 'test-staff-001',
    name: 'テスト太郎',
    role: Role.CareWorker,
    qualifications: [Qualification.CertifiedCareWorker, Qualification.DriversLicense],
    weeklyWorkCount: { hope: 5, must: 4 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.Any,
    isNightShiftOnly: false,
  },
  {
    id: 'test-staff-002',
    name: 'テスト花子',
    role: Role.Nurse,
    qualifications: [Qualification.RegisteredNurse],
    weeklyWorkCount: { hope: 5, must: 5 },
    maxConsecutiveWorkDays: 6,
    availableWeekdays: [1, 2, 3, 4, 5],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.DayOnly,
    isNightShiftOnly: false,
  },
  {
    id: 'test-staff-003',
    name: 'テスト次郎',
    role: Role.CareWorker,
    qualifications: [Qualification.CertifiedCareWorker],
    weeklyWorkCount: { hope: 4, must: 3 },
    maxConsecutiveWorkDays: 4,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.NightOnly,
    isNightShiftOnly: true,
  },
  {
    id: 'test-staff-004',
    name: 'テスト三郎',
    role: Role.CareWorker,
    qualifications: [Qualification.DriversLicense],
    weeklyWorkCount: { hope: 5, must: 4 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.Any,
    isNightShiftOnly: false,
  },
  {
    id: 'test-staff-005',
    name: 'テスト四郎',
    role: Role.CareManager,
    qualifications: [Qualification.CertifiedCareWorker, Qualification.DriversLicense],
    weeklyWorkCount: { hope: 5, must: 5 },
    maxConsecutiveWorkDays: 6,
    availableWeekdays: [1, 2, 3, 4, 5],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.DayOnly,
    isNightShiftOnly: false,
  },
];

/**
 * 標準シフト要件（2025年11月）
 * 4つの時間帯（早番、日勤、遅番、夜勤）の標準体制
 */
export const STANDARD_REQUIREMENTS: ShiftRequirement = {
  targetMonth: '2025-11',
  timeSlots: [
    { name: '早番', start: '07:00', end: '16:00', restHours: 1 },
    { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
    { name: '遅番', start: '11:00', end: '20:00', restHours: 1 },
    { name: '夜勤', start: '17:00', end: '09:00', restHours: 2 },
  ],
  requirements: {
    早番: {
      totalStaff: 2,
      requiredQualifications: [{ qualification: Qualification.DriversLicense, count: 1 }],
      requiredRoles: [],
    },
    日勤: {
      totalStaff: 3,
      requiredQualifications: [],
      requiredRoles: [{ role: Role.Nurse, count: 1 }],
    },
    遅番: {
      totalStaff: 2,
      requiredQualifications: [{ qualification: Qualification.DriversLicense, count: 1 }],
      requiredRoles: [],
    },
    夜勤: {
      totalStaff: 1,
      requiredQualifications: [],
      requiredRoles: [{ role: Role.CareWorker, count: 1 }],
    },
  },
};

/**
 * サンプル休暇申請データ
 * テスト太郎: 11/10に有給休暇
 * テスト花子: 11/15に希望休
 */
export const STANDARD_LEAVE_REQUESTS: LeaveRequest = {
  'test-staff-001': {
    '2025-11-10': LeaveType.PaidLeave,
  },
  'test-staff-002': {
    '2025-11-15': LeaveType.Hope,
  },
};

/**
 * 20名のスタッフリスト（パフォーマンステスト用）
 */
export const LARGE_STAFF_LIST: Staff[] = Array.from({ length: 20 }, (_, i) => ({
  id: `test-staff-${String(i + 1).padStart(3, '0')}`,
  name: `テストスタッフ${i + 1}`,
  role: i % 5 === 0 ? Role.Nurse : Role.CareWorker,
  qualifications:
    i % 3 === 0
      ? [Qualification.CertifiedCareWorker, Qualification.DriversLicense]
      : [Qualification.DriversLicense],
  weeklyWorkCount: { hope: 5, must: 4 },
  maxConsecutiveWorkDays: 5,
  availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
  unavailableDates: [],
  timeSlotPreference: i % 4 === 0 ? TimeSlotPreference.NightOnly : TimeSlotPreference.Any,
  isNightShiftOnly: i % 4 === 0,
}));

/**
 * 50名のスタッフリスト（パフォーマンステスト用）
 */
export const EXTRA_LARGE_STAFF_LIST: Staff[] = Array.from({ length: 50 }, (_, i) => ({
  id: `test-staff-${String(i + 1).padStart(3, '0')}`,
  name: `テストスタッフ${i + 1}`,
  role: i % 5 === 0 ? Role.Nurse : Role.CareWorker,
  qualifications:
    i % 3 === 0
      ? [Qualification.CertifiedCareWorker, Qualification.DriversLicense]
      : [Qualification.DriversLicense],
  weeklyWorkCount: { hope: 5, must: 4 },
  maxConsecutiveWorkDays: 5,
  availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
  unavailableDates: [],
  timeSlotPreference: i % 4 === 0 ? TimeSlotPreference.NightOnly : TimeSlotPreference.Any,
  isNightShiftOnly: i % 4 === 0,
}));

/**
 * モックVertex AIレスポンス
 * CI/CD環境（SKIP_AI_TESTS=true）で使用
 */
export const MOCK_VERTEX_AI_RESPONSE = {
  schedule: [
    {
      staffId: 'test-staff-001',
      staffName: 'テスト太郎',
      monthlyShifts: Array.from({ length: 30 }, (_, i) => ({
        date: `2025-11-${String(i + 1).padStart(2, '0')}`,
        shiftType: i % 5 === 0 ? '休' : i % 3 === 0 ? '早番' : i % 3 === 1 ? '日勤' : '遅番',
      })),
    },
    {
      staffId: 'test-staff-002',
      staffName: 'テスト花子',
      monthlyShifts: Array.from({ length: 30 }, (_, i) => ({
        date: `2025-11-${String(i + 1).padStart(2, '0')}`,
        shiftType: i % 4 === 0 ? '休' : '日勤',
      })),
    },
    {
      staffId: 'test-staff-003',
      staffName: 'テスト次郎',
      monthlyShifts: Array.from({ length: 30 }, (_, i) => ({
        date: `2025-11-${String(i + 1).padStart(2, '0')}`,
        shiftType: i % 4 === 0 ? '休' : '夜勤',
      })),
    },
    {
      staffId: 'test-staff-004',
      staffName: 'テスト三郎',
      monthlyShifts: Array.from({ length: 30 }, (_, i) => ({
        date: `2025-11-${String(i + 1).padStart(2, '0')}`,
        shiftType: i % 5 === 0 ? '休' : i % 2 === 0 ? '早番' : '遅番',
      })),
    },
    {
      staffId: 'test-staff-005',
      staffName: 'テスト四郎',
      monthlyShifts: Array.from({ length: 30 }, (_, i) => ({
        date: `2025-11-${String(i + 1).padStart(2, '0')}`,
        shiftType: i % 4 === 0 ? '休' : '日勤',
      })),
    },
  ] as StaffSchedule[],
};

/**
 * バリデーションテスト用の不正データ
 */
export const INVALID_TEST_DATA = {
  emptyStaffList: [],
  undefinedStaffList: undefined,
  undefinedRequirements: undefined,
  missingTargetMonth: {
    timeSlots: STANDARD_REQUIREMENTS.timeSlots,
    requirements: STANDARD_REQUIREMENTS.requirements,
  },
  oversizedStaffList: Array.from({ length: 201 }, (_, i) => ({
    ...STANDARD_STAFF_LIST[0],
    id: `oversize-staff-${i}`,
  })),
};
