/**
 * exportExcel.test.ts
 *
 * Phase 25: Excel エクスポートのユニットテスト
 * - 標準様式第1号の生成テスト
 * - 予実2段書きの生成テスト
 * - ファイル名生成テスト
 */

import { describe, it, expect } from 'vitest';
import {
  createStandardFormWorkbook,
  createActualVsPlanWorkbook,
  generateStandardFormFilename,
  generateActualVsPlanFilename,
} from '../exportExcel';
import type { StaffSchedule, Staff, FacilityShiftSettings } from '../../../types';
import { Qualification, TimeSlotPreference } from '../../../types';
import { Timestamp } from 'firebase/firestore';

// ==================== フィクスチャ ====================

const makeTimestamp = () => ({ toDate: () => new Date() } as unknown as Timestamp);

const mockShiftSettings: FacilityShiftSettings = {
  facilityId: 'fac-1',
  shiftTypes: [
    { id: 'day',    name: '日勤',    start: '09:00', end: '18:00', restHours: 1, color: { background: '', text: '' }, isActive: true, sortOrder: 1 },
    { id: 'early',  name: '早番',    start: '07:00', end: '16:00', restHours: 1, color: { background: '', text: '' }, isActive: true, sortOrder: 2 },
    { id: 'night',  name: '夜勤',    start: '16:00', end: '09:00', restHours: 2, color: { background: '', text: '' }, isActive: true, sortOrder: 3 },
    { id: 'off',    name: '休',      start: '',      end: '',      restHours: 0, color: { background: '', text: '' }, isActive: true, sortOrder: 4 },
    { id: 'postnight', name: '明け休み', start: '', end: '', restHours: 0, color: { background: '', text: '' }, isActive: true, sortOrder: 5 },
  ],
  defaultShiftCycle: [],
  updatedAt: makeTimestamp(),
  updatedBy: 'test',
};

