/**
 * StandardFormViewer.tsx
 *
 * Phase 62: 厚生労働省標準様式第1号「従業者の勤務の体制及び勤務形態一覧表」
 *           スプレッドシート形式プレビューコンポーネント
 *
 * Phase 66: Config-Driven 列定義でサービス種別対応
 *   - 通所介護（デフォルト）: 7固定列 + 3集計列
 *   - 訪問介護:              8固定列（+サービス提供時間） + 3集計列
 *   - 介護老人福祉施設（特養）: 7固定列 + 4集計列（+夜間勤務h）
 *
 * 機能:
 * - 様式ヘッダー（事業所名・事業所番号・サービス種類・対象月・作成日・作成者）
 * - 職種別グループ行 + スタッフデータ行 + 小計行 + 合計行
 * - 日付列（月の全日数）：週末は赤ヘッダー
 * - 常勤/非常勤・専従/兼務区分の表示
 * - 有給・休日・夜勤シフトの色分け
 * - showDiff=true 時に予実差分セルをオレンジ強調
 * - 凡例セクション
 * - 印刷最適化: A4横（landscape）対応
 */

import React, { useMemo } from 'react';
import type { StaffSchedule, Staff, FacilityShiftSettings, CareServiceType } from '../../types';
import { calculateFullTimeEquivalent, groupFTEByRole, calculateNightHours } from '../services/complianceService';
import { getColumnConfig } from '../config/standardFormColumns';
import { DEFAULT_STANDARD_WEEKLY_HOURS } from '../../constants';

// ==================== 型定義 ====================

interface StandardFormViewerProps {
  staffSchedules: StaffSchedule[];
  staffList: Staff[];
  shiftSettings: FacilityShiftSettings;
  facilityName: string;
  targetMonth: string; // YYYY-MM
  standardWeeklyHours?: number;
  facilityNumber?: string;
  serviceType?: CareServiceType;
  creatorName?: string;
  showDiff?: boolean; // orange highlight for diff cells
}

// ==================== ヘルパー関数 ====================

/**
 * YYYY-MM → 令和X年Y月形式に変換
 * 元号変換: 令和元年 = 2019年
 */
function formatTargetMonthJa(targetMonth: string): string {
  const [yearStr, monthStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // 令和: 2019年5月1日〜
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    return `令和${reiwaYear === 1 ? '元' : String(reiwaYear)}年${month}月`;
  }
  // 平成: 1989年1月8日〜2019年4月30日
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    return `平成${heiseiYear === 1 ? '元' : String(heiseiYear)}年${month}月`;
  }
  // 昭和: 1926年12月25日〜1989年1月7日
  if (year >= 1926) {
    const showaYear = year - 1925;
    return `昭和${showaYear === 1 ? '元' : String(showaYear)}年${month}月`;
  }
  // フォールバック: 西暦
  return `${year}年${month}月`;
}

/**
 * YYYY-MM に対して月の全日付 (YYYY-MM-DD) を返す
 */
function getDatesInMonth(targetMonth: string): string[] {
  const [yearStr, monthStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
  });
}

/**
 * 週末判定
 */
