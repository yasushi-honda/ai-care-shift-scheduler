import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Facility, assertResultError } from '../../../types';
import {
  getAllFacilities,
  createFacility,
  getFacilityStats,
  FacilityStats,
} from '../../services/facilityService';
import { Button } from '../../components/Button';

/**
 * Helper function: 日付フォーマット
 * Phase 19.1.5: モジュールスコープに配置してメモ化効果を最大化
 */
function formatFacilityDate(timestamp: any): string {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * FacilityRow
 *
 * Phase 19.1.5: React.memo()で最適化された施設テーブル行コンポーネント
 * - 不要な再レンダリングを抑制
 * - facilityとstatsが変更されない限り再レンダリングしない
 */
interface FacilityRowProps {
  facility: Facility;
  stats: FacilityStats | undefined;
}

const FacilityRow = memo<FacilityRowProps>(({ facility, stats }) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {facility.name}
        </div>
        <div className="text-xs text-gray-500">
          ID: {facility.facilityId.slice(0, 8)}...
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatFacilityDate(facility.createdAt)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {facility.members?.length || 0}人
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {stats ? `${stats.totalStaff}人` : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {stats ? `${stats.totalSchedules}件` : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <Link
          to={`/admin/facilities/${facility.facilityId}`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          詳細を見る →
        </Link>
      </td>
    </tr>
  );
});

FacilityRow.displayName = 'FacilityRow';

/**
 * FacilityManagement
 *
 * 施設管理ページ（super-admin専用）
 * - 全施設の一覧表示（テーブル形式）
 * - 新規施設作成フォーム
 * - 施設詳細へのリンク
 */
export function FacilityManagement(): React.ReactElement {
  const { currentUser } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [stats, setStats] = useState<Map<string, FacilityStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規施設作成フォーム状態
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadStats = useCallback(async (facilityList: Facility[]) => {
    const statsMap = new Map<string, FacilityStats>();

    // 並列で全施設の統計を取得
    await Promise.all(
      facilityList.map(async (facility) => {
        const result = await getFacilityStats(facility.facilityId);
        if (result.success) {
          statsMap.set(facility.facilityId, result.data);
        }
      })
    );

    setStats(statsMap);
  }, []);

  const loadFacilities = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);

    const result = await getAllFacilities(currentUser.uid);

    if (result.success) {
      setFacilities(result.data);
      // 各施設の統計情報を取得
      await loadStats(result.data);
    } else {
      assertResultError(result);
      setError(result.error.message);
    }

    setLoading(false);
  }, [currentUser, loadStats]);

  // 施設一覧を取得
  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  async function handleCreateFacility(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUser) return;

    setCreating(true);
    setCreateError(null);

    const result = await createFacility(newFacilityName, currentUser.uid);

    if (result.success) {
      // 成功：フォームをクリアして一覧を再読み込み
      setNewFacilityName('');
      setShowCreateForm(false);
      await loadFacilities();
    } else {
      assertResultError(result);
      setCreateError(result.error.message);
    }

    setCreating(false);
  }

  // Phase 19.1.5: useMemo()で統計計算をメモ化
  const totalFacilities = useMemo(() => facilities.length, [facilities.length]);

  const totalMembers = useMemo(
    () => facilities.reduce((sum, f) => sum + (f.members?.length || 0), 0),
    [facilities]
  );

  const totalStaff = useMemo(
    () => Array.from(stats.values()).reduce<number>(
      (sum: number, s: FacilityStats) => sum + s.totalStaff,
      0
    ),
    [stats]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">エラー: {error}</p>
        <Button
          onClick={loadFacilities}
          variant="danger"
          className="mt-2"
        >
          再試行
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            施設管理
          </h1>
          <p className="text-gray-600">
            全施設の管理と新規施設の作成
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          variant="primary"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          新規施設作成
        </Button>
      </div>

      {/* 新規施設作成フォーム（モーダル） */}
      {/* Phase 19.2.3: フォームアクセシビリティ改善 - role, aria-labelledby, aria-describedby */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="create-facility-title">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 id="create-facility-title" className="text-xl font-semibold text-gray-900 mb-4">
              新規施設作成
            </h2>

            <form onSubmit={handleCreateFacility}>
              <div className="mb-4">
                <label htmlFor="facility-name-input" className="block text-sm font-medium text-gray-700 mb-2">
                  施設名 <span className="text-red-500" aria-label="必須">*</span>
                </label>
                <input
                  id="facility-name-input"
                  type="text"
                  value={newFacilityName}
                  onChange={(e) => setNewFacilityName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 〇〇介護施設"
                  required
                  aria-required="true"
                  aria-describedby="facility-name-description"
                  aria-invalid={createError ? 'true' : 'false'}
                  maxLength={100}
                  autoFocus
                />
                <p id="facility-name-description" className="text-xs text-gray-500 mt-1">
                  100文字以内で入力してください
                </p>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600" role="alert" aria-live="assertive">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewFacilityName('');
                    setCreateError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={creating}
                >
                  キャンセル
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={creating || !newFacilityName.trim()}
                >
                  {creating ? '作成中...' : '作成'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 施設一覧テーブル */}
      {facilities.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">🏢</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            施設がまだありません
          </h2>
          <p className="text-gray-600 mb-4">
            「新規施設作成」ボタンから最初の施設を作成してください
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Phase 19.2.1: モバイル対応 - 横スクロール */}
          {/* Phase 19.2.1.5: 横スクロールヒント追加 */}
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  施設名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作成日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  メンバー数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  スタッフ数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  シフト数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Phase 19.1.5: React.memo()でメモ化されたFacilityRowを使用 */}
              {facilities.map((facility) => (
                <FacilityRow
                  key={facility.facilityId}
                  facility={facility}
                  stats={stats.get(facility.facilityId)}
                />
              ))}
            </tbody>
          </table>
            </div>
            {/* Phase 19.2.1.5: モバイル横スクロールヒント */}
            <div className="md:hidden px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center">
              ← 横にスクロールできます →
            </div>
          </div>
        </div>
      )}

      {/* Phase 19.1.5: useMemo()でメモ化された統計サマリー */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">総施設数</div>
          <div className="text-2xl font-bold text-blue-900">
            {totalFacilities}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">総メンバー数</div>
          <div className="text-2xl font-bold text-green-900">
            {totalMembers}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-purple-600 font-medium">
            総スタッフ数
          </div>
          <div className="text-2xl font-bold text-purple-900">
            {totalStaff}
          </div>
        </div>
      </div>
    </div>
  );
}
