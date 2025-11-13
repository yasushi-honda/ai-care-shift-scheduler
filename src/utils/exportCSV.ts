/**
 * exportCSV.ts
 *
 * Phase 19.3.1: エクスポート機能 - CSV エクスポートユーティリティ
 *
 * 特徴:
 * - シフトデータ、スタッフ情報、休暇申請のCSVエクスポート
 * - BOM付きUTF-8エンコーディング（Excel対応）
 * - papaparseを使用したCSV生成
 * - 型安全性の確保
 */

import { unparse } from 'papaparse';
import { Schedule, Staff, LeaveRequestDocument, StaffSchedule } from '../../types';
import { format } from 'date-fns';

/**
 * シフトデータをCSVエクスポート
 *
 * フォーマット:
 * - 1行目: ヘッダー（スタッフ名, 日付1, 日付2, ...）
 * - 2行目以降: 各スタッフのシフト
 *
 * @param schedule - Scheduleオブジェクト
 * @param facilityName - 施設名（オプション、ファイル名用）
 * @returns CSV文字列（BOM付きUTF-8）
 */
export function exportScheduleToCSV(
  schedule: Schedule,
  facilityName?: string
): string {
  if (!schedule.staffSchedules || schedule.staffSchedules.length === 0) {
    throw new Error('シフトデータが存在しません');
  }

  // 対象月の全日付を取得
  const dates = getAllDatesInMonth(schedule.targetMonth);

  // ヘッダー行を作成
  const headers = ['スタッフ名', ...dates];

  // データ行を作成
  const rows = schedule.staffSchedules.map((staffSchedule: StaffSchedule) => {
    const row: Record<string, string> = {
      'スタッフ名': staffSchedule.staffName,
    };

    // 各日付のシフトを埋める
    dates.forEach((date) => {
      const shift = staffSchedule.monthlyShifts.find(
        (s) => s.date === formatDateForCSV(date)
      );
      row[date] = shift ? shift.shiftType : '未定';
    });

    return row;
  });

  // papaparseでCSV生成
  const csv = unparse({
    fields: headers,
    data: rows,
  });

  // BOM付きUTF-8として返す
  return addBOM(csv);
}

/**
 * スタッフ一覧をCSVエクスポート
 *
 * フォーマット:
 * - ID, 名前, 役職, 資格, 週間勤務数（希望）, 週間勤務数（必須）,
 *   最大連続勤務日数, 利用可能曜日, 利用不可日, 時間帯希望, 夜勤専従, 作成日, 更新日
 *
 * @param staffList - Staffオブジェクトの配列
 * @param facilityName - 施設名（オプション、ファイル名用）
 * @returns CSV文字列（BOM付きUTF-8）
 */
export function exportStaffToCSV(
  staffList: Staff[],
  facilityName?: string
): string {
  if (!staffList || staffList.length === 0) {
    throw new Error('スタッフデータが存在しません');
  }

  // データ行を作成
  const rows = staffList.map((staff) => ({
    'ID': staff.id,
    '名前': staff.name,
    '役職': staff.role,
    '資格': staff.qualifications.join(', '),
    '週間勤務数（希望）': staff.weeklyWorkCount.hope,
    '週間勤務数（必須）': staff.weeklyWorkCount.must,
    '最大連続勤務日数': staff.maxConsecutiveWorkDays,
    '利用可能曜日': formatWeekdays(staff.availableWeekdays),
    '利用不可日': staff.unavailableDates.join(', ') || 'なし',
    '時間帯希望': staff.timeSlotPreference,
    '夜勤専従': staff.isNightShiftOnly ? 'はい' : 'いいえ',
    '作成日': formatTimestamp(staff.createdAt),
    '更新日': formatTimestamp(staff.updatedAt),
  }));

  // papaparseでCSV生成
  const csv = unparse(rows);

  // BOM付きUTF-8として返す
  return addBOM(csv);
}

