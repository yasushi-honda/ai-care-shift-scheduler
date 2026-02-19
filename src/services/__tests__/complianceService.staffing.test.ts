/**
 * complianceService.staffing.test.ts
 *
 * Phase 65: 日次充足率計算・月次サマリーのユニットテスト
 * 境界値（100%, 80%境界）、複数職種、ratio方式、休日除外を検証
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDailyFulfillment,
  calculateMonthlyFulfillmentSummary,
} from '../complianceService';
import type {
  StaffSchedule,
  Staff,
  FacilityShiftSettings,
  StaffingStandardConfig,
} from '../../../types';
import { Timestamp } from 'firebase/firestore';

// ==================== フィクスチャ ====================

const makeTimestamp = () => ({ toDate: () => new Date() } as unknown as Timestamp);

const mockShiftSettings: FacilityShiftSettings = {
  facilityId: 'fac-1',
  shiftTypes: [
    { id: 'day',    name: '日勤',    start: '09:00', end: '18:00', restHours: 1, color: { background: '', text: '' }, isActive: true, sortOrder: 1 },
    { id: 'off',    name: '休',      start: '',      end: '',      restHours: 0, color: { background: '', text: '' }, isActive: true, sortOrder: 5 },
    { id: 'postnight', name: '明け休み', start: '', end: '', restHours: 0, color: { background: '', text: '' }, isActive: true, sortOrder: 6 },
  ],
  defaultShiftCycle: [],
  updatedAt: makeTimestamp(),
  updatedBy: 'test',
};

function makeStaff(id: string, role: string): Staff {
  return {
    id,
    name: id,
    role: role as any,
    qualifications: [],
    weeklyWorkCount: { hope: 5, must: 4 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: '日勤のみ' as any,
    isNightShiftOnly: false,
    employmentType: 'A',
  };
}

function makeScheduleDay(staffId: string, date: string, shiftType: string): StaffSchedule {
  return {
    staffId,
    staffName: staffId,
    monthlyShifts: [{ date, plannedShiftType: shiftType }],
  };
}

/** 標準設定: 固定方式 介護職員2人必要 */
const fixedConfig: StaffingStandardConfig = {
  facilityId: 'fac-1',
  serviceType: '通所介護',
  userCount: 20,
  requirements: [
    { role: '介護職員', requiredFte: 2, calculationMethod: 'fixed' },
  ],
  updatedAt: makeTimestamp(),
  updatedBy: 'system',
};

/** 標準設定: ratio方式 利用者20人÷5=4FTE必要 */
const ratioConfig: StaffingStandardConfig = {
  facilityId: 'fac-1',
  serviceType: '通所介護',
  userCount: 20,
  requirements: [
    { role: '介護職員', requiredFte: 0, calculationMethod: 'ratio', ratioNumerator: 5 },
  ],
  updatedAt: makeTimestamp(),
  updatedBy: 'system',
};

// ==================== calculateDailyFulfillment ====================

