import React from 'react';
import { Link } from 'react-router-dom';

/**
 * AdminDashboard
 *
 * 管理画面のダッシュボード（ランディングページ）
 * 各管理機能へのクイックアクセスリンクを表示
 */
export function AdminDashboard(): JSX.Element {
  const quickLinks = [
    {
      title: '施設管理',
      description: '施設の一覧表示、作成、詳細表示',
      path: '/admin/facilities',
      icon: '🏢',
      hoverClass: 'hover:border-blue-500',
    },
    {
      title: 'ユーザー管理',
      description: 'ユーザーの一覧表示、権限付与、詳細表示',
      path: '/admin/users',
      icon: '👥',
      hoverClass: 'hover:border-green-500',
    },
    {
      title: '監査ログ',
      description: 'システムの監査ログ表示とエクスポート',
      path: '/admin/audit-logs',
      icon: '📋',
      hoverClass: 'hover:border-purple-500',
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        管理ダッシュボード
      </h1>
      <p className="text-gray-600 mb-8">
        super-admin専用の管理機能にアクセスできます
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quickLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`block p-6 bg-white rounded-lg shadow-sm border-2 border-transparent hover:shadow-md transition-all ${link.hoverClass}`}
          >
            <div className="text-4xl mb-4">{link.icon}</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {link.title}
            </h2>
            <p className="text-gray-600 text-sm">
              {link.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
