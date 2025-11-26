/**
 * Jest テストセットアップファイル
 * 統合テスト実行前の共通設定
 */

// タイムアウト延長（統合テストは時間がかかる）
jest.setTimeout(120000); // 120秒

// 環境変数の設定
process.env.NODE_ENV = 'test';

// Cloud Functions URLの設定（環境変数がない場合はデフォルト値）
if (!process.env.CLOUD_FUNCTION_URL) {
  const projectId = process.env.GCP_PROJECT_ID || 'ai-care-shift-scheduler';
  // 東京リージョン（asia-northeast1）を使用
  process.env.CLOUD_FUNCTION_URL = `https://asia-northeast1-${projectId}.cloudfunctions.net/generateShift`;
}

// テスト開始ログ
console.log('🧪 Jest テストセットアップ完了');
console.log(`📡 Cloud Function URL: ${process.env.CLOUD_FUNCTION_URL}`);
console.log(`🤖 SKIP_AI_TESTS: ${process.env.SKIP_AI_TESTS || 'false'}`);
