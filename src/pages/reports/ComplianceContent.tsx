/**
 * ComplianceContent.tsx
 *
 * Phase 25 #E: コンプライアンスチェックタブのUIコンポーネント
 *
 * 表示内容:
 * - 常勤換算（FTE）テーブル（スタッフ別）
 * - 役職別FTE合計
 * - 違反一覧（労基法・インターバル）
 * - Excel ダウンロードボタン
 */

import React, { useState, useMemo, useCallback } from 'react';
import type {
  StaffSchedule,
  Staff,
  FacilityShiftSettings,
  ComplianceViolationItem,
  FullTimeEquivalentEntry,
  DocType,
  StaffingStandardConfig,
} from '../../../types';
import {
  runComplianceCheck,
  calculateDailyFulfillment,
  calculateMonthlyFulfillmentSummary,
} from '../../services/complianceService';
import { saveDocumentMeta } from '../../services/documentArchiveService';
import { DEFAULT_STANDARD_WEEKLY_HOURS } from '../../../constants';
import { useToast } from '../../contexts/ToastContext';
import { StandardFormViewer } from '../../components/StandardFormViewer';
import { MonthlyFulfillmentChart } from '../../components/MonthlyFulfillmentChart';

interface ComplianceContentProps {
  staffSchedules: StaffSchedule[];
  staffList: Staff[];
  shiftSettings: FacilityShiftSettings;
  facilityName: string;
  targetMonth: string;
  // Phase 61: 書類アーカイブ・電子申請案内用（オプション）
  facilityId?: string;
  userId?: string;
  onOpenSubmissionGuide?: () => void;
  /** Phase 65: 人員配置基準設定（充足率表示用） */
  staffingConfig?: StaffingStandardConfig;
}

// 重大度バッジのスタイルマップ
const SEVERITY_STYLES: Record<ComplianceViolationItem['severity'], string> = {
  error: 'bg-red-100 text-red-800 border border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
};

const SEVERITY_LABELS: Record<ComplianceViolationItem['severity'], string> = {
  error: '違反',
  warning: '注意',
};

const TYPE_LABELS: Record<ComplianceViolationItem['type'], string> = {
  break_time: '休憩時間',
  rest_interval: '勤務間インターバル',
};

// 雇用形態の表示名
const EMP_TYPE_LABELS: Record<string, string> = {
  A: '常勤（フルタイム）',
  B: '常勤（短時間）',
  C: '非常勤（パートタイム）',
  D: '非常勤（その他）',
};

