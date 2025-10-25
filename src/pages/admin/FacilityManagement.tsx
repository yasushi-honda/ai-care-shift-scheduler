import React from 'react';

/**
 * FacilityManagement
 *
 * 施設管理ページ
 * - 全施設の一覧表示
 * - 新規施設作成
 * - 施設詳細表示
 *
 * Phase 10.2で実装予定
 */
export function FacilityManagement(): JSX.Element {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        施設管理
      </h1>
      <p className="text-gray-600 mb-8">
        全施設の管理と新規施設の作成
      </p>

      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="text-6xl mb-4">🏢</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          施設管理機能
        </h2>
        <p className="text-gray-600 mb-4">
          Phase 10.2で実装予定
        </p>
        <div className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-2">
          <p>実装予定の機能:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>全施設の一覧表示（施設名、作成日、メンバー数、ステータス）</li>
            <li>新規施設作成フォームと作成処理</li>
            <li>施設詳細画面（メンバー一覧、シフトデータ統計）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
