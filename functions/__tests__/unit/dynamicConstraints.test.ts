/**
 * dynamicConstraints ユニットテスト
 *
 * テスト対象:
 * - buildDynamicLeaveConstraints: 休暇希望の構造化表示
 * - buildDynamicStaffingConstraints: 日別人員配置制約（leaveRequests連携）
 * - buildDynamicConsecutiveConstraints: 連続勤務制約
 */

import {
  buildDynamicLeaveConstraints,
  buildDynamicConsecutiveConstraints,
  buildDynamicStaffingConstraints,
} from '../../src/phased-generation';
import {
  Staff,
  ShiftRequirement,
  LeaveRequest,
  LeaveType,
  TimeSlotPreference,
  Role,
  Qualification,
} from '../../src/types';

// テスト用スタッフデータ
function createStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 'staff-1',
    name: '田中太郎',
    role: Role.CareWorker,
    qualifications: [Qualification.CertifiedCareWorker],
    weeklyWorkCount: { hope: 5, must: 4 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.Any,
    isNightShiftOnly: false,
    ...overrides,
  };
}

function createRequirements(overrides: Partial<ShiftRequirement> = {}): ShiftRequirement {
  return {
    targetMonth: '2026-02',
    daysToGenerate: 28,
    timeSlots: [{ name: '日勤', start: '09:00', end: '18:00', restHours: 1 }],
    requirements: {
      '日勤': {
        totalStaff: 4,
        requiredQualifications: [],
        requiredRoles: [],
      },
    },
    ...overrides,
  } as ShiftRequirement;
}

// ======================================================================
// buildDynamicLeaveConstraints
// ======================================================================
describe('buildDynamicLeaveConstraints', () => {
  const staffList = [
    createStaff({ id: 'staff-1', name: '田中太郎' }),
    createStaff({ id: 'staff-2', name: '佐藤花子' }),
  ];

  test('休暇希望がある場合、構造化テキストを返す', () => {
    const leaveRequests: LeaveRequest = {
      'staff-1': {
        '2026-02-05': LeaveType.Hope,
        '2026-02-12': LeaveType.Hope,
      },
      'staff-2': {
        '2026-02-20': LeaveType.PaidLeave,
      },
    };

    const result = buildDynamicLeaveConstraints(staffList, leaveRequests, '2026-02');

    expect(result).toContain('【休暇希望】');
    expect(result).toContain('田中太郎');
    expect(result).toContain('5日(希望休)');
    expect(result).toContain('12日(希望休)');
    expect(result).toContain('佐藤花子');
    expect(result).toContain('20日(有給休暇)');
    expect(result).toContain('restDaysに含めて');
  });

  test('休暇希望がない場合、空文字列を返す', () => {
    const result = buildDynamicLeaveConstraints(staffList, {}, '2026-02');
    expect(result).toBe('');
  });

  test('leaveRequestsがnullish的な場合、空文字列を返す', () => {
    const result = buildDynamicLeaveConstraints(staffList, {} as LeaveRequest, '2026-02');
    expect(result).toBe('');
  });

  test('対象月以外の休暇は含めない', () => {
    const leaveRequests: LeaveRequest = {
      'staff-1': {
        '2026-01-15': LeaveType.Hope, // 前月
        '2026-02-05': LeaveType.Hope, // 対象月
      },
    };

    const result = buildDynamicLeaveConstraints(staffList, leaveRequests, '2026-02');
    expect(result).toContain('5日(希望休)');
    expect(result).not.toContain('15日');
  });

  test('スタッフIDがstaffListに存在しない場合、IDをそのまま表示', () => {
    const leaveRequests: LeaveRequest = {
      'unknown-staff': {
        '2026-02-10': LeaveType.Training,
      },
    };

    const result = buildDynamicLeaveConstraints(staffList, leaveRequests, '2026-02');
    expect(result).toContain('unknown-staff');
    expect(result).toContain('10日(研修)');
  });
});

