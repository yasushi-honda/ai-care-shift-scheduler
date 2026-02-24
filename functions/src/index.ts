import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// Firebase Admin初期化
admin.initializeApp();

// グローバル設定（デフォルト値、個別の関数で上書き可能）
// セキュリティ: 全データ処理を日本国内（東京リージョン）で完結
setGlobalOptions({
  region: 'asia-northeast1', // 東京リージョン（日本国内データ処理）
  memory: '512MiB',
  timeoutSeconds: 120, // Solver + 評価処理に十分な時間
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

// Phase 19.3.3: 使用状況レポート機能
export { scheduledMonthlyReport, generateMonthlyReport } from './generateMonthlyReport';

// Phase 42.2: デモログイン機能
export { demoSignIn } from './demoSignIn';
// デモシフトリセット機能
export { resetDemoShifts } from './resetDemoShifts';

// Phase 54: シフト再評価機能
export { reevaluateShift } from './reevaluateShift';

// Phase 63: 通知システム
export { onScheduleConfirmed } from './onScheduleConfirmed';
// Phase 63.2: 残高不足アラート
export { scheduledLeaveAlert } from './scheduledLeaveAlert';
