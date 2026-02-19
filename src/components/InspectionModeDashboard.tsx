/**
 * InspectionModeDashboard.tsx
 *
 * Phase 61: 運営指導モード ダッシュボード（Tasks 5.2〜6.1）
 *
 * 機能:
 * - 施設情報サマリー・印刷ボタン（Task 5.2）
 * - コンプライアンスチェック結果の色分け表示（Task 5.3）
 * - 当月実績シフト一覧グリッド（Task 5.4）
 * - 過去12ヶ月の月別概要テーブル（Task 5.5）
 * - 月変更でリアルタイム更新（Task 5.6 - props変更で再計算）
 * - 職種別FTEダッシュボード（Task 6.1）
 */

import React, { useState, useEffect, useMemo } from 'react';
import type {
  Staff,
  StaffSchedule,
  FacilityShiftSettings,
  ComplianceCheckResult,
  DocumentArchiveRecord,
} from '../../types';
import { runComplianceCheck } from '../services/complianceService';
import { getDocumentArchives } from '../services/documentArchiveService';
import { DEFAULT_STANDARD_WEEKLY_HOURS } from '../../constants';
import { StandardFormViewer } from './StandardFormViewer';

interface InspectionModeDashboardProps {
  facilityId: string;
  facilityName: string;
  targetMonth: string; // YYYY-MM
  staffList: Staff[];
  schedule: StaffSchedule[];
  shiftSettings: FacilityShiftSettings;
  onClose: () => void;
}

/** 過去12ヶ月（当月含む）のリストを生成 */
function getPast12Months(targetMonth: string): string[] {
  const [year, month] = targetMonth.split('-').map(Number);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    let m = month - i;
    let y = year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    months.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return months;
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split('-');
  return `${year}年${month}月`;
}


