import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// Firebase Admin初期化
admin.initializeApp();

// グローバル設定
setGlobalOptions({
  region: 'asia-northeast1', // 東京リージョン
  memory: '512MiB',
  timeoutSeconds: 60,
  minInstances: 0,
  maxInstances: 10,
});

// エンドポイントのエクスポート
export { generateShift } from './shift-generation';

// ヘルスチェックエンドポイント
export const healthCheck = onRequest(
  {
    region: 'asia-northeast1',
    cors: true,
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).json({
      status: 'ok',
      project: 'ai-care-shift-scheduler',
      timestamp: new Date().toISOString(),
    });
  }
);