/**
 * 休暇申請一覧をCSVエクスポート
 *
 * フォーマット:
 * - ID, スタッフID, スタッフ名, 日付, 休暇種別, 申請日, 更新日
 *
 * @param leaveRequests - LeaveRequestDocumentの配列
 * @param facilityName - 施設名（オプション、ファイル名用）
 * @returns CSV文字列（BOM付きUTF-8）
 */
export function exportLeaveRequestsToCSV(
  leaveRequests: LeaveRequestDocument[],
  facilityName?: string
): string {
  if (!leaveRequests || leaveRequests.length === 0) {
    throw new Error('休暇申請データが存在しません');
  }

  // データ行を作成
  const rows = leaveRequests.map((request) => ({
    'ID': request.id,
    'スタッフID': request.staffId,
    'スタッフ名': request.staffName,
    '日付': request.date,
    '休暇種別': request.leaveType,
    '申請日': formatTimestamp(request.createdAt),
    '更新日': formatTimestamp(request.updatedAt),
  }));

  // papaparseでCSV生成
  const csv = unparse(rows);

  // BOM付きUTF-8として返す
  return addBOM(csv);
}

/**
 * CSV文字列をファイルとしてダウンロード
 *
 * @param csvContent - CSV文字列
 * @param filename - ファイル名
 */
export function downloadCSV(
  csvContent: string,
  filename: string
): void {
  // Blobを作成
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // ダウンロードリンクを作成
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // メモリ解放
  URL.revokeObjectURL(url);
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
 * 日付をCSV用にフォーマット
 *
 * @param date - 日付文字列（YYYY-MM-DD）
 * @returns フォーマットされた日付文字列
 */
function formatDateForCSV(date: string): string {
  return date;
}

/**
 * 曜日配列を日本語文字列に変換
 *
 * @param weekdays - 曜日配列（0=日曜、1=月曜、...）
 * @returns 日本語曜日文字列（例: "月, 火, 水"）
 */
function formatWeekdays(weekdays: number[]): string {
  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return weekdays
    .map((day) => weekdayNames[day])
    .join(', ');
}

/**
 * Firestoreタイムスタンプを日付文字列に変換
 *
 * @param timestamp - Firestoreタイムスタンプ
 * @returns 日付文字列（YYYY-MM-DD HH:mm:ss）
 */
function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '-';

  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'yyyy-MM-dd HH:mm:ss');
  } catch (error) {
    return '-';
  }
}

/**
 * CSV文字列にBOM（Byte Order Mark）を追加
 *
 * BOMを追加することで、ExcelでUTF-8として正しく認識される
 *
 * @param csvContent - CSV文字列
 * @returns BOM付きCSV文字列
 */
function addBOM(csvContent: string): string {
  const BOM = '\uFEFF';
  return BOM + csvContent;
}

/**
 * ファイル名を生成
 *
 * @param prefix - プレフィックス（例: "シフト表", "スタッフ一覧"）
 * @param facilityName - 施設名
 * @param extension - 拡張子（デフォルト: "csv"）
 * @returns ファイル名（例: "シフト表_〇〇施設_20251113.csv"）
 */
export function generateFilename(
  prefix: string,
  facilityName?: string,
  extension: string = 'csv'
): string {
  const timestamp = format(new Date(), 'yyyyMMdd');
  const facility = facilityName ? `_${facilityName}` : '';
  return `${prefix}${facility}_${timestamp}.${extension}`;
}

/**
 * エクスポート用のメタデータを生成
 *
 * @param dataType - データタイプ
 * @param recordCount - レコード数
 * @param format - フォーマット
 * @returns メタデータオブジェクト
 */
export function generateExportMetadata(
  dataType: 'schedule' | 'staff' | 'leaveRequests',
  recordCount: number,
  format: 'csv' | 'pdf'
): {
  dataType: string;
  recordCount: number;
  format: string;
  timestamp: string;
} {
  return {
    dataType,
    recordCount,
    format,
    timestamp: new Date().toISOString(),
  };
}
