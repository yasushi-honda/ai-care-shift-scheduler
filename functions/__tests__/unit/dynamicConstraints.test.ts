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
  buildPhase2StaffInfo,
} from '../../src/phased-generation';
import {
  Staff,
  ShiftRequirement,
  LeaveRequest,
  LeaveType,
  TimeSlotPreference,
  Role,
  Qualification,
  ScheduleSkeleton,
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

// ======================================================================
// buildPhase2StaffInfo
// ======================================================================
describe('buildPhase2StaffInfo', () => {
  function createSkeleton(schedules: ScheduleSkeleton['staffSchedules']): ScheduleSkeleton {
    return { staffSchedules: schedules };
  }

  test('夜勤なし施設で構造化テキストが出力される', () => {
    const staff = [createStaff({ id: 's1', name: '田中太郎', qualifications: [Qualification.CertifiedCareWorker] })];
    const skeleton = createSkeleton([{
      staffId: 's1', staffName: '田中太郎',
      restDays: [1, 5, 8, 12, 15], nightShiftDays: [], nightShiftFollowupDays: [],
    }]);

    const result = buildPhase2StaffInfo(staff, skeleton, 31, false);

    expect(result).toContain('田中太郎(ID:s1)');
    expect(result).toContain('資格=介護福祉士');
    expect(result).toContain('1日, 5日, 8日, 12日, 15日');
    expect(result).toContain('（計5日）');
    expect(result).toContain('勤務26日');
    // CSV形式でないこと
    expect(result).not.toContain('休日=1,5,8,12,15');
  });

  test('夜勤あり施設で夜勤・明け休み情報が含まれる', () => {
    const staff = [createStaff({ id: 's1', name: '田中太郎' })];
    const skeleton = createSkeleton([{
      staffId: 's1', staffName: '田中太郎',
      restDays: [1, 8], nightShiftDays: [3, 10], nightShiftFollowupDays: [4, 5, 11, 12],
    }]);

    const result = buildPhase2StaffInfo(staff, skeleton, 31, true);

    expect(result).toContain('休日: 1日, 8日（計2日）');
    expect(result).toContain('夜勤: 3日, 10日（計2日）');
    expect(result).toContain('明け休み: 4日, 5日, 11日, 12日（計4日）');
    // 勤務日 = 31 - 2 - 2 - 4 = 23
    expect(result).toContain('勤務23日');
  });

  test('休日なしスタッフで「なし」表記', () => {
    const staff = [createStaff({ id: 's1', name: '佐藤花子' })];
    const skeleton = createSkeleton([{
      staffId: 's1', staffName: '佐藤花子',
      restDays: [], nightShiftDays: [], nightShiftFollowupDays: [],
    }]);

    const result = buildPhase2StaffInfo(staff, skeleton, 28, false);

    expect(result).toContain('休日: なし');
    expect(result).toContain('勤務28日');
  });

  test('複数スタッフで全員分出力される', () => {
    const staff = [
      createStaff({ id: 's1', name: '田中太郎' }),
      createStaff({ id: 's2', name: '佐藤花子' }),
      createStaff({ id: 's3', name: '山田次郎' }),
    ];
    const skeleton = createSkeleton([
      { staffId: 's1', staffName: '田中太郎', restDays: [1, 8], nightShiftDays: [], nightShiftFollowupDays: [] },
      { staffId: 's2', staffName: '佐藤花子', restDays: [2, 9], nightShiftDays: [], nightShiftFollowupDays: [] },
      { staffId: 's3', staffName: '山田次郎', restDays: [3, 10], nightShiftDays: [], nightShiftFollowupDays: [] },
    ]);

    const result = buildPhase2StaffInfo(staff, skeleton, 30, false);

    expect(result).toContain('田中太郎(ID:s1)');
    expect(result).toContain('佐藤花子(ID:s2)');
    expect(result).toContain('山田次郎(ID:s3)');
    // 各スタッフが改行で区切られている
    const lines = result.split('\n').filter(l => l.startsWith('- '));
    expect(lines).toHaveLength(3);
  });

  test('骨子にスタッフが見つからない場合のフォールバック', () => {
    const staff = [createStaff({ id: 's1', name: '田中太郎', qualifications: [] })];
    const skeleton = createSkeleton([]); // 骨子にスタッフなし

    const result = buildPhase2StaffInfo(staff, skeleton, 28, false);

    expect(result).toContain('田中太郎(ID:s1)');
    expect(result).toContain('資格=なし');
    expect(result).toContain('休日: なし');
    expect(result).toContain('勤務28日');
  });
});
