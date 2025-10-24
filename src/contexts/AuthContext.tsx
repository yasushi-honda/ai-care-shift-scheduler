import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db, authReady } from '../../firebase';
import { User, AuthError, Result, FacilityRole } from '../../types';
import { createOrUpdateUser } from '../services/userService';

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
                  (now - (createdAt as any).toMillis()) < 30000; // 30秒以内

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
              // 権限がある施設が1つなら自動選択、複数または0の場合はnull
              if (profile.facilities && profile.facilities.length === 1) {
                setSelectedFacilityId(profile.facilities[0].facilityId);
              } else {
                setSelectedFacilityId(null);
              }
            } else {
              // ユーザードキュメントが存在しない場合はnull
              setUserProfile(null);
              setSelectedFacilityId(null);
            }
          } catch (error) {
            console.error('Failed to fetch user profile:', error);
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