const mockStaff: Staff[] = [
  {
    id: 's1',
    name: '田中太郎',
    role: '介護職員' as any,
    qualifications: [Qualification.CertifiedCareWorker],
    weeklyWorkCount: { hope: 5, must: 4 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.DayOnly,
    isNightShiftOnly: false,
    employmentType: 'A',
  },
  {
    id: 's2',
    name: '佐藤花子',
    role: '看護職員' as any,
    qualifications: [Qualification.RegisteredNurse],
    weeklyWorkCount: { hope: 3, must: 2 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6],
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.DayOnly,
    isNightShiftOnly: false,
    employmentType: 'C',
    weeklyContractHours: 20,
  },
];

const mockSchedules: StaffSchedule[] = [
  {
    staffId: 's1',
    staffName: '田中太郎',
    monthlyShifts: [
      { date: '2025-01-01', plannedShiftType: '日勤' },
      { date: '2025-01-02', plannedShiftType: '早番' },
      { date: '2025-01-03', plannedShiftType: '休' },
    ],
  },
  {
    staffId: 's2',
    staffName: '佐藤花子',
    monthlyShifts: [
      { date: '2025-01-01', plannedShiftType: '休' },
      { date: '2025-01-02', plannedShiftType: '日勤', actualShiftType: '早番', actualStartTime: '07:00', actualEndTime: '16:00' },
      { date: '2025-01-03', plannedShiftType: '日勤' },
    ],
  },
];

// ==================== generateFilename ====================

describe('generateStandardFormFilename', () => {
  it('正しいファイル名を生成する', () => {
    expect(generateStandardFormFilename('2025-01')).toBe('勤務形態一覧表_202501.xlsx');
    expect(generateStandardFormFilename('2024-12')).toBe('勤務形態一覧表_202412.xlsx');
  });
});

describe('generateActualVsPlanFilename', () => {
  it('正しいファイル名を生成する', () => {
    expect(generateActualVsPlanFilename('2025-01')).toBe('勤務形態一覧表_予実_202501.xlsx');
    expect(generateActualVsPlanFilename('2024-12')).toBe('勤務形態一覧表_予実_202412.xlsx');
  });
});

// ==================== createStandardFormWorkbook ====================

describe('createStandardFormWorkbook', () => {
  it('Workbookオブジェクトを返す', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    expect(wb).toBeDefined();
    expect(wb.worksheets).toHaveLength(1);
  });

  it('シート名が正しい', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    expect(wb.worksheets[0].name).toBe('勤務形態一覧表');
  });

  it('タイトル行に正しいテキストが含まれる', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    const titleCell = ws.getRow(1).getCell(2);
    expect(titleCell.value).toContain('従業者の勤務の体制及び勤務形態一覧表');
  });

  it('施設名・対象月がヘッダーに含まれる', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    const row2 = ws.getRow(2);
    expect(String(row2.getCell(2).value)).toContain('テスト施設');
    expect(String(row2.getCell(5).value)).toContain('令和7年1月');
  });

  it('スタッフ名が正しく出力される', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    // 行5以降がスタッフデータ行
    const staffNames = [ws.getRow(5).getCell(2).value, ws.getRow(6).getCell(2).value];
    expect(staffNames).toContain('田中太郎');
    expect(staffNames).toContain('佐藤花子');
  });

  it('空のスケジュールでもエラーなく生成できる', async () => {
    const wb = await createStandardFormWorkbook(
      [], [], mockShiftSettings, 'テスト施設', '2025-01'
    );
    expect(wb).toBeDefined();
  });

  it('1月（31日）の列数が正しい（固定5列 + 31日 + 集計2列 = 38列）', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    const headerRow = ws.getRow(4);
    // COL_FTE = 6(DAY_START) + 31(days) + 1(totalHours) + 1(fte) = 39... 実際はCOL_TOTAL_HOURS=37, COL_FTE=38
    // COL_DAYS_START=6, daysInMonth=31 → COL_TOTAL_HOURS=6+31=37, COL_FTE=38
    expect(headerRow.getCell(38).value).toContain('換算');
  });

  it('2月（28日）の列数が正しい（固定5列 + 28日 + 集計2列 = 35列）', async () => {
    const schedFeb = [{
      staffId: 's1', staffName: '田中太郎',
      monthlyShifts: [{ date: '2025-02-01', plannedShiftType: '日勤' }],
    }];
    const wb = await createStandardFormWorkbook(
      schedFeb, mockStaff, mockShiftSettings, 'テスト施設', '2025-02'
    );
    const ws = wb.worksheets[0];
    const headerRow = ws.getRow(4);
    // COL_DAYS_START=6, daysInMonth=28 → COL_TOTAL_HOURS=6+28=34, COL_FTE=35
    expect(headerRow.getCell(35).value).toContain('換算');
  });
});

// ==================== createActualVsPlanWorkbook ====================

describe('createActualVsPlanWorkbook', () => {
  it('Workbookオブジェクトを返す', async () => {
    const wb = await createActualVsPlanWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    expect(wb).toBeDefined();
    expect(wb.worksheets).toHaveLength(1);
  });

  it('シート名が正しい', async () => {
    const wb = await createActualVsPlanWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    expect(wb.worksheets[0].name).toBe('予実勤務形態一覧表');
  });

  it('タイトルに予実が含まれる', async () => {
    const wb = await createActualVsPlanWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    const titleCell = ws.getRow(1).getCell(1);
    expect(String(titleCell.value)).toContain('予実');
  });

  it('スタッフごとに2行（予定・実績）が生成される', async () => {
    const wb = await createActualVsPlanWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    // 2スタッフ → データ行は4（行4以降）から始まり2行ずつ
    const planLabel1 = ws.getRow(4).getCell(4).value; // 1人目・予定
    const actualLabel1 = ws.getRow(5).getCell(4).value; // 1人目・実績
    expect(planLabel1).toBe('予');
    expect(actualLabel1).toBe('実');
  });

  it('空のスケジュールでもエラーなく生成できる', async () => {
    const wb = await createActualVsPlanWorkbook(
      [], [], mockShiftSettings, 'テスト施設', '2025-01'
    );
    expect(wb).toBeDefined();
  });
});
