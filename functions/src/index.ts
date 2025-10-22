import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// Firebase Admin初期化
admin.initializeApp();

// グローバル設定（デフォルト値、個別の関数で上書き可能）
setGlobalOptions({
  region: 'us-central1', // 米国中部リージョン（全関数統一）
  memory: '512MiB',
  timeoutSeconds: 60,
  minInstances: 0,
  maxInstances: 10,
});

// エンドポイントのエクスポート
export { generateShift } from './shift-generation';