function isWeekend(dateStr: string): boolean {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * シフト名 → 1〜2文字の略称
 */
function getShiftAbbrev(shiftName: string): string {
  const abbrev: Record<string, string> = {
    '早番': '早',
    '日勤': '日',
    '遅番': '遅',
    '夜勤': '夜',
    '明け休み': '明',
    '休': '休',
    '有給休暇': '有',
    '研修': '研',
  };
  return abbrev[shiftName] ?? (shiftName.charAt(0) || '');
}

/**
 * シフト名からセル色クラスを返す
 * 返り値: Tailwind クラス文字列（テキスト色 + 背景色）
 */
function getShiftCellColorClasses(shiftName: string): string {
  if (shiftName === '有給休暇') return 'text-green-700 bg-green-50';
  if (shiftName === '休' || shiftName === '明け休み') return 'text-gray-400';
  if (shiftName === '夜勤') return 'text-indigo-700';
  if (!shiftName) return 'text-gray-300';
  return 'text-gray-700';
}

/**
 * 常勤/非常勤ラベル
 */
function getEmploymentLabel(employmentType: string | undefined): string {
  if (!employmentType) return '';
  const isFullTime = employmentType === 'A' || employmentType === 'B';
  return isFullTime ? '常勤' : '非常勤';
}

/**
 * 専従/兼務ラベル
 */
function getConcurrencyLabel(employmentType: string | undefined): string {
  if (!employmentType) return '';
  const isDedicated = employmentType === 'A' || employmentType === 'C';
  return isDedicated ? '専従' : '兼務';
}

// ==================== 印刷用スタイル ====================

/**
 * A4横（landscape）印刷最適化 CSS
 *
 * 設計方針:
 * - @page で用紙サイズ・余白を固定（A4横 margin 10mm）
 * - フォント 7px + padding 1px 2px で 41列（最大）を幅 220mm 以内に収める
 * - sticky position を static にリセット（印刷でのレイアウト崩れ防止）
 * - print-color-adjust: exact で背景色（職種色・小計行アンバー等）を確実に印刷
 * - break-after/before で職種グループの途中改ページを抑制
 */
const PRINT_STYLES = `
@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  .sfv-wrap {
    font-size: 7px !important;
    color: #000 !important;
  }

  .sfv-header {
    border: none !important;
    border-radius: 0 !important;
    padding: 0 0 4px 0 !important;
    margin-bottom: 4px !important;
  }

  .sfv-header h1 {
    font-size: 10px !important;
    margin-bottom: 2px !important;
  }

  .sfv-header-meta {
    font-size: 7px !important;
    gap: 8px !important;
  }

  .sfv-overflow {
    overflow: visible !important;
    border: none !important;
    border-radius: 0 !important;
  }

  .sfv-table {
    font-size: 7px !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sfv-table th,
  .sfv-table td {
    padding: 1px 2px !important;
  }

  /* sticky 解除（印刷では位置が固定にならないため不要・むしろ邪魔） */
  .sfv-table .sticky {
    position: static !important;
    z-index: auto !important;
  }

  /* 日付列を幅詰め: 14px × 31 = 434px ≈ 115mm（全41列で約220mm） */
  .sfv-day-col {
    width: 14px !important;
    min-width: 14px !important;
    max-width: 14px !important;
    padding: 1px 0 !important;
  }

  /* 職種グループ行の直後で改ページしない（グループ見出しだけ次ページに残る現象を防止） */
  .sfv-group-row {
    break-after: avoid;
    page-break-after: avoid;
  }

  /* 小計行・合計行の直前で改ページしない（最終スタッフ行と必ず同ページに） */
  .sfv-subtotal-row,
  .sfv-total-row {
    break-before: avoid;
    page-break-before: avoid;
  }

  .sfv-legend {
    margin-top: 4px !important;
    font-size: 7px !important;
  }
}
`;

// ==================== getCellValue ヘルパー ====================

type FteEntry = ReturnType<typeof calculateFullTimeEquivalent>[number];

/**
 * 固定列のキーから表示値を返す
 */
function getCellValue(
  key: string,
  staff: Staff | undefined,
  entry: FteEntry,
  rowIndex: number
): React.ReactNode {
  switch (key) {
    case 'no':
      return rowIndex + 1;
    case 'name':
      return entry.staffName;
    case 'role':
      return entry.role;
    case 'qualification':
      return staff?.qualifications && staff.qualifications.length > 0
        ? staff.qualifications[0]
        : '';
    case 'employment':
      return getEmploymentLabel(entry.employmentType);
    case 'concurrency':
      return getConcurrencyLabel(entry.employmentType);
    case 'hireDate':
      return staff?.hireDate ?? '';
    case 'serviceHours':
      // TODO: 現データモデルに専用フィールドなし → 月間勤務時間で代替
      return entry.monthlyHours.toFixed(1);
    default:
      return '';
  }
}

/**
 * 集計列のキーから表示値を返す
 */
function getTailValue(
  key: string,
  fteEntry: FteEntry | undefined,
  nightHours: number
): React.ReactNode {
  switch (key) {
    case 'monthlyHours':
      return fteEntry ? fteEntry.monthlyHours.toFixed(1) : '0.0';
    case 'weeklyAvg':
      return fteEntry ? fteEntry.weeklyAverageHours.toFixed(1) : '0.0';
    case 'fte':
      return fteEntry ? (
        <span className="font-semibold text-indigo-700">{fteEntry.fteValue.toFixed(2)}</span>
      ) : '0.00';
    case 'nightHours':
      return nightHours.toFixed(1);
    default:
      return '';
  }
}

/**
 * 固定列のヘッダー JSX（常勤/非常勤・専従/兼務は改行あり）
 */
function renderFixedColumnHeader(key: string, headerText: string): React.ReactNode {
  if (key === 'employment') return <>常勤/<br />非常勤</>;
  if (key === 'concurrency') return <>専従/<br />兼務</>;
  return headerText;
}

/**
 * 固定列の sticky クラス（No.・氏名のみ sticky）
 */
function getFixedColStickyHeaderClass(key: string): string {
  if (key === 'no')   return 'sticky left-0 z-20 bg-slate-800';
  if (key === 'name') return 'sticky left-8 z-20 bg-slate-800';
  return '';
}

function getFixedColStickyCellClass(key: string): string {
  if (key === 'no')   return 'sticky left-0 z-10 bg-inherit';
  if (key === 'name') return 'sticky left-8 z-10 bg-inherit';
  return '';
}

// ==================== メインコンポーネント ====================

export function StandardFormViewer({
  staffSchedules,
  staffList,
  shiftSettings,
  facilityName,
  targetMonth,
  standardWeeklyHours = DEFAULT_STANDARD_WEEKLY_HOURS,
  facilityNumber,
  serviceType,
  creatorName,
  showDiff = false,
}: StandardFormViewerProps): React.ReactElement {

  // サービス種別列定義（動的）
  const colConfig = useMemo(
    () => getColumnConfig(serviceType ?? '通所介護'),
    [serviceType]
  );
  const FIXED_COLS = colConfig.fixedColumns.length;
  const TAIL_COLS = colConfig.tailColumns.length;

  // 月の全日付リスト
  const dates = useMemo(() => getDatesInMonth(targetMonth), [targetMonth]);
  const daysInMonth = dates.length;
  const totalCols = FIXED_COLS + daysInMonth + TAIL_COLS;

  // FTE エントリ計算（予定ベース）
  const fteEntries = useMemo(
    () =>
      calculateFullTimeEquivalent(
        staffSchedules,
        staffList,
        shiftSettings,
        standardWeeklyHours,
        false // 予定ベース
      ),
    [staffSchedules, staffList, shiftSettings, standardWeeklyHours]
  );

  // 職種別グループ化
  const roleGroups = useMemo(() => groupFTEByRole(fteEntries), [fteEntries]);

  // スタッフID → Staff マップ
  const staffMap = useMemo(() => {
    const m = new Map<string, Staff>();
    for (const s of staffList) {
      m.set(s.id, s);
    }
    return m;
  }, [staffList]);

  // スタッフID → StaffSchedule マップ
  const scheduleMap = useMemo(() => {
    const m = new Map<string, StaffSchedule>();
    for (const ss of staffSchedules) {
      m.set(ss.staffId, ss);
    }
    return m;
  }, [staffSchedules]);

  // スタッフID → FTE エントリ マップ
  const fteMap = useMemo(() => {
    const m = new Map<string, FteEntry>();
    for (const e of fteEntries) {
      m.set(e.staffId, e);
    }
    return m;
  }, [fteEntries]);

  // スタッフID → 夜間勤務時間マップ（特養のみ計算、他は空）
  const nightHoursMap = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>();
    if (serviceType !== '介護老人福祉施設') return m;
    for (const ss of staffSchedules) {
      m.set(ss.staffId, calculateNightHours(ss, shiftSettings, false));
    }
    return m;
  }, [serviceType, staffSchedules, shiftSettings]);

  // 合計行の値
  const totalHours = useMemo(
    () =>
      Math.round(
        roleGroups.reduce((sum, g) => sum + g.subtotalHours, 0) * 10
      ) / 10,
    [roleGroups]
  );
  const totalWeeklyAvg = useMemo(
    () =>
      Math.round(
        roleGroups.reduce((sum, g) => sum + g.subtotalWeeklyAvgHours, 0) * 10
      ) / 10,
    [roleGroups]
  );
  const totalFte = useMemo(
    () =>
      Math.round(
        roleGroups.reduce((sum, g) => sum + g.subtotalFte, 0) * 100
      ) / 100,
    [roleGroups]
  );
  const totalNightHours = useMemo(() => {
    let sum = 0;
    nightHoursMap.forEach((h) => { sum += h; });
    return Math.round(sum * 10) / 10;
  }, [nightHoursMap]);

  // 今日の日付（作成日）
  const todayStr = useMemo(
    () => new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }),
    []
  );

  return (
    <>
      {/* 印刷専用スタイル（A4横・フォント縮小・sticky解除・背景色印刷） */}
      <style>{PRINT_STYLES}</style>

      <div className="font-sans text-gray-900 sfv-wrap">
        {/* ===== ヘッダーセクション ===== */}
        <div className="bg-white border border-gray-300 rounded p-4 mb-2 sfv-header">
          <h1 className="text-lg font-bold text-center text-gray-900 mb-2">
            従業者の勤務の体制及び勤務形態一覧表
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-700 sfv-header-meta">
            <span>事業所名: {facilityName}</span>
            {facilityNumber && <span>事業所番号: {facilityNumber}</span>}
            {serviceType && <span>サービス種類: {serviceType}</span>}
            <span>対象月: {formatTargetMonthJa(targetMonth)}</span>
            <span>作成日: {todayStr}</span>
            {creatorName && <span>作成者: {creatorName}</span>}
          </div>
          {/* 印刷ボタン（印刷時は非表示） */}
          <div className="mt-2 flex justify-end print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              印刷 / PDFとして保存
            </button>
          </div>
        </div>

        {/* ===== 表本体 ===== */}
        <div className="overflow-x-auto border border-gray-200 rounded sfv-overflow">
          <table className="border-collapse text-xs w-full sfv-table">
            {/* ===== テーブルヘッダー ===== */}
            <thead className="bg-slate-800 text-white">
              <tr>
                {/* 固定列ヘッダー */}
                {colConfig.fixedColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`${getFixedColStickyHeaderClass(col.key)} border border-slate-700 px-1 py-1.5 text-center font-semibold whitespace-nowrap ${col.widthClass}`}
                  >
                    {renderFixedColumnHeader(col.key, col.headerText)}
                  </th>
                ))}

                {/* 日付列ヘッダー */}
                {dates.map((dateStr) => {
                  const day = parseInt(dateStr.slice(8), 10);
                  const weekend = isWeekend(dateStr);
                  return (
                    <th
                      key={dateStr}
                      className={`sfv-day-col border border-slate-700 px-0.5 py-1.5 text-center font-semibold w-6 ${
                        weekend ? 'text-red-400 print:text-red-600' : 'text-white'
                      }`}
                    >
                      {day}
                    </th>
                  );
                })}

                {/* 集計列ヘッダー */}
                {colConfig.tailColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`border border-slate-700 px-1 py-1.5 text-center font-semibold whitespace-nowrap ${col.widthClass}`}
                  >
                    {col.headerText}
                  </th>
                ))}
              </tr>
            </thead>

            {/* ===== テーブルボディ ===== */}
            <tbody>
              {roleGroups.length === 0 ? (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="px-4 py-6 text-center text-gray-500 bg-gray-50"
                  >
                    スタッフデータがありません
                  </td>
                </tr>
              ) : (
                roleGroups.map((group) => {
                  // グループ内の夜間勤務合計
                  const groupNightHours = Math.round(
                    group.entries.reduce(
                      (sum, e) => sum + (nightHoursMap.get(e.staffId) ?? 0), 0
                    ) * 10
                  ) / 10;

                  return (
                    <React.Fragment key={group.role}>
                      {/* 職種グループヘッダー行 */}
                      <tr className="bg-indigo-50 sfv-group-row">
                        <td
                          colSpan={totalCols}
                          className="px-2 py-1 text-sm font-bold text-indigo-800 border border-indigo-200"
                        >
                          【{group.role}】 ({group.staffCount}名)
                        </td>
                      </tr>

                      {/* スタッフデータ行 */}
                      {group.entries.map((entry, rowIndex) => {
                        const staff = staffMap.get(entry.staffId);
                        const ss = scheduleMap.get(entry.staffId);
                        const fteEntry = fteMap.get(entry.staffId);
                        const isFullTime =
                          entry.employmentType === 'A' || entry.employmentType === 'B';
                        const nightHours = nightHoursMap.get(entry.staffId) ?? 0;

                        return (
                          <tr
                            key={entry.staffId}
                            className={
                              isFullTime
                                ? 'bg-white hover:bg-gray-50'
                                : 'bg-gray-50 hover:bg-gray-100'
                            }
                          >
                            {/* 固定列データセル */}
                            {colConfig.fixedColumns.map((col) => {
                              const stickyClass = getFixedColStickyCellClass(col.key);
                              const isName = col.key === 'name';
                              const isNo = col.key === 'no';
                              const isMono = col.key === 'hireDate' || col.key === 'serviceHours';
                              return (
                                <td
                                  key={col.key}
                                  className={`${stickyClass} border border-gray-200 py-1 text-center ${col.widthClass} ${
                                    isName ? 'px-2 font-medium text-gray-800 whitespace-nowrap text-left' :
                                    isNo   ? 'px-1 text-gray-500' :
                                    isMono ? 'px-1.5 text-gray-700 font-mono' :
                                             'px-1.5 text-gray-700'
                                  }`}
                                >
                                  {getCellValue(col.key, staff, entry, rowIndex)}
                                </td>
                              );
                            })}

                            {/* 日付セル */}
                            {dates.map((dateStr) => {
                              const shift = ss?.monthlyShifts.find(
                                (sh) => sh.date === dateStr
                              );
                              const plannedShiftName = shift?.plannedShiftType ?? '';
                              const actualShiftName = shift?.actualShiftType ?? '';
                              const displayShiftName = plannedShiftName;
                              const abbrev = displayShiftName
                                ? getShiftAbbrev(displayShiftName)
                                : '';
                              const hasDiff =
                                showDiff &&
                                !!actualShiftName &&
                                actualShiftName !== plannedShiftName;
                              const colorClasses = getShiftCellColorClasses(displayShiftName);

                              return (
                                <td
                                  key={dateStr}
                                  className={`sfv-day-col border border-gray-200 px-0.5 py-1 text-center font-mono w-6 ${colorClasses} ${
                                    hasDiff ? 'bg-orange-100' : ''
                                  }`}
                                  title={
                                    hasDiff
                                      ? `予定: ${plannedShiftName} / 実績: ${actualShiftName}`
                                      : displayShiftName
                                  }
                                >
                                  {abbrev || <span className="text-gray-200">-</span>}
                                </td>
                              );
                            })}

                            {/* 集計列データセル */}
                            {colConfig.tailColumns.map((col) => (
                              <td
                                key={col.key}
                                className={`border border-gray-200 px-1 py-1 text-center font-mono text-gray-800 ${col.widthClass}`}
                              >
                                {getTailValue(col.key, fteEntry, nightHours)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}

                      {/* 職種小計行 */}
                      <tr className="bg-amber-50 border-t-2 border-amber-300 sfv-subtotal-row">
                        <td
                          colSpan={FIXED_COLS}
                          className="px-2 py-1 text-xs font-semibold text-amber-800 text-right border border-amber-200"
                        >
                          {group.role} 小計
                        </td>
                        <td
                          colSpan={daysInMonth}
                          className="bg-amber-50 border border-amber-200"
                        />
                        {colConfig.tailColumns.map((col) => {
                          let value: React.ReactNode;
                          if (col.key === 'monthlyHours') value = group.subtotalHours.toFixed(1);
                          else if (col.key === 'weeklyAvg') value = group.subtotalWeeklyAvgHours.toFixed(1);
                          else if (col.key === 'fte') value = group.subtotalFte.toFixed(2);
                          else if (col.key === 'nightHours') value = groupNightHours.toFixed(1);
                          else value = '';
                          return (
                            <td
                              key={col.key}
                              className="border border-amber-200 text-xs font-bold text-amber-800 text-center px-1 py-1"
                            >
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })
              )}

              {/* ===== 合計行 ===== */}
              {roleGroups.length > 0 && (
                <tr className="bg-amber-100 font-bold border-t-2 border-amber-400 sfv-total-row">
                  <td
                    colSpan={FIXED_COLS}
                    className="text-sm font-bold text-amber-900 text-right px-2 py-1.5 border border-amber-300"
                  >
                    合計
                  </td>
                  <td
                    colSpan={daysInMonth}
                    className="bg-amber-100 border border-amber-300"
                  />
                  {colConfig.tailColumns.map((col) => {
                    let value: React.ReactNode;
                    if (col.key === 'monthlyHours') value = totalHours.toFixed(1);
                    else if (col.key === 'weeklyAvg') value = totalWeeklyAvg.toFixed(1);
                    else if (col.key === 'fte') value = totalFte.toFixed(2);
                    else if (col.key === 'nightHours') value = totalNightHours.toFixed(1);
                    else value = '';
                    return (
                      <td
                        key={col.key}
                        className="border border-amber-300 text-sm font-bold text-amber-900 text-center px-1 py-1.5"
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ===== 凡例セクション ===== */}
        <div className="mt-2 text-xs text-gray-500 space-y-1 sfv-legend">
          <p>略称: 早=早番 日=日勤 遅=遅番 夜=夜勤 明=明け休み 休=休日 有=有給休暇 研=研修</p>
          <p>
            ※ 常勤職員（A/B）の有給休暇は所定労働時間（週所定時間÷5）として月間勤務時間に計上しています
          </p>
          {serviceType === '介護老人福祉施設' && (
            <p>※ 夜間勤務h: 22:00〜翌5:00の勤務時間合計</p>
          )}
          {serviceType === '訪問介護' && (
            <p>※ サービス提供時間: 現在は月間勤務時間を代替表示しています</p>
          )}
          {showDiff && (
            <p>
              <span className="inline-block w-3 h-3 bg-orange-100 border border-orange-300 rounded-sm align-middle mr-1" />
              オレンジ色のセル: 予定シフトと実績シフトが異なるセルを示します
            </p>
          )}
        </div>
      </div>
    </>
  );
}
