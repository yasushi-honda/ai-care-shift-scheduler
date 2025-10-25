import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { ShiftRequirement, RequirementError, Result } from '../../types';

/**
 * RequirementService
 *
 * シフト要件設定の永続化をFirestoreで管理するサービス
 * Firestoreパス: /facilities/{facilityId}/requirements/default
 */
export const RequirementService = {
  /**
   * シフト要件設定を保存
   *
   * @param facilityId 施設ID
   * @param requirement シフト要件設定
   * @returns 成功または失敗
   */
  async saveRequirement(
    facilityId: string,
    requirement: ShiftRequirement
  ): Promise<Result<void, RequirementError>> {
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

      if (!requirement.targetMonth || !/^\d{4}-\d{2}$/.test(requirement.targetMonth)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '対象月は必須です（YYYY-MM形式）',
          },
        };
      }

      if (!requirement.timeSlots || requirement.timeSlots.length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '時間帯設定は必須です',
          },
        };
      }

      if (!requirement.requirements || Object.keys(requirement.requirements).length === 0) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '要件設定は必須です',
          },
        };
      }

      // Firestoreに保存（ドキュメントIDは固定で "default"）
      const requirementDocRef = doc(db, `facilities/${facilityId}/requirements/default`);
      await setDoc(requirementDocRef, {
        ...requirement,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        data: undefined,
      };
    } catch (error: any) {
      console.error('Failed to save requirement:', error);

      // 権限エラーの処理
      if (error.code === 'permission-denied') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'シフト要件を保存する権限がありません',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error.message || 'シフト要件の保存に失敗しました',
        },
      };
    }
  },

  /**
   * シフト要件設定を取得
   *
   * @param facilityId 施設ID
   * @returns シフト要件設定またはnull（存在しない場合）、またはエラー
   */
  async getRequirement(
    facilityId: string
  ): Promise<Result<ShiftRequirement | null, RequirementError>> {
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

      // Firestoreから取得（ドキュメントIDは固定で "default"）
      const requirementDocRef = doc(db, `facilities/${facilityId}/requirements/default`);
      const requirementDoc = await getDoc(requirementDocRef);

      if (!requirementDoc.exists()) {
        // 存在しない場合はnullを返す（エラーではない）
        return {
          success: true,
          data: null,
        };
      }

      const data = requirementDoc.data();
      return {
        success: true,
        data: {
          targetMonth: data.targetMonth,
          timeSlots: data.timeSlots,
          requirements: data.requirements,
        } as ShiftRequirement,
      };
    } catch (error: any) {
      console.error('Failed to get requirement:', error);

      // 権限エラーの処理
      if (error.code === 'permission-denied') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'シフト要件を取得する権限がありません',
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'FIRESTORE_ERROR',
          message: error.message || 'シフト要件の取得に失敗しました',
        },
      };
    }
  },
};
