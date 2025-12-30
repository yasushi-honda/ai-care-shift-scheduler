/**
 * テストデータファクトリ
 *
 * 各テストファイルで重複していたテストデータ生成を共通化
 */

import type { Staff, ScheduleSkeleton, StaffScheduleSkeleton } from '../../src/types';
import { Role, Qualification, TimeSlotPreference } from '../../src/types';

/**
 * Staffテストデータ生成
 */
export function createStaff(overrides?: Partial<Staff>): Staff {
  return {
    id: 'staff-001',
    name: 'テスト太郎',
    role: Role.CareWorker,
    qualifications: [Qualification.CertifiedCareWorker],
    weeklyWorkCount: { hope: 5, must: 4 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.Any,
    isNightShiftOnly: false,
    ...overrides,
  };
}

/**
 * 複数スタッフ生成
 */
export function createStaffList(count: number): Staff[] {
  const roles = [Role.CareWorker, Role.Nurse, Role.CareManager];
  const qualifications = [
    [Qualification.CertifiedCareWorker],
    [Qualification.CertifiedCareWorker, Qualification.DriversLicense],
    [Qualification.RegisteredNurse],
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `staff-${String(i + 1).padStart(3, '0')}`,
    name: `スタッフ${i + 1}`,
    role: roles[i % roles.length],
    qualifications: qualifications[i % qualifications.length],
    weeklyWorkCount: { hope: 5, must: 4 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.Any,
    isNightShiftOnly: i % 5 === 0, // 20%が夜勤専従
  }));
}

/**
 * StaffScheduleSkeleton テストデータ生成
 */
export function createStaffSkeleton(overrides?: Partial<StaffScheduleSkeleton>): StaffScheduleSkeleton {
  return {
    staffId: 'staff-001',
    staffName: 'テスト太郎',
    restDays: [6, 7, 13, 14, 20, 21, 27, 28],
    nightShiftDays: [3, 10],
    nightShiftFollowupDays: [4, 5, 11, 12], // 夜勤後の明け休み+公休
    ...overrides,
  };
}

/**
 * ScheduleSkeleton テストデータ生成
 */
export function createSkeleton(staffSchedules: StaffScheduleSkeleton[]): ScheduleSkeleton {
  return {
    staffSchedules,
  };
}

/**
 * 現実的なScheduleSkeleton生成（大規模テスト用）
 */
export function createRealisticSkeleton(
  staffList: Staff[],
  hasNightShift: boolean,
  daysInMonth: number = 30
): ScheduleSkeleton {
  const staffSchedules: StaffScheduleSkeleton[] = staffList.map((staff, i) => {
    const nightShiftDays: number[] = [];
    const nightShiftFollowupDays: number[] = [];

    if (hasNightShift) {
      const nightCount = staff.isNightShiftOnly ? 6 : 2;
      for (let j = 0; j < nightCount; j++) {
        const day = 3 + j * 5 + (i % 3);
        if (day <= daysInMonth - 2) { // 月末2日前までに制限
          nightShiftDays.push(day);
          if (day + 1 <= daysInMonth) nightShiftFollowupDays.push(day + 1);
          if (day + 2 <= daysInMonth) nightShiftFollowupDays.push(day + 2);
        }
      }
    }

    const restDays: number[] = [];
    for (let week = 0; week < 4; week++) {
      const baseDay = week * 7 + 6 + (i % 2);
      if (baseDay <= daysInMonth) restDays.push(baseDay);
      if (baseDay + 1 <= daysInMonth) restDays.push(baseDay + 1);
    }

    return {
      staffId: staff.id,
      staffName: staff.name,
      restDays,
      nightShiftDays,
      nightShiftFollowupDays,
    };
  });

  return { staffSchedules };
}

/**
 * AIレスポンス テストデータ生成
 */
export function createMockAIResponse(overrides?: {
  text?: string;
  finishReason?: string;
  thoughtsTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}) {
  const defaultText = 'Valid JSON response with sufficient length to avoid short response warning. ' +
    'This text should be at least 100 characters long.';

  return {
    text: overrides?.text ?? defaultText,
    candidates: [{ finishReason: overrides?.finishReason ?? 'STOP' }],
    usageMetadata: {
      promptTokenCount: 1000,
      thoughtsTokenCount: overrides?.thoughtsTokenCount ?? 5000,
      candidatesTokenCount: overrides?.candidatesTokenCount ?? 10000,
      totalTokenCount: overrides?.totalTokenCount ?? 16000,
    },
  };
}

/**
 * BUG-022パターンのAIレスポンス（思考トークン過剰消費）
 */
export function createBug022Response() {
  return {
    text: '',
    candidates: [{ finishReason: 'STOP' }],
    usageMetadata: {
      promptTokenCount: 12000,
      thoughtsTokenCount: 65533,
      candidatesTokenCount: 2,
      totalTokenCount: 65536,
    },
  };
}

/**
 * BUG-023パターンのSkeleton（nightShiftFollowupDays欠落）
 */
export function createBug023Skeleton(staffList: Staff[]): ScheduleSkeleton {
  return {
    staffSchedules: staffList.map(staff => ({
      staffId: staff.id,
      staffName: staff.name,
      restDays: [6, 7, 13, 14, 20, 21, 27, 28],
      nightShiftDays: staff.isNightShiftOnly ? [3, 8, 13, 18, 23, 28] : [5, 15],
      nightShiftFollowupDays: [], // BUG-023: 空！
    })),
  };
}
