import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Facility, FacilityRole } from '../../../types';
import { getUserById, grantAccess, revokeAccess } from '../../services/userService';
import { getAllFacilities } from '../../services/facilityService';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/Button';

/**
 * UserDetail
 *
 * ユーザー詳細ページ（super-admin専用）
 * - ユーザーの基本情報
 * - 所属施設とロール一覧
 * - アクセス権限付与フォーム
 * - アクセス権限削除機能
 */
export function UserDetail(): React.ReactElement {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // アクセス権限付与フォーム状態
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [selectedRole, setSelectedRole] = useState<FacilityRole>(FacilityRole.Viewer);
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  // アクセス権限削除状態
  const [revoking, setRevoking] = useState<string | null>(null); // facilityId being revoked

  const loadUserDetail = useCallback(async () => {
    if (!userId || !currentUser) return;

    setLoading(true);
    setError(null);

    // ユーザー情報と全施設情報を並列取得
    const [userResult, facilitiesResult] = await Promise.all([
      getUserById(userId, currentUser.uid),
      getAllFacilities(currentUser.uid),
    ]);

    if (!userResult.success) {
      setError(userResult.error.message);
      setLoading(false);
      return;
    }

    setUser(userResult.data);

    if (facilitiesResult.success) {
      setFacilities(facilitiesResult.data);
    }

    setLoading(false);
  }, [userId, currentUser]);

  useEffect(() => {
    loadUserDetail();
  }, [loadUserDetail]);

  async function handleGrantAccess(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUser || !userId) return;

    setGranting(true);
    setGrantError(null);

    const result = await grantAccess(
      userId,
      selectedFacilityId,
      selectedRole,
      currentUser.uid
    );

    if (result.success) {
      // 成功：フォームをクリアして詳細を再読み込み
      setSelectedFacilityId('');
      setSelectedRole(FacilityRole.Viewer);
      setShowGrantForm(false);
      await loadUserDetail();
    } else {
      setGrantError(result.error.message);
    }

    setGranting(false);
  }

  async function handleRevokeAccess(facilityId: string) {
    if (!currentUser || !userId) return;

    const confirmed = window.confirm(
      'このユーザーの施設へのアクセス権限を削除してもよろしいですか？'
    );
    if (!confirmed) return;

    setRevoking(facilityId);

    const result = await revokeAccess(userId, facilityId, currentUser.uid);

    if (result.success) {
      // 成功：詳細を再読み込み
      await loadUserDetail();
    } else {
      alert(`エラー: ${result.error.message}`);
    }

    setRevoking(null);
  }

  function formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'super-admin':
        return 'bg-red-100 text-red-800';
      case 'admin':
        return 'bg-orange-100 text-orange-800';
      case 'editor':
        return 'bg-blue-100 text-blue-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getRoleLabel(role: string): string {
    switch (role) {
      case 'super-admin':
        return 'スーパー管理者';
      case 'admin':
        return '管理者';
      case 'editor':
        return '編集者';
      case 'viewer':
        return '閲覧者';
      default:
        return role;
    }
  }

  function getFacilityName(facilityId: string): string {
    const facility = facilities.find((f) => f.facilityId === facilityId);
    return facility?.name || facilityId;
  }

  // 付与可能な施設リスト（すでにアクセス権を持っていない施設のみ）
  const availableFacilities = facilities.filter(
    (facility) =>
      !user?.facilities?.some((access) => access.facilityId === facility.facilityId)
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

  if (error || !user) {
    return (
      <div>
        <button
          onClick={() => navigate('/admin/users')}
          className="mb-4 text-blue-600 hover:text-blue-800"
        >
          ← ユーザー一覧に戻る
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">エラー: {error || 'ユーザーが見つかりません'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ヘッダー */}
      <button
        onClick={() => navigate('/admin/users')}
        className="mb-4 text-blue-600 hover:text-blue-800 font-medium"
      >
        ← ユーザー一覧に戻る
      </button>

      <div className="mb-8 flex items-center">
        <img
          src={user.photoURL}
          alt={user.name}
          className="h-20 w-20 rounded-full mr-4"
        />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{user.name}</h1>
          <p className="text-gray-600">{user.email}</p>
        </div>
      </div>

      {/* 基本情報 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">基本情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">ユーザーID</div>
            <div className="text-base font-medium text-gray-900 font-mono text-xs">
              {user.userId}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">最終ログイン</div>
            <div className="text-base font-medium text-gray-900">
              {formatDate(user.lastLoginAt)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">アカウント作成日</div>
            <div className="text-base font-medium text-gray-900">
              {formatDate(user.createdAt)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">認証プロバイダー</div>
            <div className="text-base font-medium text-gray-900">
              {user.provider === 'google' ? 'Google' : user.provider}
            </div>
          </div>
        </div>
      </div>

      {/* アクセス権限付与ボタン */}
      <div className="mb-6">
        <Button
          onClick={() => setShowGrantForm(true)}
          variant="primary"
          disabled={availableFacilities.length === 0}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          アクセス権限を付与
        </Button>
        {availableFacilities.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">
            付与可能な施設がありません
          </p>
        )}
      </div>

      {/* アクセス権限付与フォーム（モーダル） */}
      {showGrantForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              アクセス権限付与
            </h2>

            <form onSubmit={handleGrantAccess}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  施設 <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">施設を選択</option>
                  {availableFacilities.map((facility) => (
                    <option key={facility.facilityId} value={facility.facilityId}>
                      {facility.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ロール <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as FacilityRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value={FacilityRole.Viewer}>閲覧者 (Viewer)</option>
                  <option value={FacilityRole.Editor}>編集者 (Editor)</option>
                  <option value={FacilityRole.Admin}>管理者 (Admin)</option>
                  <option value={FacilityRole.SuperAdmin}>
                    スーパー管理者 (Super Admin)
                  </option>
                </select>
              </div>

              {grantError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                  {grantError}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowGrantForm(false);
                    setSelectedFacilityId('');
                    setSelectedRole(FacilityRole.Viewer);
                    setGrantError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={granting}
                >
                  キャンセル
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={granting || !selectedFacilityId}
                >
                  {granting ? '付与中...' : '付与'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 所属施設とロール */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          所属施設とロール
        </h2>

        {!user.facilities || user.facilities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏢</div>
            <p className="text-gray-500">
              このユーザーはまだどの施設にもアクセス権限を持っていません
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    施設名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ロール
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    付与日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {user.facilities.map((access) => (
                  <tr key={access.facilityId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {getFacilityName(access.facilityId)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(
                          access.role
                        )}`}
                      >
                        {getRoleLabel(access.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(access.grantedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleRevokeAccess(access.facilityId)}
                        className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={revoking === access.facilityId}
                      >
                        {revoking === access.facilityId ? '削除中...' : '削除'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
