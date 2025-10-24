import { doc, getDoc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
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

      // Cloud Functionがsuper-admin権限を付与するまで待機（初回ユーザーの場合）
      // リアルタイムリスナーで効率的に待機（ポーリングより確実・効率的）
      const waitForFacilities = new Promise<User>((resolve, reject) => {
        const timeoutMs = 3000; // 3秒

        // タイムアウトタイマー
        const timer = setTimeout(() => {
          unsubscribe();
          // タイムアウト時は元のユーザーデータを返す（権限なしの可能性あり）
          console.log('⚠️ super-admin権限付与タイムアウト - 権限なしユーザーの可能性');
          resolve(newUser);
        }, timeoutMs);

        // リアルタイムリスナー登録
        const unsubscribe = onSnapshot(
          userRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as User;
              if (data?.facilities && data.facilities.length > 0) {
                // super-admin権限が付与された
                clearTimeout(timer);
                unsubscribe();
                console.log('✅ super-admin権限付与を確認しました');
                resolve(data);
              }
            }
          },
          (error) => {
            clearTimeout(timer);
            unsubscribe();
            console.error('❌ リスナーエラー:', error);
            reject(error);
          }
        );
      });

      let updatedUser: User;
      try {
        updatedUser = await waitForFacilities;

        // Cloud Functionから受け取ったデータを検証（既存ユーザーパスと同様）
        if (
          !updatedUser.userId ||
          !updatedUser.email ||
          !updatedUser.name ||
          !updatedUser.provider ||
          !updatedUser.facilities ||
          !Array.isArray(updatedUser.facilities) ||
          !updatedUser.createdAt
        ) {
          console.error('Invalid user data from Cloud Function, using fallback');
          updatedUser = newUser;
        }
      } catch (error) {
        console.error('Failed to wait for facilities update:', error);
        // エラー時は元のユーザーデータを返す
        updatedUser = newUser;
      }

      return {
        success: true,
        data: updatedUser,
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
