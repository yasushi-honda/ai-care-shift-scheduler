/**
 * exportExcel.ts
 *
 * Phase 25: Excel エクスポートユーティリティ
 *
 * 機能:
 * 1. 標準様式第1号出力（行政提出用）
 *    - 厚生労働省標準様式「従業者の勤務の体制及び勤務形態一覧表」準拠
 *    - 予定シフトのみ、FTE付き
 * 2. 予実2段書き出力（内部管理用）
 *    - 各日に予定・実績を2行で表示
 *    - 差異セルをオレンジ色ハイライト
 */

import ExcelJS from 'exceljs';
import type { StaffSchedule, Staff, FacilityShiftSettings } from '../../types';
import { EMPLOYMENT_TYPES } from '../../constants';
import { calculateFullTimeEquivalent } from '../services/complianceService';

// ==================== 定数 ====================

// シフト略称マップ（日本語省略表記）
const SHIFT_ABBREV: Record<string, string> = {
  '早番': '早',
  '日勤': '日',
  '遅番': '遅',
  '夜勤': '夜',
  '明け休み': '明',
  '休': '休',
  '有給休暇': '有',
  '研修': '研',
};

/**
 * シフトタイプ名を略称に変換（定義なければ先頭1文字）
 */
function toAbbrev(shiftTypeName: string): string {
  return SHIFT_ABBREV[shiftTypeName] ?? (shiftTypeName.charAt(0) || '');
}

/**
 * 対象月（YYYY-MM）の全日付リストを返す
 */
function getDatesInMonth(targetMonth: string): string[] {
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });
}

/**
 * YYYY-MM → 令和/年月表記（例: 令和7年1月）
 */
function formatTargetMonthJa(targetMonth: string): string {
  const [year, month] = targetMonth.split('-').map(Number);
  // 令和元年 = 2019年
  const reiwaYear = year - 2018;
  if (reiwaYear >= 1) {
    return `令和${reiwaYear}年${month}月`;
  }
  return `${year}年${month}月`;
}

/**
 * 共通スタイル定義
 */
const STYLES = {
  titleFont: { bold: true, size: 14 },
  headerFont: { bold: true, size: 10 },
  headerFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFD0E4F7' },
  },
  borderThin: {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
  },
  alignCenter: { horizontal: 'center' as const, vertical: 'middle' as const },
  alignLeft: { horizontal: 'left' as const, vertical: 'middle' as const },
  diffFill: {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: 'FFFFA500' }, // オレンジ（差異ハイライト）
  },
};

// ==================== 標準様式第1号 ====================

/**
 * 標準様式第1号「従業者の勤務の体制及び勤務形態一覧表」を生成
 *
 * 行政提出用（予定シフトのみ）
 *
 * @param staffSchedules - 対象月のスタッフスケジュール一覧
 * @param staffList - スタッフ情報一覧
 * @param shiftSettings - 施設シフト設定
 * @param facilityName - 施設名
 * @param targetMonth - 対象月（YYYY-MM）
 * @param standardWeeklyHours - 常勤週所定労働時間（デフォルト40h）
 * @returns ExcelJS Workbook
 */
