import React, { useState, useEffect } from 'react';
import { SecurityAlertService } from '../../services/securityAlertService';
import { AnomalyDetectionService } from '../../services/anomalyDetectionService';
import {
  SecurityAlert,
  SecurityAlertType,
  SecurityAlertSeverity,
  SecurityAlertStatus,
  assertResultError,
} from '../../../types';
import { Timestamp } from 'firebase/firestore';

/**
 * SecurityAlertsPage
 *
 * セキュリティアラート管理ページ（super-admin専用）
 *
 * 機能:
 * - セキュリティアラート一覧表示
 * - フィルタリング機能（ステータス、種別、重要度）
 * - アラート詳細表示
 * - ステータス更新（確認、調査中、解決、誤検知）
 * - メモ追加機能
 * - 手動異常検知実行
 */
export function SecurityAlerts(): React.ReactElement {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // ページネーション状態（IDベース）
  const [lastId, setLastId] = useState<string | null>(null);
  const [firstId, setFirstId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const PAGE_SIZE = 25;

  // フィルター状態
  const [filterStatus, setFilterStatus] = useState<SecurityAlertStatus | ''>('');
  const [filterType, setFilterType] = useState<SecurityAlertType | ''>('');
  const [filterSeverity, setFilterSeverity] = useState<SecurityAlertSeverity | ''>('');

  // 詳細表示モーダル
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [notes, setNotes] = useState('');

  // フィルター変更時のロード
  useEffect(() => {
    loadAlerts();
  }, [filterStatus, filterType, filterSeverity]);

  const loadAlerts = async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    setLoading(true);
    setError(null);

    const filters: {
      status?: SecurityAlertStatus;
      type?: SecurityAlertType;
      severity?: SecurityAlertSeverity;
      limit?: number;
      startAfterId?: string;
      startBeforeId?: string;
    } = { limit: PAGE_SIZE + 1 }; // hasMore判定のため+1件取得

    if (filterStatus) filters.status = filterStatus;
    if (filterType) filters.type = filterType;
    if (filterSeverity) filters.severity = filterSeverity;

    // ページネーション処理（IDベース）
    if (direction === 'next' && lastId) {
      filters.startAfterId = lastId;
    } else if (direction === 'prev' && firstId) {
      filters.startBeforeId = firstId;
    }

    const result = await SecurityAlertService.getAlerts(filters);

    if (!result.success) {
      assertResultError(result);
      setError(result.error.message);
      setLoading(false);
      return;
    }

    // hasNext/hasPrev判定と表示データの設定
    const hasMoreData = result.data.length > PAGE_SIZE;

    if (result.data.length > PAGE_SIZE) {
      // 次ページがある場合：最初のPAGE_SIZE件のみ表示
      const displayAlerts = result.data.slice(0, PAGE_SIZE);
      setAlerts(displayAlerts);
      setFirstId(displayAlerts[0].id);
      setLastId(displayAlerts[displayAlerts.length - 1].id);
    } else if (result.data.length > 0) {
      // 次ページがない場合：全件表示
      setAlerts(result.data);
      setFirstId(result.data[0].id);
      setLastId(result.data[result.data.length - 1].id);
    } else {
      // データなし
      setAlerts([]);
      setFirstId(null);
      setLastId(null);
    }

    // ページネーション可否を方向別に設定
    if (direction === 'next') {
      // 次に進んだ：hasNextを判定、hasPrevは常にtrue
      setHasNext(hasMoreData);
      setHasPrev(true);
    } else if (direction === 'prev') {
      // 前に戻った：hasPrevを判定、hasNextは常にtrue
      setHasPrev(hasMoreData);
      setHasNext(true);
    } else {
      // 初期ロード：hasNextを判定、hasPrevはfalse
      setHasNext(hasMoreData);
      setHasPrev(false);
    }

    // ページ番号を更新
    if (direction === 'next') {
      setCurrentPage((prev) => prev + 1);
    } else if (direction === 'prev') {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    } else {
      setCurrentPage(1);
    }

    setLoading(false);
  };

  const handleFilterApply = () => {
    loadAlerts();
  };

  const handleFilterClear = () => {
    setFilterStatus('');
    setFilterType('');
    setFilterSeverity('');
  };

  const handleRunDetection = async () => {
    setScanning(true);
    try {
      await AnomalyDetectionService.runAllDetections();
      alert('異常検知スキャンが完了しました。アラートを再読み込みします。');
      await loadAlerts();
    } catch (err) {
      alert('異常検知スキャンに失敗しました');
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const formatTimestamp = (timestamp: Timestamp): string => {
    const date = timestamp.toDate();
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTypeBadgeColor = (type: SecurityAlertType): string => {
    switch (type) {
      case SecurityAlertType.BULK_EXPORT:
        return 'bg-orange-100 text-orange-800';
      case SecurityAlertType.UNUSUAL_TIME_ACCESS:
        return 'bg-yellow-100 text-yellow-800';
      case SecurityAlertType.MULTIPLE_AUTH_FAILURES:
        return 'bg-red-100 text-red-800';
      case SecurityAlertType.UNAUTHORIZED_ACCESS_ATTEMPT:
        return 'bg-red-100 text-red-800';
      case SecurityAlertType.STORAGE_THRESHOLD_EXCEEDED:
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityBadgeColor = (severity: SecurityAlertSeverity): string => {
    switch (severity) {
      case SecurityAlertSeverity.LOW:
        return 'bg-blue-100 text-blue-800';
      case SecurityAlertSeverity.MEDIUM:
        return 'bg-yellow-100 text-yellow-800';
      case SecurityAlertSeverity.HIGH:
        return 'bg-orange-100 text-orange-800';
      case SecurityAlertSeverity.CRITICAL:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: SecurityAlertStatus): string => {
    switch (status) {
      case SecurityAlertStatus.NEW:
        return 'bg-red-100 text-red-800';
      case SecurityAlertStatus.ACKNOWLEDGED:
        return 'bg-yellow-100 text-yellow-800';
      case SecurityAlertStatus.INVESTIGATING:
        return 'bg-blue-100 text-blue-800';
      case SecurityAlertStatus.RESOLVED:
        return 'bg-green-100 text-green-800';
      case SecurityAlertStatus.FALSE_POSITIVE:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRowClick = (alert: SecurityAlert) => {
    setSelectedAlert(alert);
    setNotes(alert.notes || '');
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedAlert(null);
    setNotes('');
  };

  const handleUpdateStatus = async (status: SecurityAlertStatus) => {
    if (!selectedAlert) return;

    const result = await SecurityAlertService.updateAlertStatus(
      selectedAlert.id,
      status,
      notes
    );

    if (!result.success) {
      assertResultError(result);
      alert(`ステータス更新に失敗しました: ${result.error.message}`);
      return;
    }

    alert('ステータスを更新しました');
    closeDetailModal();
    await loadAlerts();
  };

  const handleAddNotes = async () => {
    if (!selectedAlert) return;

    const result = await SecurityAlertService.addNotes(selectedAlert.id, notes);

    if (!result.success) {
      assertResultError(result);
      alert(`メモの保存に失敗しました: ${result.error.message}`);
      return;
    }

    alert('メモを保存しました');
    closeDetailModal();
    await loadAlerts();
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          セキュリティアラート
        </h1>
        <button
          onClick={handleRunDetection}
          disabled={scanning}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {scanning ? '🔄 スキャン中...' : '🔍 異常検知実行'}
        </button>
      </div>

      {/* フィルターパネル */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">フィルター</h2>
          <button
            onClick={handleFilterClear}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            クリア
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ステータス */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ステータス
            </label>
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as SecurityAlertStatus | '')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              {Object.values(SecurityAlertStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* 種別 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              種別
            </label>
            <select
              value={filterType}
              onChange={(e) =>
                setFilterType(e.target.value as SecurityAlertType | '')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              {Object.values(SecurityAlertType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* 重要度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              重要度
            </label>
            <select
              value={filterSeverity}
              onChange={(e) =>
                setFilterSeverity(e.target.value as SecurityAlertSeverity | '')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              {Object.values(SecurityAlertSeverity).map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleFilterApply}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            フィルター適用
          </button>
        </div>
      </div>

      {/* アラート一覧テーブル */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">エラー: {error}</div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            セキュリティアラートがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    検出日時
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    タイトル
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    種別
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    重要度
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    onClick={() => handleRowClick(alert)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatTimestamp(alert.detectedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {alert.title}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getTypeBadgeColor(
                          alert.type
                        )}`}
                      >
                        {alert.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityBadgeColor(
                          alert.severity
                        )}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getStatusBadgeColor(
                          alert.status
                        )}`}
                      >
                        {alert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ページネーション */}
        {!loading && !error && alerts.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              ページ {currentPage} ({alerts.length}件を表示中、1ページあたり{PAGE_SIZE}件)
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => loadAlerts('prev')}
                disabled={!hasPrev || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← 前へ
              </button>
              <button
                onClick={() => loadAlerts('next')}
                disabled={!hasNext || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                次へ →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 詳細表示モーダル */}
      {showDetailModal && selectedAlert && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeDetailModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                セキュリティアラート詳細
              </h2>
              <button
                onClick={closeDetailModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* 基本情報 */}
              {/* Phase 19.2.1: モバイル対応 - レスポンシブグリッド */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    検出日時
                  </div>
                  <div className="mt-1 text-sm text-gray-900">
                    {formatTimestamp(selectedAlert.detectedAt)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    ステータス
                  </div>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${getStatusBadgeColor(
                        selectedAlert.status
                      )}`}
                    >
                      {selectedAlert.status}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">種別</div>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${getTypeBadgeColor(
                        selectedAlert.type
                      )}`}
                    >
                      {selectedAlert.type}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    重要度
                  </div>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${getSeverityBadgeColor(
                        selectedAlert.severity
                      )}`}
                    >
                      {selectedAlert.severity}
                    </span>
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-500">
                    タイトル
                  </div>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedAlert.title}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-500">説明</div>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedAlert.description}
                  </div>
                </div>
                {selectedAlert.userId && (
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-gray-500">
                      対象ユーザーID
                    </div>
                    <div className="mt-1 text-sm text-gray-900 font-mono">
                      {selectedAlert.userId}
                    </div>
                  </div>
                )}
              </div>

              {/* メタデータ */}
              {selectedAlert.metadata &&
                Object.keys(selectedAlert.metadata).length > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      メタデータ（JSON）
                    </h3>
                    <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                      {JSON.stringify(selectedAlert.metadata, null, 2)}
                    </pre>
                  </div>
                )}

              {/* メモ */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  管理者メモ
                </h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="メモを入力..."
                />
                <button
                  onClick={handleAddNotes}
                  className="mt-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  メモを保存
                </button>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() =>
                    handleUpdateStatus(SecurityAlertStatus.ACKNOWLEDGED)
                  }
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                >
                  確認済みにする
                </button>
                <button
                  onClick={() =>
                    handleUpdateStatus(SecurityAlertStatus.INVESTIGATING)
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  調査中にする
                </button>
                <button
                  onClick={() =>
                    handleUpdateStatus(SecurityAlertStatus.RESOLVED)
                  }
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  解決済みにする
                </button>
                <button
                  onClick={() =>
                    handleUpdateStatus(SecurityAlertStatus.FALSE_POSITIVE)
                  }
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  誤検知にする
                </button>
                <button
                  onClick={closeDetailModal}
                  className="ml-auto px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
