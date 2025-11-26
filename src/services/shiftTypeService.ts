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
  FacilityShiftSettings,
  ShiftTypeConfig,
  ShiftTypeSettingsError,
} from '../../types';
import { DEFAULT_SHIFT_TYPES, DEFAULT_SHIFT_CYCLE } from '../../constants';

/**
 * シフトタイプ設定を取得
 * 設定がない場合はデフォルト設定を自動作成
 */
export async function getShiftSettings(
  facilityId: string
): Promise<Result<FacilityShiftSettings, ShiftTypeSettingsError>> {
  try {
    const settingsRef = doc(db, 'facilities', facilityId, 'shiftSettings', 'default');
    const settingsDoc = await getDoc(settingsRef);

    if (!settingsDoc.exists()) {
      // デフォルト設定を作成
      const defaultSettings: FacilityShiftSettings = {
        facilityId,
        shiftTypes: DEFAULT_SHIFT_TYPES,
        defaultShiftCycle: DEFAULT_SHIFT_CYCLE,
        updatedAt: Timestamp.now(),
        updatedBy: 'system',
      };

      await setDoc(settingsRef, defaultSettings);

      return { success: true, data: defaultSettings };
    }

    const settings = settingsDoc.data() as FacilityShiftSettings;
    return { success: true, data: settings };
  } catch (error) {
    console.error('Error fetching shift settings:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: 'シフト設定の取得に失敗しました',
      },
    };
  }
}

/**
 * シフトタイプ設定を保存
 */
export async function saveShiftSettings(
  facilityId: string,
  settings: Partial<Omit<FacilityShiftSettings, 'facilityId' | 'updatedAt' | 'updatedBy'>>,
  userId: string
): Promise<Result<void, ShiftTypeSettingsError>> {
  try {
    // バリデーション
    if (settings.shiftTypes) {
      const validationError = validateShiftTypes(settings.shiftTypes);
      if (validationError) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError,
          },
        };
      }
    }

    const settingsRef = doc(db, 'facilities', facilityId, 'shiftSettings', 'default');

    const updateData = {
      ...settings,
      facilityId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    await setDoc(settingsRef, updateData, { merge: true });

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error saving shift settings:', error);
    return {
      success: false,
      error: {
        code: 'FIRESTORE_ERROR',
        message: 'シフト設定の保存に失敗しました',
      },
    };
  }
}

/**
 * シフトタイプ設定のリアルタイム購読
 */
export function subscribeToShiftSettings(
  facilityId: string,
  onUpdate: (settings: FacilityShiftSettings) => void,
  onError: (error: ShiftTypeSettingsError) => void
): Unsubscribe {
  const settingsRef = doc(db, 'facilities', facilityId, 'shiftSettings', 'default');

  return onSnapshot(
    settingsRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        // デフォルト設定を作成
        const defaultSettings: FacilityShiftSettings = {
          facilityId,
          shiftTypes: DEFAULT_SHIFT_TYPES,
          defaultShiftCycle: DEFAULT_SHIFT_CYCLE,
          updatedAt: Timestamp.now(),
          updatedBy: 'system',
        };

        try {
          await setDoc(settingsRef, defaultSettings);
          onUpdate(defaultSettings);
        } catch (error) {
          console.error('Error creating default shift settings:', error);
          onError({
            code: 'FIRESTORE_ERROR',
            message: 'デフォルト設定の作成に失敗しました',
          });
        }
        return;
      }

      const settings = snapshot.data() as FacilityShiftSettings;
      onUpdate(settings);
    },
    (error) => {
      console.error('Error subscribing to shift settings:', error);
      onError({
        code: 'FIRESTORE_ERROR',
        message: 'シフト設定の購読に失敗しました',
      });
    }
  );
}

/**
 * シフトタイプをIDで検索
 */
export function findShiftTypeById(
  settings: FacilityShiftSettings,
  shiftTypeId: string
): ShiftTypeConfig | undefined {
  return settings.shiftTypes.find((st) => st.id === shiftTypeId);
}

/**
 * シフトタイプを名前で検索
 */
export function findShiftTypeByName(
  settings: FacilityShiftSettings,
  name: string
): ShiftTypeConfig | undefined {
  return settings.shiftTypes.find((st) => st.name === name);
}

/**
 * 有効なシフトタイプのみを取得（ソート順）
 */
export function getActiveShiftTypes(
  settings: FacilityShiftSettings
): ShiftTypeConfig[] {
  return settings.shiftTypes
    .filter((st) => st.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * シフトサイクル順序を取得（名前の配列）
 */
export function getShiftCycleNames(
  settings: FacilityShiftSettings
): string[] {
  return settings.defaultShiftCycle
    .map((id) => {
      const shiftType = findShiftTypeById(settings, id);
      return shiftType?.name ?? '';
    })
    .filter((name) => name !== '');
}

/**
 * シフトタイプのバリデーション
 */
function validateShiftTypes(shiftTypes: ShiftTypeConfig[]): string | null {
  // 重複IDチェック
  const ids = shiftTypes.map((st) => st.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    return 'シフトタイプIDが重複しています';
  }

  // 重複名前チェック
  const names = shiftTypes.map((st) => st.name);
  const uniqueNames = new Set(names);
  if (names.length !== uniqueNames.size) {
    return 'シフトタイプ名が重複しています';
  }

  // 必須フィールドチェック
  for (const st of shiftTypes) {
    if (!st.id || !st.name) {
      return 'シフトタイプIDと名前は必須です';
    }
    if (st.restHours < 0) {
      return '休憩時間は0以上である必要があります';
    }
  }

  return null;
}
