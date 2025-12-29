/**
 * E2Eテスト用データセットアップヘルパー
 *
 * Firestore Emulatorにテストデータを投入する機能を提供
 */

import admin from 'firebase-admin';
import {
  TEST_STAFF,
  TEST_FACILITY_ID,
  TEST_FACILITY,
  getTestShiftRequirement,
} from '../fixtures';

// Firestore Admin SDKインスタンス
let db: admin.firestore.Firestore | null = null;

/**
 * Firestore Admin SDKを初期化（Emulator環境）
 */
function initializeFirestoreAdmin(): admin.firestore.Firestore {
  if (db) {
    return db;
  }

  // Emulator環境設定
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

  // Admin SDKが既に初期化されている場合はスキップ
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'ai-care-shift-scheduler',
    });
  }

  db = admin.firestore();
  console.log('🔧 Firestore Admin SDK初期化完了（data-helper）');
  return db;
}

/**
 * テスト用施設データを投入
 */
export async function seedTestFacility(): Promise<void> {
  const firestore = initializeFirestoreAdmin();
  const now = admin.firestore.Timestamp.now();

  const facilityRef = firestore.collection('facilities').doc(TEST_FACILITY_ID);
  await facilityRef.set({
    ...TEST_FACILITY,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`✅ テスト施設投入完了: ${TEST_FACILITY_ID}`);
}

/**
 * テスト用スタッフデータを投入
 */
export async function seedTestStaff(): Promise<void> {
  const firestore = initializeFirestoreAdmin();
  const now = admin.firestore.Timestamp.now();

  const batch = firestore.batch();

  for (const staff of TEST_STAFF) {
    const staffRef = firestore
      .collection('facilities')
      .doc(TEST_FACILITY_ID)
      .collection('staff')
      .doc(staff.staffId);

    batch.set(staffRef, {
      ...staff,
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  console.log(`✅ テストスタッフ投入完了: ${TEST_STAFF.length}名`);
}

/**
 * テスト用シフト要件データを投入
 */
export async function seedTestShiftRequirements(): Promise<void> {
  const firestore = initializeFirestoreAdmin();
  const now = admin.firestore.Timestamp.now();

  const shiftRequirement = getTestShiftRequirement();

  const requirementRef = firestore
    .collection('facilities')
    .doc(TEST_FACILITY_ID)
    .collection('shiftRequirements')
    .doc(shiftRequirement.targetMonth);

  await requirementRef.set({
    ...shiftRequirement,
    updatedAt: now,
  });

  console.log(`✅ テストシフト要件投入完了: ${shiftRequirement.targetMonth}`);
}

/**
 * 全テストデータを投入
 */
export async function seedAllTestData(): Promise<void> {
  console.log('🌱 テストデータ投入開始...');

  await seedTestFacility();
  await seedTestStaff();
  await seedTestShiftRequirements();

  console.log('✅ 全テストデータ投入完了');
}

/**
 * Firestore Emulatorの全データをクリア
 */
export async function clearAllEmulatorData(): Promise<void> {
  console.log('🧹 Firestore Emulatorデータクリア開始...');

  try {
    const response = await fetch(
      'http://localhost:8080/emulator/v1/projects/ai-care-shift-scheduler/databases/(default)/documents',
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      console.warn(`⚠️ Firestoreクリア警告: ${response.statusText}`);
    } else {
      console.log('✅ Firestore Emulatorデータクリア完了');
    }
  } catch (error) {
    console.warn('⚠️ Firestoreクリアスキップ（Emulator未起動の可能性）');
  }
}

/**
 * テストデータをリセット（クリア → 再投入）
 */
export async function resetTestData(): Promise<void> {
  await clearAllEmulatorData();
  await seedAllTestData();
}
