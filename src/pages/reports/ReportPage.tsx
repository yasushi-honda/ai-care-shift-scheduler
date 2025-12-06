import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getMonthlyReport,
  getManagementReport,
  getPersonalReport,
} from '../../services/reportService';
import {
  generateDashboardPDF,
  generateManagementPDF,
  generatePersonalPDF,
} from '../../services/pdfService';
import {
  MonthlyReportData,
  ManagementReportData,
  PersonalReportData,
  FacilityRole,
  WorkTimeWarning,
} from '../../../types';
import MonthNavigator from '../../../components/MonthNavigator';
import { UsageChart, createPieChartData, createBarChartData } from '../../components/UsageChart';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { ErrorMessage } from '../../components/ErrorMessage';

/**
 * Phase 41: 月次レポートページ
 *
 * タブ構成:
 * - ダッシュボード: サマリー表示
 * - 勤務時間: スタッフ別勤務時間詳細
 * - シフト種別: シフト種別分布
 * - スタッフ稼働: 稼働統計
 * - 経営分析: 管理者向け分析（管理者のみ）
 * - 個人: 自分の勤務実績（スタッフのみ）
 */

type ReportTab = 'dashboard' | 'workTime' | 'shiftType' | 'staffActivity' | 'management' | 'personal';

/**
 * 警告タイプをラベルに変換
 */
function getWarningLabel(warning: WorkTimeWarning): string {
  switch (warning) {
    case 'overtime': return '残業超過';
    case 'consecutive_work': return '連勤注意';
    case 'insufficient_rest': return '休息不足';
    default: return String(warning);
  }
}

/**
 * Phase 42.1: 戻るボタン用アイコン
 */
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

