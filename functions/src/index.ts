import { setGlobalOptions } from 'firebase-functions/v2';

// グローバル設定
setGlobalOptions({
  region: 'asia-northeast1', // 東京リージョン
  memory: '512MiB',
  timeoutSeconds: 60,
  minInstances: 0,
  maxInstances: 10,
});

// 将来実装するエンドポイント
// export { generateShift } from './shift-generation';
// export { updateStaff } from './staff-management';
// export { exportPDF } from './export-service';

// 仮のヘルスチェックエンドポイント
import { onRequest } from 'firebase-functions/v2/https';

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
