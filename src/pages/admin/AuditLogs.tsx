import React, { useState, useEffect } from 'react';
import { AuditLogService } from '../../services/auditLogService';
import { AuditLog, AuditLogAction, assertResultError } from '../../../types';
import { Timestamp } from 'firebase/firestore';

/**
 * AuditLogsPage
 *
 * 監査ログビューアページ（super-admin専用）
 *
 * 機能:
 * - 監査ログの一覧表示
 * - フィルタリング機能（日時範囲、ユーザーID、操作種別、リソースタイプ、施設ID）
 * - CSV/JSONエクスポート機能
 * - ページネーション
 * - 詳細表示モーダル
 */
export function AuditLogs(): React.ReactElement {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ページネーション状態（IDベース）
  const [lastId, setLastId] = useState<string | null>(null);
  const [firstId, setFirstId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const PAGE_SIZE = 50;

  // フィルター状態
  const [filterUserId, setFilterUserId] = useState('');
  const [filterAction, setFilterAction] = useState<AuditLogAction | ''>('');
  const [filterResourceType, setFilterResourceType] = useState('');
  const [filterFacilityId, setFilterFacilityId] = useState<string>('');

  // 詳細表示モーダル
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // フィルター変更時のロード
  useEffect(() => {
    loadLogs();
  }, [filterUserId, filterAction, filterResourceType, filterFacilityId]);

  const loadLogs = async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    setLoading(true);
    setError(null);

    const filters: {
      userId?: string;
      action?: AuditLogAction;
      resourceType?: string;
      facilityId?: string | null;
      limit?: number;
      startAfterId?: string;
      startBeforeId?: string;
    } = { limit: PAGE_SIZE + 1 }; // hasMore判定のため+1件取得

    if (filterUserId) filters.userId = filterUserId;
    if (filterAction) filters.action = filterAction;
    if (filterResourceType) filters.resourceType = filterResourceType;
    if (filterFacilityId !== '') {
      filters.facilityId = filterFacilityId || null;
    }

    // ページネーション処理（IDベース）
    if (direction === 'next' && lastId) {
      filters.startAfterId = lastId;
    } else if (direction === 'prev' && firstId) {
      filters.startBeforeId = firstId;
    }

    const result = await AuditLogService.getAuditLogs(filters);

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
      const displayLogs = result.data.slice(0, PAGE_SIZE);
      setLogs(displayLogs);
      setFirstId(displayLogs[0].id);
      setLastId(displayLogs[displayLogs.length - 1].id);
    } else if (result.data.length > 0) {
      // 次ページがない場合：全件表示
      setLogs(result.data);
      setFirstId(result.data[0].id);
      setLastId(result.data[result.data.length - 1].id);
    } else {
      // データなし
      setLogs([]);
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
    loadLogs();
  };

  const handleFilterClear = () => {
    setFilterUserId('');
    setFilterAction('');
    setFilterResourceType('');
    setFilterFacilityId('');
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

  const getActionBadgeColor = (action: AuditLogAction): string => {
    switch (action) {
      case AuditLogAction.CREATE:
        return 'bg-green-100 text-green-800';
      case AuditLogAction.UPDATE:
        return 'bg-blue-100 text-blue-800';
      case AuditLogAction.DELETE:
        return 'bg-red-100 text-red-800';
      case AuditLogAction.READ:
        return 'bg-gray-100 text-gray-800';
      case AuditLogAction.LOGIN:
        return 'bg-purple-100 text-purple-800';
      case AuditLogAction.LOGOUT:
        return 'bg-yellow-100 text-yellow-800';
      case AuditLogAction.GRANT_ROLE:
        return 'bg-indigo-100 text-indigo-800';
      case AuditLogAction.REVOKE_ROLE:
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getResultBadgeColor = (result: 'success' | 'failure'): string => {
    return result === 'success'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const handleRowClick = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedLog(null);
  };

  const exportToCSV = () => {
    const headers = [
      '日時',
      'ユーザーID',
      '施設ID',
      '操作種別',
      'リソースタイプ',
      'リソースID',
      '結果',
      'エラーメッセージ',
      'IPアドレス',
      'ユーザーエージェント',
    ];

    const rows = logs.map((log) => [
      formatTimestamp(log.timestamp),
      log.userId,
      log.facilityId || '',
      log.action,
      log.resourceType,
      log.resourceId || '',
      log.result,
      log.errorMessage || '',
      log.deviceInfo.ipAddress || '',
      log.deviceInfo.userAgent || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const jsonData = logs.map((log) => ({
      ...log,
      timestamp: formatTimestamp(log.timestamp),
    }));

    const jsonContent = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `audit_logs_${new Date().toISOString().split('T')[0]}.json`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">監査ログ</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportToCSV}
            disabled={logs.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📄 CSV
          </button>
          <button
            onClick={exportToJSON}
            disabled={logs.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📦 JSON
          </button>
        </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* ユーザーID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ユーザーID
            </label>
            <input
              type="text"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              placeholder="ユーザーID"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 操作種別 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              操作種別
            </label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as AuditLogAction | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべて</option>
              {Object.values(AuditLogAction).map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          {/* リソースタイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              リソースタイプ
            </label>
            <input
              type="text"
              value={filterResourceType}
              onChange={(e) => setFilterResourceType(e.target.value)}
              placeholder="staff, schedule..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 施設ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              施設ID
            </label>
            <input
              type="text"
              value={filterFacilityId}
              onChange={(e) => setFilterFacilityId(e.target.value)}
              placeholder="施設ID（空でグローバル）"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

      {/* ログ一覧テーブル */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">エラー: {error}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            監査ログがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日時
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ユーザーID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    リソース
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    結果
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => handleRowClick(log)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {log.userId.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {log.resourceType}
                      {log.resourceId && (
                        <span className="text-gray-400">
                          {' '}
                          ({log.resourceId.substring(0, 8)}...)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${getResultBadgeColor(
                          log.result
                        )}`}
                      >
                        {log.result === 'success' ? '成功' : '失敗'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ページネーション */}
        {!loading && !error && logs.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              ページ {currentPage} ({logs.length}件表示中)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadLogs('prev')}
                disabled={!hasPrev}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  !hasPrev
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                前へ
              </button>
              <button
                onClick={() => loadLogs('next')}
                disabled={!hasNext}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  !hasNext
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 詳細表示モーダル */}
      {showDetailModal && selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeDetailModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">監査ログ詳細</h2>
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
                  <div className="text-sm font-medium text-gray-500">日時</div>
                  <div className="mt-1 text-sm text-gray-900">
                    {formatTimestamp(selectedLog.timestamp)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">結果</div>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${getResultBadgeColor(
                        selectedLog.result
                      )}`}
                    >
                      {selectedLog.result === 'success' ? '成功' : '失敗'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    ユーザーID
                  </div>
                  <div className="mt-1 text-sm text-gray-900 font-mono">
                    {selectedLog.userId}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    施設ID
                  </div>
                  <div className="mt-1 text-sm text-gray-900 font-mono">
                    {selectedLog.facilityId || 'グローバル'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">操作種別</div>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${getActionBadgeColor(
                        selectedLog.action
                      )}`}
                    >
                      {selectedLog.action}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">
                    リソースタイプ
                  </div>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedLog.resourceType}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-500">
                    リソースID
                  </div>
                  <div className="mt-1 text-sm text-gray-900 font-mono">
                    {selectedLog.resourceId || 'N/A'}
                  </div>
                </div>
              </div>

              {/* デバイス情報 */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  デバイス情報
                </h3>
                <div className="space-y-2">
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      IPアドレス
                    </div>
                    <div className="mt-1 text-sm text-gray-900 font-mono">
                      {selectedLog.deviceInfo.ipAddress || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">
                      ユーザーエージェント
                    </div>
                    <div className="mt-1 text-sm text-gray-900 break-all">
                      {selectedLog.deviceInfo.userAgent || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* エラーメッセージ */}
              {selectedLog.errorMessage && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    エラーメッセージ
                  </h3>
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              {/* 詳細情報（JSON） */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  詳細情報（JSON）
                </h3>
                <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={closeDetailModal}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