// ======================================================================
// buildDynamicConsecutiveConstraints
// ======================================================================
describe('buildDynamicConsecutiveConstraints', () => {
  test('推奨文言が「4〜5日」であること', () => {
    const staffList = [createStaff()];
    const result = buildDynamicConsecutiveConstraints(staffList);

    expect(result).toContain('4〜5日に抑えることを推奨');
    expect(result).not.toContain('3〜4日');
  });

  test('休日間隔のガイダンスが含まれること', () => {
    const staffList = [createStaff()];
    const result = buildDynamicConsecutiveConstraints(staffList);

    expect(result).toContain('5日以上間を空けないよう');
  });

  test('デフォルト5日の制限が表示されること', () => {
    const staffList = [createStaff()];
    const result = buildDynamicConsecutiveConstraints(staffList);

    expect(result).toContain('最大5日');
    expect(result).toContain('6日以上連続で勤務させると');
  });

  test('個別制限がある場合に表示されること', () => {
    const staffList = [
      createStaff({ name: '山田花子', maxConsecutiveWorkDays: 3 }),
      createStaff({ name: '鈴木一郎', maxConsecutiveWorkDays: 5 }),
    ];
    const result = buildDynamicConsecutiveConstraints(staffList);

    expect(result).toContain('山田花子');
    expect(result).toContain('最大3日');
    expect(result).not.toContain('鈴木一郎: **最大5日');
  });
});

// ======================================================================
// buildDynamicStaffingConstraints
// ======================================================================
describe('buildDynamicStaffingConstraints', () => {
  const staffList = [
    createStaff({ id: 'staff-1', name: '田中太郎', weeklyWorkCount: { hope: 5, must: 4 } }),
    createStaff({ id: 'staff-2', name: '佐藤花子', weeklyWorkCount: { hope: 5, must: 4 } }),
    createStaff({ id: 'staff-3', name: '山田次郎', weeklyWorkCount: { hope: 4, must: 3 } }),
    createStaff({ id: 'staff-4', name: '鈴木三郎', weeklyWorkCount: { hope: 5, must: 4 } }),
    createStaff({ id: 'staff-5', name: '高橋四郎', weeklyWorkCount: { hope: 5, must: 4 } }),
  ];
  const requirements = createRequirements();

  test('leaveRequests渡しなしでもエラーにならない', () => {
    const result = buildDynamicStaffingConstraints(staffList, requirements, 28);
    expect(result).toContain('日別人員配置制約');
    expect(result).toContain('必ず4名');
  });

  test('leaveRequests渡しありでリスク日が変わること', () => {
    // リスク日を生むため、ある営業日に複数スタッフの休暇希望を設定
    const leaveRequests: LeaveRequest = {
      'staff-1': { '2026-02-02': LeaveType.Hope },
      'staff-2': { '2026-02-02': LeaveType.Hope },
      'staff-3': { '2026-02-02': LeaveType.Hope },
    };

    const resultWithLeave = buildDynamicStaffingConstraints(staffList, requirements, 28, leaveRequests);

    // 休暇ありの場合、2日は勤務可能2名（必要4名）なのでリスク日になるはず
    expect(resultWithLeave).toContain('人員不足リスク日');
  });

  test('スタッフ別休日予算テーブルが含まれること', () => {
    const result = buildDynamicStaffingConstraints(staffList, requirements, 28);
    expect(result).toContain('スタッフ別休日予算');
    expect(result).toContain('田中太郎');
    expect(result).toContain('週希望');
    expect(result).toContain('月間勤務');
    expect(result).toContain('休日合計');
    expect(result).toContain('うち希望休');
  });

  test('休暇希望がある場合にうち希望休の列に反映されること', () => {
    const leaveRequests: LeaveRequest = {
      'staff-1': {
        '2026-02-05': LeaveType.Hope,
        '2026-02-12': LeaveType.Hope,
      },
    };

    const result = buildDynamicStaffingConstraints(staffList, requirements, 28, leaveRequests);
    // 田中太郎の行にうち希望休2日が含まれるか
    expect(result).toContain('| 田中太郎 | 5回 | 20日 | 8日 | 2日 |');
  });
});
