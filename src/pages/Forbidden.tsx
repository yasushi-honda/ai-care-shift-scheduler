import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Forbidden (403エラーページ)
 *
 * super-admin権限を持たないユーザーが管理画面にアクセスしようとした際に表示されるページ
 */
export function Forbidden(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="text-6xl font-bold text-red-600 mb-4">403</div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            アクセスが拒否されました
          </h1>
          <p className="text-gray-600">
            このページにアクセスする権限がありません。
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-blue-600 !text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ホームに戻る
          </button>
          <p className="text-sm text-gray-500">
            管理画面にアクセスするにはsuper-admin権限が必要です。
          </p>
        </div>
      </div>
    </div>
  );
}