function SummaryCard({ label, value, colorClass }: { label: string; value: string | number; colorClass: string }) {
  return (
    <div className={`rounded-lg p-4 ${colorClass}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

export function ComplianceContent({
  staffSchedules,
  staffList,
  shiftSettings,
  facilityName,
  targetMonth,
  facilityId,
  userId,
  onOpenSubmissionGuide,
  staffingConfig,
}: ComplianceContentProps): React.ReactElement {
  const { showSuccess, showError, showWarning, showWithAction } = useToast();
  const [useActual, setUseActual] = useState(false);
  const [standardWeeklyHours, setStandardWeeklyHours] = useState(DEFAULT_STANDARD_WEEKLY_HOURS);
  const [isExporting, setIsExporting] = useState<DocType | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showFulfillmentDetail, setShowFulfillmentDetail] = useState(false);

  // Phase 65: 月次充足率サマリー（メモ化）
  const fulfillmentSummary = useMemo(() => {
    if (!staffingConfig || staffSchedules.length === 0) return null;
    const daily = calculateDailyFulfillment(
      staffSchedules,
      staffList,
      shiftSettings,
      staffingConfig,
      targetMonth,
      standardWeeklyHours,
      useActual
    );
    return calculateMonthlyFulfillmentSummary(daily, targetMonth);
  }, [staffSchedules, staffList, shiftSettings, staffingConfig, targetMonth, standardWeeklyHours, useActual]);

  // コンプライアンスチェック実行（メモ化）
  const result = useMemo(
    () =>
      runComplianceCheck(
        staffSchedules,
        staffList,
        shiftSettings,
        targetMonth,
        standardWeeklyHours,
        useActual
      ),
    [staffSchedules, staffList, shiftSettings, targetMonth, standardWeeklyHours, useActual]
  );

  const errorCount = result.violations.filter((v) => v.severity === 'error').length;
  const warningCount = result.violations.filter((v) => v.severity === 'warning').length;
  const totalFte = (Object.values(result.fteTotalByRole) as number[]).reduce((sum, v) => sum + v, 0);

  // Excel エクスポート（標準様式・予実2段書き共用）
  const handleExcelExport = useCallback(
    async (docType: DocType) => {
      setIsExporting(docType);
      try {
        const {
          createStandardFormWorkbook,
          createActualVsPlanWorkbook,
          downloadExcel,
          generateStandardFormFilename,
          generateActualVsPlanFilename,
        } = await import('../../utils/exportExcel');

        if (docType === 'standard_form') {
          const wb = await createStandardFormWorkbook(
            staffSchedules, staffList, shiftSettings, facilityName, targetMonth, standardWeeklyHours
          );
          await downloadExcel(wb, generateStandardFormFilename(targetMonth));
        } else {
          const wb = await createActualVsPlanWorkbook(
            staffSchedules, staffList, shiftSettings, facilityName, targetMonth, standardWeeklyHours
          );
          await downloadExcel(wb, generateActualVsPlanFilename(targetMonth));
        }

        // Firestore記録（失敗してもダウンロードはブロックしない）
        if (facilityId && userId) {
          try {
            await saveDocumentMeta(facilityId, targetMonth, docType, userId, facilityName);
          } catch {
            showWarning('書類アーカイブへの記録に失敗しました（ダウンロードは完了）');
          }
        }

        // 成功トースト（電子申請案内リンク付き）
        if (onOpenSubmissionGuide) {
          showWithAction({
            message: 'Excelをダウンロードしました。提出手順を確認してください。',
            type: 'success',
            actionLabel: '電子申請の手順を確認する',
            onAction: onOpenSubmissionGuide,
          });
        } else {
          showSuccess('Excelをダウンロードしました');
        }
      } catch {
        showError('Excelのエクスポートに失敗しました');
      } finally {
        setIsExporting(null);
      }
    },
    [staffSchedules, staffList, shiftSettings, facilityName, targetMonth, standardWeeklyHours, facilityId, userId, onOpenSubmissionGuide, showWarning, showWithAction, showSuccess, showError]
  );

  // 役職別FTE合計テーブルの行
  const roleEntries = (Object.entries(result.fteTotalByRole) as [string, number][]).sort((a, b) => a[0].localeCompare(b[0]));

  // 違反をタイプ別にグループ化
  const breakViolations = result.violations.filter((v) => v.type === 'break_time');
  const intervalViolations = result.violations.filter((v) => v.type === 'rest_interval');

  return (
    <div className="space-y-6">
      {/* コントロールバー */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          {/* 予定/実績トグル */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">集計基準:</span>
            <button
              onClick={() => setUseActual(false)}
              className={`px-3 py-1.5 text-sm rounded-l-md border ${
                !useActual
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              予定
            </button>
            <button
              onClick={() => setUseActual(true)}
              className={`px-3 py-1.5 text-sm rounded-r-md border-t border-r border-b -ml-px ${
                useActual
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              実績
            </button>
          </div>

          {/* 週所定労働時間 */}
          <div className="flex items-center gap-2">
            <label htmlFor="weeklyHours" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              週所定労働時間:
            </label>
            <input
              id="weeklyHours"
              type="number"
              min={1}
              max={48}
              value={standardWeeklyHours}
              onChange={(e) => setStandardWeeklyHours(Math.max(1, Math.min(48, Number(e.target.value))))}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
            />
            <span className="text-sm text-gray-500">h/週</span>
          </div>
        </div>

        {/* Excel エクスポートボタン群 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleExcelExport('standard_form')}
            disabled={isExporting !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting === 'standard_form' ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            勤務形態一覧表（標準様式）
          </button>
          <button
            onClick={() => handleExcelExport('actual_vs_plan')}
            disabled={isExporting !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting === 'actual_vs_plan' ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            予実比較（Excel）
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard
          label="対象スタッフ数"
          value={result.fteEntries.length}
          colorClass="bg-blue-50 text-blue-900"
        />
        <SummaryCard
          label="FTE合計"
          value={`${Math.round(totalFte * 100) / 100} 人`}
          colorClass="bg-indigo-50 text-indigo-900"
        />
        <SummaryCard
          label="違反件数"
          value={errorCount}
          colorClass={errorCount > 0 ? 'bg-red-50 text-red-900' : 'bg-green-50 text-green-900'}
        />
        <SummaryCard
          label="注意件数"
          value={warningCount}
          colorClass={warningCount > 0 ? 'bg-yellow-50 text-yellow-900' : 'bg-green-50 text-green-900'}
        />
        {/* Phase 65: 充足率カード */}
        <SummaryCard
          label="平均充足率"
          value={fulfillmentSummary ? `${fulfillmentSummary.averageFulfillmentRate}%` : '―'}
          colorClass={
            !fulfillmentSummary
              ? 'bg-slate-50 text-slate-500'
              : fulfillmentSummary.averageFulfillmentRate >= 100
              ? 'bg-green-50 text-green-900'
              : fulfillmentSummary.averageFulfillmentRate >= 80
              ? 'bg-yellow-50 text-yellow-900'
              : 'bg-red-50 text-red-900'
          }
        />
      </div>

      {/* 役職別FTE合計 */}
      {roleEntries.length > 0 && (
        <section className="bg-white rounded-lg shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 text-base font-semibold text-gray-900 border-b">
            役職別 常勤換算合計
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">職種</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">FTE合計</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {roleEntries.map(([role, fte]) => (
                  <tr key={role}>
                    <td className="px-4 py-2 text-sm text-gray-900">{role}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                      {fte.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Phase 65: 人員配置基準充足状況 */}
      {fulfillmentSummary && (
        <section className="bg-white rounded-lg shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowFulfillmentDetail((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-base font-semibold text-gray-900 border-b hover:bg-gray-50 transition-colors"
          >
            <span>人員配置基準 充足状況</span>
            <span className="text-sm font-normal text-slate-500">
              平均 {fulfillmentSummary.averageFulfillmentRate}% / 未達 {fulfillmentSummary.shortfallDays}日
              {showFulfillmentDetail ? ' ▲' : ' ▼'}
            </span>
          </button>

          {showFulfillmentDetail && (
            <div className="p-4 space-y-4">
              {/* 職種別 基準vs実績 */}
              {fulfillmentSummary.byRole.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">職種別 月平均充足状況</h3>
                  <div className="space-y-2">
                    {fulfillmentSummary.byRole.map((r) => (
                      <div key={r.role} className="flex items-center gap-3 text-sm">
                        <span className="w-28 text-gray-700 flex-shrink-0">{r.role}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              r.averageFulfillmentRate >= 100
                                ? 'bg-green-500'
                                : r.averageFulfillmentRate >= 80
                                ? 'bg-yellow-400'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(r.averageFulfillmentRate, 100)}%` }}
                          />
                        </div>
                        <span className="w-24 text-right text-gray-900 flex-shrink-0">
                          {r.averageFulfillmentRate}%
                          {r.shortfallDays > 0 && (
                            <span className="text-red-500 ml-1">（未達 {r.shortfallDays}日）</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 月次充足率グラフ */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">日別充足率推移</h3>
                <MonthlyFulfillmentChart summary={fulfillmentSummary} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* スタッフ別FTEテーブル */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <h2 className="px-4 py-3 text-base font-semibold text-gray-900 border-b">
          スタッフ別 常勤換算（FTE）
        </h2>
        {result.fteEntries.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">データがありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">氏名</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">職種</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">雇用形態</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">月間勤務時間</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">週平均</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">常勤換算</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {result.fteEntries.map((entry: FullTimeEquivalentEntry) => (
                  <tr key={entry.staffId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{entry.staffName}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 hidden sm:table-cell">{entry.role || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 hidden md:table-cell">
                      {EMP_TYPE_LABELS[entry.employmentType] ?? entry.employmentType}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-900">{entry.monthlyHours.toFixed(1)}h</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 hidden sm:table-cell">
                      {entry.weeklyAverageHours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                      {entry.fteValue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-4 py-2 text-xs text-gray-400 border-t">
          常勤換算 = 月間勤務時間 ÷ (週所定{standardWeeklyHours}h × 4.33週)
        </p>
      </section>

      {/* 標準様式プレビュー（折りたたみ可・デフォルト閉じ） */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            標準様式プレビュー
            <span className="text-xs font-normal text-gray-500 ml-1">（厚生労働省様式第1号）</span>
          </h2>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${showPreview ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showPreview && (
          <div className="border-t border-gray-200 p-4">
            <StandardFormViewer
              staffSchedules={staffSchedules}
              staffList={staffList}
              shiftSettings={shiftSettings}
              facilityName={facilityName}
              targetMonth={targetMonth}
              standardWeeklyHours={standardWeeklyHours}
            />
          </div>
        )}
      </section>

      {/* 違反一覧 */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <h2 className="px-4 py-3 text-base font-semibold text-gray-900 border-b">
          コンプライアンス違反 / 注意事項
        </h2>

        {result.violations.length === 0 ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center gap-2 text-green-700 bg-green-50 rounded-full px-4 py-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">違反・注意事項は検出されませんでした</span>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* 休憩時間違反 */}
            {breakViolations.length > 0 && (
              <ViolationGroup
                title={`${TYPE_LABELS.break_time}（労働基準法第34条）`}
                violations={breakViolations}
              />
            )}
            {/* インターバル注意 */}
            {intervalViolations.length > 0 && (
              <ViolationGroup
                title={`${TYPE_LABELS.rest_interval}（労働時間等設定改善法指針）`}
                violations={intervalViolations}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ViolationGroup({
  title,
  violations,
}: {
  title: string;
  violations: ComplianceViolationItem[];
}) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <ul className="space-y-2">
        {violations.map((v, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span
              className={`inline-block shrink-0 mt-0.5 px-2 py-0.5 text-xs font-medium rounded-full ${SEVERITY_STYLES[v.severity]}`}
            >
              {SEVERITY_LABELS[v.severity]}
            </span>
            <div className="min-w-0">
              <span className="font-medium text-gray-800">{v.staffName}</span>
              <span className="mx-1 text-gray-400">·</span>
              <span className="text-gray-600">{v.description}</span>
              <span className="ml-2 text-xs text-gray-400">({v.legalBasis})</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
