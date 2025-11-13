import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FacilityRole } from '../../types';

/**
 * 施設選択画面
 *
 * 複数施設にアクセス権限を持つユーザーが施設を選択する画面。
 * 1施設のみの場合は自動選択されるため、この画面は表示されない。
 *
 * Requirements: 2.5, 2.6, 2.15
 */
export function FacilitySelectorPage() {
  const { userProfile, selectFacility, signOut } = useAuth();

  const handleFacilitySelect = (facilityId: string) => {
    selectFacility(facilityId);
  };

  const handleLogout = async () => {
    const result = await signOut();
    if (!result.success) {
      const failureResult = result as { success: false; error: { message: string } };
      console.error('ログアウトエラー:', failureResult.error);
    }
  };

  // ロール名の日本語表示
  const getRoleDisplayName = (role: FacilityRole): string => {
    const roleNames: Record<FacilityRole, string> = {
      [FacilityRole.SuperAdmin]: 'システム管理者',
      [FacilityRole.Admin]: '管理者',
      [FacilityRole.Editor]: '編集者',
      [FacilityRole.Viewer]: '閲覧者',
    };
    return roleNames[role] || role;
  };

  if (!userProfile || !userProfile.facilities || userProfile.facilities.length === 0) {
    return null; // この画面は複数施設を持つユーザー専用
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          {userProfile.photoURL && (
            <img
              src={userProfile.photoURL}
              alt={userProfile.name}
              className="w-16 h-16 rounded-full mx-auto mb-4"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            施設を選択してください
          </h1>
          <p className="text-gray-600">
            {userProfile.name}さん（{userProfile.email}）
          </p>
        </div>

        {/* 施設リスト */}
        {/* Phase 19.2.2: タッチターゲット拡大 - min-h-[44px]、タッチフィードバック */}
        <div className="space-y-3 mb-6">
          {userProfile.facilities.map((facility) => (
            <button
              key={facility.facilityId}
              onClick={() => handleFacilitySelect(facility.facilityId)}
              className="w-full min-h-[44px] p-4 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 active:bg-blue-100 active:scale-[0.98] transition-all duration-200 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {facility.facilityId}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    ロール: {getRoleDisplayName(facility.role)}
                  </p>
                </div>
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* アクション */}
        {/* Phase 19.2.2: タッチターゲット拡大 - min-h-[44px] */}
        <div className="border-t border-gray-200 pt-6">
          <button
            onClick={handleLogout}
            className="w-full min-h-[44px] bg-white text-gray-700 px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] transition-all duration-200"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
}
