import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db } from '../../firebase';
import { User, Result, AuthError } from '../../types';

/**
 * 初回ログイン時のユーザードキュメント自動作成
 * 既存ユーザーの場合はlastLoginAtのみ更新
 */
export async function createOrUpdateUser(
  firebaseUser: FirebaseUser
): Promise<Result<User, AuthError>> {
  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);

    const now = Timestamp.now();

    if (userDoc.exists()) {
      // 既存ユーザー: lastLoginAtのみ更新
      const existingData = userDoc.data();

      // Validate required fields
      if (
        !existingData.userId ||
        !existingData.email ||
        !existingData.name ||
        !existingData.provider ||
        !existingData.facilities ||
        !Array.isArray(existingData.facilities) ||
        !existingData.createdAt
      ) {
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'ユーザードキュメントに必須フィールドが不足しています',
          },
        };
      }

      const existingUser = existingData as User;
      await setDoc(
        userRef,
        { lastLoginAt: now },
        { merge: true }
      );

      return {
        success: true,
        data: {
          ...existingUser,
          lastLoginAt: now,
        },
      };
    } else {
      // 初回ユーザー: 新規ドキュメント作成
      if (!firebaseUser.email) {
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'メールアドレスが取得できませんでした',
          },
        };
      }

      const newUser: User = {
        userId: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || '',
        photoURL: firebaseUser.photoURL || '',
        provider: 'google',
        facilities: [], // 初回は空配列（Phase 2.2でsuper-admin権限を付与）
        createdAt: now,
        lastLoginAt: now,
      };

      await setDoc(userRef, newUser);

      return {
        success: true,
        data: newUser,
      };
    }
  } catch (error: any) {
    console.error('Failed to create or update user:', error);
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error.message || 'ユーザー情報の保存に失敗しました',
      },
    };
  }
}
