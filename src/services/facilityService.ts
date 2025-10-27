import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  CollectionReference,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Facility, FacilityMember, FacilityRole, Result, User } from '../../types';

// Facility サービスエラー型
export type FacilityError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'FIRESTORE_ERROR'; message: string };

// 施設統計情報
export interface FacilityStats {
  facilityId: string;
  totalStaff: number;
  totalSchedules: number;
  latestScheduleMonth: string | null;
}

/**
 * ユーザーがsuper-adminかどうかを確認
 * @param userId - ユーザーID
 * @returns Promise<boolean>
 */
async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return false;
    }

    const user = userDoc.data() as User;
    return user.facilities?.some((f) => f.role === FacilityRole.SuperAdmin) || false;
  } catch (error) {
    console.error('Error checking super-admin status:', error);
    return false;
  }
}

/**
 * 全施設を取得（super-admin専用）
 *
 * @param currentUserId - 現在のユーザーID
 * @returns Result<Facility[], FacilityError>
 */
export async function getAllFacilities(
  currentUserId: string
): Promise<Result<Facility[], FacilityError>> {
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

    const facilitiesRef = collection(db, 'facilities') as CollectionReference<Facility>;
    const q = query(facilitiesRef, orderBy('createdAt', 'desc'));

    const snapshot = await getDocs(q);
    const facilities: Facility[] = snapshot.docs.map((doc) => ({
      ...doc.data(),
      facilityId: doc.id,
    }));

    return { success: true, data: facilities };
  } catch (error) {
    console.error('Error fetching facilities:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '施設一覧の取得に失敗しました',
      },
    };
  }
}

/**
 * 施設IDで施設を取得
 *
 * @param facilityId - 施設ID
 * @param currentUserId - 現在のユーザーID
 * @returns Result<Facility, FacilityError>
 */
export async function getFacilityById(
  facilityId: string,
  currentUserId: string
): Promise<Result<Facility, FacilityError>> {
  try {
    const facilityRef = doc(db, 'facilities', facilityId);
    const facilityDoc = await getDoc(facilityRef);

    if (!facilityDoc.exists()) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '指定された施設が見つかりません',
        },
      };
    }

    const facility: Facility = {
      ...facilityDoc.data(),
      facilityId: facilityDoc.id,
    } as Facility;

    return { success: true, data: facility };
  } catch (error) {
    console.error('Error fetching facility:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '施設情報の取得に失敗しました',
      },
    };
  }
}

/**
 * 新規施設を作成（super-admin専用）
 *
 * @param name - 施設名
 * @param currentUserId - 作成者のユーザーID（super-admin）
 * @returns Result<Facility, FacilityError>
 */
export async function createFacility(
  name: string,
  currentUserId: string
): Promise<Result<Facility, FacilityError>> {
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
    if (!name || name.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '施設名は必須です',
        },
      };
    }

    if (name.trim().length > 100) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '施設名は100文字以内で入力してください',
        },
      };
    }

    // 新しい施設ドキュメントを作成
    const facilityRef = doc(collection(db, 'facilities'));
    const newFacility: Facility = {
      facilityId: facilityRef.id,
      name: name.trim(),
      createdAt: Timestamp.now(),
      createdBy: currentUserId,
      members: [], // 初期状態ではメンバーなし
    };

    await setDoc(facilityRef, newFacility);

    return { success: true, data: newFacility };
  } catch (error) {
    console.error('Error creating facility:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '施設の作成に失敗しました',
      },
    };
  }
}

/**
 * 施設の統計情報を取得
 *
 * @param facilityId - 施設ID
 * @returns Result<FacilityStats, FacilityError>
 */
export async function getFacilityStats(
  facilityId: string
): Promise<Result<FacilityStats, FacilityError>> {
  try {
    // スタッフ数を取得
    const staffRef = collection(db, 'facilities', facilityId, 'staff');
    const staffSnapshot = await getDocs(staffRef);
    const totalStaff = staffSnapshot.size;

    // スケジュール数と最新スケジュールを効率的に取得
    const schedulesRef = collection(db, 'facilities', facilityId, 'schedules');
    const schedulesSnapshot = await getDocs(schedulesRef);
    const totalSchedules = schedulesSnapshot.size;

    // 最新スケジュールの月を取得（Firestoreクエリで最適化）
    let latestScheduleMonth: string | null = null;
    if (totalSchedules > 0) {
      // targetMonthで降順ソート、1件のみ取得
      const latestQuery = query(
        schedulesRef,
        orderBy('targetMonth', 'desc'),
        limit(1)
      );
      const latestSnapshot = await getDocs(latestQuery);
      if (!latestSnapshot.empty) {
        latestScheduleMonth = latestSnapshot.docs[0].data().targetMonth;
      }
    }

    const stats: FacilityStats = {
      facilityId,
      totalStaff,
      totalSchedules,
      latestScheduleMonth,
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching facility stats:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '施設統計の取得に失敗しました',
      },
    };
  }
}
