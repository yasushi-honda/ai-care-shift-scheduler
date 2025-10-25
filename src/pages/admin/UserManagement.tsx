import React from 'react';

/**
 * UserManagement
 *
 * ユーザー管理ページ
 * - 全ユーザーの一覧表示
 * - ユーザー詳細表示
 * - アクセス権限付与・剥奪
 *
 * Phase 10.3で実装予定
 */
export function UserManagement(): JSX.Element {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        ユーザー管理
      </h1>
      <p className="text-gray-600 mb-8">
        全ユーザーの管理とアクセス権限の付与
      </p>

      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="text-6xl mb-4">👥</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          ユーザー管理機能
        </h2>
        <p className="text-gray-600 mb-4">
          Phase 10.3で実装予定
        </p>
        <div className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-2">
          <p>実装予定の機能:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>全ユーザーの一覧表示（名前、メール、所属施設数、最終ログイン）</li>
            <li>ユーザー詳細画面（所属施設とロール、アクセス履歴）</li>
            <li>アクセス権限付与フォーム（施設選択、ロール選択）</li>
            <li>アクセス権限付与・剥奪処理</li>
            <li>admin権限ユーザーはeditor/viewerのみ付与可能な制限</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
