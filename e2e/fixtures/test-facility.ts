/**
 * E2Eテスト用施設フィクスチャ
 *
 * Single Source of Truth: scripts/demoData.ts
 * テスト用施設データを提供
 */

import { DEMO_FACILITY_ID, DEMO_FACILITY_NAME } from '../../scripts/demoData';

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
 * テスト用施設ID
 */
export const TEST_FACILITY_ID = DEMO_FACILITY_ID;

/**
 * テスト用施設名
 */
export const TEST_FACILITY_NAME = DEMO_FACILITY_NAME;

/**
 * テスト用施設データ
 */
export const TEST_FACILITY: TestFacility = {
  facilityId: TEST_FACILITY_ID,
  name: TEST_FACILITY_NAME,
  members: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};
