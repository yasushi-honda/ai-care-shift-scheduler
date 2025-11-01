import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAllUsers, UserSummary } from '../../services/userService';
import { Button } from '../../components/Button';
import { assertResultError } from '../../../types';

/**
 * UserManagement
 *
 * ユーザー管理ページ（super-admin専用）
 * - 全ユーザーの一覧表示（名前、メール、所属施設数、最終ログイン）
 * - ユーザー詳細へのリンク
 */
export function UserManagement(): React.ReactElement {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);

    const result = await getAllUsers(currentUser.uid);

    if (result.success) {
      setUsers(result.data);
    } else {
      assertResultError(result);
      setError(result.error.message);
    }

    setLoading(false);
  }, [currentUser]);

  // ユーザー一覧を取得
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
          onClick={loadUsers}
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
            ユーザー管理
          </h1>
          <p className="text-gray-600">
            全ユーザーの一覧と権限管理
          </p>
        </div>
      </div>

      {/* ユーザー一覧テーブル */}
      {users.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">👥</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            ユーザーがまだいません
          </h2>
          <p className="text-gray-600 mb-4">
            ユーザーがログインするとここに表示されます
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
                  所属施設数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  最終ログイン
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        src={user.photoURL}
                        alt={user.name}
                        className="h-10 w-10 rounded-full mr-3"
                      />
                      <div className="text-sm font-medium text-gray-900">
                        {user.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {user.facilitiesCount}件
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.lastLoginAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      to={`/admin/users/${user.userId}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      詳細を見る →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 統計サマリー */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">総ユーザー数</div>
          <div className="text-2xl font-bold text-blue-900">{users.length}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">
            平均所属施設数
          </div>
          <div className="text-2xl font-bold text-green-900">
            {users.length > 0
              ? (
                  users.reduce((sum, u) => sum + u.facilitiesCount, 0) /
                  users.length
                ).toFixed(1)
              : 0}
          </div>
        </div>
      </div>
    </div>
  );
}