export function ReportPage(): React.ReactElement {
  const { selectedFacilityId, currentUser, userProfile } = useAuth();
  const { showError, showSuccess } = useToast();

  const [targetMonth, setTargetMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeTab, setActiveTab] = useState<ReportTab>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // レポートデータ
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportData | null>(null);
  const [managementReport, setManagementReport] = useState<ManagementReportData | null>(null);
  const [personalReport, setPersonalReport] = useState<PersonalReportData | null>(null);

  // ユーザーの施設ロールを取得
  const getUserFacilityRole = useCallback((): FacilityRole | null => {
    if (!userProfile || !selectedFacilityId) return null;
    const facilityAccess = userProfile.facilities?.find(f => f.facilityId === selectedFacilityId);
    return facilityAccess?.role || null;
  }, [userProfile, selectedFacilityId]);

  const facilityRole = getUserFacilityRole();
  const isManager = facilityRole === 'facility-admin' || facilityRole === 'manager';
  const isStaff = facilityRole === 'staff';

  // 施設名を取得
  const getFacilityName = useCallback((): string => {
    if (!userProfile || !selectedFacilityId) return '';
    const facilityAccess = userProfile.facilities?.find(f => f.facilityId === selectedFacilityId);
    return facilityAccess?.facilityId || '施設';
  }, [userProfile, selectedFacilityId]);

  // 月次レポートデータを取得
  const fetchMonthlyReport = useCallback(async () => {
    if (!selectedFacilityId) return;

    setIsLoading(true);
    setError(null);

    const result = await getMonthlyReport(selectedFacilityId, targetMonth);

    if (result.success === true) {
      setMonthlyReport(result.data);
    } else if (result.success === false) {
      const err = result.error;
      if (err.code === 'NO_SCHEDULE_DATA') {
        setError(`${targetMonth}のシフトデータがありません`);
      } else {
        setError(`レポートの取得に失敗しました: ${err.message}`);
      }
      setMonthlyReport(null);
    }

    setIsLoading(false);
  }, [selectedFacilityId, targetMonth]);

  // 経営分析レポートを取得
  const fetchManagementReport = useCallback(async () => {
    if (!selectedFacilityId || !isManager) return;

    setIsLoading(true);
    setError(null);

    const result = await getManagementReport(selectedFacilityId, targetMonth);

    if (result.success === true) {
      setManagementReport(result.data);
    } else if (result.success === false) {
      const err = result.error;
      setError(`経営分析レポートの取得に失敗しました: ${err.message}`);
      setManagementReport(null);
    }

    setIsLoading(false);
  }, [selectedFacilityId, targetMonth, isManager]);

  // 個人レポートを取得
  const fetchPersonalReport = useCallback(async () => {
    if (!selectedFacilityId || !currentUser) return;

    // スタッフIDを取得（実際の実装ではユーザーに紐づいたスタッフIDを使用）
    const staffId = currentUser.uid;

    setIsLoading(true);
    setError(null);

    const result = await getPersonalReport(selectedFacilityId, staffId, targetMonth);

    if (result.success === true) {
      setPersonalReport(result.data);
    } else if (result.success === false) {
      const err = result.error;
      setError(`個人レポートの取得に失敗しました: ${err.message}`);
      setPersonalReport(null);
    }

    setIsLoading(false);
  }, [selectedFacilityId, currentUser, targetMonth]);

  // タブ変更時のデータ取得
  useEffect(() => {
    if (!selectedFacilityId) return;

    switch (activeTab) {
      case 'dashboard':
      case 'workTime':
      case 'shiftType':
      case 'staffActivity':
        fetchMonthlyReport();
        break;
      case 'management':
        fetchManagementReport();
        break;
      case 'personal':
        fetchPersonalReport();
        break;
    }
  }, [activeTab, selectedFacilityId, targetMonth, fetchMonthlyReport, fetchManagementReport, fetchPersonalReport]);

  // ダッシュボードPDFダウンロード
  const handleDownloadDashboardPDF = async () => {
    if (!monthlyReport) return;

    setIsPdfGenerating(true);
    try {
      await generateDashboardPDF(monthlyReport, getFacilityName());
      showSuccess('PDFをダウンロードしました');
    } catch (err) {
      showError('PDF生成に失敗しました');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // 経営分析PDFダウンロード
  const handleDownloadManagementPDF = async () => {
    if (!managementReport) return;

    setIsPdfGenerating(true);
    try {
      await generateManagementPDF(managementReport, getFacilityName(), targetMonth);
      showSuccess('PDFをダウンロードしました');
    } catch (err) {
      showError('PDF生成に失敗しました');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // 個人レポートPDFダウンロード
  const handleDownloadPersonalPDF = async () => {
    if (!personalReport) return;

    setIsPdfGenerating(true);
    try {
      await generatePersonalPDF(personalReport, getFacilityName());
      showSuccess('PDFをダウンロードしました');
    } catch (err) {
      showError('PDF生成に失敗しました');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // タブ定義
  const tabs: { id: ReportTab; label: string; visible: boolean }[] = [
    { id: 'dashboard', label: 'ダッシュボード', visible: true },
    { id: 'workTime', label: '勤務時間', visible: true },
    { id: 'shiftType', label: 'シフト種別', visible: true },
    { id: 'staffActivity', label: 'スタッフ稼働', visible: true },
    { id: 'management', label: '経営分析', visible: isManager },
    { id: 'personal', label: '個人レポート', visible: isStaff },
  ];

  // 施設未選択時の表示
  if (!selectedFacilityId) {
    return (
      <div className="p-8 text-center text-gray-500">
        施設を選択してください
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー - Phase 42.1: 戻るボタン追加 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                to="/"
                className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="シフト管理画面に戻る"
              >
                <ArrowLeftIcon />
                <span className="hidden sm:inline">シフト管理</span>
              </Link>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">月次レポート</h1>
            </div>
            <MonthNavigator
              currentMonth={targetMonth}
              onMonthChange={setTargetMonth}
            />
          </div>
        </div>
      </header>

      {/* タブナビゲーション - モバイル対応スクロール */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav
            className="flex space-x-1 sm:space-x-4 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
            aria-label="タブ"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {tabs
              .filter(tab => tab.visible)
              .map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
          </nav>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="space-y-4">
            <SkeletonLoader height={120} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonLoader height={200} />
              <SkeletonLoader height={200} />
            </div>
          </div>
        ) : error ? (
          <ErrorMessage
            title="データの読み込みに失敗しました"
            message={error}
            onRetry={() => {
              switch (activeTab) {
                case 'dashboard':
                case 'workTime':
                case 'shiftType':
                case 'staffActivity':
                  fetchMonthlyReport();
                  break;
                case 'management':
                  fetchManagementReport();
                  break;
                case 'personal':
                  fetchPersonalReport();
                  break;
              }
            }}
          />
        ) : (
          <>
            {/* ダッシュボードタブ */}
            {activeTab === 'dashboard' && monthlyReport && (
              <DashboardContent
                data={monthlyReport}
                onDownloadPDF={handleDownloadDashboardPDF}
                isPdfGenerating={isPdfGenerating}
              />
            )}

            {/* 勤務時間タブ */}
            {activeTab === 'workTime' && monthlyReport && (
              <WorkTimeContent data={monthlyReport} />
            )}

            {/* シフト種別タブ */}
            {activeTab === 'shiftType' && monthlyReport && (
              <ShiftTypeContent data={monthlyReport} />
            )}

            {/* スタッフ稼働タブ */}
            {activeTab === 'staffActivity' && monthlyReport && (
              <StaffActivityContent data={monthlyReport} />
            )}

            {/* 経営分析タブ */}
            {activeTab === 'management' && managementReport && (
              <ManagementContent
                data={managementReport}
                onDownloadPDF={handleDownloadManagementPDF}
                isPdfGenerating={isPdfGenerating}
              />
            )}

            {/* 個人レポートタブ */}
            {activeTab === 'personal' && personalReport && (
              <PersonalContent
                data={personalReport}
                onDownloadPDF={handleDownloadPersonalPDF}
                isPdfGenerating={isPdfGenerating}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ===============================
// ダッシュボードコンテンツ
// ===============================
interface DashboardContentProps {
  data: MonthlyReportData;
  onDownloadPDF: () => void;
  isPdfGenerating: boolean;
}

function DashboardContent({ data, onDownloadPDF, isPdfGenerating }: DashboardContentProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* PDFダウンロードボタン */}
      <div className="flex justify-end">
        <button
          onClick={onDownloadPDF}
          disabled={isPdfGenerating}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPdfGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              生成中...
            </>
          ) : (
            <>
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDFダウンロード
            </>
          )}
        </button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="総勤務時間"
          value={`${data.summary.totalWorkHours.toLocaleString()}h`}
          icon="⏱️"
          color="blue"
        />
        <SummaryCard
          title="スタッフ数"
          value={`${data.summary.totalStaffCount}名`}
          icon="👥"
          color="green"
        />
        <SummaryCard
          title="充足率"
          value={`${data.summary.fulfillmentRate}%`}
          icon="📊"
          color={data.summary.fulfillmentRate >= 80 ? 'green' : 'orange'}
        />
        <SummaryCard
          title="有給消化率"
          value={`${data.summary.paidLeaveUsageRate}%`}
          icon="🏖️"
          color="purple"
        />
      </div>

      {/* グラフ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* シフト種別分布 */}
        <UsageChart
          type="pie"
          title="シフト種別分布"
          data={createPieChartData(
            data.shiftTypeData.overall.map(s => s.shiftType),
            data.shiftTypeData.overall.map(s => s.count)
          )}
          height={300}
        />

        {/* スタッフ別勤務時間 */}
        <UsageChart
          type="bar"
          title="スタッフ別勤務時間（上位10名）"
          data={createBarChartData(
            data.workTimeData.slice(0, 10).map(w => w.staffName),
            data.workTimeData.slice(0, 10).map(w => w.totalHours),
            '勤務時間(h)'
          )}
          height={300}
        />
      </div>
    </div>
  );
}

// ===============================
// 勤務時間コンテンツ
// ===============================
interface WorkTimeContentProps {
  data: MonthlyReportData;
}

function WorkTimeContent({ data }: WorkTimeContentProps): React.ReactElement {
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* モバイル: カード表示 */}
      <div className="block md:hidden">
        <div className="divide-y divide-gray-200">
          {data.workTimeData.map(work => (
            <div
              key={work.staffId}
              onClick={() => setExpandedStaff(expandedStaff === work.staffId ? null : work.staffId)}
              className="p-4 cursor-pointer hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{work.staffName}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    総勤務: {work.totalHours.toFixed(1)}h
                  </div>
                </div>
                <div className="text-right">
                  {work.warningFlags.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      ⚠️ {work.warningFlags.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-gray-500">
                <div>通常: {work.regularHours.toFixed(1)}h</div>
                <div>夜勤: {work.nightHours.toFixed(1)}h</div>
                <div>残業: {work.estimatedOvertimeHours.toFixed(1)}h</div>
              </div>
              {expandedStaff === work.staffId && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2 text-sm">日別詳細</h4>
                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {work.dailyDetails.map(day => (
                      <div
                        key={day.date}
                        className={`p-1 rounded text-center ${
                          day.hours > 0 ? 'bg-blue-100' : 'bg-gray-100'
                        }`}
                      >
                        <div className="font-medium">{day.date.split('-')[2]}</div>
                        <div>{day.hours > 0 ? `${day.hours}h` : '-'}</div>
                      </div>
                    ))}
                  </div>
                  {work.warningFlags.length > 0 && (
                    <div className="mt-3">
                      <h5 className="font-medium text-red-700 mb-1 text-sm">警告</h5>
                      <ul className="list-disc list-inside text-red-600 text-xs">
                        {work.warningFlags.map((flag, idx) => (
                          <li key={idx}>{getWarningLabel(flag)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* デスクトップ: テーブル表示 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                スタッフ名
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                総勤務時間
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                通常勤務
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                夜勤時間
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                推定残業
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                警告
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.workTimeData.map(work => (
              <React.Fragment key={work.staffId}>
                <tr
                  onClick={() => setExpandedStaff(expandedStaff === work.staffId ? null : work.staffId)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {work.staffName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {work.totalHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {work.regularHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {work.nightHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {work.estimatedOvertimeHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {work.warningFlags.length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ⚠️ {work.warningFlags.length}件
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
                {expandedStaff === work.staffId && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 bg-gray-50">
                      <div className="text-sm">
                        <h4 className="font-medium text-gray-900 mb-2">日別詳細</h4>
                        <div className="grid grid-cols-7 gap-1 text-xs">
                          {work.dailyDetails.map(day => (
                            <div
                              key={day.date}
                              className={`p-1 rounded text-center ${
                                day.hours > 0 ? 'bg-blue-100' : 'bg-gray-100'
                              }`}
                            >
                              <div className="font-medium">{day.date.split('-')[2]}</div>
                              <div>{day.hours > 0 ? `${day.hours}h` : '-'}</div>
                            </div>
                          ))}
                        </div>
                        {work.warningFlags.length > 0 && (
                          <div className="mt-3">
                            <h5 className="font-medium text-red-700 mb-1">警告</h5>
                            <ul className="list-disc list-inside text-red-600">
                              {work.warningFlags.map((flag, idx) => (
                                <li key={idx}>{getWarningLabel(flag)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===============================
// シフト種別コンテンツ
// ===============================
interface ShiftTypeContentProps {
  data: MonthlyReportData;
}

function ShiftTypeContent({ data }: ShiftTypeContentProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* 全体のシフト種別分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsageChart
          type="pie"
          title="シフト種別分布（全体）"
          data={createPieChartData(
            data.shiftTypeData.overall.map(s => s.shiftType),
            data.shiftTypeData.overall.map(s => s.count)
          )}
          height={300}
        />

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">シフト種別サマリー</h3>
          <div className="space-y-3">
            {data.shiftTypeData.overall.map(shift => (
              <div key={shift.shiftType} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 rounded mr-3"
                    style={{ backgroundColor: shift.color }}
                  />
                  <span className="text-sm font-medium text-gray-700">{shift.shiftType}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {shift.count}回 ({shift.percentage}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* スタッフ別シフト種別内訳 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">スタッフ別シフト種別内訳</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  スタッフ名
                </th>
                {data.shiftTypeData.overall.map(shift => (
                  <th
                    key={shift.shiftType}
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {shift.shiftType}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.shiftTypeData.byStaff.map(staff => (
                <tr key={staff.staffId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {staff.staffName}
                    {staff.nightShiftWarning && (
                      <span className="ml-2 text-red-500" title="夜勤8回以上">⚠️</span>
                    )}
                  </td>
                  {data.shiftTypeData.overall.map(shiftType => {
                    const breakdown = staff.breakdown.find(b => b.shiftType === shiftType.shiftType);
                    return (
                      <td
                        key={shiftType.shiftType}
                        className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500"
                      >
                        {breakdown?.count || 0}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===============================
// スタッフ稼働コンテンツ
// ===============================
interface StaffActivityContentProps {
  data: MonthlyReportData;
}

function StaffActivityContent({ data }: StaffActivityContentProps): React.ReactElement {
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const selectedActivity = data.staffActivityData.find(s => s.staffId === selectedStaff);

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">
      {/* スタッフ一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">スタッフ一覧</h3>
        </div>
        {/* モバイル: 横スクロールリスト */}
        <div className="lg:hidden flex overflow-x-auto space-x-2 p-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {data.staffActivityData.map(staff => (
            <button
              key={staff.staffId}
              onClick={() => setSelectedStaff(staff.staffId)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStaff === staff.staffId
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {staff.staffName}
            </button>
          ))}
        </div>
        {/* デスクトップ: 縦リスト */}
        <ul className="hidden lg:block divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {data.staffActivityData.map(staff => (
            <li
              key={staff.staffId}
              onClick={() => setSelectedStaff(staff.staffId)}
              className={`px-4 py-3 cursor-pointer transition-colors ${
                selectedStaff === staff.staffId
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">{staff.staffName}</div>
              <div className="text-sm text-gray-500">
                出勤 {staff.workDays}日 / 休日 {staff.restDays}日
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 詳細表示 */}
      <div className="lg:col-span-2">
        {selectedActivity ? (
          <div className="space-y-4">
            {/* 統計カード */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
                <div className="text-xs sm:text-sm text-gray-500">出勤日数</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedActivity.workDays}日</div>
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
                <div className="text-xs sm:text-sm text-gray-500">休日数</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedActivity.restDays}日</div>
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
                <div className="text-xs sm:text-sm text-gray-500">連続勤務最大</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedActivity.maxConsecutiveWorkDays}日</div>
              </div>
              <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
                <div className="text-xs sm:text-sm text-gray-500">週平均勤務</div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{selectedActivity.averageWeeklyHours.toFixed(1)}h</div>
              </div>
            </div>

            {/* 休日内訳 */}
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">休日内訳</h4>
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-xs sm:text-sm text-gray-500">公休:</span>
                  <span className="ml-2 font-medium">{selectedActivity.publicHolidayDays}日</span>
                </div>
                <div>
                  <span className="text-xs sm:text-sm text-gray-500">有給:</span>
                  <span className="ml-2 font-medium">{selectedActivity.paidLeaveDays}日</span>
                </div>
              </div>
            </div>

            {/* 月間カレンダー */}
            <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">月間カレンダー</h4>
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-xs">
                {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                  <div key={day} className="font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
                {selectedActivity.monthlyCalendar.map((day) => (
                  <div
                    key={day.date}
                    className={`p-1 sm:p-2 rounded ${
                      day.status === 'work'
                        ? 'bg-blue-100 text-blue-800'
                        : day.status === 'rest'
                        ? 'bg-gray-100 text-gray-600'
                        : day.status === 'paid_leave'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    <div className="font-medium text-xs sm:text-sm">{new Date(day.date).getDate()}</div>
                    <div className="truncate text-xs hidden sm:block">{day.shiftType || '-'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 sm:p-8 text-center text-gray-500">
            <p className="hidden lg:block">左のリストからスタッフを選択してください</p>
            <p className="lg:hidden">上のリストからスタッフを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ===============================
// 経営分析コンテンツ
// ===============================
interface ManagementContentProps {
  data: ManagementReportData;
  onDownloadPDF: () => void;
  isPdfGenerating: boolean;
}

function ManagementContent({ data, onDownloadPDF, isPdfGenerating }: ManagementContentProps): React.ReactElement {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* PDFダウンロードボタン */}
      <div className="flex justify-end">
        <button
          onClick={onDownloadPDF}
          disabled={isPdfGenerating}
          className="inline-flex items-center px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
        >
          {isPdfGenerating ? '生成中...' : 'PDFダウンロード'}
        </button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard title="充足率" value={`${data.summary.fulfillmentRate}%`} icon="📊" color="blue" />
        <SummaryCard title="総勤務時間" value={`${data.summary.totalWorkHours}h`} icon="⏱️" color="green" />
        <SummaryCard title="スタッフ数" value={`${data.summary.totalStaffCount}名`} icon="👥" color="purple" />
        <SummaryCard title="有給消化率" value={`${data.summary.paidLeaveUsageRate}%`} icon="🏖️" color="orange" />
      </div>

      {/* 時間帯別充足率 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">時間帯別充足率</h3>
        </div>
        {/* モバイル: カード表示 */}
        <div className="block sm:hidden divide-y divide-gray-200">
          {data.timeSlotFulfillment.map(slot => (
            <div key={slot.timeSlot} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-gray-900">{slot.timeSlot}</span>
                <span className={`font-bold ${slot.fulfillmentRate >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                  {slot.fulfillmentRate}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                <div>必要: {slot.requiredCount}</div>
                <div>実績: {slot.actualCount}</div>
                <div>不足: {slot.shortfallDays}日</div>
              </div>
            </div>
          ))}
        </div>
        {/* デスクトップ: テーブル表示 */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間帯</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">必要人数</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">実績人数</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">充足率</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">不足日数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.timeSlotFulfillment.map(slot => (
                <tr key={slot.timeSlot} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{slot.timeSlot}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500">{slot.requiredCount}</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500">{slot.actualCount}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={`font-medium ${slot.fulfillmentRate >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                      {slot.fulfillmentRate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500">{slot.shortfallDays}日</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* コスト推計 */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">コスト推計</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <div className="text-xs sm:text-sm text-gray-500">通常勤務</div>
            <div className="text-lg sm:text-xl font-bold text-gray-900">¥{data.costEstimate.regularHoursCost.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500">残業</div>
            <div className="text-lg sm:text-xl font-bold text-gray-900">¥{data.costEstimate.overtimeHoursCost.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500">夜勤手当</div>
            <div className="text-lg sm:text-xl font-bold text-gray-900">¥{data.costEstimate.nightShiftAllowance.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500">合計</div>
            <div className="text-lg sm:text-xl font-bold text-blue-600">¥{data.costEstimate.totalEstimate.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* 前月比較 */}
      {data.monthComparison && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">前月比較</h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div>
              <div className="text-xs sm:text-sm text-gray-500">勤務時間差</div>
              <div className={`text-base sm:text-xl font-bold ${data.monthComparison.workHoursDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.monthComparison.workHoursDiff >= 0 ? '+' : ''}{data.monthComparison.workHoursDiff}h
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-gray-500">充足率差</div>
              <div className={`text-base sm:text-xl font-bold ${data.monthComparison.fulfillmentRateDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.monthComparison.fulfillmentRateDiff >= 0 ? '+' : ''}{data.monthComparison.fulfillmentRateDiff}%
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm text-gray-500">コスト差</div>
              <div className={`text-base sm:text-xl font-bold ${data.monthComparison.costDiff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data.monthComparison.costDiff >= 0 ? '+' : ''}¥{data.monthComparison.costDiff.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 改善提案 */}
      {data.recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">改善提案</h3>
          <ul className="space-y-2">
            {data.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start text-sm sm:text-base">
                <span className="mr-2 text-blue-500 flex-shrink-0">💡</span>
                <span className="text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===============================
// 個人レポートコンテンツ
// ===============================
interface PersonalContentProps {
  data: PersonalReportData;
  onDownloadPDF: () => void;
  isPdfGenerating: boolean;
}

function PersonalContent({ data, onDownloadPDF, isPdfGenerating }: PersonalContentProps): React.ReactElement {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* PDFダウンロードボタン */}
      <div className="flex justify-end">
        <button
          onClick={onDownloadPDF}
          disabled={isPdfGenerating}
          className="inline-flex items-center px-3 sm:px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
        >
          {isPdfGenerating ? '生成中...' : 'PDFダウンロード'}
        </button>
      </div>

      {/* スタッフ名 */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{data.staffName}</h2>
        <p className="text-sm sm:text-base text-gray-500">{data.targetMonth} 勤務実績レポート</p>
      </div>

      {/* 勤務サマリー */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <SummaryCard title="出勤日数" value={`${data.workSummary.workDays}日`} icon="📅" color="blue" />
        <SummaryCard title="総勤務時間" value={`${data.workSummary.totalHours}h`} icon="⏱️" color="green" />
        <SummaryCard title="夜勤回数" value={`${data.workSummary.nightShiftCount}回`} icon="🌙" color="purple" />
        <SummaryCard title="休日数" value={`${data.workSummary.restDays}日`} icon="🏖️" color="orange" />
      </div>

      {/* シフト種別内訳 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <UsageChart
          type="pie"
          title="シフト種別内訳"
          data={createPieChartData(
            data.shiftBreakdown.map(s => s.shiftType),
            data.shiftBreakdown.map(s => s.count)
          )}
          height={250}
        />

        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">シフト種別詳細</h3>
          <div className="space-y-2">
            {data.shiftBreakdown.map(shift => (
              <div key={shift.shiftType} className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-gray-700">{shift.shiftType}</span>
                <span className="text-gray-500">{shift.count}回 ({shift.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 休暇残高 */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">休暇残高</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <div className="text-xs sm:text-sm text-gray-500">有給休暇</div>
            <div className="flex items-baseline flex-wrap">
              <span className="text-xl sm:text-2xl font-bold text-gray-900">{data.leaveBalance.paidLeaveRemaining}</span>
              <span className="text-gray-500 ml-1 sm:ml-2 text-xs sm:text-sm">/ {data.leaveBalance.paidLeaveUsed + data.leaveBalance.paidLeaveRemaining}日</span>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">使用済み: {data.leaveBalance.paidLeaveUsed}日</div>
          </div>
          <div>
            <div className="text-xs sm:text-sm text-gray-500">公休</div>
            <div className="flex items-baseline flex-wrap">
              <span className="text-xl sm:text-2xl font-bold text-gray-900">{data.leaveBalance.publicHolidayRemaining}</span>
              <span className="text-gray-500 ml-1 sm:ml-2 text-xs sm:text-sm">/ {data.leaveBalance.publicHolidayUsed + data.leaveBalance.publicHolidayRemaining}日</span>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">使用済み: {data.leaveBalance.publicHolidayUsed}日</div>
          </div>
        </div>
      </div>

      {/* 月間カレンダー */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">月間カレンダー</h3>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-xs">
          {['日', '月', '火', '水', '木', '金', '土'].map(day => (
            <div key={day} className="font-medium text-gray-500 py-1">
              {day}
            </div>
          ))}
          {data.calendar.map((day) => (
            <div
              key={day.date}
              className={`p-1 sm:p-2 rounded ${
                day.status === 'work'
                  ? 'bg-blue-100 text-blue-800'
                  : day.status === 'rest'
                  ? 'bg-gray-100 text-gray-600'
                  : day.status === 'paid_leave'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              <div className="font-medium text-xs sm:text-sm">{new Date(day.date).getDate()}</div>
              <div className="truncate text-xs hidden sm:block">{day.shiftType || '-'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===============================
// サマリーカードコンポーネント
// ===============================
interface SummaryCardProps {
  title: string;
  value: string;
  icon: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
}

function SummaryCard({ title, value, icon, color }: SummaryCardProps): React.ReactElement {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    orange: 'bg-orange-50 border-orange-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  return (
    <div className={`p-3 sm:p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-gray-500 truncate">{title}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{value}</p>
        </div>
        <span className="text-xl sm:text-2xl flex-shrink-0">{icon}</span>
      </div>
    </div>
  );
}
