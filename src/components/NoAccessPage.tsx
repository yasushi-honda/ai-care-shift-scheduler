import React from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * アクセス権限なしユーザー向け画面
 *
 * 施設へのアクセス権限がないユーザーに表示され、
 * 管理者への連絡方法を案内します。
 *
 * Requirements: 2.3
 */
export function NoAccessPage() {
  const { currentUser, signOut } = useAuth();

  const handleLogout = async () => {
    const result = await signOut();
    if (!result.success) {
      const failureResult = result as { success: false; error: { message: string } };
      console.error('ログアウトエラー:', failureResult.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          {/* アイコン */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
            <svg
              className="h-8 w-8 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* メッセージ */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            アクセス権限がありません
          </h2>
          <p className="text-gray-600 mb-6">
            現在、どの施設へのアクセス権限も付与されていません。
            <br />
            システムを利用するには、管理者による権限付与が必要です。
          </p>

          {/* ユーザー情報 */}
          {currentUser && (
            <div className="bg-gray-50 rounded-md p-4 mb-6 text-left">
              <p className="text-sm text-gray-500 mb-1">ログイン中のアカウント</p>
              <p className="text-sm font-medium text-gray-900">
                {currentUser.email}
              </p>
            </div>
          )}

          {/* 案内 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6 text-left">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              次のステップ
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>施設の管理者に連絡して、アクセス権限の付与を依頼してください</li>
              <li>権限付与後、ページを再読み込みしてください</li>
            </ul>
          </div>

          {/* アクション */}
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              ページを再読み込み
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-white text-gray-700 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
