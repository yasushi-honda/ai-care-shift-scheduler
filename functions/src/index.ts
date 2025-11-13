import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// Firebase Admin初期化
admin.initializeApp();

// グローバル設定（デフォルト値、個別の関数で上書き可能）
setGlobalOptions({
  region: 'us-central1', // 米国中部リージョン（全関数統一）
  memory: '512MiB',
  timeoutSeconds: 120, // 大規模シフト生成（50名×1ヶ月）に対応
  minInstances: 0,
  maxInstances: 10,
});

// エンドポイントのエクスポート
export { generateShift } from './shift-generation';
export { assignSuperAdminOnFirstUser, updateLastLogin } from './auth-onCreate';
export { onUserDelete } from './onUserDelete';
export { fixFirstUserRole } from './fix-facility-role';
export { archiveAuditLogs } from './archiveAuditLogs';

// Phase 19.3.2: バックアップ・リストア機能
export { backupFacilityData } from './backupFacilityData';
export { restoreFacilityData } from './restoreFacilityData';
export { scheduledBackup } from './scheduledBackup';
