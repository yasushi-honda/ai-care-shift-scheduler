/**
 * staffingStandardService.test.ts
 *
 * Phase 65: 人員配置基準サービスのユニットテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as firestore from 'firebase/firestore';
import {
  getStaffingStandard,
  saveStaffingStandard,
} from '../staffingStandardService';
import { assertResultError } from '../../../types';

// Firestore モック
vi.mock('firebase/firestore');
vi.mock('../../../firebase', () => ({
  db: {},
}));

// Timestamp モック
const mockTimestamp = { toDate: () => new Date() } as unknown as firestore.Timestamp;
vi.mocked(firestore.Timestamp, true).now = vi.fn(() => mockTimestamp);

const FACILITY_ID = 'fac-test-01';
const USER_ID = 'user-test-01';

describe('getStaffingStandard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firestore.doc).mockReturnValue({} as any);
  });

  it('設定が存在する場合はFirestoreから取得して返す', async () => {
    const mockConfig = {
      facilityId: FACILITY_ID,
      serviceType: '通所介護',
      userCount: 30,
      requirements: [{ role: '介護職員', requiredFte: 5, calculationMethod: 'ratio', ratioNumerator: 5 }],
      updatedAt: mockTimestamp,
      updatedBy: USER_ID,
    };

    vi.mocked(firestore.getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockConfig,
    } as any);

    const result = await getStaffingStandard(FACILITY_ID, '通所介護');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.facilityId).toBe(FACILITY_ID);
      expect(result.data.serviceType).toBe('通所介護');
      expect(result.data.userCount).toBe(30);
    }
  });

  it('設定が存在しない場合はデフォルト設定を作成して返す', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValue({
      exists: () => false,
      data: () => null,
    } as any);
    vi.mocked(firestore.setDoc).mockResolvedValue(undefined);

    const result = await getStaffingStandard(FACILITY_ID, '訪問介護');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.facilityId).toBe(FACILITY_ID);
      expect(result.data.serviceType).toBe('訪問介護');
      expect(result.data.requirements.length).toBeGreaterThan(0);
      // デフォルト設定が Firestore に保存されたことを確認
      expect(firestore.setDoc).toHaveBeenCalledOnce();
    }
  });

  it('Firestoreエラー時は FIRESTORE_ERROR を返す', async () => {
    vi.mocked(firestore.getDoc).mockRejectedValue(new Error('Firestore unavailable'));

    const result = await getStaffingStandard(FACILITY_ID, '通所介護');

    expect(result.success).toBe(false);
    if (!result.success) {
      assertResultError(result);
      expect(result.error.code).toBe('FIRESTORE_ERROR');
    }
  });
});

describe('saveStaffingStandard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(firestore.doc).mockReturnValue({} as any);
    vi.mocked(firestore.setDoc).mockResolvedValue(undefined);
  });

  it('有効な設定を保存して success を返す', async () => {
    const config = {
      serviceType: '通所介護' as const,
      userCount: 25,
      requirements: [{ role: '介護職員', requiredFte: 3, calculationMethod: 'fixed' as const }],
      updatedBy: USER_ID,
    };

    const result = await saveStaffingStandard(FACILITY_ID, config, USER_ID);

    expect(result.success).toBe(true);
    expect(firestore.setDoc).toHaveBeenCalledOnce();
  });

  it('facilityId が空の場合は VALIDATION_ERROR を返す', async () => {
    const config = {
      serviceType: '通所介護' as const,
      userCount: 20,
      requirements: [{ role: '介護職員', requiredFte: 1, calculationMethod: 'fixed' as const }],
      updatedBy: USER_ID,
    };

    const result = await saveStaffingStandard('', config, USER_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      assertResultError(result);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  it('requirements が空の場合は VALIDATION_ERROR を返す', async () => {
    const config = {
      serviceType: '通所介護' as const,
      userCount: 20,
      requirements: [],
      updatedBy: USER_ID,
    };

    const result = await saveStaffingStandard(FACILITY_ID, config, USER_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      assertResultError(result);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('Firestoreエラー時は FIRESTORE_ERROR を返す', async () => {
    vi.mocked(firestore.setDoc).mockRejectedValue(new Error('Write failed'));

    const config = {
      serviceType: '訪問介護' as const,
      userCount: 15,
      requirements: [{ role: '介護職員', requiredFte: 2.5, calculationMethod: 'fixed' as const }],
      updatedBy: USER_ID,
    };

    const result = await saveStaffingStandard(FACILITY_ID, config, USER_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      assertResultError(result);
      expect(result.error.code).toBe('FIRESTORE_ERROR');
    }
  });
});
