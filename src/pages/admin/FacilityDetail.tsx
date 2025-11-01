import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Facility } from '../../../types';
import {
  getFacilityById,
  getFacilityStats,
  FacilityStats,
} from '../../services/facilityService';
import { createInvitation } from '../../services/invitationService';
import { useAuth } from '../../contexts/AuthContext';
import { handleError } from '../../utils/errorHandler';

/**
 * FacilityDetail
 *
 * 施設詳細ページ（super-admin専用）
 * - 施設の基本情報
 * - メンバー一覧
 * - シフトデータ統計
 */
export function FacilityDetail(): React.ReactElement {
  const { facilityId } = useParams<{ facilityId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [facility, setFacility] = useState<Facility | null>(null);
  const [stats, setStats] = useState<FacilityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 招待モーダルの状態
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const loadFacilityDetail = useCallback(async () => {
    if (!facilityId || !currentUser) return;

    setLoading(true);
    setError(null);

    // 施設情報を取得
    const facilityResult = await getFacilityById(facilityId, currentUser.uid);

    if (!facilityResult.success) {
      setError(facilityResult.error.message);
      setLoading(false);
      return;
    }

    setFacility(facilityResult.data);

    // 統計情報を取得
    const statsResult = await getFacilityStats(facilityId);
    if (statsResult.success) {
      setStats(statsResult.data);
    }

    setLoading(false);
  }, [facilityId, currentUser]);

  useEffect(() => {
    loadFacilityDetail();
  }, [loadFacilityDetail]);

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

  // 招待モーダルを開く
  const handleOpenInviteModal = () => {
    setShowInviteModal(true);
    setInviteEmail('');
    setInviteRole('editor');
    setInviteError(null);
    setInviteSuccess(null);
  };

  // 招待モーダルを閉じる
  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('editor');
    setInviteError(null);
    setInviteSuccess(null);
  };

  // 招待を送信
  const handleSendInvitation = async () => {
    if (!facilityId || !currentUser) return;

    setInviteError(null);
    setInviteSuccess(null);

    // メールアドレスのフォーマット検証
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setInviteError('有効なメールアドレスを入力してください');
      return;
    }

    // 既存メンバーチェック
    const isExistingMember = facility?.members?.some(
      (m) => m.email && m.email.toLowerCase() === inviteEmail.trim().toLowerCase()
    );
    if (isExistingMember) {
      setInviteError('このメールアドレスのユーザーはすでにメンバーです');
      return;
    }

    setInviting(true);

    const result = await createInvitation(
      facilityId,
      inviteEmail.trim(),
      inviteRole,
      currentUser.uid
    );

    setInviting(false);

    if (!result.success) {
      const errorMsg = handleError(result.error, '招待の送信');
      setInviteError(errorMsg.message);
      return;
    }

    const { invitationLink } = result.data;

    // 成功メッセージを表示
    setInviteSuccess(
      `招待を送信しました！以下のリンクを ${inviteEmail} に共有してください：\n${invitationLink}`
    );

    // フォームをリセット
    setInviteEmail('');
    setInviteRole('editor');
  };

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

  if (error || !facility) {
    return (
      <div>
        <button
          onClick={() => navigate('/admin/facilities')}
          className="mb-4 text-blue-600 hover:text-blue-800"
        >
          ← 施設一覧に戻る
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">エラー: {error || '施設が見つかりません'}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ヘッダー */}
      <button
        onClick={() => navigate('/admin/facilities')}
        className="mb-4 text-blue-600 hover:text-blue-800 font-medium"
      >
        ← 施設一覧に戻る
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {facility.name}
        </h1>
        <p className="text-gray-600">
          施設ID: {facility.facilityId}
        </p>
      </div>

      {/* 基本情報 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          基本情報
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">作成日時</div>
            <div className="text-base font-medium text-gray-900">
              {formatDate(facility.createdAt)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">作成者ID</div>
            <div className="text-base font-medium text-gray-900">
              {facility.createdBy}
            </div>
          </div>
        </div>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="text-sm text-blue-600 font-medium mb-1">
            メンバー数
          </div>
          <div className="text-3xl font-bold text-blue-900">
            {facility.members?.length || 0}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            この施設にアクセスできるユーザー
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-6">
          <div className="text-sm text-green-600 font-medium mb-1">
            スタッフ数
          </div>
          <div className="text-3xl font-bold text-green-900">
            {stats?.totalStaff || 0}
          </div>
          <div className="text-xs text-green-600 mt-1">
            登録されているスタッフ
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-6">
          <div className="text-sm text-purple-600 font-medium mb-1">
            シフト数
          </div>
          <div className="text-3xl font-bold text-purple-900">
            {stats?.totalSchedules || 0}
          </div>
          <div className="text-xs text-purple-600 mt-1">
            {stats?.latestScheduleMonth
              ? `最新: ${stats.latestScheduleMonth}`
              : '未作成'}
          </div>
        </div>
      </div>

      {/* メンバー一覧 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            メンバー一覧
          </h2>
          <button
            onClick={handleOpenInviteModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + メンバー追加
          </button>
        </div>

        {!facility.members || facility.members.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-500">
              この施設にはまだメンバーがいません
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ユーザー名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    メールアドレス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ロール
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ユーザーID
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {facility.members.map((member) => (
                  <tr key={member.userId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {member.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {member.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(
                          member.role
                        )}`}
                      >
                        {getRoleLabel(member.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500 font-mono">
                        {member.userId.slice(0, 12)}...
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 招待モーダル */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              メンバーを招待
            </h3>

            {/* 成功メッセージ */}
            {inviteSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 whitespace-pre-wrap">
                  {inviteSuccess}
                </p>
              </div>
            )}

            {/* エラーメッセージ */}
            {inviteError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{inviteError}</p>
              </div>
            )}

            {/* フォーム */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="example@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={inviting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ロール
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'editor' | 'viewer')
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={inviting}
                >
                  <option value="editor">編集者（シフト編集可能）</option>
                  <option value="viewer">閲覧者（閲覧のみ）</option>
                </select>
              </div>
            </div>

            {/* ボタン */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCloseInviteModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={inviting}
              >
                キャンセル
              </button>
              <button
                onClick={handleSendInvitation}
                disabled={inviting || !inviteEmail}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviting ? '送信中...' : '招待を送信'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