describe('calculateDailyFulfillment', () => {
  it('全日充足: 日勤2人（介護職員）→ 充足率100%, status=met', () => {
    // 日勤 = 8h実勤務 / (40/5=8h) = 1.0 FTE/人 → 2人 = 2.0 FTE
    const date = '2025-01-01';
    const schedules = [
      makeScheduleDay('staff1', date, '日勤'),
      makeScheduleDay('staff2', date, '日勤'),
    ];
    const staffList = [makeStaff('staff1', '介護職員'), makeStaff('staff2', '介護職員')];

    const results = calculateDailyFulfillment(
      schedules, staffList, mockShiftSettings, fixedConfig, '2025-01', 40, false
    );

    const jan1 = results.find((r) => r.date === date)!;
    expect(jan1.overall.status).toBe('met');
    expect(jan1.overall.fulfillmentRate).toBeGreaterThanOrEqual(100);
    expect(jan1.byRole[0].actualFte).toBeCloseTo(2.0, 1);
  });

  it('基準未達: 日勤1人（介護職員）→ 充足率50%, status=shortage', () => {
    const date = '2025-01-02';
    const schedules = [makeScheduleDay('staff1', date, '日勤')];
    const staffList = [makeStaff('staff1', '介護職員')];

    const results = calculateDailyFulfillment(
      schedules, staffList, mockShiftSettings, fixedConfig, '2025-01', 40, false
    );

    const jan2 = results.find((r) => r.date === date)!;
    expect(jan2.overall.status).toBe('shortage');
    expect(jan2.overall.fulfillmentRate).toBeCloseTo(50, 0);
  });

  it('警告域: 1.6FTE（80%）→ status=warning', () => {
    // 必要: 2.0 FTE。1.6FTE = 80%
    // 日勤8h × 2人 = 2FTE だと100%になってしまうので、
    // 必要FTE=2の状態で実績1.6FTE（80%）を再現するには:
    // 8h × 1人 + 4.8h × 1人 = 12.8h → 12.8/8 = 1.6FTE
    // この設定を簡易に再現するために必要FTEを2.0、実FTEを1.6にする
    // 単純化: 6.4h勤務（カスタムシフトは使えないので4人で6時間ずつは不可）
    // → 代替: 必要FTE=1に変更して0.8FTE(日勤 80%)のケースを検証
    const customConfig: StaffingStandardConfig = {
      ...fixedConfig,
      requirements: [{ role: '介護職員', requiredFte: 1.25, calculationMethod: 'fixed' }],
    };
    // 1FTE(日勤8h/8h=1.0) / 1.25 = 80%
    const date = '2025-01-03';
    const schedules = [makeScheduleDay('staff1', date, '日勤')];
    const staffList = [makeStaff('staff1', '介護職員')];

    const results = calculateDailyFulfillment(
      schedules, staffList, mockShiftSettings, customConfig, '2025-01', 40, false
    );

    const jan3 = results.find((r) => r.date === date)!;
    expect(jan3.overall.status).toBe('warning');
    expect(jan3.overall.fulfillmentRate).toBeCloseTo(80, 0);
  });

  it('休日スタッフは FTE 0 として扱われる', () => {
    const date = '2025-01-04';
    const schedules = [
      makeScheduleDay('staff1', date, '休'),         // 休日
      makeScheduleDay('staff2', date, '明け休み'),    // 明け休み
    ];
    const staffList = [
      makeStaff('staff1', '介護職員'),
      makeStaff('staff2', '介護職員'),
    ];

    const results = calculateDailyFulfillment(
      schedules, staffList, mockShiftSettings, fixedConfig, '2025-01', 40, false
    );

    const jan4 = results.find((r) => r.date === date)!;
    expect(jan4.overall.actualFte).toBe(0);
    expect(jan4.overall.status).toBe('shortage');
  });

  it('ratio方式: 利用者20÷5=4FTE必要、日勤4人→充足率100%', () => {
    const date = '2025-01-05';
    const schedules = Array.from({ length: 4 }, (_, i) =>
      makeScheduleDay(`staff${i + 1}`, date, '日勤')
    );
    const staffList = Array.from({ length: 4 }, (_, i) =>
      makeStaff(`staff${i + 1}`, '介護職員')
    );

    const results = calculateDailyFulfillment(
      schedules, staffList, mockShiftSettings, ratioConfig, '2025-01', 40, false
    );

    const jan5 = results.find((r) => r.date === date)!;
    expect(jan5.byRole[0].requiredFte).toBeCloseTo(4, 1);
    expect(jan5.overall.fulfillmentRate).toBeCloseTo(100, 0);
    expect(jan5.overall.status).toBe('met');
  });

  it('複数職種: 介護職員と看護職員を個別に判定', () => {
    const multiRoleConfig: StaffingStandardConfig = {
      ...fixedConfig,
      requirements: [
        { role: '介護職員', requiredFte: 2, calculationMethod: 'fixed' },
        { role: '看護職員', requiredFte: 1, calculationMethod: 'fixed' },
      ],
    };
    const date = '2025-01-06';
    const schedules = [
      makeScheduleDay('care1', date, '日勤'),
      makeScheduleDay('care2', date, '日勤'),
      makeScheduleDay('nurse1', date, '日勤'),
    ];
    const staffList = [
      makeStaff('care1', '介護職員'),
      makeStaff('care2', '介護職員'),
      makeStaff('nurse1', '看護職員'),
    ];

    const results = calculateDailyFulfillment(
      schedules, staffList, mockShiftSettings, multiRoleConfig, '2025-01', 40, false
    );

    const jan6 = results.find((r) => r.date === date)!;
    expect(jan6.overall.status).toBe('met');
    const careRole = jan6.byRole.find((r) => r.role === '介護職員')!;
    const nurseRole = jan6.byRole.find((r) => r.role === '看護職員')!;
    expect(careRole.status).toBe('met');
    expect(nurseRole.status).toBe('met');
  });

  it('対象月の日数分の結果が返る', () => {
    const results = calculateDailyFulfillment(
      [], [], mockShiftSettings, fixedConfig, '2025-02', 40, false
    );
    // 2025年2月は28日
    expect(results).toHaveLength(28);
    expect(results[0].date).toBe('2025-02-01');
    expect(results[27].date).toBe('2025-02-28');
  });

  it('2月29日（うるう年）も正しく集計', () => {
    const results = calculateDailyFulfillment(
      [], [], mockShiftSettings, fixedConfig, '2024-02', 40, false
    );
    expect(results).toHaveLength(29);
    expect(results[28].date).toBe('2024-02-29');
  });
});

