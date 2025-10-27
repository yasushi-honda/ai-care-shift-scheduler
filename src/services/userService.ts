import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
  Timestamp,
  CollectionReference,
  runTransaction,
  onSnapshot,
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db } from '../../firebase';
import { User, FacilityAccess, FacilityRole, FacilityMember, Result, AuthError } from '../../types';
import { checkIsSuperAdmin } from '../utils/permissions';

// User サービスエラー型
export type UserError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string };

// ユーザー統計情報（一覧表示用）
export interface UserSummary {
  userId: string;
  email: string;
  name: string;
  photoURL: string;
  facilitiesCount: number;
  lastLoginAt: Timestamp;
}

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

/**
 * 全ユーザーを取得（super-admin専用）
 *
 * @param currentUserId - 現在のユーザーID
 * @returns Result<UserSummary[], UserError>
 */
export async function getAllUsers(
  currentUserId: string
): Promise<Result<UserSummary[], UserError>> {
  try {
    // super-admin権限チェック
    const isSuperAdmin = await checkIsSuperAdmin(currentUserId);
    if (!isSuperAdmin) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'この操作にはスーパー管理者権限が必要です',
        },
      };
    }

    const usersRef = collection(db, 'users') as CollectionReference<User>;
    const q = query(usersRef, orderBy('lastLoginAt', 'desc'));

    const snapshot = await getDocs(q);
    const users: UserSummary[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        userId: doc.id,
        email: data.email,
        name: data.name,
        photoURL: data.photoURL,
        facilitiesCount: data.facilities?.length || 0,
        lastLoginAt: data.lastLoginAt,
      };
    });

    return { success: true, data: users };
  } catch (error) {
    console.error('Error fetching users:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: 'ユーザー一覧の取得に失敗しました',
      },
    };
  }
}

/**
 * ユーザーIDでユーザー詳細を取得（super-admin専用）
 *
 * @param userId - ユーザーID
 * @param currentUserId - 現在のユーザーID
 * @returns Result<User, UserError>
 */
export async function getUserById(
  userId: string,
  currentUserId: string
): Promise<Result<User, UserError>> {
  try {
    // super-admin権限チェック
    const isSuperAdmin = await checkIsSuperAdmin(currentUserId);
    if (!isSuperAdmin) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'この操作にはスーパー管理者権限が必要です',
        },
      };
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定されたユーザーが見つかりません',
        },
      };
    }

    const user: User = {
      ...userDoc.data(),
      userId: userDoc.id,
    } as User;

    return { success: true, data: user };
  } catch (error) {
    console.error('Error fetching user:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: 'ユーザー情報の取得に失敗しました',
      },
    };
  }
}

/**
 * ユーザーにアクセス権限を付与（super-admin専用）
 *
 * @param userId - 対象ユーザーID
 * @param facilityId - 施設ID
 * @param role - 付与するロール
 * @param currentUserId - 実行者のユーザーID（super-admin）
 * @returns Result<void, UserError>
 */
