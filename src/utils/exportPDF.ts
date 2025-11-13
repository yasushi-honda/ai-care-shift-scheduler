/**
 * exportPDF.ts
 *
 * Phase 19.3.1: エクスポート機能 - PDF エクスポートユーティリティ
 * Phase 19.3.1.1: 日本語フォント対応
 *
 * 特徴:
 * - シフト表、スタッフ情報のPDF生成
 * - jsPDFとjspdf-autotableを使用
 * - 印刷用フォーマット（A4サイズ）
 * - 日本語フォント対応（NotoSansJP）
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Schedule, Staff, StaffSchedule } from '../../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

// ==================== 日本語フォントロード ====================

/**
 * 日本語フォントを動的にロード
 *
 * @returns Base64エンコードされたフォントデータ、失敗時はnull
 */
async function loadJapaneseFont(): Promise<string | null> {
  try {
    const response = await fetch('/fonts/NotoSansJP-Regular.otf');
    if (!response.ok) {
      throw new Error(`Failed to fetch font: ${response.status}`);
    }
    const fontBlob = await response.blob();
    return await blobToBase64(fontBlob);
  } catch (error) {
    console.error('Failed to load Japanese font:', error);
    return null;
  }
}

/**
 * BlobをBase64文字列に変換
 *
 * @param blob - 変換するBlob
 * @returns Base64エンコードされた文字列
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // "data:application/octet-stream;base64," プレフィックスを削除
      const base64String = base64.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * jsPDFに日本語フォントを適用
 *
 * @param doc - jsPDFオブジェクト
 * @returns フォント適用成功時true、失敗時false
 */
async function applyJapaneseFont(doc: jsPDF): Promise<boolean> {
  const fontBase64 = await loadJapaneseFont();

  if (!fontBase64) {
    console.warn('Japanese font not available, using default font');
    return false;
  }

  try {
    doc.addFileToVFS('NotoSansJP-Regular.otf', fontBase64);
    doc.addFont('NotoSansJP-Regular.otf', 'NotoSansJP', 'normal');
    doc.setFont('NotoSansJP');
    return true;
  } catch (error) {
    console.error('Failed to apply Japanese font:', error);
    return false;
  }
}

/**
 * シフト表をPDF生成
 *
 * フォーマット:
 * - 用紙: A4横向き
 * - ヘッダー: 施設名、対象月、出力日時
 * - テーブル: 横軸=日付、縦軸=スタッフ名
 * - フッター: ページ番号
 *
 * @param schedule - Scheduleオブジェクト
 * @param facilityName - 施設名
 * @returns jsPDFオブジェクト
 */