// ==================== calculateMonthlyFulfillmentSummary ====================

describe('calculateMonthlyFulfillmentSummary', () => {
  it('空配列を渡すと totalDays=0 のサマリーが返る', () => {
    const summary = calculateMonthlyFulfillmentSummary([], '2025-01');
    expect(summary.totalDays).toBe(0);
    expect(summary.averageFulfillmentRate).toBe(100);
    expect(summary.shortfallDays).toBe(0);
  });

  it('全日 100% → averageFulfillmentRate=100, shortfallDays=0', () => {
    const dailyResults = Array.from({ length: 5 }, (_, i) => ({
      date: `2025-01-0${i + 1}`,
      overall: { requiredFte: 2, actualFte: 2, fulfillmentRate: 100, status: 'met' as const },
      byRole: [{ role: '介護職員', requiredFte: 2, actualFte: 2, fulfillmentRate: 100, status: 'met' as const }],
    }));

    const summary = calculateMonthlyFulfillmentSummary(dailyResults, '2025-01');
    expect(summary.averageFulfillmentRate).toBe(100);
    expect(summary.shortfallDays).toBe(0);
    expect(summary.totalDays).toBe(5);
  });

  it('一部の日が shortage → shortfallDays が正しくカウントされる', () => {
    const dailyResults = [
      {
        date: '2025-01-01',
        overall: { requiredFte: 2, actualFte: 2, fulfillmentRate: 100, status: 'met' as const },
        byRole: [{ role: '介護職員', requiredFte: 2, actualFte: 2, fulfillmentRate: 100, status: 'met' as const }],
      },
      {
        date: '2025-01-02',
        overall: { requiredFte: 2, actualFte: 0, fulfillmentRate: 0, status: 'shortage' as const },
        byRole: [{ role: '介護職員', requiredFte: 2, actualFte: 0, fulfillmentRate: 0, status: 'shortage' as const }],
      },
      {
        date: '2025-01-03',
        overall: { requiredFte: 2, actualFte: 0, fulfillmentRate: 0, status: 'shortage' as const },
        byRole: [{ role: '介護職員', requiredFte: 2, actualFte: 0, fulfillmentRate: 0, status: 'shortage' as const }],
      },
    ];

    const summary = calculateMonthlyFulfillmentSummary(dailyResults, '2025-01');
    expect(summary.shortfallDays).toBe(2);
    expect(summary.averageFulfillmentRate).toBeCloseTo((100 + 0 + 0) / 3, 0);
    expect(summary.byRole[0].shortfallDays).toBe(2);
  });

  it('職種別サマリーに全職種が含まれる', () => {
    const dailyResults = [
      {
        date: '2025-01-01',
        overall: { requiredFte: 3, actualFte: 3, fulfillmentRate: 100, status: 'met' as const },
        byRole: [
          { role: '介護職員', requiredFte: 2, actualFte: 2, fulfillmentRate: 100, status: 'met' as const },
          { role: '看護職員', requiredFte: 1, actualFte: 1, fulfillmentRate: 100, status: 'met' as const },
        ],
      },
    ];

    const summary = calculateMonthlyFulfillmentSummary(dailyResults, '2025-01');
    expect(summary.byRole).toHaveLength(2);
    expect(summary.byRole.map((r) => r.role)).toContain('介護職員');
    expect(summary.byRole.map((r) => r.role)).toContain('看護職員');
  });
});
