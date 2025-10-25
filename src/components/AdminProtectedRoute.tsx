import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * AdminProtectedRoute
 *
 * super-admin権限を持つユーザーのみアクセスを許可するルート保護コンポーネント
 * super-admin以外のユーザーは /forbidden にリダイレクトされる
 */
export function AdminProtectedRoute({ children }: AdminProtectedRouteProps): JSX.Element {
  const { loading, isSuperAdmin } = useAuth();

  // ローディング中は何も表示しない
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // super-admin権限がない場合は403ページにリダイレクト
  if (!isSuperAdmin()) {
    return <Navigate to="/forbidden" replace />;
  }

  // super-admin権限がある場合は子コンポーネントを表示
  return <>{children}</>;
}
