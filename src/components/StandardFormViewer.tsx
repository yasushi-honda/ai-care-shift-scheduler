/**
 * StandardFormViewer.tsx
 *
 * Phase 62: 厚生労働省標準様式第1号「従業者の勤務の体制及び勤務形態一覧表」
 *           スプレッドシート形式プレビューコンポーネント
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
import type { StaffSchedule, Staff, FacilityShiftSettings } from '../../types';
import { calculateFullTimeEquivalent, groupFTEByRole } from '../services/complianceService';
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
  serviceType?: string;
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

  // 月の全日付リスト
  const dates = useMemo(() => getDatesInMonth(targetMonth), [targetMonth]);
  const daysInMonth = dates.length;

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
    const m = new Map<string, typeof fteEntries[number]>();
    for (const e of fteEntries) {
      m.set(e.staffId, e);
    }
    return m;
  }, [fteEntries]);

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

  // 今日の日付（作成日）
  const todayStr = useMemo(
    () => new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }),
    []
  );

  // 固定列数（No. + 氏名 + 職種 + 資格 + 常勤/非常勤 + 専従/兼務 + 雇用開始日 = 7列）
  const FIXED_COLS = 7;
  // 末尾列数（月間h + 週平均h + 常勤換算値 = 3列）
  const TAIL_COLS = 3;
  const totalCols = FIXED_COLS + daysInMonth + TAIL_COLS;

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
                <th
                  className="sticky left-0 z-20 bg-slate-800 border border-slate-700 px-1 py-1.5 text-center font-semibold whitespace-nowrap w-8"
                  rowSpan={1}
                >
                  No.
                </th>
                <th className="sticky left-8 z-20 bg-slate-800 border border-slate-700 px-2 py-1.5 text-left font-semibold whitespace-nowrap w-24">
                  職員氏名
                </th>
                <th className="border border-slate-700 px-1.5 py-1.5 text-center font-semibold whitespace-nowrap w-20">
                  職種
                </th>
                <th className="border border-slate-700 px-1.5 py-1.5 text-center font-semibold whitespace-nowrap w-24">
                  資格
                </th>
                <th className="border border-slate-700 px-1 py-1.5 text-center font-semibold whitespace-nowrap w-16">
                  常勤/<br />非常勤
                </th>
                <th className="border border-slate-700 px-1 py-1.5 text-center font-semibold whitespace-nowrap w-14">
                  専従/<br />兼務
                </th>
                <th className="border border-slate-700 px-1.5 py-1.5 text-center font-semibold whitespace-nowrap w-20">
                  雇用開始日
                </th>

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
                <th className="border border-slate-700 px-1 py-1.5 text-center font-semibold whitespace-nowrap w-16">
                  月間h
                </th>
                <th className="border border-slate-700 px-1 py-1.5 text-center font-semibold whitespace-nowrap w-16">
                  週平均h
                </th>
                <th className="border border-slate-700 px-1 py-1.5 text-center font-semibold whitespace-nowrap w-14">
                  常勤換算値
                </th>
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
                roleGroups.map((group) => (
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

                      return (
                        <tr
                          key={entry.staffId}
                          className={
                            isFullTime
                              ? 'bg-white hover:bg-gray-50'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }
                        >
                          {/* No. */}
                          <td className="sticky left-0 z-10 bg-inherit border border-gray-200 px-1 py-1 text-center text-gray-500 w-8">
                            {rowIndex + 1}
                          </td>

                          {/* 職員氏名 */}
                          <td className="sticky left-8 z-10 bg-inherit border border-gray-200 px-2 py-1 font-medium text-gray-800 whitespace-nowrap w-24">
                            {entry.staffName}
                          </td>

                          {/* 職種 */}
                          <td className="border border-gray-200 px-1.5 py-1 text-center text-gray-700 w-20">
                            {entry.role}
                          </td>

                          {/* 資格（複数ある場合は最初の1つ、なければ空） */}
                          <td className="border border-gray-200 px-1.5 py-1 text-center text-gray-700 w-24">
                            {staff?.qualifications && staff.qualifications.length > 0
                              ? staff.qualifications[0]
                              : ''}
                          </td>

                          {/* 常勤/非常勤 */}
                          <td className="border border-gray-200 px-1 py-1 text-center text-gray-700 w-16">
                            {getEmploymentLabel(entry.employmentType)}
                          </td>

                          {/* 専従/兼務 */}
                          <td className="border border-gray-200 px-1 py-1 text-center text-gray-700 w-14">
                            {getConcurrencyLabel(entry.employmentType)}
                          </td>

                          {/* 雇用開始日 */}
                          <td className="border border-gray-200 px-1.5 py-1 text-center text-gray-700 w-20 font-mono">
                            {staff?.hireDate ?? ''}
                          </td>

                          {/* 日付セル */}
                          {dates.map((dateStr) => {
                            const shift = ss?.monthlyShifts.find(
                              (sh) => sh.date === dateStr
                            );
                            const plannedShiftName = shift?.plannedShiftType ?? '';
                            const actualShiftName = shift?.actualShiftType ?? '';

                            // 表示するシフト名（予定ベース）
                            const displayShiftName = plannedShiftName;
                            const abbrev = displayShiftName
                              ? getShiftAbbrev(displayShiftName)
                              : '';

                            // 差分ハイライト（showDiff=true かつ実績が予定と異なる場合）
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

                          {/* 月間時間 */}
                          <td className="border border-gray-200 px-1 py-1 text-center font-mono text-gray-800 w-16">
                            {fteEntry ? fteEntry.monthlyHours.toFixed(1) : '0.0'}
                          </td>

                          {/* 週平均時間 */}
                          <td className="border border-gray-200 px-1 py-1 text-center font-mono text-gray-800 w-16">
                            {fteEntry ? fteEntry.weeklyAverageHours.toFixed(1) : '0.0'}
                          </td>

                          {/* 常勤換算値 */}
                          <td className="border border-gray-200 px-1 py-1 text-center font-mono font-semibold text-indigo-700 w-14">
                            {fteEntry ? fteEntry.fteValue.toFixed(2) : '0.00'}
                          </td>
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
                      <td className="border border-amber-200 text-xs font-bold text-amber-800 text-center px-1 py-1">
                        {group.subtotalHours.toFixed(1)}
                      </td>
                      <td className="border border-amber-200 text-xs font-bold text-amber-800 text-center px-1 py-1">
                        {group.subtotalWeeklyAvgHours.toFixed(1)}
                      </td>
                      <td className="border border-amber-200 text-xs font-bold text-amber-800 text-center px-1 py-1">
                        {group.subtotalFte.toFixed(2)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))
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
                  <td className="border border-amber-300 text-sm font-bold text-amber-900 text-center px-1 py-1.5">
                    {totalHours.toFixed(1)}
                  </td>
                  <td className="border border-amber-300 text-sm font-bold text-amber-900 text-center px-1 py-1.5">
                    {totalWeeklyAvg.toFixed(1)}
                  </td>
                  <td className="border border-amber-300 text-sm font-bold text-amber-900 text-center px-1 py-1.5">
                    {totalFte.toFixed(2)}
                  </td>
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
