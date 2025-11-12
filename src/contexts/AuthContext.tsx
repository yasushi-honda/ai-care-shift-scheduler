import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, googleProvider, db, authReady } from '../../firebase';
import { User, AuthError, Result, FacilityRole } from '../../types';
import { createOrUpdateUser } from '../services/userService';

// LocalStorageキー
const SELECTED_FACILITY_KEY = 'selectedFacilityId';

// AuthContext の型定義
interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  selectedFacilityId: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<Result<void, AuthError>>;
  signOut: () => Promise<Result<void, AuthError>>;
  selectFacility: (facilityId: string) => void;
  hasRole: (facilityId: string, role: FacilityRole) => boolean;
  isSuperAdmin: () => boolean;
}

// Context の作成
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Cloud Function の facilities 付与完了を待機
 * 新規ユーザーの場合、Cloud Function が非同期で facilities を設定するため、
 * 最大10秒間ポーリングして facilities の更新を待つ
 */
async function waitForFacilities(userId: string, maxWaitSeconds: number = 10): Promise<User | null> {
  const startTime = Date.now();
  const pollInterval = 1000; // 1秒ごとにチェック

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const profile = userDoc.data() as User;

        // facilities が設定されていればそのまま返す
        if (profile.facilities && profile.facilities.length > 0) {
          console.log('✅ Cloud Function completed: facilities assigned', {
            userId,
            facilities: profile.facilities.length,
            waitedMs: Date.now() - startTime
          });
          return profile;
        }
      }
    } catch (error) {
      console.error('Error polling for facilities:', error);
    }

    // 1秒待機
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // タイムアウト: facilities が設定されなかった
  console.warn('⏱️ Timeout waiting for facilities assignment', {
    userId,
    waitedSeconds: maxWaitSeconds
  });

  // 最終的なプロファイルを取得して返す
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
  } catch (error) {
    console.error('Error fetching final profile:', error);
  }

  return null;
}

