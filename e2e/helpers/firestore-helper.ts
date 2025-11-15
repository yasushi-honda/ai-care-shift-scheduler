/**
 * Firestore Helper for E2E Tests
 *
 * Phase 22: 招待フローE2Eテスト用のFirestoreヘルパー関数
 *
 * このヘルパーは、Emulator環境でFirestoreドキュメントを直接作成・削除します。
 * Firebase Admin SDKを使用してSecurity Rulesをバイパスします。
 */

import admin from 'firebase-admin';

// Admin SDK初期化状態
let adminInitialized = false;

/**
 * Admin SDKを初期化（Emulator環境）
 *
 * auth-helper.tsと同様のパターン
 */
function initializeAdminSDK(): void {
  if (adminInitialized) {
    return;
  }

  // Admin SDKが既に初期化されている場合はスキップ
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'ai-care-shift-scheduler',
    });
  }

  // Emulator環境設定
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

  adminInitialized = true;
  console.log('🔧 Firebase Admin SDK初期化完了（firestore-helper内）');
}

/**
 * Emulator環境のFirestore Admin SDKを使用して招待ドキュメントを作成
 *
 * @param params 招待ドキュメント作成パラメータ
 * @returns 作成された招待ドキュメントID
 */
export async function createInvitationInEmulator(params: {
  email: string;
  role: 'editor' | 'viewer';
  token: string;
  facilityId: string;
  createdBy: string;
  status?: 'pending' | 'accepted' | 'expired';
}): Promise<string> {
  console.log(`🔐 Emulator招待ドキュメント作成: ${params.email} (token: ${params.token})`);

  // Admin SDK初期化（未初期化の場合のみ）
  initializeAdminSDK();

  // トークンからドキュメントIDを生成（一意性を保証）
  const invitationId = `test-invitation-${params.token}`;

  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7日後
  );

  const invitationData = {
    id: invitationId,
    email: params.email,
    role: params.role,
    token: params.token,
    status: params.status || 'pending',
    facilityId: params.facilityId,
    createdBy: params.createdBy,
    createdAt: now,
    expiresAt: expiresAt,
  };

  try {
    // Admin SDK経由でトップレベルinvitationsコレクションにドキュメント作成
    // Admin SDKはSecurity Rulesをバイパスするため、権限エラーは発生しない
    await admin.firestore().collection('invitations').doc(invitationId).set(invitationData);

    // Phase 22: サブコレクションにも招待ドキュメント作成（後方互換性）
    // acceptInvitation関数がサブコレクションも更新するため
    const facilityInvitationRef = admin.firestore()
      .collection('facilities')
      .doc(params.facilityId)
      .collection('invitations')
      .doc(invitationId);

    await facilityInvitationRef.set(invitationData);

    console.log(`✅ Emulator招待ドキュメント作成成功: ${params.email} (ID: ${invitationId})`);
    return invitationId;
  } catch (error: any) {
    console.error(`❌ Emulator招待ドキュメント作成失敗: ${error.message}`);
    throw new Error(`Failed to create invitation in emulator: ${error.message}`);
  }
}

/**
 * Emulator環境のFirestore Admin SDKを使用して招待ドキュメントを削除
 *
 * @param invitationId 招待ドキュメントID
 */
export async function deleteInvitationInEmulator(invitationId: string): Promise<void> {
  console.log(`🗑️ Emulator招待ドキュメント削除: ${invitationId}`);

  // Admin SDK初期化（未初期化の場合のみ）
  initializeAdminSDK();

  try {
    await admin.firestore().collection('invitations').doc(invitationId).delete();
    console.log(`✅ Emulator招待ドキュメント削除成功: ${invitationId}`);
  } catch (error: any) {
    console.warn(`⚠️ Emulator招待ドキュメント削除失敗: ${error.message}`);
  }
}

/**
 * Emulator環境のFirestore Admin SDKを使用してfacilityドキュメントを作成
 *
 * @param params 施設ドキュメント作成パラメータ
 * @returns 作成された施設ドキュメントID
 */
export async function createFacilityInEmulator(params: {
  facilityId: string;
  name: string;
  adminUserId: string;
}): Promise<string> {
  console.log(`🏢 Emulator施設ドキュメント作成: ${params.name} (ID: ${params.facilityId})`);

  // Admin SDK初期化（未初期化の場合のみ）
  initializeAdminSDK();

  const now = admin.firestore.Timestamp.now();

  // Facility型に完全準拠（types.ts:217-223）
  const facilityData = {
    facilityId: params.facilityId, // ✅ id → facilityId
    name: params.name,
    createdAt: now,
    createdBy: params.adminUserId,
    members: [], // ✅ 空配列（初期状態）
    // ❌ settings, updatedAt フィールドは削除（Facility型に存在しない）
  };

  try {
    // Admin SDK経由でfacilitiesコレクションにドキュメント作成
    await admin.firestore().collection('facilities').doc(params.facilityId).set(facilityData);

    console.log(`✅ Emulator施設ドキュメント作成成功: ${params.name} (ID: ${params.facilityId})`);
    return params.facilityId;
  } catch (error: any) {
    console.error(`❌ Emulator施設ドキュメント作成失敗: ${error.message}`);
    throw new Error(`Failed to create facility in emulator: ${error.message}`);
  }
}

/**
 * Emulator環境のFirestoreをクリーンアップ（全ドキュメント削除）
 *
 * テスト間での状態リセットに使用
 */
export async function clearEmulatorFirestore(): Promise<void> {
  console.log(`🧹 Emulator Firestore クリーンアップ開始`);

  const response = await fetch(
    'http://localhost:8080/emulator/v1/projects/ai-care-shift-scheduler/databases/(default)/documents',
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    console.warn(`⚠️ Emulator Firestore クリーンアップ失敗: ${response.statusText}`);
    return;
  }

  console.log(`✅ Emulator Firestore クリーンアップ完了`);
}
