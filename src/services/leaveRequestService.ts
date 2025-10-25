import {
  collection,
  doc,
  addDoc,
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
import { LeaveRequestDocument, LeaveRequestError, Result, LeaveType } from '../../types';

/**
 * LeaveRequestService
 *
 * 休暇申請のCRUD操作をFirestoreで管理するサービス
 * Firestoreパス: /facilities/{facilityId}/leaveRequests/{requestId}
 */
export const LeaveRequestService = {
  /**
   * 休暇申請一覧をリアルタイムで購読（対象月でフィルタリング）
   *
   * @param facilityId 施設ID
   * @param targetMonth 対象月（YYYY-MM形式）
   * @param callback 休暇申請リストが更新されたときに呼ばれるコールバック（エラー時はerrorパラメーターに情報が渡される）
   * @returns リスナー解除関数
   */
  subscribeToLeaveRequests(
    facilityId: string,
    targetMonth: string,
    callback: (leaveRequests: LeaveRequestDocument[], error?: Error) => void
  ): Unsubscribe {
    // 対象月の開始日と終了日を計算
    const [year, month] = targetMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const leaveRequestsCollectionRef = collection(
      db,
      `facilities/${facilityId}/leaveRequests`
    );
    const q = query(
      leaveRequestsCollectionRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const leaveRequests: LeaveRequestDocument[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            staffId: data.staffId,
            staffName: data.staffName,
            date: data.date,
            leaveType: data.leaveType as LeaveType,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } as LeaveRequestDocument;
        });

        callback(leaveRequests);
      },
      (error) => {
        console.error('Failed to subscribe to leave requests:', error);
        callback([], error as Error);
      }
    );

    return unsubscribe;
  },

  /**
   * 新しい休暇申請を作成
   *
   * @param facilityId 施設ID
   * @param leaveRequest 休暇申請情報（id, createdAt, updatedAtは自動生成）
   * @returns 作成された休暇申請のIDまたはエラー
   */
  async createLeaveRequest(
    facilityId: string,
    leaveRequest: Omit<LeaveRequestDocument, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Result<string, LeaveRequestError>> {
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

      if (!leaveRequest.staffId || leaveRequest.staffId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'スタッフIDは必須です',
          },
        };
      }

      if (!leaveRequest.staffName || leaveRequest.staffName.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'スタッフ名は必須です',
          },
        };
      }

      if (!leaveRequest.date || !/^\d{4}-\d{2}-\d{2}$/.test(leaveRequest.date)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '日付は必須です（YYYY-MM-DD形式）',
          },
        };
      }

      if (!leaveRequest.leaveType) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '休暇種別は必須です',
          },
        };
      }

      // Firestoreに保存
      const leaveRequestsCollectionRef = collection(
        db,
        `facilities/${facilityId}/leaveRequests`
      );
      const docRef = await addDoc(leaveRequestsCollectionRef, {
        ...leaveRequest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        data: docRef.id,
      };
    } catch (error: any) {
      console.error('Failed to create leave request:', error);

      // 権限エラーの処理
      if (error.code === 'permission-denied') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: '休暇申請を作成する権限がありません',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error.message || '休暇申請の作成に失敗しました',
        },
      };
    }
  },

  /**
   * 休暇申請を削除
   *
   * @param facilityId 施設ID
   * @param requestId 休暇申請ID
   * @returns 成功または失敗
   */
  async deleteLeaveRequest(
    facilityId: string,
    requestId: string
  ): Promise<Result<void, LeaveRequestError>> {
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

      if (!requestId || requestId.trim() === '') {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '休暇申請IDは必須です',
          },
        };
      }

      const leaveRequestDocRef = doc(
        db,
        `facilities/${facilityId}/leaveRequests/${requestId}`
      );

      // ドキュメントが存在するか確認
      const leaveRequestDoc = await getDoc(leaveRequestDocRef);
      if (!leaveRequestDoc.exists()) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '指定された休暇申請が見つかりません',
          },
        };
      }

      // Firestoreから削除
      await deleteDoc(leaveRequestDocRef);

      return {
        success: true,
        data: undefined,
      };
    } catch (error: any) {
      console.error('Failed to delete leave request:', error);

      // 権限エラーの処理
      if (error.code === 'permission-denied') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: '休暇申請を削除する権限がありません',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error.message || '休暇申請の削除に失敗しました',
        },
      };
    }
  },
};