export async function createStandardFormWorkbook(
  staffSchedules: StaffSchedule[],
  staffList: Staff[],
  shiftSettings: FacilityShiftSettings,
  facilityName: string,
  targetMonth: string,
  standardWeeklyHours: number = 40
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI介護シフトスケジューラー';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('勤務形態一覧表', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const dates = getDatesInMonth(targetMonth);
  const daysInMonth = dates.length;

  // FTE計算（予定ベース）
  const fteEntries = calculateFullTimeEquivalent(
    staffSchedules, staffList, shiftSettings, standardWeeklyHours, false
  );

  // ==================== 列定義 ====================
  // 固定列: 番号(1), 氏名(2), 職種(3), 資格(4), 常勤区分(5)
  // 日付列: 6 + day - 1
  // 集計列: 月間勤務時間, 常勤換算値
  const COL_NO = 1;
  const COL_NAME = 2;
  const COL_ROLE = 3;
  const COL_QUAL = 4;
  const COL_EMP = 5;
  const COL_DAYS_START = 6;
  const COL_TOTAL_HOURS = COL_DAYS_START + daysInMonth;
  const COL_FTE = COL_TOTAL_HOURS + 1;
  const totalCols = COL_FTE;

  // 列幅設定
  worksheet.getColumn(COL_NO).width = 4;
  worksheet.getColumn(COL_NAME).width = 12;
  worksheet.getColumn(COL_ROLE).width = 10;
  worksheet.getColumn(COL_QUAL).width = 12;
  worksheet.getColumn(COL_EMP).width = 8;
  for (let d = 0; d < daysInMonth; d++) {
    worksheet.getColumn(COL_DAYS_START + d).width = 3.2;
  }
  worksheet.getColumn(COL_TOTAL_HOURS).width = 9;
  worksheet.getColumn(COL_FTE).width = 8;

  // ==================== 行1: タイトル ====================
  const titleRow = worksheet.getRow(1);
  const titleCell = titleRow.getCell(COL_NAME);
  titleCell.value = '従業者の勤務の体制及び勤務形態一覧表';
  titleCell.font = STYLES.titleFont;
  titleCell.alignment = STYLES.alignLeft;
  worksheet.mergeCells(1, COL_NAME, 1, totalCols);
  titleRow.height = 24;

  // ==================== 行2: 施設名・対象月 ====================
  const infoRow = worksheet.getRow(2);
  infoRow.getCell(COL_NAME).value = `事業所名: ${facilityName}`;
  infoRow.getCell(COL_NAME).font = { size: 10 };
  infoRow.getCell(COL_EMP).value = `対象月: ${formatTargetMonthJa(targetMonth)}`;
  infoRow.getCell(COL_EMP).font = { size: 10 };
  infoRow.height = 18;

  // ==================== 行4: ヘッダー ====================
  const headerRow = worksheet.getRow(4);
  headerRow.height = 28;

  const setHeader = (col: number, value: string) => {
    const cell = headerRow.getCell(col);
    cell.value = value;
    cell.font = STYLES.headerFont;
    cell.fill = STYLES.headerFill;
    cell.alignment = { ...STYLES.alignCenter, wrapText: true };
    cell.border = STYLES.borderThin;
  };

  setHeader(COL_NO, 'No.');
  setHeader(COL_NAME, '職員氏名');
  setHeader(COL_ROLE, '職種');
  setHeader(COL_QUAL, '資格');
  setHeader(COL_EMP, '勤務\n形態');

  // 日付ヘッダー（1〜daysInMonth）
  for (let d = 0; d < daysInMonth; d++) {
    const date = new Date(dates[d]);
    const day = date.getDate();
    const weekDay = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const cell = headerRow.getCell(COL_DAYS_START + d);
    cell.value = `${day}\n${weekDay}`;
    cell.font = {
      bold: true,
      size: 9,
      color: isWeekend ? { argb: 'FFCC0000' } : undefined,
    };
    cell.fill = STYLES.headerFill;
    cell.alignment = { ...STYLES.alignCenter, wrapText: true };
    cell.border = STYLES.borderThin;
  }

  setHeader(COL_TOTAL_HOURS, '月間\n勤務時間');
  setHeader(COL_FTE, '常勤\n換算値');

  // ==================== 行5+: スタッフデータ ====================
  staffSchedules.forEach((ss, idx) => {
    const staff = staffList.find((s) => s.id === ss.staffId);
    const fteEntry = fteEntries.find((e) => e.staffId === ss.staffId);
    const empType = staff?.employmentType ?? 'A';
    const empLabel = `${empType}: ${EMPLOYMENT_TYPES[empType]}`;

    const row = worksheet.getRow(5 + idx);
    row.height = 16;

    const setCell = (col: number, value: ExcelJS.CellValue, opts?: Partial<ExcelJS.Style>) => {
      const cell = row.getCell(col);
      cell.value = value;
      cell.font = { size: 9, ...opts?.font };
      cell.alignment = { ...STYLES.alignCenter, ...opts?.alignment };
      cell.border = STYLES.borderThin;
      if (opts?.fill) cell.fill = opts.fill;
    };

    setCell(COL_NO, idx + 1);
    setCell(COL_NAME, ss.staffName, { alignment: { horizontal: 'left', vertical: 'middle' } });
    setCell(COL_ROLE, staff?.role ?? '');
    setCell(COL_QUAL, staff?.qualifications?.join(', ') ?? '');
    setCell(COL_EMP, empLabel, { alignment: { horizontal: 'left', vertical: 'middle' } });

    // 各日シフト
    dates.forEach((date, d) => {
      const shift = ss.monthlyShifts.find((s) => s.date === date);
      const shiftName = shift?.plannedShiftType ?? '';
      const abbrev = shiftName ? toAbbrev(shiftName) : '';

      const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
      setCell(COL_DAYS_START + d, abbrev, {
        font: {
          size: 9,
          color: isWeekend ? { argb: 'FFCC0000' } : undefined,
        },
      });
    });

    // 集計
    setCell(COL_TOTAL_HOURS, fteEntry?.monthlyHours ?? 0);
    setCell(COL_FTE, fteEntry?.fteValue ?? 0);
  });

  // ==================== 行(最終+2): 合計行 ====================
  const totalRowIdx = 5 + staffSchedules.length + 1;
  const totalRow = worksheet.getRow(totalRowIdx);
  totalRow.height = 18;

  const totalFTE = fteEntries.reduce((sum, e) => sum + e.fteValue, 0);
  const totalHours = fteEntries.reduce((sum, e) => sum + e.monthlyHours, 0);

  const setTotalCell = (col: number, value: ExcelJS.CellValue) => {
    const cell = totalRow.getCell(col);
    cell.value = value;
    cell.font = { bold: true, size: 10 };
    cell.alignment = STYLES.alignCenter;
    cell.border = STYLES.borderThin;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
  };

  setTotalCell(COL_NO, '合計');
  worksheet.mergeCells(totalRowIdx, COL_NO, totalRowIdx, COL_EMP);
  setTotalCell(COL_TOTAL_HOURS, Math.round(totalHours * 10) / 10);
  setTotalCell(COL_FTE, Math.round(totalFTE * 100) / 100);

  // ==================== 行(最終+3): 注記 ====================
  const noteRow = worksheet.getRow(totalRowIdx + 1);
  const noteCell = noteRow.getCell(COL_NO);
  noteCell.value =
    `※ 常勤換算値 = 月間勤務時間 ÷ (週所定労働時間${standardWeeklyHours}h × 4.33週)　` +
    '略称: 早=早番 日=日勤 遅=遅番 夜=夜勤 明=明け休み 休=休日 有=有給';
  noteCell.font = { size: 8, color: { argb: 'FF666666' } };
  worksheet.mergeCells(totalRowIdx + 1, COL_NO, totalRowIdx + 1, totalCols);

  return workbook;
}

