import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, FacilityRole } from '../../types';

/**
 * ユーザーがsuper-adminかどうかを確認
 *
 * @param userId - ユーザーID
 * @returns Promise<boolean> - super-adminの場合true
 *
 * @description
 * この関数は複数のサービス（facilityService, userService）で使用されていた
 * 重複コードを統合したものです。
 */
export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
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
 * ユーザーが指定された施設に対して特定のロール以上の権限を持っているか確認
 *
 * @param userId - ユーザーID
 * @param facilityId - 施設ID
 * @param requiredRole - 必要なロール
 * @returns Promise<boolean> - 権限がある場合true
 */
export async function checkFacilityAccess(
  userId: string,
  facilityId: string,
  requiredRole: FacilityRole
): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return false;
    }

    const user = userDoc.data() as User;

    // super-adminは全施設にアクセス可能
    if (user.facilities?.some((f) => f.role === FacilityRole.SuperAdmin)) {
      return true;
    }

    // 指定された施設のアクセス権限をチェック
    const facilityAccess = user.facilities?.find((f) => f.facilityId === facilityId);
    if (!facilityAccess) {
      return false;
    }

    // ロール階層チェック
    const roleHierarchy = {
      [FacilityRole.SuperAdmin]: 4,
      [FacilityRole.Admin]: 3,
      [FacilityRole.Editor]: 2,
      [FacilityRole.Viewer]: 1,
    };

    return (roleHierarchy[facilityAccess.role] || 0) >= (roleHierarchy[requiredRole] || 0);
  } catch (error) {
    console.error('Error checking facility access:', error);
    return false;
  }
}
