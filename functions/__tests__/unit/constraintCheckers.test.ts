/**
 * constraintCheckers.ts ユニットテスト
 *
 * テスト対象:
 * - isBusinessDay: 営業日判定
 * - checkStaffShortage: 人員不足チェック
 * - checkConsecutiveWorkViolation: 連続勤務超過チェック
 * - checkNightRestViolation: 夜勤後休息違反チェック
 * - checkQualificationMissing: 資格不足チェック
 * - checkLeaveRequestIgnored: 休暇希望無視チェック
 * - checkTimeSlotPreferenceViolation: 時間帯希望違反チェック
 */

import {
  isBusinessDay,
  checkStaffShortage,
  checkConsecutiveWorkViolation,
  checkNightRestViolation,
  checkQualificationMissing,
  checkRoleMissing,
  checkLeaveRequestIgnored,
  checkTimeSlotPreferenceViolation,
} from '../../src/evaluation/constraintCheckers';
import {
  Staff,
  StaffSchedule,
  ShiftRequirement,
  LeaveRequest,
  LeaveType,
  TimeSlotPreference,
  Role,
  Qualification,
} from '../../src/types';

describe('constraintCheckers', () => {
  describe('isBusinessDay', () => {
    it('夜勤ありの場合は全日が営業日', () => {
      // 日曜日（2025-11-02）
      expect(isBusinessDay('2025-11-02', true)).toBe(true);
      // 月曜日（2025-11-03）
      expect(isBusinessDay('2025-11-03', true)).toBe(true);
    });

    it('夜勤なしの場合、日曜日は非営業日', () => {
      // 日曜日（2025-11-02）
      expect(isBusinessDay('2025-11-02', false)).toBe(false);
    });

    it('夜勤なしの場合、日曜以外は営業日', () => {
      // 月曜日（2025-11-03）
      expect(isBusinessDay('2025-11-03', false)).toBe(true);
      // 土曜日（2025-11-01）
      expect(isBusinessDay('2025-11-01', false)).toBe(true);
    });
  });

  describe('checkStaffShortage', () => {
    const baseRequirements: ShiftRequirement = {
      targetMonth: '2025-11',
      timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
      requirements: {
        '日勤': { totalStaff: 2, requiredQualifications: [], requiredRoles: [] },
      },
    };

    it('人員充足の場合は違反なし', () => {
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'A',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }],
        },
        {
          staffId: 's2',
          staffName: 'B',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }],
        },
      ];

      // 2025-11-03のみチェック（1日だけ人員充足）
      const requirements: ShiftRequirement = {
        ...baseRequirements,
        startDay: 3,
        endDay: 3,
      };

      const violations = checkStaffShortage(schedule, requirements);
      // 他の日は人員不足だが、3日は充足しているので3日分の違反はない
      const day3Violations = violations.filter(v => v.affectedDates?.includes('2025-11-03'));
      expect(day3Violations.length).toBe(0);
    });

    it('人員不足の場合は違反を検出', () => {
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'A',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }],
        },
      ];

      const violations = checkStaffShortage(schedule, baseRequirements);
      // 2025-11-03に1名不足
      const day3Violations = violations.filter(v => v.affectedDates?.includes('2025-11-03'));
      expect(day3Violations.length).toBe(1);
      expect(day3Violations[0].type).toBe('staffShortage');
      expect(day3Violations[0].description).toContain('1名の人員不足');
    });

    it('日曜日（夜勤なし）はスキップされる', () => {
      const schedule: StaffSchedule[] = [];
      const violations = checkStaffShortage(schedule, baseRequirements);
      // 2025-11-02は日曜日なのでスキップ
      const sundayViolations = violations.filter(v => v.affectedDates?.includes('2025-11-02'));
      expect(sundayViolations.length).toBe(0);
    });
  });

  describe('checkConsecutiveWorkViolation', () => {
    const createStaff = (id: string, name: string, maxConsecutive = 5): Staff => ({
      id,
      name,
      role: Role.CareWorker,
      qualifications: [],
      weeklyWorkCount: { hope: 5, must: 4 },
      maxConsecutiveWorkDays: maxConsecutive,
      availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
      unavailableDates: [],
      timeSlotPreference: TimeSlotPreference.Any,
      isNightShiftOnly: false,
    });

    it('連勤が上限以内なら違反なし', () => {
      const staffList = [createStaff('s1', 'テスト太郎', 5)];
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [
            { date: '2025-11-01', shiftType: '日勤' },
            { date: '2025-11-02', shiftType: '日勤' },
            { date: '2025-11-03', shiftType: '日勤' },
            { date: '2025-11-04', shiftType: '日勤' },
            { date: '2025-11-05', shiftType: '日勤' }, // 5連勤（上限ちょうど）
            { date: '2025-11-06', shiftType: '休' },
          ],
        },
      ];

      const violations = checkConsecutiveWorkViolation(schedule, staffList);
      expect(violations.length).toBe(0);
    });

    it('連勤が上限超過で違反検出', () => {
      const staffList = [createStaff('s1', 'テスト太郎', 5)];
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [
            { date: '2025-11-01', shiftType: '日勤' },
            { date: '2025-11-02', shiftType: '日勤' },
            { date: '2025-11-03', shiftType: '日勤' },
            { date: '2025-11-04', shiftType: '日勤' },
            { date: '2025-11-05', shiftType: '日勤' },
            { date: '2025-11-06', shiftType: '日勤' }, // 6連勤（上限超過）
          ],
        },
      ];

      const violations = checkConsecutiveWorkViolation(schedule, staffList);
      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe('consecutiveWork');
      expect(violations[0].description).toContain('5日を超える連勤');
    });

    it('休日で連勤がリセットされる', () => {
      const staffList = [createStaff('s1', 'テスト太郎', 3)];
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [
            { date: '2025-11-01', shiftType: '日勤' },
            { date: '2025-11-02', shiftType: '日勤' },
            { date: '2025-11-03', shiftType: '日勤' }, // 3連勤
            { date: '2025-11-04', shiftType: '休' }, // リセット
            { date: '2025-11-05', shiftType: '日勤' },
            { date: '2025-11-06', shiftType: '日勤' },
            { date: '2025-11-07', shiftType: '日勤' }, // また3連勤
          ],
        },
      ];

      const violations = checkConsecutiveWorkViolation(schedule, staffList);
      expect(violations.length).toBe(0);
    });
  });

  describe('checkNightRestViolation', () => {
    it('夜勤後に休息があれば違反なし', () => {
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [
            { date: '2025-11-01', shiftType: '夜勤' },
            { date: '2025-11-02', shiftType: '明け休み' },
          ],
        },
      ];

      const violations = checkNightRestViolation(schedule);
      expect(violations.length).toBe(0);
    });

    it('夜勤後に勤務があると違反検出', () => {
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [
            { date: '2025-11-01', shiftType: '夜勤' },
            { date: '2025-11-02', shiftType: '日勤' }, // 違反
          ],
        },
      ];

      const violations = checkNightRestViolation(schedule);
      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe('nightRestViolation');
      expect(violations[0].description).toContain('休息がありません');
    });

    it('夜勤後に公休があれば違反なし', () => {
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [
            { date: '2025-11-01', shiftType: '夜勤' },
            { date: '2025-11-02', shiftType: '公休' },
          ],
        },
      ];

      const violations = checkNightRestViolation(schedule);
      expect(violations.length).toBe(0);
    });
  });

  describe('checkQualificationMissing', () => {
    const createStaffWithQual = (id: string, name: string, qualifications: Qualification[]): Staff => ({
      id,
      name,
      role: Role.CareWorker,
      qualifications,
      weeklyWorkCount: { hope: 5, must: 4 },
      maxConsecutiveWorkDays: 5,
      availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
      unavailableDates: [],
      timeSlotPreference: TimeSlotPreference.Any,
      isNightShiftOnly: false,
    });

    it('資格要件充足で違反なし', () => {
      const staffList = [
        createStaffWithQual('s1', 'A', [Qualification.CertifiedCareWorker]),
        createStaffWithQual('s2', 'B', [Qualification.CertifiedCareWorker]),
      ];
      const schedule: StaffSchedule[] = [
        { staffId: 's1', staffName: 'A', monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }] },
        { staffId: 's2', staffName: 'B', monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }] },
      ];
      const requirements: ShiftRequirement = {
        targetMonth: '2025-11',
        timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
        requirements: {
          '日勤': {
            totalStaff: 2,
            requiredQualifications: [{ qualification: Qualification.CertifiedCareWorker, count: 1 }],
            requiredRoles: [],
          },
        },
      };

      const violations = checkQualificationMissing(schedule, staffList, requirements);
      const day3Violations = violations.filter(v => v.affectedDates?.includes('2025-11-03'));
      expect(day3Violations.length).toBe(0);
    });

    it('資格要件不足で違反検出', () => {
      const staffList = [
        createStaffWithQual('s1', 'A', []), // 資格なし
        createStaffWithQual('s2', 'B', []), // 資格なし
      ];
      const schedule: StaffSchedule[] = [
        { staffId: 's1', staffName: 'A', monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }] },
        { staffId: 's2', staffName: 'B', monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }] },
      ];
      const requirements: ShiftRequirement = {
        targetMonth: '2025-11',
        timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
        requirements: {
          '日勤': {
            totalStaff: 2,
            requiredQualifications: [{ qualification: Qualification.CertifiedCareWorker, count: 1 }],
            requiredRoles: [],
          },
        },
      };

      const violations = checkQualificationMissing(schedule, staffList, requirements);
      const day3Violations = violations.filter(v => v.affectedDates?.includes('2025-11-03'));
      expect(day3Violations.length).toBe(1);
      expect(day3Violations[0].type).toBe('qualificationMissing');
    });
  });

  describe('checkRoleMissing', () => {
    const createStaffWithRole = (id: string, name: string, role: Role): Staff => ({
      id,
      name,
      role,
      qualifications: [],
      weeklyWorkCount: { hope: 5, must: 4 },
      maxConsecutiveWorkDays: 5,
      availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
      unavailableDates: [],
      timeSlotPreference: TimeSlotPreference.Any,
      isNightShiftOnly: false,
    });

    it('ロール要件充足で違反なし', () => {
      const staffList = [
        createStaffWithRole('s1', '看護師A', Role.Nurse),
        createStaffWithRole('s2', '介護職員B', Role.CareWorker),
      ];
      const schedule: StaffSchedule[] = [
        { staffId: 's1', staffName: '看護師A', monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }] },
        { staffId: 's2', staffName: '介護職員B', monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }] },
      ];
      const requirements: ShiftRequirement = {
        targetMonth: '2025-11',
        timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
        requirements: {
          '日勤': {
            totalStaff: 2,
            requiredQualifications: [],
            requiredRoles: [{ role: Role.Nurse, count: 1 }],
          },
        },
      };

      const violations = checkRoleMissing(schedule, staffList, requirements);
      const day3Violations = violations.filter(v => v.affectedDates?.includes('2025-11-03'));
      expect(day3Violations.length).toBe(0);
    });

    it('ロール要件不足で違反検出', () => {
      const staffList = [
        createStaffWithRole('s1', '介護職員A', Role.CareWorker),
        createStaffWithRole('s2', '介護職員B', Role.CareWorker),
      ];
      const schedule: StaffSchedule[] = [
        { staffId: 's1', staffName: '介護職員A', monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }] },
        { staffId: 's2', staffName: '介護職員B', monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }] },
      ];
      const requirements: ShiftRequirement = {
        targetMonth: '2025-11',
        timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
        requirements: {
          '日勤': {
            totalStaff: 2,
            requiredQualifications: [],
            requiredRoles: [{ role: Role.Nurse, count: 1 }], // 看護師1名必要だが配置なし
          },
        },
      };

      const violations = checkRoleMissing(schedule, staffList, requirements);
      const day3Violations = violations.filter(v => v.affectedDates?.includes('2025-11-03'));
      expect(day3Violations.length).toBe(1);
      expect(day3Violations[0].type).toBe('roleMissing');
      expect(day3Violations[0].severity).toBe('error');
      expect(day3Violations[0].description).toContain('看護職員');
    });

    it('日曜日（夜勤なし）はスキップされる', () => {
      const staffList = [createStaffWithRole('s1', '介護職員A', Role.CareWorker)];
      const schedule: StaffSchedule[] = [];
      const requirements: ShiftRequirement = {
        targetMonth: '2025-11',
        timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
        requirements: {
          '日勤': {
            totalStaff: 1,
            requiredQualifications: [],
            requiredRoles: [{ role: Role.Nurse, count: 1 }],
          },
        },
      };

      const violations = checkRoleMissing(schedule, staffList, requirements);
      // 2025-11-02は日曜日なのでスキップ
      const sundayViolations = violations.filter(v => v.affectedDates?.includes('2025-11-02'));
      expect(sundayViolations.length).toBe(0);
    });

    it('requiredRolesが空の場合は違反なし', () => {
      const staffList = [createStaffWithRole('s1', '介護職員A', Role.CareWorker)];
      const schedule: StaffSchedule[] = [
        { staffId: 's1', staffName: '介護職員A', monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }] },
      ];
      const requirements: ShiftRequirement = {
        targetMonth: '2025-11',
        timeSlots: [{ name: '日勤', start: '09:00', end: '17:00', restHours: 1 }],
        requirements: {
          '日勤': {
            totalStaff: 1,
            requiredQualifications: [],
            requiredRoles: [], // ロール要件なし
          },
        },
      };

      const violations = checkRoleMissing(schedule, staffList, requirements);
      expect(violations.length).toBe(0);
    });
  });

  describe('checkLeaveRequestIgnored', () => {
    it('休暇希望が反映されていれば違反なし', () => {
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '休' }],
        },
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2025-11-03': LeaveType.Hope },
      };

      const violations = checkLeaveRequestIgnored(schedule, leaveRequests);
      expect(violations.length).toBe(0);
    });

    it('休暇希望が無視されていると違反検出', () => {
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }], // 勤務が入っている
        },
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2025-11-03': LeaveType.Hope },
      };

      const violations = checkLeaveRequestIgnored(schedule, leaveRequests);
      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe('leaveRequestIgnored');
      expect(violations[0].description).toContain('希望が反映されていません');
    });

    it('有給休暇が反映されていれば違反なし', () => {
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '有給' }],
        },
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2025-11-03': LeaveType.PaidLeave },
      };

      const violations = checkLeaveRequestIgnored(schedule, leaveRequests);
      expect(violations.length).toBe(0);
    });
  });

  describe('checkTimeSlotPreferenceViolation', () => {
    const createStaffWithPreference = (
      id: string,
      name: string,
      preference: TimeSlotPreference
    ): Staff => ({
      id,
      name,
      role: Role.CareWorker,
      qualifications: [],
      weeklyWorkCount: { hope: 5, must: 4 },
      maxConsecutiveWorkDays: 5,
      availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
      unavailableDates: [],
      timeSlotPreference: preference,
      isNightShiftOnly: preference === TimeSlotPreference.NightOnly,
    });

    it('日勤のみ希望スタッフが日勤なら違反なし', () => {
      const staffList = [createStaffWithPreference('s1', 'テスト太郎', TimeSlotPreference.DayOnly)];
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }],
        },
      ];

      const violations = checkTimeSlotPreferenceViolation(schedule, staffList);
      expect(violations.length).toBe(0);
    });

    it('日勤のみ希望スタッフが夜勤配置で違反検出', () => {
      const staffList = [createStaffWithPreference('s1', 'テスト太郎', TimeSlotPreference.DayOnly)];
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '夜勤' }],
        },
      ];

      const violations = checkTimeSlotPreferenceViolation(schedule, staffList);
      expect(violations.length).toBe(1);
      expect(violations[0].description).toContain('日勤のみ希望');
    });

    it('夜勤のみ希望スタッフが夜勤なら違反なし', () => {
      const staffList = [createStaffWithPreference('s1', 'テスト太郎', TimeSlotPreference.NightOnly)];
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '夜勤' }],
        },
      ];

      const violations = checkTimeSlotPreferenceViolation(schedule, staffList);
      expect(violations.length).toBe(0);
    });

    it('夜勤のみ希望スタッフが日勤配置で違反検出', () => {
      const staffList = [createStaffWithPreference('s1', 'テスト太郎', TimeSlotPreference.NightOnly)];
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [{ date: '2025-11-03', shiftType: '日勤' }],
        },
      ];

      const violations = checkTimeSlotPreferenceViolation(schedule, staffList);
      expect(violations.length).toBe(1);
      expect(violations[0].description).toContain('夜勤のみ希望');
    });

    it('いつでも可のスタッフはどのシフトでも違反なし', () => {
      const staffList = [createStaffWithPreference('s1', 'テスト太郎', TimeSlotPreference.Any)];
      const schedule: StaffSchedule[] = [
        {
          staffId: 's1',
          staffName: 'テスト太郎',
          monthlyShifts: [
            { date: '2025-11-03', shiftType: '日勤' },
            { date: '2025-11-04', shiftType: '夜勤' },
            { date: '2025-11-05', shiftType: '遅番' },
          ],
        },
      ];

      const violations = checkTimeSlotPreferenceViolation(schedule, staffList);
      expect(violations.length).toBe(0);
    });
  });
});