export async function grantAccess(
  userId: string,
  facilityId: string,
  role: FacilityRole,
  currentUserId: string
): Promise<Result<void, UserError>> {
  try {
    // super-admin権限チェック
    const isSuperAdmin = await checkIsSuperAdmin(currentUserId);
    if (!isSuperAdmin) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'この操作にはスーパー管理者権限が必要です',
        },
      };
    }

    // バリデーション
    if (!userId || !facilityId || !role) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ユーザーID、施設ID、ロールは必須です',
        },
      };
    }

    // トランザクションで users と facilities の両方を更新
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const facilityRef = doc(db, 'facilities', facilityId);

      const userDoc = await transaction.get(userRef);
      const facilityDoc = await transaction.get(facilityRef);

      if (!userDoc.exists()) {
        throw new Error('USER_NOT_FOUND');
      }
      if (!facilityDoc.exists()) {
        throw new Error('FACILITY_NOT_FOUND');
      }

      const user = userDoc.data() as User;
      const facility = facilityDoc.data();

      // すでに権限がある場合はチェック
      const existingAccess = user.facilities?.find((f) => f.facilityId === facilityId);
      if (existingAccess) {
        throw new Error('ALREADY_HAS_ACCESS');
      }

      // FacilityAccess エントリを作成
      const newAccess: FacilityAccess = {
        facilityId,
        role,
        grantedAt: Timestamp.now(),
        grantedBy: currentUserId,
      };

      // FacilityMember エントリを作成（施設の非正規化データ）
      const newMember: FacilityMember = {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role,
      };

      // users ドキュメントの facilities 配列に追加
      transaction.update(userRef, {
        facilities: arrayUnion(newAccess),
      });

      // facilities ドキュメントの members 配列に追加
      transaction.update(facilityRef, {
        members: arrayUnion(newMember),
      });
    });

    return { success: true, data: undefined };
  } catch (error: any) {
    console.error('Error granting access:', error);

    if (error.message === 'USER_NOT_FOUND') {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定されたユーザーが見つかりません',
        },
      };
    }

    if (error.message === 'FACILITY_NOT_FOUND') {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された施設が見つかりません',
        },
      };
    }

    if (error.message === 'ALREADY_HAS_ACCESS') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'このユーザーはすでにこの施設へのアクセス権限を持っています',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: 'アクセス権限の付与に失敗しました',
      },
    };
  }
}

/**
 * ユーザーのアクセス権限を剥奪（super-admin専用）
 *
 * @param userId - 対象ユーザーID
 * @param facilityId - 施設ID
 * @param currentUserId - 実行者のユーザーID（super-admin）
 * @returns Result<void, UserError>
 */
export async function revokeAccess(
  userId: string,
  facilityId: string,
  currentUserId: string
): Promise<Result<void, UserError>> {
  try {
    // super-admin権限チェック
    const isSuperAdmin = await checkIsSuperAdmin(currentUserId);
    if (!isSuperAdmin) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'この操作にはスーパー管理者権限が必要です',
        },
      };
    }

    // バリデーション
    if (!userId || !facilityId) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ユーザーIDと施設IDは必須です',
        },
      };
    }

    // トランザクションで users と facilities の両方を更新
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const facilityRef = doc(db, 'facilities', facilityId);

      const userDoc = await transaction.get(userRef);
      const facilityDoc = await transaction.get(facilityRef);

      if (!userDoc.exists()) {
        throw new Error('USER_NOT_FOUND');
      }
      if (!facilityDoc.exists()) {
        throw new Error('FACILITY_NOT_FOUND');
      }

      const user = userDoc.data() as User;
      const facility = facilityDoc.data();

      // アクセス権限を見つける
      const accessToRemove = user.facilities?.find((f) => f.facilityId === facilityId);
      if (!accessToRemove) {
        throw new Error('ACCESS_NOT_FOUND');
      }

      // メンバーエントリを見つける
      const memberToRemove = facility.members?.find((m) => m.userId === userId);

      // users ドキュメントの facilities 配列から削除
      transaction.update(userRef, {
        facilities: arrayRemove(accessToRemove),
      });

      // facilities ドキュメントの members 配列から削除（存在する場合のみ）
      if (memberToRemove) {
        transaction.update(facilityRef, {
          members: arrayRemove(memberToRemove),
        });
      }
    });

    return { success: true, data: undefined };
  } catch (error: any) {
    console.error('Error revoking access:', error);

    if (error.message === 'USER_NOT_FOUND') {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定されたユーザーが見つかりません',
        },
      };
    }

    if (error.message === 'FACILITY_NOT_FOUND') {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された施設が見つかりません',
        },
      };
    }

    if (error.message === 'ACCESS_NOT_FOUND') {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'このユーザーは指定された施設へのアクセス権限を持っていません',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: 'アクセス権限の剥奪に失敗しました',
      },
    };
  }
}
