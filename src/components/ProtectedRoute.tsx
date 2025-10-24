import React, { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from './LoginPage';
import { NoAccessPage } from './NoAccessPage';
import { FacilitySelectorPage } from './FacilitySelectorPage';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, userProfile, selectedFacilityId, loading } = useAuth();

  // 認証状態をチェック中はローディング表示
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未認証の場合はログイン画面を表示
  if (!currentUser) {
    return <LoginPage />;
  }

  // ユーザープロファイルが読み込まれていない場合はローディング表示
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">プロファイルを読み込み中...</p>
        </div>
      </div>
    );
  }

  // アクセス権限なし（施設が空の場合）
  if (!userProfile.facilities || userProfile.facilities.length === 0) {
    return <NoAccessPage />;
  }

  // 複数施設へのアクセス権限があり、施設が選択されていない場合
  if (userProfile.facilities.length > 1 && !selectedFacilityId) {
    return <FacilitySelectorPage />;
  }

  // 認証済み＋権限あり＋施設選択済みの場合は子コンポーネントを表示
  return <>{children}</>;
}
