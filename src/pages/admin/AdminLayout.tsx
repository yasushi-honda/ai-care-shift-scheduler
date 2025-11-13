import React, { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { assertResultError } from '../../../types';

/**
 * Phase 19.2.1.5: 定数定義
 */
const HEADER_HEIGHT_PX = 73; // ヘッダーの高さ（px）

/**
 * AdminLayout
 *
 * 管理画面の共通レイアウト
 * - サイドバーナビゲーション（施設管理、ユーザー管理、監査ログ）
 * - ヘッダー（ユーザー情報、ログアウトボタン）
 * - メインコンテンツエリア（Outlet）
 *
 * Phase 19.2.1: レスポンシブデザイン対応
 * - モバイルでハンバーガーメニュー
 * - サイドバーはmd以上で表示、モバイルではオーバーレイ
 *
 * Phase 19.2.1.5: アクセシビリティ・コード品質改善
 * - フォーカストラップ実装
 * - マジックナンバー解消（HEADER_HEIGHT_PX定数化）
 */
export function AdminLayout(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, userProfile } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);

  // Phase 19.2.1: モバイルメニューのキーボード・アクセシビリティ対応
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    // Escapeキーでメニューを閉じる
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    // メニュー表示中はbodyのスクロールを無効化
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Phase 19.2.1.5: フォーカストラップ実装
  useEffect(() => {
    if (!isMobileMenuOpen || !mobileMenuRef.current) return;

    // フォーカス可能な要素を取得
    const focusableElements = mobileMenuRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // 最初の要素にフォーカス
    firstElement?.focus();

    // Tabキーでフォーカスをトラップ
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab: 最初の要素から最後の要素へ
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: 最後の要素から最初の要素へ
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('keydown', handleTab);
      // メニューが閉じたら、ハンバーガーボタンにフォーカスを戻す
      hamburgerButtonRef.current?.focus();
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const result = await signOut();
    if (result.success) {
      navigate('/');
    } else {
      assertResultError(result);
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
      {/* Phase 19.2.1: レスポンシブヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Phase 19.2.1: ハンバーガーメニューボタン（モバイルのみ） */}
            {/* Phase 19.2.2: タッチターゲット拡大 - min-h/w-[44px]、active:scale-95 */}
            <button
              ref={hamburgerButtonRef}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all duration-200 flex items-center justify-center"
              aria-label="メニュー"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>

            <Link to="/admin" className="text-lg md:text-xl font-bold text-gray-900">
              管理画面
            </Link>
            <Link
              to="/"
              className="hidden sm:block text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← メインアプリに戻る
            </Link>
          </div>

          {/* Phase 19.2.1: レスポンシブユーザー情報 */}
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="hidden sm:block text-sm text-gray-700">
              <span className="font-medium">{userProfile?.name || 'ユーザー'}</span>
              <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                super-admin
              </span>
            </div>
            {/* Phase 19.2.2: タッチターゲット拡大 - min-h-[44px] */}
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="px-3 md:px-4 py-2 min-h-[44px] text-xs md:text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 active:bg-gray-400 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningOut ? 'ログアウト中...' : 'ログアウト'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex relative">
        {/* Phase 19.2.1: デスクトップサイドバー（md以上で表示） */}
        <aside
          className="hidden md:block w-64 bg-white shadow-sm"
          style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_PX}px)` }}
        >
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

        {/* Phase 19.2.1: モバイルオーバーレイサイドバー */}
        {isMobileMenuOpen && (
          <>
            {/* バックドロップ（背景オーバーレイ） */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* スライドインメニュー */}
            <aside
              ref={mobileMenuRef}
              className="fixed left-0 bottom-0 w-64 bg-white shadow-lg z-50 md:hidden overflow-y-auto"
              style={{ top: `${HEADER_HEIGHT_PX}px` }}
              role="dialog"
              aria-modal="true"
              aria-label="モバイルナビゲーションメニュー"
            >
              <nav className="p-4 space-y-2">
                {navigationItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
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
          </>
        )}

        {/* Phase 19.2.1: メインコンテンツエリア（モバイル対応パディング） */}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
