import { describe, it, expect } from 'vitest';
import {
  detectLeaveQualificationConflicts,
} from '../leaveConflictValidator';
import {
  Qualification,
  Role,
  TimeSlotPreference,
  LeaveType,
  Staff,
  LeaveRequest,
  ShiftRequirement,
} from '../../../types';

// ── テスト用ファクトリ ─────────────────────────────────────

function makeStaff(
  id: string,
  name: string,
  qualifications: Qualification[] = []
): Staff {
  return {
    id,
    name,
    role: Role.Nurse,
    qualifications,
    weeklyWorkCount: { hope: 5, must: 5 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.Any,
    isNightShiftOnly: false,
  };
}

function makeRequirements(
  targetMonth: string,
  shifts: Record<string, { qual: Qualification; count: number }[]>
): ShiftRequirement {
  return {
    targetMonth,
    timeSlots: Object.keys(shifts).map((name) => ({
      name,
      start: '09:00',
      end: '18:00',
      restHours: 1,
    })),
    requirements: Object.fromEntries(
      Object.entries(shifts).map(([name, quals]) => [
        name,
        {
          totalStaff: 3,
          requiredQualifications: quals.map((q) => ({
            qualification: q.qual,
            count: q.count,
          })),
          requiredRoles: [],
        },
      ])
    ),
  };
}

// ── テストスイート ────────────────────────────────────────

describe('detectLeaveQualificationConflicts', () => {
  // ───────────── 基本ケース ─────────────
  describe('基本ケース', () => {
    it('希望休がなければ警告は発生しない', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '看護師A', [Qualification.RegisteredNurse]),
        makeStaff('s2', '看護師B', [Qualification.RegisteredNurse]),
        makeStaff('s3', '介護士A', []),
      ];
      const leaveRequests: LeaveRequest = {};
      const requirements = makeRequirements('2026-03', {
        日勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      expect(result).toHaveLength(0);
    });

    it('資格要件のないシフトで希望休が集中しても警告なし', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '介護士A', []),
        makeStaff('s2', '介護士B', []),
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2026-03-10': LeaveType.Hope },
        s2: { '2026-03-10': LeaveType.Hope },
      };
      const requirements = makeRequirements('2026-03', {
        日勤: [],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      expect(result).toHaveLength(0);
    });
  });

  // ───────────── 看護師2名が同日に希望休（主要シナリオ） ─────────────
  describe('看護師が同日希望休で資格不足', () => {
    it('看護師2名が同日希望休 → qualificationMissing警告が発生する', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '看護師A', [Qualification.RegisteredNurse]),
        makeStaff('s2', '看護師B', [Qualification.RegisteredNurse]),
        makeStaff('s3', '介護士A', []),
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2026-03-10': LeaveType.Hope },
        s2: { '2026-03-10': LeaveType.Hope },
      };
      const requirements = makeRequirements('2026-03', {
        日勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2026-03-10');
      expect(result[0].qualification).toBe(Qualification.RegisteredNurse);
      expect(result[0].requiredCount).toBe(1);
      expect(result[0].availableCount).toBe(0);
      expect(result[0].affectedStaff).toContain('看護師A');
      expect(result[0].affectedStaff).toContain('看護師B');
    });

    it('看護師1名のみ希望休で1名必要 → 0名配置可能 → 警告', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '看護師A', [Qualification.RegisteredNurse]),
        makeStaff('s2', '介護士A', []),
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2026-03-15': LeaveType.PaidLeave },
      };
      const requirements = makeRequirements('2026-03', {
        日勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      expect(result).toHaveLength(1);
      expect(result[0].availableCount).toBe(0);
      expect(result[0].affectedStaff).toEqual(['看護師A']);
    });

    it('看護師1名が希望休でも別の看護師が出勤可能なら警告なし', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '看護師A', [Qualification.RegisteredNurse]),
        makeStaff('s2', '看護師B', [Qualification.RegisteredNurse]),
        makeStaff('s3', '介護士A', []),
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2026-03-10': LeaveType.Hope },
      };
      const requirements = makeRequirements('2026-03', {
        日勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      expect(result).toHaveLength(0);
    });
  });

  // ───────────── 複数シフト・複数資格 ─────────────
  describe('複数シフト・複数資格', () => {
    it('日勤と夜勤それぞれで看護師1名必要 → 合計2名必要 → 1名不足で警告', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '看護師A', [Qualification.RegisteredNurse]),
        makeStaff('s2', '看護師B', [Qualification.RegisteredNurse]),
        makeStaff('s3', '介護士A', []),
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2026-03-10': LeaveType.Hope },
      };
      const requirements = makeRequirements('2026-03', {
        日勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
        夜勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      // 合計2名必要で1名配置可能 → 警告
      expect(result).toHaveLength(1);
      expect(result[0].requiredCount).toBe(2);
      expect(result[0].availableCount).toBe(1);
    });

    it('複数の資格要件があるとき、不足する資格のみ警告が出る', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '看護師A', [Qualification.RegisteredNurse]),
        makeStaff('s2', '理学療法士A', [Qualification.PhysicalTherapist]),
        makeStaff('s3', '介護士A', []),
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2026-03-10': LeaveType.Hope },
      };
      const requirements = makeRequirements('2026-03', {
        日勤: [
          { qual: Qualification.RegisteredNurse, count: 1 },
          { qual: Qualification.PhysicalTherapist, count: 1 },
        ],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      // 看護師のみ不足、理学療法士は問題なし
      expect(result).toHaveLength(1);
      expect(result[0].qualification).toBe(Qualification.RegisteredNurse);
    });
  });

  // ───────────── 境界値 ─────────────
  describe('境界値', () => {
    it('対象月外の希望休は無視される', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '看護師A', [Qualification.RegisteredNurse]),
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2026-04-01': LeaveType.Hope }, // 4月（対象は3月）
      };
      const requirements = makeRequirements('2026-03', {
        日勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      expect(result).toHaveLength(0);
    });

    it('スタッフリストが空の場合、警告なし', () => {
      const staffList: Staff[] = [];
      const leaveRequests: LeaveRequest = {};
      const requirements = makeRequirements('2026-03', {
        日勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      expect(result).toHaveLength(0);
    });

    it('有給休暇・研修による希望休も資格不足を引き起こす', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '看護師A', [Qualification.RegisteredNurse]),
      ];
      const leaveRequests: LeaveRequest = {
        s1: { '2026-03-05': LeaveType.Training },
      };
      const requirements = makeRequirements('2026-03', {
        日勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      expect(result).toHaveLength(1);
    });

    it('複数日で重複するとき、各日に独立した警告が出る', () => {
      const staffList: Staff[] = [
        makeStaff('s1', '看護師A', [Qualification.RegisteredNurse]),
      ];
      const leaveRequests: LeaveRequest = {
        s1: {
          '2026-03-05': LeaveType.Hope,
          '2026-03-10': LeaveType.Hope,
        },
      };
      const requirements = makeRequirements('2026-03', {
        日勤: [{ qual: Qualification.RegisteredNurse, count: 1 }],
      });

      const result = detectLeaveQualificationConflicts(
        staffList,
        leaveRequests,
        requirements
      );

      expect(result).toHaveLength(2);
      const dates = result.map((w) => w.date).sort();
      expect(dates).toEqual(['2026-03-05', '2026-03-10']);
    });
  });
});