// AuthProvider コンポーネント
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    // authReady が完了するまで待機してから認証状態を監視
    authReady.then(() => {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);

        if (user) {
          // Firestoreからユーザープロファイルを取得
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              let profile = userDoc.data() as User;

              // 新規ユーザー（facilities が空）の場合、Cloud Function 完了を待機
              if (!profile.facilities || profile.facilities.length === 0) {
                // createdAt が最近（30秒以内）の場合のみポーリング
                const createdAt = profile.createdAt;
                const now = Date.now();
                const isRecentlyCreated = createdAt &&
                  createdAt instanceof Timestamp &&
                  (now - createdAt.toMillis()) < 30000; // 30秒以内

                if (isRecentlyCreated) {
                  console.log('🔄 New user detected, waiting for Cloud Function to assign facilities...');
                  const updatedProfile = await waitForFacilities(user.uid, 10);
                  if (updatedProfile) {
                    profile = updatedProfile;
                  }
                }
              }

              setUserProfile(profile);

              // 施設の自動選択ロジック
              // 1. LocalStorageから前回選択した施設IDを復元
              // 2. 復元した施設IDが有効かバリデーション
              // 3. 無効な場合は、権限がある施設が1つなら自動選択、複数または0の場合はnull
              let restoredFacilityId: string | null = null;

              try {
                const savedFacilityId = localStorage.getItem(SELECTED_FACILITY_KEY);
                if (savedFacilityId && profile.facilities) {
                  // 保存された施設IDへのアクセス権限があるか確認
                  const hasAccess = profile.facilities.some(
                    (f) => f.facilityId === savedFacilityId
                  );
                  if (hasAccess) {
                    restoredFacilityId = savedFacilityId;
                    console.log('✅ Restored facility from localStorage:', savedFacilityId);
                  } else {
                    // アクセス権限がない場合はLocalStorageから削除
                    localStorage.removeItem(SELECTED_FACILITY_KEY);
                    console.warn('⚠️ Saved facility ID is no longer accessible, removed from localStorage');
                  }
                }
              } catch (error) {
                console.error('Failed to restore facility from localStorage:', error);
                // 破損したデータをクリーンアップ
                try {
                  localStorage.removeItem(SELECTED_FACILITY_KEY);
                } catch (removeError) {
                  console.error('Failed to remove corrupted facility data:', removeError);
                }
              }

              if (restoredFacilityId) {
                // LocalStorageから復元成功
                setSelectedFacilityId(restoredFacilityId);
              } else if (profile.facilities && profile.facilities.length === 1) {
                // 施設が1つのみの場合は自動選択
                const autoSelectedId = profile.facilities[0].facilityId;
                setSelectedFacilityId(autoSelectedId);
                // LocalStorageにも保存
                try {
                  localStorage.setItem(SELECTED_FACILITY_KEY, autoSelectedId);
                } catch (error) {
                  console.error('Failed to save auto-selected facility:', error);
                }
              } else {
                // 複数または0の場合はnull
                setSelectedFacilityId(null);
                // LocalStorageから削除（古いデータが残らないように）
                try {
                  localStorage.removeItem(SELECTED_FACILITY_KEY);
                } catch (error) {
                  console.error('Failed to remove facility from localStorage:', error);
                }
              }
            } else {
              // ユーザードキュメントが存在しない場合
              console.warn('⚠️ User document does not exist for UID:', user.uid);
              console.warn('This may happen if:');
              console.warn('1. User just logged in and Cloud Function has not created the document yet');
              console.warn('2. User was deleted from Firestore but still exists in Authentication');
              console.warn('3. There was an error during user creation');
              setUserProfile(null);
              setSelectedFacilityId(null);
            }
          } catch (error: any) {
            // エラーコードに応じた詳細ログ
            if (error.code === 'permission-denied') {
              console.error('❌ Permission denied when fetching user profile');
              console.error('Possible causes:');
              console.error('1. Security Rules not deployed correctly');
              console.error('2. User document does not exist (new user)');
              console.error('3. Authentication token not fully initialized');
              console.error('Error details:', error);
            } else if (error.code === 'unavailable') {
              console.error('❌ Firestore service unavailable');
              console.error('Possible causes:');
              console.error('1. Network connection issue');
              console.error('2. Firestore service outage');
              console.error('Error details:', error);
            } else {
              console.error('❌ Failed to fetch user profile:', error);
            }
            setUserProfile(null);
            setSelectedFacilityId(null);
          }
        } else {
          setUserProfile(null);
          setSelectedFacilityId(null);
        }

        setLoading(false);
      });
    }).catch((error) => {
      console.error('Failed to initialize auth:', error);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Google OAuth ログイン
  const signInWithGoogle = async (): Promise<Result<void, AuthError>> => {
    try {
      // COOP警告の説明ログを事前に出力
      console.info('ℹ️ Google認証を開始します...');
      console.info(
        '⚠️ [予想される警告] Cross-Origin-Opener-Policy警告が表示される場合がありますが、' +
        'これはFirebase Authenticationの仕様による正常な動作です。認証機能には影響ありません。'
      );

      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      // ユーザードキュメントの作成または更新
      const userResult = await createOrUpdateUser(firebaseUser);

      if (!userResult.success) {
        // ユーザードキュメント作成失敗時はエラーを返す
        // TypeScriptの型narrowingが機能しないため、明示的に型アサーション
        const failureResult = userResult as { success: false; error: AuthError };
        return {
          success: false,
          error: failureResult.error
        };
      }

      // ユーザードキュメント作成成功
      // ユーザープロファイルを即座に設定（race condition回避）
      setUserProfile(userResult.data);
      return { success: true, data: undefined };
    } catch (error: any) {
      console.error('Sign in error:', error);

      // エラーコードに応じた適切なエラーを返す
      if (error.code === 'auth/popup-closed-by-user') {
        return {
          success: false,
          error: { code: 'AUTH_FAILED', message: 'ログインがキャンセルされました' }
        };
      }
      if (error.code === 'auth/network-request-failed') {
        return {
          success: false,
          error: { code: 'NETWORK_ERROR', message: 'ネットワークエラーが発生しました' }
        };
      }

      return {
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: error.message || 'ログインに失敗しました' }
      };
    }
  };

  // ログアウト
  const signOut = async (): Promise<Result<void, AuthError>> => {
    try {
      await firebaseSignOut(auth);

      // LocalStorageから施設IDを削除
      try {
        localStorage.removeItem(SELECTED_FACILITY_KEY);
      } catch (error) {
        console.error('Failed to remove facility from localStorage:', error);
      }

      return { success: true, data: undefined };
    } catch (error: any) {
      console.error('Sign out error:', error);
      return {
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: error.message || 'ログアウトに失敗しました' }
      };
    }
  };

  // 施設選択
  const selectFacility = (facilityId: string) => {
    if (!userProfile || !userProfile.facilities) {
      console.error('Cannot select facility: User profile not loaded');
      return;
    }

    // ユーザーが指定施設へのアクセス権限を持っているか確認
    const hasAccess = userProfile.facilities.some(
      (f) => f.facilityId === facilityId
    );

    if (!hasAccess) {
      console.error(`User does not have access to facility: ${facilityId}`);
      return;
    }

    setSelectedFacilityId(facilityId);

    // LocalStorageに保存（ページリロード時に復元するため）
    try {
      localStorage.setItem(SELECTED_FACILITY_KEY, facilityId);
    } catch (error) {
      console.error('Failed to save selected facility to localStorage:', error);
    }
  };

  // ロール判定（指定施設に対して指定ロール以上の権限を持つか）
  const hasRole = (facilityId: string, role: FacilityRole): boolean => {
    if (!userProfile || !userProfile.facilities) {
      return false;
    }

    // 指定施設へのアクセス権限を取得
    const facilityAccess = userProfile.facilities.find(
      (f) => f.facilityId === facilityId
    );

    if (!facilityAccess) {
      return false;
    }

    // super-adminは全権限を持つ
    if (facilityAccess.role === FacilityRole.SuperAdmin) {
      return true;
    }

    // ロール階層チェック
    const roleHierarchy: Record<FacilityRole, number> = {
      [FacilityRole.SuperAdmin]: 4,
      [FacilityRole.Admin]: 3,
      [FacilityRole.Editor]: 2,
      [FacilityRole.Viewer]: 1,
    };

    return roleHierarchy[facilityAccess.role] >= roleHierarchy[role];
  };

  // super-admin判定
  const isSuperAdmin = (): boolean => {
    if (!userProfile || !userProfile.facilities) {
      return false;
    }

    return userProfile.facilities.some(
      (f) => f.role === FacilityRole.SuperAdmin
    );
  };

  const value: AuthContextType = {
    currentUser,
    userProfile,
    selectedFacilityId,
    loading,
    signInWithGoogle,
    signOut,
    selectFacility,
    hasRole,
    isSuperAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// useAuth カスタムフック
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