// ==================== 予実2段書き ====================

/**
 * 予実2段書きExcelを生成（内部管理用）
 *
 * 各日に「予定」「実績」を2行表示。差異セルはオレンジハイライト。
 *
 * @param staffSchedules - 対象月のスタッフスケジュール一覧
 * @param staffList - スタッフ情報一覧
 * @param shiftSettings - 施設シフト設定
 * @param facilityName - 施設名
 * @param targetMonth - 対象月（YYYY-MM）
 * @param standardWeeklyHours - 常勤週所定労働時間（デフォルト40h）
 * @returns ExcelJS Workbook
 */
export async function createActualVsPlanWorkbook(
  staffSchedules: StaffSchedule[],
  staffList: Staff[],
  shiftSettings: FacilityShiftSettings,
  facilityName: string,
  targetMonth: string,
  standardWeeklyHours: number = 40
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI介護シフトスケジューラー';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('予実勤務形態一覧表', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const dates = getDatesInMonth(targetMonth);
  const daysInMonth = dates.length;

  // FTE（予定・実績 両方）
  const ftePlan = calculateFullTimeEquivalent(
    staffSchedules, staffList, shiftSettings, standardWeeklyHours, false
  );
  const fteActual = calculateFullTimeEquivalent(
    staffSchedules, staffList, shiftSettings, standardWeeklyHours, true
  );

  // 列定義
  const COL_NAME = 1;
  const COL_ROLE = 2;
  const COL_EMP = 3;
  const COL_TYPE = 4; // 予定/実績
  const COL_DAYS_START = 5;
  const COL_TOTAL_HOURS = COL_DAYS_START + daysInMonth;
  const COL_FTE = COL_TOTAL_HOURS + 1;
  const totalCols = COL_FTE;

  // 列幅
  worksheet.getColumn(COL_NAME).width = 12;
  worksheet.getColumn(COL_ROLE).width = 10;
  worksheet.getColumn(COL_EMP).width = 7;
  worksheet.getColumn(COL_TYPE).width = 4;
  for (let d = 0; d < daysInMonth; d++) {
    worksheet.getColumn(COL_DAYS_START + d).width = 3.2;
  }
  worksheet.getColumn(COL_TOTAL_HOURS).width = 9;
  worksheet.getColumn(COL_FTE).width = 8;

  // タイトル
  const titleRow = worksheet.getRow(1);
  const titleCell = titleRow.getCell(COL_NAME);
  titleCell.value = `${facilityName} 勤務形態一覧表（予実）　${formatTargetMonthJa(targetMonth)}`;
  titleCell.font = STYLES.titleFont;
  worksheet.mergeCells(1, COL_NAME, 1, totalCols);
  titleRow.height = 22;

  // ヘッダー行
  const headerRow = worksheet.getRow(3);
  headerRow.height = 28;

  const setHeader = (col: number, value: string) => {
    const cell = headerRow.getCell(col);
    cell.value = value;
    cell.font = STYLES.headerFont;
    cell.fill = STYLES.headerFill;
    cell.alignment = { ...STYLES.alignCenter, wrapText: true };
    cell.border = STYLES.borderThin;
  };

  setHeader(COL_NAME, '職員氏名');
  setHeader(COL_ROLE, '職種');
  setHeader(COL_EMP, '勤務\n形態');
  setHeader(COL_TYPE, '予/実');

  for (let d = 0; d < daysInMonth; d++) {
    const date = new Date(dates[d]);
    const day = date.getDate();
    const weekDay = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const cell = headerRow.getCell(COL_DAYS_START + d);
    cell.value = `${day}\n${weekDay}`;
    cell.font = {
      bold: true,
      size: 9,
      color: isWeekend ? { argb: 'FFCC0000' } : undefined,
    };
    cell.fill = STYLES.headerFill;
    cell.alignment = { ...STYLES.alignCenter, wrapText: true };
    cell.border = STYLES.borderThin;
  }

  setHeader(COL_TOTAL_HOURS, '月間\n勤務時間');
  setHeader(COL_FTE, '常勤\n換算値');

  // スタッフデータ（1スタッフにつき2行: 予定行・実績行）
  let currentDataRow = 4;

  staffSchedules.forEach((ss, _idx) => {
    const staff = staffList.find((s) => s.id === ss.staffId);
    const planEntry = ftePlan.find((e) => e.staffId === ss.staffId);
    const actualEntry = fteActual.find((e) => e.staffId === ss.staffId);
    const empType = staff?.employmentType ?? 'A';

    const planRow = worksheet.getRow(currentDataRow);
    const actualRow = worksheet.getRow(currentDataRow + 1);
    planRow.height = 14;
    actualRow.height = 14;

    // 氏名・職種・勤務形態（予定行のみ、2行マージ）
    const nameCell = planRow.getCell(COL_NAME);
    nameCell.value = ss.staffName;
    nameCell.font = { bold: true, size: 9 };
    nameCell.alignment = { ...STYLES.alignLeft, vertical: 'middle' };
    nameCell.border = STYLES.borderThin;
    worksheet.mergeCells(currentDataRow, COL_NAME, currentDataRow + 1, COL_NAME);

    const roleCell = planRow.getCell(COL_ROLE);
    roleCell.value = staff?.role ?? '';
    roleCell.font = { size: 9 };
    roleCell.alignment = STYLES.alignCenter;
    roleCell.border = STYLES.borderThin;
    worksheet.mergeCells(currentDataRow, COL_ROLE, currentDataRow + 1, COL_ROLE);

    const empCell = planRow.getCell(COL_EMP);
    empCell.value = empType;
    empCell.font = { size: 9 };
    empCell.alignment = STYLES.alignCenter;
    empCell.border = STYLES.borderThin;
    worksheet.mergeCells(currentDataRow, COL_EMP, currentDataRow + 1, COL_EMP);

    // 予定/実績ラベル
    const setPRLabel = (row: ExcelJS.Row, label: string) => {
      const cell = row.getCell(COL_TYPE);
      cell.value = label;
      cell.font = { size: 8, italic: true };
      cell.alignment = STYLES.alignCenter;
      cell.border = STYLES.borderThin;
      cell.fill = label === '予'
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
    };
    setPRLabel(planRow, '予');
    setPRLabel(actualRow, '実');

    // 各日シフト
    dates.forEach((date, d) => {
      const shift = ss.monthlyShifts.find((s) => s.date === date);
      const planned = shift?.plannedShiftType ?? '';
      const actual = shift?.actualShiftType ?? '';
      const hasDiff = actual !== '' && actual !== planned;

      const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
      const weekendColor = { argb: 'FFCC0000' };

      // 予定セル
      const pCell = planRow.getCell(COL_DAYS_START + d);
      pCell.value = planned ? toAbbrev(planned) : '';
      pCell.font = { size: 9, color: isWeekend ? weekendColor : undefined };
      pCell.alignment = STYLES.alignCenter;
      pCell.border = STYLES.borderThin;
      pCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

      // 実績セル
      const aCell = actualRow.getCell(COL_DAYS_START + d);
      aCell.value = actual ? toAbbrev(actual) : '';
      aCell.font = { size: 9, color: isWeekend ? weekendColor : undefined };
      aCell.alignment = STYLES.alignCenter;
      aCell.border = STYLES.borderThin;
      // 差異があればオレンジハイライト
      aCell.fill = hasDiff
        ? STYLES.diffFill
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
    });

    // 集計（予定行）
    const setAgg = (row: ExcelJS.Row, hours: number, fte: number) => {
      const hCell = row.getCell(COL_TOTAL_HOURS);
      hCell.value = hours;
      hCell.font = { size: 9 };
      hCell.alignment = STYLES.alignCenter;
      hCell.border = STYLES.borderThin;

      const fCell = row.getCell(COL_FTE);
      fCell.value = fte;
      fCell.font = { size: 9 };
      fCell.alignment = STYLES.alignCenter;
      fCell.border = STYLES.borderThin;
    };
    setAgg(planRow, planEntry?.monthlyHours ?? 0, planEntry?.fteValue ?? 0);
    setAgg(actualRow, actualEntry?.monthlyHours ?? 0, actualEntry?.fteValue ?? 0);

    // 集計列をマージ（FTEのみ）
    worksheet.mergeCells(currentDataRow, COL_FTE, currentDataRow + 1, COL_FTE);

    currentDataRow += 2;
  });

  // 凡例行
  const legendRow = worksheet.getRow(currentDataRow + 1);
  const legendCell = legendRow.getCell(COL_NAME);
  legendCell.value =
    '凡例: 予=予定シフト 実=実績シフト オレンジ=予実差異あり　' +
    '略称: 早=早番 日=日勤 遅=遅番 夜=夜勤 明=明け休み 休=休日 有=有給';
  legendCell.font = { size: 8, color: { argb: 'FF666666' } };
  worksheet.mergeCells(currentDataRow + 1, COL_NAME, currentDataRow + 1, totalCols);

  return workbook;
}

// ==================== ダウンロードヘルパー ====================

/**
 * ExcelJS Workbook をブラウザでダウンロード
 *
 * @param workbook - ExcelJS Workbook
 * @param filename - ファイル名（例: 勤務形態一覧表_202501.xlsx）
 */
export async function downloadExcel(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * ファイル名を生成（標準様式第1号）
 *
 * @param targetMonth - YYYY-MM
 * @returns 例: 勤務形態一覧表_202501.xlsx
 */
export function generateStandardFormFilename(targetMonth: string): string {
  const ym = targetMonth.replace('-', '');
  return `勤務形態一覧表_${ym}.xlsx`;
}

/**
 * ファイル名を生成（予実2段書き）
 *
 * @param targetMonth - YYYY-MM
 * @returns 例: 勤務形態一覧表_予実_202501.xlsx
 */
export function generateActualVsPlanFilename(targetMonth: string): string {
  const ym = targetMonth.replace('-', '');
  return `勤務形態一覧表_予実_${ym}.xlsx`;
}
