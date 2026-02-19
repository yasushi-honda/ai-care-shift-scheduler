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
import type { StaffSchedule, Staff, FacilityShiftSettings, StandardFormOptions, CareServiceType } from '../../types';
import { calculateFullTimeEquivalent, groupFTEByRole, calculateNightHours } from '../services/complianceService';
import { getColumnConfig } from '../config/standardFormColumns';

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
 * @param facilityNumber - 事業所番号（省略可）
 * @param serviceType - サービス種類（省略可）
 * @param creatorName - 作成者氏名（省略可）
 * @returns ExcelJS Workbook
 */
export async function createStandardFormWorkbook(
  staffSchedules: StaffSchedule[],
  staffList: Staff[],
  shiftSettings: FacilityShiftSettings,
  facilityName: string,
  targetMonth: string,
  standardWeeklyHours: number = 40,
  facilityNumber?: string,
  serviceType?: CareServiceType,
  creatorName?: string
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

  // 職種別グループ化
  const roleGroups = groupFTEByRole(fteEntries);

  // ==================== 列定義（Config-Driven） ====================
  const colConfig = getColumnConfig(serviceType ?? '通所介護');
  const fixedColCount = colConfig.fixedColumns.length;
  const tailColCount = colConfig.tailColumns.length;

  // 固定列の Excel 列番号（1-indexed）
  const fixedColNums: Record<string, number> = {};
  colConfig.fixedColumns.forEach((col, i) => {
    fixedColNums[col.key] = i + 1;
  });

  const COL_DAYS_START = fixedColCount + 1;
  const totalCols = fixedColCount + daysInMonth + tailColCount;

  // 集計列の Excel 列番号
  const tailColNums: Record<string, number> = {};
  colConfig.tailColumns.forEach((col, i) => {
    tailColNums[col.key] = COL_DAYS_START + daysInMonth + i;
  });

  // 夜間勤務時間マップ（特養のみ計算）
  const nightHoursMap = new Map<string, number>();
  if (serviceType === '介護老人福祉施設') {
    for (const ss of staffSchedules) {
      nightHoursMap.set(ss.staffId, calculateNightHours(ss, shiftSettings, false));
    }
  }

  // 列幅設定
  colConfig.fixedColumns.forEach((col, i) => {
    worksheet.getColumn(i + 1).width = col.excelWidth;
  });
  for (let d = 0; d < daysInMonth; d++) {
    worksheet.getColumn(COL_DAYS_START + d).width = 3.2;
  }
  colConfig.tailColumns.forEach((col, i) => {
    worksheet.getColumn(COL_DAYS_START + daysInMonth + i).width = col.excelWidth;
  });

  // ==================== 行1: タイトル ====================
  const colName = fixedColNums['name'] ?? 1;
  const titleRow = worksheet.getRow(1);
  const titleCell = titleRow.getCell(colName);
  titleCell.value = '従業者の勤務の体制及び勤務形態一覧表';
  titleCell.font = STYLES.titleFont;
  titleCell.alignment = STYLES.alignLeft;
  worksheet.mergeCells(1, colName, 1, totalCols);
  titleRow.height = 24;

  // ==================== 行2: 事業所番号・サービス種類 ====================
  const facilityInfoRow = worksheet.getRow(2);
  facilityInfoRow.getCell(colName).value =
    `事業所番号: ${facilityNumber ?? ''}　サービス種類: ${serviceType ?? ''}`;
  facilityInfoRow.getCell(colName).font = { size: 10 };
  worksheet.mergeCells(2, colName, 2, totalCols);
  facilityInfoRow.height = 18;

  // ==================== 行3: 施設名・対象月・作成日・作成者 ====================
  const infoRow = worksheet.getRow(3);
  infoRow.getCell(colName).value =
    `事業所名: ${facilityName}　対象月: ${formatTargetMonthJa(targetMonth)}　作成日: ${new Date().toLocaleDateString('ja-JP')}　作成者: ${creatorName ?? ''}`;
  infoRow.getCell(colName).font = { size: 10 };
  worksheet.mergeCells(3, colName, 3, totalCols);
  infoRow.height = 18;

  // ==================== 行5: ヘッダー ====================
  const headerRow = worksheet.getRow(5);
  headerRow.height = 28;

  const setHeader = (col: number, value: string) => {
    const cell = headerRow.getCell(col);
    cell.value = value;
    cell.font = STYLES.headerFont;
    cell.fill = STYLES.headerFill;
    cell.alignment = { ...STYLES.alignCenter, wrapText: true };
    cell.border = STYLES.borderThin;
  };

  // 固定列ヘッダー（Config-Driven）
  colConfig.fixedColumns.forEach((col) => {
    const colNum = fixedColNums[col.key];
    // Excel では改行を \n で表現
    const headerVal = col.key === 'employment' ? '常勤/\n非常勤'
      : col.key === 'concurrency' ? '専従/\n兼務'
      : col.key === 'hireDate' ? '雇用\n開始日'
      : col.headerText;
    setHeader(colNum, headerVal);
  });

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

  // 集計列ヘッダー（Config-Driven）
  colConfig.tailColumns.forEach((col) => {
    const colNum = tailColNums[col.key];
    const headerVal = col.key === 'monthlyHours' ? '月間\n勤務時間'
      : col.key === 'weeklyAvg' ? '週平均\nh'
      : col.key === 'fte' ? '常勤\n換算値'
      : col.headerText;
    setHeader(colNum, headerVal);
  });

  // ==================== 行6+: 職種別グループ化スタッフデータ ====================
  // staffSchedules の元の順序を保持するためのマップ
  const ssOrderMap = new Map<string, number>();
  staffSchedules.forEach((ss, idx) => ssOrderMap.set(ss.staffId, idx));

  let currentDataRow = 6;
  let staffRowNumber = 1; // 通し番号

  for (const group of roleGroups) {
    // グループヘッダー行（薄青）
    const groupHeaderRow = worksheet.getRow(currentDataRow);
    groupHeaderRow.height = 16;
    const groupHeaderCell = groupHeaderRow.getCell(1);
    groupHeaderCell.value = `【${group.role}】`;
    groupHeaderCell.font = { bold: true, size: 9 };
    groupHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEEBF7' } };
    groupHeaderCell.alignment = STYLES.alignLeft;
    groupHeaderCell.border = STYLES.borderThin;
    worksheet.mergeCells(currentDataRow, 1, currentDataRow, totalCols);
    currentDataRow++;

    // グループ内スタッフを元のstaffSchedules順にソート
    const sortedEntries = [...group.entries].sort((a, b) => {
      const idxA = ssOrderMap.get(a.staffId) ?? 9999;
      const idxB = ssOrderMap.get(b.staffId) ?? 9999;
      return idxA - idxB;
    });

    // スタッフデータ行
    for (const fteEntry of sortedEntries) {
      const ss = staffSchedules.find((s) => s.staffId === fteEntry.staffId);
      if (!ss) continue;

      const staff = staffList.find((s) => s.id === ss.staffId);
      const empType = staff?.employmentType ?? 'A';

      // 常勤/非常勤判定: A/B → 常勤, C/D → 非常勤
      const fulltimeLabel = (empType === 'A' || empType === 'B') ? '常勤' : '非常勤';
      // 専従/兼務判定: A/C → 専従, B/D → 兼務
      const dutyLabel = (empType === 'A' || empType === 'C') ? '専従' : '兼務';

      const row = worksheet.getRow(currentDataRow);
      row.height = 16;

      const setCell = (col: number, value: ExcelJS.CellValue, opts?: Partial<ExcelJS.Style>) => {
        const cell = row.getCell(col);
        cell.value = value;
        cell.font = { size: 9, ...opts?.font };
        cell.alignment = { ...STYLES.alignCenter, ...opts?.alignment };
        cell.border = STYLES.borderThin;
        if (opts?.fill) cell.fill = opts.fill;
      };

      // 固定列データセル（Config-Driven）
      colConfig.fixedColumns.forEach((col) => {
        const colNum = fixedColNums[col.key];
        let value: ExcelJS.CellValue = '';
        let opts: Partial<ExcelJS.Style> | undefined;
        switch (col.key) {
          case 'no':
            value = staffRowNumber;
            break;
          case 'name':
            value = ss.staffName;
            opts = { alignment: { horizontal: 'left', vertical: 'middle' } };
            break;
          case 'role':
            value = staff?.role ?? '';
            break;
          case 'qualification':
            value = staff?.qualifications?.join(', ') ?? '';
            break;
          case 'employment':
            value = fulltimeLabel;
            break;
          case 'concurrency':
            value = dutyLabel;
            break;
          case 'hireDate':
            value = staff?.hireDate ?? '';
            break;
          case 'serviceHours':
            // TODO: 現データモデルに専用フィールドなし → 月間勤務時間で代替
            value = fteEntry.monthlyHours;
            break;
        }
        setCell(colNum, value, opts);
      });

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

      // 集計列データセル（Config-Driven）
      colConfig.tailColumns.forEach((col) => {
        const colNum = tailColNums[col.key];
        let value: ExcelJS.CellValue = 0;
        switch (col.key) {
          case 'monthlyHours': value = fteEntry.monthlyHours; break;
          case 'weeklyAvg':    value = fteEntry.weeklyAverageHours; break;
          case 'fte':          value = fteEntry.fteValue; break;
          case 'nightHours':   value = nightHoursMap.get(ss.staffId) ?? 0; break;
        }
        setCell(colNum, value);
      });

      staffRowNumber++;
      currentDataRow++;
    }

    // 小計行（薄黄）
    const subtotalRow = worksheet.getRow(currentDataRow);
    subtotalRow.height = 16;

    const setSubtotalCell = (col: number, value: ExcelJS.CellValue) => {
      const cell = subtotalRow.getCell(col);
      cell.value = value;
      cell.font = { bold: true, size: 9 };
      cell.alignment = STYLES.alignCenter;
      cell.border = STYLES.borderThin;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
    };

    const firstFixedCol = 1;
    const lastFixedCol = fixedColCount;
    setSubtotalCell(firstFixedCol, `${group.role} 小計`);
    worksheet.mergeCells(currentDataRow, firstFixedCol, currentDataRow, lastFixedCol);

    // グループ内夜間勤務合計
    const groupNightHours = group.entries.reduce(
      (sum, e) => sum + (nightHoursMap.get(e.staffId) ?? 0), 0
    );

    colConfig.tailColumns.forEach((col) => {
      const colNum = tailColNums[col.key];
      let value: ExcelJS.CellValue = 0;
      switch (col.key) {
        case 'monthlyHours': value = group.subtotalHours; break;
        case 'weeklyAvg':    value = group.subtotalWeeklyAvgHours; break;
        case 'fte':          value = group.subtotalFte; break;
        case 'nightHours':   value = Math.round(groupNightHours * 10) / 10; break;
      }
      setSubtotalCell(colNum, value);
    });

    currentDataRow++;
  }

  // ==================== 合計行 ====================
  const totalRowIdx = currentDataRow + 1;
  const totalRow = worksheet.getRow(totalRowIdx);
  totalRow.height = 18;

  const totalFTE = fteEntries.reduce((sum, e) => sum + e.fteValue, 0);
  const totalHours = fteEntries.reduce((sum, e) => sum + e.monthlyHours, 0);
  const totalWeeklyAvg = fteEntries.reduce((sum, e) => sum + e.weeklyAverageHours, 0);
  const totalNightHours = Array.from(nightHoursMap.values()).reduce((sum, h) => sum + h, 0);

  const setTotalCell = (col: number, value: ExcelJS.CellValue) => {
    const cell = totalRow.getCell(col);
    cell.value = value;
    cell.font = { bold: true, size: 10 };
    cell.alignment = STYLES.alignCenter;
    cell.border = STYLES.borderThin;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
  };

  setTotalCell(1, '合計');
  worksheet.mergeCells(totalRowIdx, 1, totalRowIdx, fixedColCount);

  colConfig.tailColumns.forEach((col) => {
    const colNum = tailColNums[col.key];
    let value: ExcelJS.CellValue = 0;
    switch (col.key) {
      case 'monthlyHours': value = Math.round(totalHours * 10) / 10; break;
      case 'weeklyAvg':    value = Math.round(totalWeeklyAvg * 10) / 10; break;
      case 'fte':          value = Math.round(totalFTE * 100) / 100; break;
      case 'nightHours':   value = Math.round(totalNightHours * 10) / 10; break;
    }
    setTotalCell(colNum, value);
  });

  // ==================== 注記行 ====================
  const noteRow = worksheet.getRow(totalRowIdx + 1);
  const noteCell = noteRow.getCell(1);
  noteCell.value =
    `※ 常勤職員の有給休暇は所定労働時間として計上しています　` +
    `※ 常勤換算値 = 月間勤務時間 ÷ (週所定労働時間${standardWeeklyHours}h × 4.33週)　` +
    '略称: 早=早番 日=日勤 遅=遅番 夜=夜勤 明=明け休み 休=休日 有=有給';
  noteCell.font = { size: 8, color: { argb: 'FF666666' } };
  worksheet.mergeCells(totalRowIdx + 1, 1, totalRowIdx + 1, totalCols);

  return workbook;
}

/**
 * StandardFormOptions オブジェクトを受け取って標準様式第1号を生成するラッパー
 *
 * @param options - StandardFormOptions
 * @returns ExcelJS Workbook
 */
export async function createStandardFormWorkbookFromOptions(
  options: StandardFormOptions
): Promise<ExcelJS.Workbook> {
  return createStandardFormWorkbook(
    options.staffSchedules,
    options.staffList,
    options.shiftSettings,
    options.facilityName,
    options.targetMonth,
    options.standardWeeklyHours ?? 40,
    options.facilityNumber,
    options.serviceType,
    options.creatorName
  );
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
