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

  it('施設名・対象月がヘッダーに含まれる（Phase 62: 行3に移動）', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    // Phase 62: 行2=事業所番号/サービス種類, 行3=施設名/対象月
    const row3 = ws.getRow(3);
    expect(String(row3.getCell(2).value)).toContain('テスト施設');
    expect(String(row3.getCell(2).value)).toContain('令和7年1月');
  });

  it('スタッフ名が正しく出力される（Phase 62: 職種グループ行後のデータ行を検索）', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    // Phase 62: 行6以降（グループヘッダー行を含む）。全行からスタッフ名セルを収集
    const staffNames: string[] = [];
    for (let r = 6; r <= 20; r++) {
      const cellVal = ws.getRow(r).getCell(2).value;
      if (cellVal && typeof cellVal === 'string' && !cellVal.startsWith('【')) {
        staffNames.push(cellVal);
      }
    }
    expect(staffNames).toContain('田中太郎');
    expect(staffNames).toContain('佐藤花子');
  });

  it('空のスケジュールでもエラーなく生成できる', async () => {
    const wb = await createStandardFormWorkbook(
      [], [], mockShiftSettings, 'テスト施設', '2025-01'
    );
    expect(wb).toBeDefined();
  });

  it('1月（31日）の列数が正しい（Phase 62: 固定7列 + 31日 + 集計3列 = 41列）', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    // Phase 62: ヘッダーは行5に移動
    // COL_DAYS_START=8, daysInMonth=31 → COL_TOTAL_HOURS=39, COL_WEEKLY_AVG=40, COL_FTE=41
    const headerRow = ws.getRow(5);
    expect(headerRow.getCell(41).value).toContain('換算');
  });

  it('2月（28日）の列数が正しい（Phase 62: 固定7列 + 28日 + 集計3列 = 38列）', async () => {
    const schedFeb = [{
      staffId: 's1', staffName: '田中太郎',
      monthlyShifts: [{ date: '2025-02-01', plannedShiftType: '日勤' }],
    }];
    const wb = await createStandardFormWorkbook(
      schedFeb, mockStaff, mockShiftSettings, 'テスト施設', '2025-02'
    );
    const ws = wb.worksheets[0];
    // Phase 62: ヘッダーは行5に移動
    // COL_DAYS_START=8, daysInMonth=28 → COL_TOTAL_HOURS=36, COL_WEEKLY_AVG=37, COL_FTE=38
    const headerRow = ws.getRow(5);
    expect(headerRow.getCell(38).value).toContain('換算');
  });
});

// ==================== Phase 62: 新規テスト ====================

describe('Phase 62: createStandardFormWorkbook 拡張', () => {
  it('後方互換性: 6引数での呼び出しが正常に動作する', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01', 40
    );
    expect(wb).toBeDefined();
    expect(wb.worksheets[0].name).toBe('勤務形態一覧表');
  });

  it('事業所番号・サービス種類が行2に出力される', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01',
      40, 'TEST0001234', '通所介護', 'テスト作成者'
    );
    const ws = wb.worksheets[0];
    const row2Val = String(ws.getRow(2).getCell(2).value);
    expect(row2Val).toContain('TEST0001234');
    expect(row2Val).toContain('通所介護');
  });

  it('作成者名が行3に出力される', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01',
      40, undefined, undefined, '山田管理者'
    );
    const ws = wb.worksheets[0];
    const row3Val = String(ws.getRow(3).getCell(2).value);
    expect(row3Val).toContain('山田管理者');
  });

  it('職種グループヘッダー行に「【」が含まれる', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    // 行6以降を走査してグループヘッダー行を探す
    let hasGroupHeader = false;
    for (let r = 6; r <= 15; r++) {
      const cellVal = ws.getRow(r).getCell(1).value;
      if (typeof cellVal === 'string' && cellVal.includes('【')) {
        hasGroupHeader = true;
        break;
      }
    }
    expect(hasGroupHeader).toBe(true);
  });

  it('小計行に「小計」が含まれる', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    let hasSubtotalRow = false;
    for (let r = 6; r <= 20; r++) {
      const cellVal = ws.getRow(r).getCell(1).value;
      if (typeof cellVal === 'string' && cellVal.includes('小計')) {
        hasSubtotalRow = true;
        break;
      }
    }
    expect(hasSubtotalRow).toBe(true);
  });

  it('週平均時間列ヘッダーが行5に含まれる', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    const headerRow = ws.getRow(5);
    // COL_WEEKLY_AVG = 8 + 31 + 1 = 40
    const weeklyAvgHeader = String(headerRow.getCell(40).value);
    expect(weeklyAvgHeader).toContain('週平均');
  });

  it('有給計上注記が注記行に含まれる', async () => {
    const wb = await createStandardFormWorkbook(
      mockSchedules, mockStaff, mockShiftSettings, 'テスト施設', '2025-01'
    );
    const ws = wb.worksheets[0];
    // 注記行を探す（下の方の行）
    let hasNote = false;
    for (let r = 1; r <= ws.rowCount; r++) {
      const cellVal = String(ws.getRow(r).getCell(1).value ?? '');
      if (cellVal.includes('有給休暇')) {
        hasNote = true;
        break;
      }
    }
    expect(hasNote).toBe(true);
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
