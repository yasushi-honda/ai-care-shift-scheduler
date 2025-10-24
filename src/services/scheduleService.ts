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
  where,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Schedule, ScheduleError, Result } from '../../types';

/**
 * ScheduleService
 *
 * シフトスケジュールのCRUD操作をFirestoreで管理するサービス
 * Firestoreパス: /facilities/{facilityId}/schedules/{scheduleId}
 */
export const ScheduleService = {
  /**
   * 対象月のスケジュール一覧をリアルタイムで購読
   *
   * @param facilityId 施設ID
   * @param targetMonth 対象月 ('YYYY-MM')
   * @param callback スケジュールリストが更新されたときに呼ばれるコールバック（エラー時はerrorパラメーターに情報が渡される）
   * @returns リスナー解除関数
   */
  subscribeToSchedules(
    facilityId: string,
    targetMonth: string,
    callback: (schedules: Schedule[], error?: Error) => void
  ): Unsubscribe {
    // Validate parameters
    if (!facilityId || facilityId.trim() === '') {
      callback([], new Error('施設IDは必須です'));
      return () => {}; // Return no-op unsubscribe
    }

    if (!targetMonth || targetMonth.trim() === '') {
      callback([], new Error('対象月は必須です'));
      return () => {};
    }

    const schedulesCollectionRef = collection(db, `facilities/${facilityId}/schedules`);
    const q = query(
      schedulesCollectionRef,
      where('targetMonth', '==', targetMonth),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const schedules: Schedule[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            targetMonth: data.targetMonth,
            staffSchedules: data.staffSchedules,
            createdAt: data.createdAt,
            createdBy: data.createdBy,
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
            version: data.version,
            status: data.status,
          } as Schedule;
        });

        callback(schedules);
      },
      (error) => {
        console.error('Failed to subscribe to schedules:', error);
        // エラー情報をコールバックに渡す
        callback([], error as Error);
      }
    );

    return unsubscribe;
  },

  /**
   * 新しいスケジュールを作成
   *
   * @param facilityId 施設ID
   * @param userId ユーザーID（作成者）
   * @param schedule スケジュール情報（id, createdAt, createdBy, updatedAt, updatedByは自動生成）
   * @returns 作成されたスケジュールのIDまたはエラー
   */
  async saveSchedule(
    facilityId: string,
    userId: string,
    schedule: Omit<Schedule, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>
  ): Promise<Result<string, ScheduleError>> {
    try {
      // バリデーション
      if (!schedule.targetMonth || schedule.targetMonth.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '対象月は必須です',
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

      if (!userId || userId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'ユーザーIDは必須です',
          },
        };
      }

      // 対象月のフォーマット検証（YYYY-MM）
      const monthPattern = /^\d{4}-\d{2}$/;
      if (!monthPattern.test(schedule.targetMonth)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '対象月のフォーマットが不正です（YYYY-MM形式で指定してください）',
          },
        };
      }

      // Validate staffSchedules
      if (!schedule.staffSchedules || !Array.isArray(schedule.staffSchedules)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'スタッフスケジュールは必須です',
          },
        };
      }

      if (schedule.staffSchedules.length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'スタッフスケジュールが空です',
          },
        };
      }

      // Firestoreに保存
      const schedulesCollectionRef = collection(db, `facilities/${facilityId}/schedules`);
      const docRef = await addDoc(schedulesCollectionRef, {
        ...schedule,
        createdAt: serverTimestamp(),
        createdBy: userId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });

      return {
        success: true,
        data: docRef.id,
      };
    } catch (error: any) {
      console.error('Failed to create schedule:', error);

      // 権限エラーの処理
      if (error.code === 'permission-denied') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'スケジュールを作成する権限がありません',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error.message || 'スケジュールの作成に失敗しました',
        },
      };
    }
  },

  /**
   * 既存のスケジュールを更新（下書き保存）
   *
   * @param facilityId 施設ID
   * @param scheduleId スケジュールID
   * @param userId ユーザーID（更新者）
   * @param updates 更新するフィールド
   * @returns 更新結果
   */
  async updateSchedule(
    facilityId: string,
    scheduleId: string,
    userId: string,
    updates: Partial<Omit<Schedule, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<Result<void, ScheduleError>> {
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

      if (!scheduleId || scheduleId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'スケジュールIDは必須です',
          },
        };
      }

      if (!userId || userId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'ユーザーIDは必須です',
          },
        };
      }

      // Firestoreで更新
      const scheduleRef = doc(db, `facilities/${facilityId}/schedules/${scheduleId}`);

      // ドキュメントの存在確認
      const docSnap = await getDoc(scheduleRef);
      if (!docSnap.exists()) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'スケジュールが見つかりません',
          },
        };
      }

      await updateDoc(scheduleRef, {
        ...updates,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });

      return {
        success: true,
        data: undefined,
      };
    } catch (error: any) {
      console.error('Failed to update schedule:', error);

      // 権限エラーの処理
      if (error.code === 'permission-denied') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'スケジュールを更新する権限がありません',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error.message || 'スケジュールの更新に失敗しました',
        },
      };
    }
  },
};
