/**
 * staffingStandardService.ts
 *
 * Phase 65: 人員配置基準管理サービス
 *
 * 機能:
 * - 施設ごとの人員配置基準設定の取得・保存・購読
 * - 未設定の場合はサービス種別に応じたデフォルト基準を自動生成
 *
 * Firestoreパス: /facilities/{facilityId}/staffingStandards/default
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Result,
  StaffingStandardConfig,
  StaffingStandardError,
  CareServiceType,
} from '../../types';
import { DEFAULT_STAFFING_STANDARDS } from '../../constants';

const COLLECTION = 'staffingStandards';
const DOC_ID = 'default';

/**
 * 人員配置基準設定を取得
 * 設定がない場合は、指定サービス種別のデフォルト基準を自動作成
 */
export async function getStaffingStandard(
  facilityId: string,
  serviceType: CareServiceType = '通所介護'
): Promise<Result<StaffingStandardConfig, StaffingStandardError>> {
  try {
    const ref = doc(db, 'facilities', facilityId, COLLECTION, DOC_ID);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      const defaultConfig: StaffingStandardConfig = buildDefaultConfig(
        facilityId,
        serviceType
      );
      await setDoc(ref, defaultConfig);
      return { success: true, data: defaultConfig };
    }

    const config = snapshot.data() as StaffingStandardConfig;
    return { success: true, data: config };
  } catch (error) {
    console.error('Error fetching staffing standard:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '人員配置基準設定の取得に失敗しました',
      },
    };
  }
}

/**
 * 人員配置基準設定を保存（merge: true）
 */
export async function saveStaffingStandard(
  facilityId: string,
  config: Omit<StaffingStandardConfig, 'facilityId' | 'updatedAt'>,
  userId: string
): Promise<Result<void, StaffingStandardError>> {
  if (!facilityId) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '施設IDが指定されていません' },
    };
  }
  if (!config.requirements || config.requirements.length === 0) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '配置基準（職種要件）が空です' },
    };
  }

  try {
    const ref = doc(db, 'facilities', facilityId, COLLECTION, DOC_ID);
    const data: StaffingStandardConfig = {
      ...config,
      facilityId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };
    await setDoc(ref, data, { merge: true });
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error saving staffing standard:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: '人員配置基準設定の保存に失敗しました',
      },
    };
  }
}

/**
 * 人員配置基準設定のリアルタイム購読
 */
export function subscribeStaffingStandard(
  facilityId: string,
  onUpdate: (config: StaffingStandardConfig) => void,
  onError: (error: StaffingStandardError) => void,
  serviceType: CareServiceType = '通所介護'
): Unsubscribe {
  const ref = doc(db, 'facilities', facilityId, COLLECTION, DOC_ID);

  return onSnapshot(
    ref,
    async (snapshot) => {
      if (!snapshot.exists()) {
        const defaultConfig = buildDefaultConfig(facilityId, serviceType);
        try {
          await setDoc(ref, defaultConfig);
          onUpdate(defaultConfig);
        } catch (error) {
          console.error('Error creating default staffing standard:', error);
          onError({
            code: 'FIRESTORE_ERROR',
            message: 'デフォルト人員配置基準の作成に失敗しました',
          });
        }
        return;
      }
      onUpdate(snapshot.data() as StaffingStandardConfig);
    },
    (error) => {
      console.error('Error subscribing to staffing standard:', error);
      onError({
        code: 'FIRESTORE_ERROR',
        message: '人員配置基準設定の購読に失敗しました',
      });
    }
  );
}

// ==================== 内部ヘルパー ====================

function buildDefaultConfig(
  facilityId: string,
  serviceType: CareServiceType
): StaffingStandardConfig {
  return {
    facilityId,
    serviceType,
    userCount: 20,
    requirements: DEFAULT_STAFFING_STANDARDS[serviceType] ?? DEFAULT_STAFFING_STANDARDS['その他'],
    updatedAt: Timestamp.now(),
    updatedBy: 'system',
  };
}
