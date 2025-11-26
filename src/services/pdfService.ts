/**
 * PDFService - PDF生成サービス
 * Phase 41: 月次レポート機能
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  MonthlyReportData,
  ManagementReportData,
  PersonalReportData,
} from '../../types';

// 日本語フォントをBase64で埋め込む代わりに、シンプルなASCII文字で表示
// 実運用では Noto Sans JP などの日本語フォントを埋め込む

/**
 * PDF文書のベース設定
 */
function createBasePDF(): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  return doc;
}

/**
 * ヘッダーを追加
 */
function addHeader(
  doc: jsPDF,
  facilityName: string,
  reportTitle: string,
  targetMonth: string
): void {
  const pageWidth = doc.internal.pageSize.getWidth();

  // 施設名
  doc.setFontSize(10);
  doc.text(facilityName, 14, 15);

  // レポートタイトル
  doc.setFontSize(16);
  doc.text(reportTitle, pageWidth / 2, 25, { align: 'center' });

  // 対象期間
  doc.setFontSize(10);
  const [year, month] = targetMonth.split('-');
  doc.text(`${year}年${month}月`, pageWidth / 2, 32, { align: 'center' });

  // 区切り線
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 36, pageWidth - 14, 36);
}

/**
 * フッターを追加
 */
function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);

    // 生成日時
    const now = new Date();
    const dateStr = `Generated: ${now.toLocaleString('ja-JP')}`;
    doc.text(dateStr, 14, pageHeight - 10);

    // ページ番号
    doc.text(`${i} / ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }
}

/**
 * 数値をフォーマット
 */
function formatNumber(num: number, decimals = 0): string {
  return num.toLocaleString('ja-JP', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 通貨をフォーマット
 */
function formatCurrency(amount: number): string {
  return `¥${formatNumber(amount)}`;
}

/**
 * ダッシュボードPDFを生成
 */
export async function generateDashboardPDF(
  data: MonthlyReportData,
  facilityName: string,
  chartImages?: { pieChart?: string; barChart?: string }
): Promise<void> {
  const doc = createBasePDF();

  // ヘッダー
  addHeader(doc, facilityName, 'Monthly Report Dashboard', data.targetMonth);

  let yPos = 45;

  // サマリーセクション
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Summary', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Total Work Hours', `${formatNumber(data.summary.totalWorkHours)} hours`],
      ['Staff Count', `${data.summary.totalStaffCount} persons`],
      ['Avg Hours/Staff', `${formatNumber(data.summary.averageWorkHoursPerStaff)} hours`],
      ['Fulfillment Rate', `${data.summary.fulfillmentRate}%`],
      ['Paid Leave Usage', `${data.summary.paidLeaveUsageRate}%`],
      ['Work Days', `${data.summary.workDaysCount} days`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [66, 133, 244] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error jspdf-autotable adds finalY to doc
  yPos = doc.lastAutoTable.finalY + 15;

  // グラフ画像（もし提供されていれば）
  if (chartImages?.pieChart) {
    doc.setFontSize(12);
    doc.text('Shift Type Distribution', 14, yPos);
    yPos += 5;

    try {
      doc.addImage(chartImages.pieChart, 'PNG', 14, yPos, 80, 60);
      yPos += 65;
    } catch {
      // 画像追加に失敗した場合はスキップ
    }
  }

  // 勤務時間テーブル
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.text('Work Time by Staff', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Staff', 'Total', 'Regular', 'Night', 'Overtime', 'Warning']],
    body: data.workTimeData.map(w => [
      w.staffName,
      `${formatNumber(w.totalHours)}h`,
      `${formatNumber(w.regularHours)}h`,
      `${formatNumber(w.nightHours)}h`,
      `${formatNumber(w.estimatedOvertimeHours)}h`,
      w.warningFlags.length > 0 ? 'Yes' : '-',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [66, 133, 244] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8 },
  });

  // フッター
  addFooter(doc);

  // ダウンロード
  const fileName = `report_dashboard_${data.targetMonth}.pdf`;
  doc.save(fileName);
}

/**
 * 経営分析レポートPDFを生成
 */
export async function generateManagementPDF(
  data: ManagementReportData,
  facilityName: string,
  targetMonth: string
): Promise<void> {
  const doc = createBasePDF();

  // ヘッダー
  addHeader(doc, facilityName, 'Management Analysis Report', targetMonth);

  let yPos = 45;

  // サマリーセクション
  doc.setFontSize(12);
  doc.text('Executive Summary', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Fulfillment Rate', `${data.summary.fulfillmentRate}%`],
      ['Total Work Hours', `${formatNumber(data.summary.totalWorkHours)} hours`],
      ['Staff Count', `${data.summary.totalStaffCount} persons`],
      ['Paid Leave Usage', `${data.summary.paidLeaveUsageRate}%`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [52, 168, 83] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error jspdf-autotable adds finalY to doc
  yPos = doc.lastAutoTable.finalY + 10;

  // 時間帯別充足率
  doc.setFontSize(12);
  doc.text('Time Slot Fulfillment', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Time Slot', 'Required', 'Actual', 'Rate', 'Shortfall Days']],
    body: data.timeSlotFulfillment.map(t => [
      t.timeSlot,
      formatNumber(t.requiredCount),
      formatNumber(t.actualCount),
      `${t.fulfillmentRate}%`,
      `${t.shortfallDays} days`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [52, 168, 83] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error jspdf-autotable adds finalY to doc
  yPos = doc.lastAutoTable.finalY + 10;

  // コスト推計
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.text('Cost Estimate', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Category', 'Amount']],
    body: [
      ['Regular Hours', formatCurrency(data.costEstimate.regularHoursCost)],
      ['Overtime', formatCurrency(data.costEstimate.overtimeHoursCost)],
      ['Night Shift Allowance', formatCurrency(data.costEstimate.nightShiftAllowance)],
      ['Total', formatCurrency(data.costEstimate.totalEstimate)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [52, 168, 83] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error jspdf-autotable adds finalY to doc
  yPos = doc.lastAutoTable.finalY + 10;

  // 前月比較（あれば）
  if (data.monthComparison) {
    doc.setFontSize(12);
    doc.text('Month-over-Month Comparison', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Change']],
      body: [
        ['Work Hours', `${data.monthComparison.workHoursDiff >= 0 ? '+' : ''}${formatNumber(data.monthComparison.workHoursDiff)}h`],
        ['Fulfillment Rate', `${data.monthComparison.fulfillmentRateDiff >= 0 ? '+' : ''}${data.monthComparison.fulfillmentRateDiff}%`],
        ['Cost', `${data.monthComparison.costDiff >= 0 ? '+' : ''}${formatCurrency(data.monthComparison.costDiff)}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [52, 168, 83] },
      margin: { left: 14, right: 14 },
    });

    // @ts-expect-error jspdf-autotable adds finalY to doc
    yPos = doc.lastAutoTable.finalY + 10;
  }

  // 改善提案
  if (data.recommendations.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.text('Recommendations', 14, yPos);
    yPos += 8;

    doc.setFontSize(9);
    for (const rec of data.recommendations) {
      // 長い文字列を折り返し
      const lines = doc.splitTextToSize(`• ${rec}`, 180);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 5 + 3;

      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    }
  }

  // フッター
  addFooter(doc);

  // ダウンロード
  const fileName = `report_management_${targetMonth}.pdf`;
  doc.save(fileName);
}

