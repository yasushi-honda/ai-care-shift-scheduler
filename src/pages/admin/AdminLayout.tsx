import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * AdminLayout
 *
 * 管理画面の共通レイアウト
 * - サイドバーナビゲーション（施設管理、ユーザー管理、監査ログ）
 * - ヘッダー（ユーザー情報、ログアウトボタン）
 * - メインコンテンツエリア（Outlet）
 */
export function AdminLayout(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, userProfile } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const result = await signOut();
    if (result.success) {
      navigate('/');
    } else {
      console.error('Sign out failed:', result.error);
      setIsSigningOut(false);
    }
  };

  const navigationItems = [
    { path: '/admin/facilities', label: '施設管理', icon: '🏢' },
    { path: '/admin/users', label: 'ユーザー管理', icon: '👥' },
    { path: '/admin/audit-logs', label: '監査ログ', icon: '📋' },
    { path: '/admin/security-alerts', label: 'セキュリティアラート', icon: '🚨' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/admin" className="text-xl font-bold text-gray-900">
              管理画面
            </Link>
            <Link
              to="/"
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← メインアプリに戻る
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{userProfile?.displayName || 'ユーザー'}</span>
              <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                super-admin
              </span>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningOut ? 'ログアウト中...' : 'ログアウト'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* サイドバーナビゲーション */}
        <aside className="w-64 bg-white shadow-sm min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-2">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* メインコンテンツエリア */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
