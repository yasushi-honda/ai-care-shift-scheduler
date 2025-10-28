import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  query,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Staff, StaffError, Result } from '../../types';

/**
 * Staff型からFirestoreスキーマへの変換（書き込み用）
 *
 * Staff型とFirestoreスキーマでフィールド名が異なるため、
 * 書き込み時にフィールド名を変換する必要がある。
 */
function staffToFirestore(staff: Partial<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>>) {
  const { role, qualifications, maxConsecutiveWorkDays, isNightShiftOnly, ...rest } = staff;
  return {
    ...rest,
    ...(role !== undefined && { position: role }),                           // role → position
    ...(qualifications !== undefined && { certifications: qualifications }), // qualifications → certifications
    ...(maxConsecutiveWorkDays !== undefined && { maxConsecutiveDays: maxConsecutiveWorkDays }), // maxConsecutiveWorkDays → maxConsecutiveDays
    ...(isNightShiftOnly !== undefined && { nightShiftOnly: isNightShiftOnly }), // isNightShiftOnly → nightShiftOnly
  };
}

/**
 * StaffService
 *
 * スタッフ情報のCRUD操作をFirestoreで管理するサービス
 * Firestoreパス: /facilities/{facilityId}/staff/{staffId}
 */
export const StaffService = {
  /**
   * スタッフ一覧をリアルタイムで購読
   *
   * @param facilityId 施設ID
   * @param callback スタッフリストが更新されたときに呼ばれるコールバック（エラー時はerrorパラメーターに情報が渡される）
   * @returns リスナー解除関数
   */
  subscribeToStaffList(
    facilityId: string,
    callback: (staffList: Staff[], error?: Error) => void
  ): Unsubscribe {
    const staffCollectionRef = collection(db, `facilities/${facilityId}/staff`);
    const q = query(staffCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const staffList: Staff[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            // Firestoreフィールド名とStaff型のフィールド名をマッピング
            role: data.position ?? data.role,  // position → role
            qualifications: data.certifications ?? data.qualifications ?? [],  // certifications → qualifications
            weeklyWorkCount: data.weeklyWorkCount ?? { hope: 20, must: 16 },
            maxConsecutiveWorkDays: data.maxConsecutiveDays ?? data.maxConsecutiveWorkDays ?? 5,  // maxConsecutiveDays → maxConsecutiveWorkDays
            availableWeekdays: data.availableWeekdays || [0, 1, 2, 3, 4, 5, 6],  // デフォルト: 全曜日
            unavailableDates: data.unavailableDates || [],
            timeSlotPreference: data.timeSlotPreference || {},
            isNightShiftOnly: data.nightShiftOnly ?? data.isNightShiftOnly ?? false,  // nightShiftOnly → isNightShiftOnly
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } as Staff;
        });

        callback(staffList);
      },
      (error) => {
        console.error('Failed to subscribe to staff list:', error);
        // エラー情報をコールバックに渡す
        callback([], error as Error);
      }
    );

    return unsubscribe;
  },

  /**
   * 新しいスタッフを作成
   *
   * @param facilityId 施設ID
   * @param staff スタッフ情報（id, createdAt, updatedAtは自動生成）
   * @returns 作成されたスタッフのIDまたはエラー
   */
  async createStaff(
    facilityId: string,
    staff: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Result<string, StaffError>> {
    try {
      // バリデーション
      if (!staff.name || staff.name.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'スタッフ名は必須です',
          },
        };
      }

      if (!facilityId || facilityId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '施設IDは必須です',
          },
        };
      }

      // Firestoreに保存（フィールド名を変換）
      const staffCollectionRef = collection(db, `facilities/${facilityId}/staff`);
      const docRef = await addDoc(staffCollectionRef, {
        ...staffToFirestore(staff),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        data: docRef.id,
      };
    } catch (error: any) {
      console.error('Failed to create staff:', error);

      // 権限エラーの処理
      if (error.code === 'permission-denied') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'スタッフを作成する権限がありません',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error.message || 'スタッフの作成に失敗しました',
        },
      };
    }
  },

  /**
   * スタッフ情報を更新
   *
   * @param facilityId 施設ID
   * @param staffId スタッフID
   * @param updates 更新するフィールド
   * @returns 成功または失敗
   */
  async updateStaff(
    facilityId: string,
    staffId: string,
    updates: Partial<Staff>
  ): Promise<Result<void, StaffError>> {
    try {
      // バリデーション
      if (!facilityId || facilityId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '施設IDは必須です',
          },
        };
      }

      if (!staffId || staffId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'スタッフIDは必須です',
          },
        };
      }

      const staffDocRef = doc(db, `facilities/${facilityId}/staff/${staffId}`);

      // ドキュメントが存在するか確認
      const staffDoc = await getDoc(staffDocRef);
      if (!staffDoc.exists()) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '指定されたスタッフが見つかりません',
          },
        };
      }

      // id, createdAt, updatedAtは更新しない
      const { id, createdAt, updatedAt, ...allowedUpdates } = updates;

      // Firestoreに保存（フィールド名を変換）
      await updateDoc(staffDocRef, {
        ...staffToFirestore(allowedUpdates),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        data: undefined,
      };
    } catch (error: any) {
      console.error('Failed to update staff:', error);

      // 権限エラーの処理
      if (error.code === 'permission-denied') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'スタッフ情報を更新する権限がありません',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error.message || 'スタッフ情報の更新に失敗しました',
        },
      };
    }
  },

  /**
   * スタッフを削除
   *
   * @param facilityId 施設ID
   * @param staffId スタッフID
   * @returns 成功または失敗
   */
  async deleteStaff(
    facilityId: string,
    staffId: string
  ): Promise<Result<void, StaffError>> {
    try {
      // バリデーション
      if (!facilityId || facilityId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '施設IDは必須です',
          },
        };
      }

      if (!staffId || staffId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'スタッフIDは必須です',
          },
        };
      }

      const staffDocRef = doc(db, `facilities/${facilityId}/staff/${staffId}`);

      // ドキュメントが存在するか確認
      const staffDoc = await getDoc(staffDocRef);
      if (!staffDoc.exists()) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '指定されたスタッフが見つかりません',
          },
        };
      }

      // Firestoreから削除
      await deleteDoc(staffDocRef);

      return {
        success: true,
        data: undefined,
      };
    } catch (error: any) {
      console.error('Failed to delete staff:', error);

      // 権限エラーの処理
      if (error.code === 'permission-denied') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'スタッフを削除する権限がありません',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error.message || 'スタッフの削除に失敗しました',
        },
      };
    }
  },
};
