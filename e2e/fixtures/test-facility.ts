/**
 * E2Eテスト用施設フィクスチャ
 *
 * テスト用施設データを定義
 */

import { TEST_FACILITY_ID } from './test-staff';

export interface TestFacility {
  facilityId: string;
  name: string;
  members: {
    userId: string;
    role: 'super-admin' | 'admin' | 'editor' | 'viewer';
    grantedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * テスト用施設データ
 */
export const TEST_FACILITY: TestFacility = {
  facilityId: TEST_FACILITY_ID,
  name: 'テスト介護施設',
  members: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * テスト用施設名
 */
export const TEST_FACILITY_NAME = 'テスト介護施設';

export { TEST_FACILITY_ID };
