/**
 * DocumentArchiveContent.tsx
 *
 * Phase 61: 書類アーカイブ一覧パネル
 *
 * 機能:
 * - 施設の書類アーカイブを年月降順で一覧表示
 * - 各行に「対象月」「書類種別」「生成日時」「再ダウンロードボタン」を表示
 * - チェックボックスで複数行を選択して一括ZIPダウンロード
 * - 管理者ロール専用（呼び出し元でアクセス制御済み）
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  DocumentArchiveRecord,
  DocumentMeta,
  DocType,
  BulkDownloadProgress,
  BulkDownloadSelection,
  StaffSchedule,
  Staff,
  FacilityShiftSettings,
} from '../../../types';
import {
  getDocumentArchives,
  reDownloadDocument,
  bulkDownloadDocuments,
} from '../../services/documentArchiveService';
import { getComplianceData } from '../../services/reportService';
import { DEFAULT_STANDARD_WEEKLY_HOURS } from '../../../constants';
import { useToast } from '../../contexts/ToastContext';

interface DocumentArchiveContentProps {
  facilityId: string;
  facilityName: string;
  onOpenSubmissionGuide?: () => void;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  standard_form: '標準様式第1号',
  actual_vs_plan: '予実比較',
};

type ArchiveRow = {
  yearMonth: string;
  docType: DocType;
  meta: DocumentMeta;
  key: string; // `${yearMonth}__${docType}`
};

function formatDateTime(createdAt: DocumentMeta['createdAt']): string {
  const d = createdAt.toDate();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-');
  return `${year}年${month}月`;
}

export function DocumentArchiveContent({
  facilityId,
  facilityName,
  onOpenSubmissionGuide,
}: DocumentArchiveContentProps): React.ReactElement {
  const { showSuccess, showError, showWarning } = useToast();

  const [archives, setArchives] = useState<DocumentArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [redownloadingKey, setRedownloadingKey] = useState<string | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkDownloadProgress | null>(null);

  // アーカイブ一覧を取得
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    getDocumentArchives(facilityId)
      .then((data) => {
        if (!cancelled) setArchives(data);
      })
      .catch(() => {
        if (!cancelled) setFetchError('書類アーカイブの取得に失敗しました');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  // アーカイブレコードを行に展開（yearMonth × docType）
  const rows = useMemo((): ArchiveRow[] => {
    const result: ArchiveRow[] = [];
    for (const record of archives) {
      if (record.standard_form) {
        result.push({
          yearMonth: record.yearMonth,
          docType: 'standard_form',
          meta: record.standard_form,
          key: `${record.yearMonth}__standard_form`,
        });
      }
      if (record.actual_vs_plan) {
        result.push({
          yearMonth: record.yearMonth,
          docType: 'actual_vs_plan',
          meta: record.actual_vs_plan,
          key: `${record.yearMonth}__actual_vs_plan`,
        });
      }
    }
    return result;
  }, [archives]);

  // チェックボックス操作
  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedKeys.size === rows.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(rows.map((r) => r.key)));
    }
  }, [selectedKeys.size, rows]);

  // 再ダウンロード
  const handleReDownload = useCallback(
    async (row: ArchiveRow) => {
      setRedownloadingKey(row.key);
      try {
        const result = await getComplianceData(facilityId, row.yearMonth);
        if (!result.success) {
          showError('対象月のシフトデータが存在しません');
          return;
        }
        const { staffSchedules, staffList, shiftSettings } = result.data;
        await reDownloadDocument(
          row.yearMonth,
          row.docType,
          staffSchedules,
          staffList,
          shiftSettings,
          facilityName,
          DEFAULT_STANDARD_WEEKLY_HOURS
        );
        showSuccess('Excelを再ダウンロードしました');
      } catch {
        showError('再ダウンロードに失敗しました');
      } finally {
        setRedownloadingKey(null);
      }
    },
    [facilityId, facilityName, showSuccess, showError]
  );

  // 一括ZIPダウンロード
  const handleBulkDownload = useCallback(async () => {
    if (selectedKeys.size === 0) return;

    setIsBulkDownloading(true);
    setBulkProgress({ completed: 0, total: selectedKeys.size });

    try {
      // 選択された全月の compliance データを並列プリフェッチ
      const selectedRows = rows.filter((r) => selectedKeys.has(r.key));
      const uniqueMonths: string[] = Array.from(new Set(selectedRows.map((r) => r.yearMonth)));

      type FetchedEntry = { ym: string; r: Awaited<ReturnType<typeof getComplianceData>> };
      const fetched: FetchedEntry[] = await Promise.all(
        uniqueMonths.map((ym: string) => getComplianceData(facilityId, ym).then((r) => ({ ym, r })))
      );

      const scheduleMap = new Map<string, StaffSchedule[]>();
      let staffList: Staff[] = [];
      let shiftSettings: FacilityShiftSettings | null = null;

      for (const { ym, r } of fetched) {
        if (r.success) {
          scheduleMap.set(ym, r.data.staffSchedules);
          staffList = r.data.staffList;
          shiftSettings = r.data.shiftSettings;
        }
      }

      if (!shiftSettings) {
        showError('シフト設定の取得に失敗しました');
        return;
      }

      const selections: BulkDownloadSelection[] = selectedRows.map((r) => ({
        yearMonth: r.yearMonth,
        docType: r.docType,
      }));

      const result = await bulkDownloadDocuments(
        facilityId,
        selections,
        facilityName,
        (ym) => scheduleMap.get(ym) ?? [],
        staffList,
        shiftSettings,
        DEFAULT_STANDARD_WEEKLY_HOURS,
        (progress) => setBulkProgress(progress)
      );

      const skipped = result.skipped.length;
      if (skipped > 0) {
        showWarning(`ZIP生成完了（${skipped}件スキップ: シフトデータなし）`);
      } else {
        showSuccess('ZIPをダウンロードしました');
      }

      setSelectedKeys(new Set());
    } catch {
      showError('一括ダウンロードに失敗しました');
    } finally {
      setIsBulkDownloading(false);
      setBulkProgress(null);
    }
  }, [selectedKeys, rows, facilityId, facilityName, showSuccess, showError, showWarning]);

  // ローディング中
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-500">読み込み中...</span>
      </div>
    );
  }

  // エラー
  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
        {fetchError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg p-4 shadow-sm">
        <p className="text-sm text-gray-600">
          {rows.length === 0
            ? 'アーカイブはまだありません。Excelエクスポート時に自動で記録されます。'
            : `${rows.length}件のアーカイブ`}
        </p>

        <div className="flex items-center gap-2">
          {onOpenSubmissionGuide && (
            <button
              onClick={onOpenSubmissionGuide}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
            >
              電子申請の手順を確認する
            </button>
          )}
          <button
            onClick={handleBulkDownload}
            disabled={selectedKeys.size === 0 || isBulkDownloading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isBulkDownloading && bulkProgress ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {bulkProgress.completed}/{bulkProgress.total}件生成中
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                選択した書類を一括ダウンロード（{selectedKeys.size}件）
              </>
            )}
          </button>
        </div>
      </div>

      {/* 一覧テーブル */}
      {rows.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedKeys.size === rows.length && rows.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label="全選択"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">対象月</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">書類種別</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">生成日時</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">生成者</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(row.key)}
                      onChange={() => toggleKey(row.key)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`${formatYearMonth(row.yearMonth)} ${DOC_TYPE_LABELS[row.docType]} を選択`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {formatYearMonth(row.yearMonth)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                      row.docType === 'standard_form'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}>
                      {DOC_TYPE_LABELS[row.docType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                    {formatDateTime(row.meta.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
                    {row.meta.createdBy}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleReDownload(row)}
                      disabled={redownloadingKey !== null || isBulkDownloading}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {redownloadingKey === row.key ? (
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                      再DL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