/**
 * 個人レポートPDFを生成
 */
export async function generatePersonalPDF(
  data: PersonalReportData,
  facilityName: string
): Promise<void> {
  const doc = createBasePDF();

  // ヘッダー
  addHeader(doc, facilityName, `Personal Report - ${data.staffName}`, data.targetMonth);

  let yPos = 45;

  // 勤務サマリー
  doc.setFontSize(12);
  doc.text('Work Summary', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Work Days', `${data.workSummary.workDays} days`],
      ['Total Hours', `${formatNumber(data.workSummary.totalHours)} hours`],
      ['Night Shifts', `${data.workSummary.nightShiftCount} times`],
      ['Rest Days', `${data.workSummary.restDays} days`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [251, 188, 5] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error jspdf-autotable adds finalY to doc
  yPos = doc.lastAutoTable.finalY + 10;

  // シフト種別内訳
  doc.setFontSize(12);
  doc.text('Shift Breakdown', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Shift Type', 'Count', 'Percentage']],
    body: data.shiftBreakdown.map(s => [
      s.shiftType,
      `${s.count}`,
      `${s.percentage}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [251, 188, 5] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error jspdf-autotable adds finalY to doc
  yPos = doc.lastAutoTable.finalY + 10;

  // 休暇残高
  doc.setFontSize(12);
  doc.text('Leave Balance', 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Type', 'Used', 'Remaining']],
    body: [
      ['Paid Leave', `${data.leaveBalance.paidLeaveUsed} days`, `${data.leaveBalance.paidLeaveRemaining} days`],
      ['Public Holiday', `${data.leaveBalance.publicHolidayUsed} days`, `${data.leaveBalance.publicHolidayRemaining} days`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [251, 188, 5] },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error jspdf-autotable adds finalY to doc
  yPos = doc.lastAutoTable.finalY + 10;

  // 月間カレンダー（簡易版）
  if (data.calendar.length > 0 && yPos < 200) {
    doc.setFontSize(12);
    doc.text('Monthly Calendar', 14, yPos);
    yPos += 5;

    // カレンダーを7列の表として表示
    const calendarRows: string[][] = [];
    let currentRow: string[] = [];

    // 月の最初の日の曜日を取得
    const firstDate = new Date(data.calendar[0].date);
    const startDay = firstDate.getDay();

    // 空白セルを追加
    for (let i = 0; i < startDay; i++) {
      currentRow.push('');
    }

    for (const day of data.calendar) {
      const date = new Date(day.date);
      const dayNum = date.getDate();
      const status = day.status === 'work' ? (day.shiftType || 'W') : day.status.charAt(0).toUpperCase();
      currentRow.push(`${dayNum}:${status}`);

      if (currentRow.length === 7) {
        calendarRows.push(currentRow);
        currentRow = [];
      }
    }

    if (currentRow.length > 0) {
      while (currentRow.length < 7) {
        currentRow.push('');
      }
      calendarRows.push(currentRow);
    }

    autoTable(doc, {
      startY: yPos,
      head: [['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']],
      body: calendarRows,
      theme: 'grid',
      headStyles: { fillColor: [251, 188, 5] },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 7, cellPadding: 2 },
    });
  }

  // フッター
  addFooter(doc);

  // ダウンロード
  const fileName = `report_personal_${data.staffName}_${data.targetMonth}.pdf`;
  doc.save(fileName);
}