export function InspectionModeDashboard({
  facilityId,
  facilityName,
  targetMonth,
  staffList,
  schedule,
  shiftSettings,
  onClose,
}: InspectionModeDashboardProps): React.ReactElement {
  const [archives, setArchives] = useState<DocumentArchiveRecord[]>([]);
  const [archivesLoading, setArchivesLoading] = useState(true);

  // 書類アーカイブを取得（12ヶ月概要テーブル用）
  useEffect(() => {
    let cancelled = false;
    setArchivesLoading(true);
    getDocumentArchives(facilityId)
      .then((data) => {
        if (!cancelled) setArchives(data);
      })
      .catch(() => {
        // エラー時は空配列のまま
      })
      .finally(() => {
        if (!cancelled) setArchivesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [facilityId]);

  // コンプライアンスチェック（当月・実績優先）
  const complianceResult = useMemo<ComplianceCheckResult | null>(() => {
    if (schedule.length === 0 || staffList.length === 0) return null;
    return runComplianceCheck(
      schedule,
      staffList,
      shiftSettings,
      targetMonth,
      DEFAULT_STANDARD_WEEKLY_HOURS,
      true // 実績優先
    );
  }, [schedule, staffList, shiftSettings, targetMonth]);

  // 12ヶ月リスト
  const past12Months = useMemo(() => getPast12Months(targetMonth), [targetMonth]);

  // Level1（労基法）違反件数
  const level1Count = complianceResult?.violations.filter(
    (v) => v.severity === 'error'
  ).length ?? 0;

  // Level2（警告）違反件数
  const level2Count = complianceResult?.violations.filter(
    (v) => v.severity === 'warning'
  ).length ?? 0;

  // FTE合計
  const fteTotal = complianceResult
    ? (Object.values(complianceResult.fteTotalByRole) as number[]).reduce((sum, v) => sum + v, 0)
    : 0;

  // アーカイブが存在する月のセット
  const archivedMonths = useMemo(() => {
    const set = new Set<string>();
    for (const record of archives) {
      if (record.standard_form || record.actual_vs_plan) {
        set.add(record.yearMonth);
      }
    }
    return set;
  }, [archives]);

  return (
    <div className="bg-slate-50 h-full overflow-y-auto print:bg-white">
      {/* ===== ヘッダー（印刷時非表示） ===== */}
      <div className="sticky top-0 z-10 bg-amber-600 text-white px-6 py-3 flex items-center justify-between shadow-md print:hidden">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">運営指導モード</span>
          <span className="bg-amber-800 text-amber-100 text-xs px-2 py-0.5 rounded-full font-medium">
            {facilityName}
          </span>
          <span className="text-amber-200 text-sm">{formatYearMonth(targetMonth)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            印刷
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            終了
          </button>
        </div>
      </div>

      {/* ===== 印刷用ヘッダー ===== */}
      <div className="hidden print:block px-6 py-4 border-b border-gray-300">
        <h1 className="text-xl font-bold text-gray-900">運営指導 書類確認シート</h1>
        <p className="text-sm text-gray-600 mt-1">
          {facilityName}　{formatYearMonth(targetMonth)}　印刷日: {new Date().toLocaleDateString('ja-JP')}
        </p>
      </div>

      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* ===== セクション1: コンプライアンスサマリー（Task 5.3） ===== */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            コンプライアンスチェック結果（{formatYearMonth(targetMonth)}）
          </h2>

          {schedule.length === 0 ? (
            <div className="bg-gray-100 rounded-lg p-4 text-gray-500 text-sm">
              当月のシフトデータがありません
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {/* Level1 違反 */}
              <div className={`rounded-lg p-4 border-2 ${
                level1Count > 0
                  ? 'bg-red-50 border-red-300'
                  : 'bg-green-50 border-green-200'
              }`}>
                <p className="text-xs font-semibold uppercase text-gray-500 mb-1">
                  法令違反（Level 1）
                </p>
                <p className={`text-3xl font-bold ${level1Count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {level1Count}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {level1Count > 0 ? '休憩時間不足・労基法違反あり' : '違反なし'}
                </p>
              </div>

              {/* Level2 警告 */}
              <div className={`rounded-lg p-4 border-2 ${
                level2Count > 0
                  ? 'bg-orange-50 border-orange-300'
                  : 'bg-green-50 border-green-200'
              }`}>
                <p className="text-xs font-semibold uppercase text-gray-500 mb-1">
                  警告（Level 2）
                </p>
                <p className={`text-3xl font-bold ${level2Count > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {level2Count}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {level2Count > 0 ? '勤務間インターバル不足あり' : '警告なし'}
                </p>
              </div>

              {/* FTE合計 */}
              <div className="rounded-lg p-4 border-2 bg-blue-50 border-blue-200">
                <p className="text-xs font-semibold uppercase text-gray-500 mb-1">常勤換算合計</p>
                <p className="text-3xl font-bold text-blue-600">
                  {fteTotal.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">常勤換算値（実績）</p>
              </div>
            </div>
          )}

          {/* 違反詳細リスト */}
          {complianceResult && complianceResult.violations.length > 0 && (
            <div className="mt-3 bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {complianceResult.violations.map((v, i) => (
                <div
                  key={i}
                  className={`px-4 py-2.5 flex items-start gap-3 text-sm ${
                    v.severity === 'error' ? 'bg-red-50' : 'bg-orange-50'
                  }`}
                >
                  <span className={`shrink-0 mt-0.5 inline-block w-2 h-2 rounded-full ${
                    v.severity === 'error' ? 'bg-red-500' : 'bg-orange-400'
                  }`} />
                  <div>
                    <span className="font-medium text-gray-800">{v.staffName}</span>
                    <span className="text-gray-400 mx-1">·</span>
                    <span className="text-gray-600">{v.date}</span>
                    <p className="text-xs text-gray-600 mt-0.5">{v.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {complianceResult && complianceResult.violations.length === 0 && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-medium">
              ✓ コンプライアンス違反は検出されませんでした
            </div>
          )}
        </section>

        {/* ===== セクション2: 職種別FTE（Task 6.1） ===== */}
        {complianceResult && Object.keys(complianceResult.fteTotalByRole).length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              職種別 常勤換算値（FTE）
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">職種</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">FTE値</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">状況</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(Object.entries(complianceResult.fteTotalByRole) as Array<[string, number]>)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([role, fte]) => (
                      <tr key={role} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-800">{role}</td>
                        <td className="px-4 py-2 text-sm text-right font-bold text-blue-700">
                          {(fte as number).toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                            fte > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {fte > 0 ? '配置あり' : '配置なし'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===== セクション3: 標準様式プレビュー（Phase 62 - Task 5.4置き換え） ===== */}
        <section className="print:break-before-page">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            勤務体制及び勤務形態一覧表 プレビュー（{formatYearMonth(targetMonth)}）
          </h2>

          {schedule.length === 0 ? (
            <div className="bg-gray-100 rounded-lg p-4 text-gray-500 text-sm">
              当月のシフトデータがありません
            </div>
          ) : (
            <StandardFormViewer
              staffSchedules={schedule}
              staffList={staffList}
              shiftSettings={shiftSettings}
              facilityName={facilityName}
              targetMonth={targetMonth}
              standardWeeklyHours={DEFAULT_STANDARD_WEEKLY_HOURS}
            />
          )}
        </section>

        {/* ===== セクション4: 12ヶ月概要テーブル（Task 5.5） ===== */}
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            過去12ヶ月 書類アーカイブ状況
          </h2>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {archivesLoading ? (
              <div className="flex items-center gap-2 p-4 text-gray-500 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600" />
                読み込み中...
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">対象月</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">書類アーカイブ</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">標準様式</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">予実比較</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {past12Months.map((ym) => {
                    const archiveRecord = archives.find((a) => a.yearMonth === ym);
                    const hasStandardForm = !!archiveRecord?.standard_form;
                    const hasActualVsPlan = !!archiveRecord?.actual_vs_plan;
                    const isCurrentMonth = ym === targetMonth;
                    return (
                      <tr
                        key={ym}
                        className={`${isCurrentMonth ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-2 text-sm font-medium text-gray-800">
                          {formatYearMonth(ym)}
                          {isCurrentMonth && (
                            <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                              当月
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {archivedMonths.has(ym) ? (
                            <span className="text-green-600 font-bold text-base">○</span>
                          ) : (
                            <span className="text-gray-300">−</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {hasStandardForm ? (
                            <span className="text-green-600 font-bold text-base">○</span>
                          ) : (
                            <span className="text-gray-300">−</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {hasActualVsPlan ? (
                            <span className="text-green-600 font-bold text-base">○</span>
                          ) : (
                            <span className="text-gray-300">−</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