export async function exportScheduleToPDF(
  schedule: Schedule,
  facilityName: string
): Promise<jsPDF> {
  if (!schedule.staffSchedules || schedule.staffSchedules.length === 0) {
    throw new Error('シフトデータが存在しません');
  }

  // PDFドキュメントを作成（A4横向き）
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // 日本語フォントを適用
  await applyJapaneseFont(doc);

  // ヘッダー情報
  const headerHeight = 30;
  const marginTop = 10;
  const marginLeft = 10;

  // タイトル
  doc.setFontSize(16);
  doc.text(`${facilityName} - シフト表`, marginLeft, marginTop + 10);

  // 対象月と出力日時
  doc.setFontSize(10);
  const targetMonthFormatted = formatTargetMonth(schedule.targetMonth);
  doc.text(`対象月: ${targetMonthFormatted}`, marginLeft, marginTop + 20);
  doc.text(
    `出力日時: ${format(new Date(), 'yyyy年MM月dd日 HH:mm', { locale: ja })}`,
    marginLeft + 70,
    marginTop + 20
  );

  // テーブルデータを準備
  const dates = getAllDatesInMonth(schedule.targetMonth);
  const headers = ['スタッフ名', ...dates.map((d) => formatDateShort(d))];

  const rows = schedule.staffSchedules.map((staffSchedule: StaffSchedule) => {
    const row = [staffSchedule.staffName];

    dates.forEach((date) => {
      const shift = staffSchedule.monthlyShifts.find(
        (s) => s.date === date
      );
      row.push(shift ? shift.shiftType : '-');
    });

    return row;
  });

  // autotableでテーブル生成
  autoTable(doc, {
    startY: headerHeight,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 8,
      cellPadding: 1,
      overflow: 'linebreak',
      halign: 'center',
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 30 }, // スタッフ名は左寄せ
    },
    margin: { top: headerHeight, left: marginLeft, right: marginLeft },
    didDrawPage: (data) => {
      // フッター: ページ番号
      const pageCount = doc.getNumberOfPages();
      const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.text(
        `ページ ${pageNumber} / ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    },
  });

  return doc;
}

/**
 * スタッフ情報をPDF生成
 *
 * フォーマット:
 * - 用紙: A4縦向き
 * - ヘッダー: 施設名、出力日時
 * - テーブル: スタッフ情報一覧
 * - フッター: ページ番号、合計スタッフ数
 *
 * @param staffList - Staffオブジェクトの配列
 * @param facilityName - 施設名
 * @returns jsPDFオブジェクト
 */
export async function exportStaffToPDF(
  staffList: Staff[],
  facilityName: string
): Promise<jsPDF> {
  if (!staffList || staffList.length === 0) {
    throw new Error('スタッフデータが存在しません');
  }

  // PDFドキュメントを作成（A4縦向き）
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // 日本語フォントを適用
  await applyJapaneseFont(doc);

  // ヘッダー情報
  const headerHeight = 30;
  const marginTop = 10;
  const marginLeft = 10;

  // タイトル
  doc.setFontSize(16);
  doc.text(`${facilityName} - スタッフ一覧`, marginLeft, marginTop + 10);

  // 出力日時
  doc.setFontSize(10);
  doc.text(
    `出力日時: ${format(new Date(), 'yyyy年MM月dd日 HH:mm', { locale: ja })}`,
    marginLeft,
    marginTop + 20
  );

  // テーブルデータを準備
  const headers = [
    '名前',
    '役職',
    '資格',
    '週勤務数\n(希望/必須)',
    '最大連続\n勤務日数',
    '時間帯希望',
  ];

  const rows = staffList.map((staff) => [
    staff.name,
    staff.role,
    staff.qualifications.join('\n'),
    `${staff.weeklyWorkCount.hope}/${staff.weeklyWorkCount.must}`,
    staff.maxConsecutiveWorkDays.toString(),
    staff.timeSlotPreference,
  ]);

  // autotableでテーブル生成
  autoTable(doc, {
    startY: headerHeight,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 9,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 30 }, // 名前
      1: { cellWidth: 25 }, // 役職
      2: { cellWidth: 40 }, // 資格
      3: { cellWidth: 20, halign: 'center' }, // 週勤務数
      4: { cellWidth: 20, halign: 'center' }, // 最大連続勤務日数
      5: { cellWidth: 25 }, // 時間帯希望
    },
    margin: { top: headerHeight, left: marginLeft, right: marginLeft },
    didDrawPage: (data) => {
      // フッター: ページ番号と合計スタッフ数
      const pageCount = doc.getNumberOfPages();
      const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.text(
        `ページ ${pageNumber} / ${pageCount} | 合計: ${staffList.length}名`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    },
  });

  return doc;
}

/**
 * PDFをファイルとしてダウンロード
 *
 * @param pdf - jsPDFオブジェクト
 * @param filename - ファイル名
 */
export function downloadPDF(
  pdf: jsPDF,
  filename: string
): void {
  pdf.save(filename);
}

// ==================== ヘルパー関数 ====================

/**
 * 対象月の全日付を取得
 *
 * @param targetMonth - 対象月（YYYY-MM）
 * @returns 日付の配列（YYYY-MM-DD形式）
 */
function getAllDatesInMonth(targetMonth: string): string[] {
  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const dates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dates.push(dateStr);
  }

  return dates;
}

/**
 * 対象月をフォーマット
 *
 * @param targetMonth - 対象月（YYYY-MM）
 * @returns フォーマットされた月（YYYY年MM月）
 */
function formatTargetMonth(targetMonth: string): string {
  const [year, month] = targetMonth.split('-');
  return `${year}年${month}月`;
}

/**
 * 日付を短縮形式にフォーマット（PDFテーブル用）
 *
 * @param date - 日付文字列（YYYY-MM-DD）
 * @returns 短縮形式の日付（MM/DD）
 */
function formatDateShort(date: string): string {
  const parts = date.split('-');
  return `${parts[1]}/${parts[2]}`;
}
