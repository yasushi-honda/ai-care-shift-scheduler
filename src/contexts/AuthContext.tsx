import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db, authReady } from '../../firebase';
import { User, AuthError, Result } from '../../types';
import { createOrUpdateUser } from '../services/userService';

// AuthContext の型定義
interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<Result<void, AuthError>>;
  signOut: () => Promise<Result<void, AuthError>>;
}

// Context の作成
const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider コンポーネント
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
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
              setUserProfile(userDoc.data() as User);
            } else {
              // ユーザードキュメントが存在しない場合はnull
              setUserProfile(null);
            }
          } catch (error) {
            console.error('Failed to fetch user profile:', error);
            setUserProfile(null);
          }
        } else {
          setUserProfile(null);
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

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    signInWithGoogle,
    signOut,
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
