import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getMonthlyReport,
  getManagementReport,
  getPersonalReport,
  getComplianceData,
} from '../../services/reportService';
// pdfService は PDF生成時のみ動的importする（jsPDF + html2canvas の遅延読み込み）
import {
  MonthlyReportData,
  ManagementReportData,
  PersonalReportData,
  FacilityRole,
  StaffSchedule,
  Staff,
  FacilityShiftSettings,
} from '../../../types';
import MonthNavigator from '../../../components/MonthNavigator';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { ErrorMessage } from '../../components/ErrorMessage';
import { DashboardContent } from './DashboardContent';
import { WorkTimeContent } from './WorkTimeContent';
import { ShiftTypeContent } from './ShiftTypeContent';
import { StaffActivityContent } from './StaffActivityContent';
import { ManagementContent } from './ManagementContent';
import { PersonalContent } from './PersonalContent';
import { ComplianceContent } from './ComplianceContent';
import { DocumentArchiveContent } from './DocumentArchiveContent';
import { SubmissionGuideModal } from '../../components/SubmissionGuideModal';

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

type ReportTab = 'dashboard' | 'workTime' | 'shiftType' | 'staffActivity' | 'management' | 'personal' | 'compliance' | 'archive';

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

  // コンプライアンスデータ
  const [complianceStaffSchedules, setComplianceStaffSchedules] = useState<StaffSchedule[] | null>(null);
  const [complianceStaffList, setComplianceStaffList] = useState<Staff[] | null>(null);
  const [complianceShiftSettings, setComplianceShiftSettings] = useState<FacilityShiftSettings | null>(null);

  // Phase 61: 電子申請フロー案内モーダル
  const [submissionGuideOpen, setSubmissionGuideOpen] = useState(false);

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

  // コンプライアンスデータを取得
  const fetchComplianceData = useCallback(async () => {
    if (!selectedFacilityId) return;

    setIsLoading(true);
    setError(null);

    const result = await getComplianceData(selectedFacilityId, targetMonth);

    if (result.success === true) {
      const { staffSchedules, staffList, shiftSettings } = result.data;
      setComplianceStaffSchedules(staffSchedules);
      setComplianceStaffList(staffList);
      setComplianceShiftSettings(shiftSettings);
    } else if (result.success === false) {
      const err = result.error;
      if (err.code === 'NO_SCHEDULE_DATA') {
        setError(`${targetMonth}のシフトデータがありません`);
      } else {
        setError(`コンプライアンスデータの取得に失敗しました: ${err.message}`);
      }
      setComplianceStaffSchedules(null);
      setComplianceStaffList(null);
      setComplianceShiftSettings(null);
    }

    setIsLoading(false);
  }, [selectedFacilityId, targetMonth]);

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
      case 'compliance':
        fetchComplianceData();
        break;
      case 'archive':
        // DocumentArchiveContent が自律的にデータを取得するため、ここでは何もしない
        break;
    }
  }, [activeTab, selectedFacilityId, targetMonth, fetchMonthlyReport, fetchManagementReport, fetchPersonalReport, fetchComplianceData]);

  // ダッシュボードPDFダウンロード
  const handleDownloadDashboardPDF = async () => {
    if (!monthlyReport) return;

    setIsPdfGenerating(true);
    try {
      const { generateDashboardPDF } = await import('../../services/pdfService');
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
      const { generateManagementPDF } = await import('../../services/pdfService');
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
      const { generatePersonalPDF } = await import('../../services/pdfService');
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
    { id: 'compliance', label: 'コンプライアンス', visible: isManager },
    { id: 'archive', label: '書類アーカイブ', visible: isManager },
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
      <header className="bg-white shadow-xs">
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
                    py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors shrink-0
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
                case 'compliance':
                  fetchComplianceData();
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

            {/* コンプライアンスタブ */}
            {activeTab === 'compliance' &&
              complianceStaffSchedules &&
              complianceStaffList &&
              complianceShiftSettings && (
                <ComplianceContent
                  staffSchedules={complianceStaffSchedules}
                  staffList={complianceStaffList}
                  shiftSettings={complianceShiftSettings}
                  facilityName={getFacilityName()}
                  targetMonth={targetMonth}
                  facilityId={selectedFacilityId ?? undefined}
                  userId={currentUser?.uid}
                  onOpenSubmissionGuide={() => setSubmissionGuideOpen(true)}
                />
              )}

            {/* 書類アーカイブタブ（管理者専用） */}
            {activeTab === 'archive' && selectedFacilityId && (
              <DocumentArchiveContent
                facilityId={selectedFacilityId}
                facilityName={getFacilityName()}
                onOpenSubmissionGuide={() => setSubmissionGuideOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Phase 61: 電子申請フロー案内モーダル */}
      <SubmissionGuideModal
        isOpen={submissionGuideOpen}
        onClose={() => setSubmissionGuideOpen(false)}
      />
    </div>
  );
}

