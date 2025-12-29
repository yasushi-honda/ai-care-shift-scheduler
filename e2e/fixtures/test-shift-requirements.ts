/**
 * E2Eテスト用シフト要件フィクスチャ
 *
 * デイサービス（夜勤なし）のシフト要件を定義
 */

export interface TimeSlot {
  name: string;
  start: string;
  end: string;
  restHours: number;
}

export interface DailyRequirement {
  totalStaff: number;
  requiredRoles: string[];
  requiredQualifications: string[];
}

export interface TestShiftRequirement {
  targetMonth: string;
  timeSlots: TimeSlot[];
  requirements: Record<string, DailyRequirement>;
}

/**
 * テスト用タイムスロット（3種類：夜勤なし）
 */
export const TEST_TIME_SLOTS: TimeSlot[] = [
  { name: '早番', start: '08:00', end: '17:00', restHours: 1 },
  { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
  { name: '遅番', start: '10:00', end: '19:00', restHours: 1 },
];

/**
 * テスト用日別要件
 */
export const TEST_DAILY_REQUIREMENTS: Record<string, DailyRequirement> = {
  早番: {
    totalStaff: 2,
    requiredRoles: [],
    requiredQualifications: [],
  },
  日勤: {
    totalStaff: 2,
    requiredRoles: [],
    requiredQualifications: ['看護師'],
  },
  遅番: {
    totalStaff: 1,
    requiredRoles: [],
    requiredQualifications: [],
  },
};

/**
 * テスト用対象月を取得（翌月）
 */
export function getTestTargetMonth(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * テスト用シフト要件データ
 */
export function getTestShiftRequirement(): TestShiftRequirement {
  return {
    targetMonth: getTestTargetMonth(),
    timeSlots: TEST_TIME_SLOTS,
    requirements: TEST_DAILY_REQUIREMENTS,
  };
}
