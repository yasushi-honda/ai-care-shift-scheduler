/**
 * documentArchiveService.ts
 *
 * Phase 61: 書類アーカイブサービス
 *
 * 機能:
 * - Excel出力時に書類メタデータをFirestoreへ保存（setDoc merge方式）
 * - 施設の書類アーカイブ一覧を年月降順で取得
 * - 個別再ダウンロード（既存のexportExcel関数を再実行）
 * - 複数月一括ZIPダウンロード（JSZip使用）
 *
 * Firestoreパス: facilities/{facilityId}/documentArchive/{yearMonth}
 */

import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import JSZip from 'jszip';
import type ExcelJS from 'exceljs';
import { db } from '../../firebase';
import type {
  Staff,
  StaffSchedule,
  FacilityShiftSettings,
  DocType,
  DocumentArchiveRecord,
  BulkDownloadProgress,
  BulkDownloadResult,
  BulkDownloadSelection,
} from '../../types';
import {
  createStandardFormWorkbook,
  createActualVsPlanWorkbook,
  generateStandardFormFilename,
  generateActualVsPlanFilename,
} from '../utils/exportExcel';

// ==================== 書類メタデータの保存 ====================

/**
 * Excel出力後に書類メタデータをFirestoreへ保存する。
 * 同一月・同一種別が既に存在する場合は上書き更新する（merge: true）。
 * 失敗時は例外をスローし、呼び出し元でtry-catchする。
 */
export async function saveDocumentMeta(
  facilityId: string,
  yearMonth: string,
  docType: DocType,
  userId: string,
  facilityName: string
): Promise<void> {
  const ref = doc(db, 'facilities', facilityId, 'documentArchive', yearMonth);
  await setDoc(
    ref,
    {
      yearMonth,
      [docType]: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        facilityName,
      },
    },
    { merge: true }
  );
}

// ==================== 書類アーカイブ一覧取得 ====================

/**
 * 施設の書類アーカイブを年月降順で全件取得する。
 * 認証エラーはFirestore Security Rulesが拒否し、呼び出し元に伝播する。
 */
export async function getDocumentArchives(
  facilityId: string
): Promise<DocumentArchiveRecord[]> {
  const col = collection(db, 'facilities', facilityId, 'documentArchive');
  const q = query(col, orderBy('yearMonth', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as DocumentArchiveRecord);
}

// ==================== 再ダウンロード ====================

/**
 * 対象月・書類種別のExcelを再生成してダウンロードする。
 * シフトデータが存在しない場合はエラーをスローする。
 */
export async function reDownloadDocument(
  yearMonth: string,
  docType: DocType,
  staffSchedules: StaffSchedule[],
  staffList: Staff[],
  shiftSettings: FacilityShiftSettings,
  facilityName: string,
  standardWeeklyHours: number
): Promise<void> {
  const { downloadExcel } = await import('../utils/exportExcel');

  if (staffSchedules.length === 0) {
    throw new Error('対象月のシフトデータが存在しません');
  }

  let workbook: ExcelJS.Workbook;
  let filename: string;

  if (docType === 'standard_form') {
    workbook = await createStandardFormWorkbook(
      staffSchedules,
      staffList,
      shiftSettings,
      facilityName,
      yearMonth,
      standardWeeklyHours
    );
    filename = generateStandardFormFilename(yearMonth);
  } else {
    workbook = await createActualVsPlanWorkbook(
      staffSchedules,
      staffList,
      shiftSettings,
      facilityName,
      yearMonth,
      standardWeeklyHours
    );
    filename = generateActualVsPlanFilename(yearMonth);
  }

  await downloadExcel(workbook, filename);
}

// ==================== 一括ZIPダウンロード ====================

/**
 * 選択された複数月のExcelを生成してZIPファイルでダウンロードする。
 * シフトデータが存在しない月はスキップし、BulkDownloadResultに記録する。
 * 進捗はonProgressコールバックで通知する。
 */
export async function bulkDownloadDocuments(
  facilityId: string,
  selections: BulkDownloadSelection[],
  facilityName: string,
  getShiftDataForMonth: (yearMonth: string) => StaffSchedule[],
  staffList: Staff[],
  shiftSettings: FacilityShiftSettings,
  standardWeeklyHours: number,
  onProgress: (progress: BulkDownloadProgress) => void
): Promise<BulkDownloadResult> {
  const { downloadExcel } = await import('../utils/exportExcel');
  const zip = new JSZip();
  const skipped: BulkDownloadResult['skipped'] = [];
  const total = selections.length;
  let completed = 0;

  for (const selection of selections) {
    const { yearMonth, docType } = selection;
    const staffSchedules = getShiftDataForMonth(yearMonth);

    if (staffSchedules.length === 0) {
      skipped.push({
        yearMonth,
        docType,
        reason: 'シフトデータが存在しない月のためスキップしました',
      });
      completed++;
      onProgress({ completed, total });
      continue;
    }

    let buffer: ArrayBuffer;
    let filename: string;

    if (docType === 'standard_form') {
      const workbook = await createStandardFormWorkbook(
        staffSchedules,
        staffList,
        shiftSettings,
        facilityName,
        yearMonth,
        standardWeeklyHours
      );
      buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
      filename = generateStandardFormFilename(yearMonth);
    } else {
      const workbook = await createActualVsPlanWorkbook(
        staffSchedules,
        staffList,
        shiftSettings,
        facilityName,
        yearMonth,
        standardWeeklyHours
      );
      buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
      filename = generateActualVsPlanFilename(yearMonth);
    }

    zip.file(filename, buffer);
    completed++;
    onProgress({ completed, total });
  }

  // ZIPをダウンロード
  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  const blob = new Blob([zipBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${facilityName}_書類一括_documents.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { skipped };
}
