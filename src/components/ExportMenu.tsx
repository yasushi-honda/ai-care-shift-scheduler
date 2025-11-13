/**
 * ExportMenu.tsx
 *
 * Phase 19.3.1: エクスポート機能 - エクスポートメニューUIコンポーネント
 *
 * 特徴:
 * - CSV/PDF形式選択ドロップダウン
 * - エクスポートボタン
 * - ローディング状態表示
 * - エラーハンドリングとトースト通知
 * - 監査ログ記録
 */

import React, { useState } from 'react';
import { Schedule, Staff, LeaveRequestDocument, AuditLogAction } from '../../types';
import { Button } from './Button';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { AuditLogService } from '../services/auditLogService';
import {
  exportScheduleToCSV,
  exportStaffToCSV,
  exportLeaveRequestsToCSV,
  downloadCSV,
  generateFilename,
} from '../utils/exportCSV';
import {
  exportScheduleToPDF,
  exportStaffToPDF,
  downloadPDF,
} from '../utils/exportPDF';

/**
 * エクスポートメニューのプロパティ
 */
export interface ExportMenuProps {
  /**
   * エクスポートタイプ
   */
  type: 'schedule' | 'staff' | 'leaveRequests';

  /**
   * データソース
   */
  data: Schedule | Staff[] | LeaveRequestDocument[];

  /**
   * 施設ID
   */
  facilityId: string;

  /**
   * 施設名
   */
  facilityName: string;

  /**
   * 追加のCSSクラス
   */
  className?: string;

  /**
   * エクスポート完了時のコールバック
   */
  onExportComplete?: (format: 'csv' | 'pdf', auditLogId: string) => void;
}

/**
 * ExportMenu
 *
 * CSV/PDF形式でデータをエクスポートするメニューコンポーネント
 */
export const ExportMenu: React.FC<ExportMenuProps> = ({
  type,
  data,
  facilityId,
  facilityName,
  className = '',
  onExportComplete,
}) => {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  /**
   * エクスポート処理
   */
  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!currentUser) {
      addToast('ログインが必要です', 'error');
      return;
    }

    if (!data) {
      addToast('エクスポートするデータがありません', 'error');
      return;
    }

    setIsExporting(true);
    setShowDropdown(false);

    try {
      let filename = '';
      let recordCount = 0;

      // エクスポート処理
      if (format === 'csv') {
        filename = await exportCSV(type, data, facilityName);
        recordCount = getRecordCount(type, data);
      } else {
        filename = await exportPDF(type, data, facilityName);
        recordCount = getRecordCount(type, data);
      }

      // 監査ログ記録
      const auditLogResult = await AuditLogService.logAction({
        userId: currentUser.uid,
        facilityId,
        action: AuditLogAction.EXPORT,
        resourceType: getResourceType(type),
        resourceId: null,
        details: {
          exportType: type,
          format,
          recordCount,
          filename,
        },
        deviceInfo: {
          ipAddress: null,
          userAgent: navigator.userAgent,
        },
        result: 'success',
      });

      // 成功通知
      addToast(`${getDataTypeName(type)}を${format.toUpperCase()}形式でエクスポートしました`, 'success');

      // コールバック実行
      if (onExportComplete && auditLogResult.success) {
        onExportComplete(format, auditLogResult.data);
      }
    } catch (error) {
      console.error('Export error:', error);

      // エラー監査ログ記録
      await AuditLogService.logAction({
        userId: currentUser.uid,
        facilityId,
        action: AuditLogAction.EXPORT,
        resourceType: getResourceType(type),
        resourceId: null,
        details: {
          exportType: type,
          format,
        },
        deviceInfo: {
          ipAddress: null,
          userAgent: navigator.userAgent,
        },
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : '不明なエラー',
      });

      // エラー通知
      addToast(
        `エクスポートに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        onClick={() => setShowDropdown(!showDropdown)}
        variant="secondary"
        disabled={isExporting}
        icon={
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        }
      >
        {isExporting ? 'エクスポート中...' : 'エクスポート'}
      </Button>

      {/* ドロップダウンメニュー */}
      {showDropdown && !isExporting && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="py-1">
            <button
              onClick={() => handleExport('csv')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              CSV形式でエクスポート
            </button>

            {/* PDFエクスポートは休暇申請では非対応 */}
            {type !== 'leaveRequests' && (
              <button
                onClick={() => handleExport('pdf')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                PDF形式でエクスポート
              </button>
            )}
          </div>
        </div>
      )}

      {/* クリック外部でドロップダウンを閉じる */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

// ==================== ヘルパー関数 ====================

/**
 * CSV形式でエクスポート
 */
async function exportCSV(
  type: 'schedule' | 'staff' | 'leaveRequests',
  data: Schedule | Staff[] | LeaveRequestDocument[],
  facilityName: string
): Promise<string> {
  let csvContent: string;
  let filename: string;

  if (type === 'schedule') {
    csvContent = exportScheduleToCSV(data as Schedule, facilityName);
    filename = generateFilename('シフト表', facilityName, 'csv');
  } else if (type === 'staff') {
    csvContent = exportStaffToCSV(data as Staff[], facilityName);
    filename = generateFilename('スタッフ一覧', facilityName, 'csv');
  } else {
    csvContent = exportLeaveRequestsToCSV(data as LeaveRequestDocument[], facilityName);
    filename = generateFilename('休暇申請一覧', facilityName, 'csv');
  }

  downloadCSV(csvContent, filename);
  return filename;
}

/**
 * PDF形式でエクスポート
 */
async function exportPDF(
  type: 'schedule' | 'staff' | 'leaveRequests',
  data: Schedule | Staff[] | LeaveRequestDocument[],
  facilityName: string
): Promise<string> {
  let filename: string;

  if (type === 'schedule') {
    const pdf = exportScheduleToPDF(data as Schedule, facilityName);
    filename = generateFilename('シフト表', facilityName, 'pdf');
    downloadPDF(pdf, filename);
  } else if (type === 'staff') {
    const pdf = exportStaffToPDF(data as Staff[], facilityName);
    filename = generateFilename('スタッフ一覧', facilityName, 'pdf');
    downloadPDF(pdf, filename);
  } else {
    throw new Error('休暇申請のPDFエクスポートは未対応です');
  }

  return filename;
}

/**
 * レコード数を取得
 */
function getRecordCount(
  type: 'schedule' | 'staff' | 'leaveRequests',
  data: Schedule | Staff[] | LeaveRequestDocument[]
): number {
  if (type === 'schedule') {
    return (data as Schedule).staffSchedules?.length || 0;
  } else {
    return (data as Staff[] | LeaveRequestDocument[]).length;
  }
}

/**
 * リソースタイプ名を取得
 */
function getResourceType(type: 'schedule' | 'staff' | 'leaveRequests'): string {
  const typeMap = {
    schedule: 'schedule',
    staff: 'staff',
    leaveRequests: 'leaveRequest',
  };
  return typeMap[type];
}

/**
 * データタイプ名を取得（日本語）
 */
function getDataTypeName(type: 'schedule' | 'staff' | 'leaveRequests'): string {
  const nameMap = {
    schedule: 'シフト表',
    staff: 'スタッフ一覧',
    leaveRequests: '休暇申請一覧',
  };
  return nameMap[type];
}

export default ExportMenu;
