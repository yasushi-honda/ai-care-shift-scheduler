# Phase 18: Permission error検出テスト - 実行マニュアル

**作成日**: 2025-11-12
**対象**: テスト実行者
**前提**: Phase 18.1実装完了

---

## テスト実行方法

### ローカル環境

```bash
# 1. 環境変数設定
export PLAYWRIGHT_BASE_URL=https://ai-care-shift-scheduler.web.app
export TEST_USER_ID=<Firebase ConsoleでコピーしたUID>

# 2. テスト実行
npm run test:e2e:permission

# 3. 特定のテストのみ実行
npm run test:e2e:permission -- --grep "ユーザー詳細"

# 4. デバッグモード
npm run test:e2e:permission -- --debug

# 5. ヘッドレスモード無効（ブラウザ表示）
npm run test:e2e:permission -- --headed
```

### GitHub Actions（手動トリガー）

1. GitHub → Actions → "E2E Permission Check (Manual Trigger)"
2. "Run workflow" クリック
3. `test_user_id` に super-admin UID を入力
4. "Run workflow" 実行
5. 結果確認（約2-3分）

---

## トラブルシューティング

### エラー1: `TEST_USER_ID is not defined`

**原因**: 環境変数が設定されていない

**解決**:
```bash
export TEST_USER_ID=<UIDをコピー>
echo $TEST_USER_ID  # 確認
```

### エラー2: `net::ERR_NAME_NOT_RESOLVED`

**原因**: PLAYWRIGHT_BASE_URLが間違っている

**解決**:
```bash
export PLAYWRIGHT_BASE_URL=https://ai-care-shift-scheduler.web.app
```

### エラー3: `Permission error detected`

**原因**: Firestore Security Rulesの不備（これが検出したいバグ）

**解決手順**:
1. エラーメッセージをコピー
2. `firestore.rules` で該当コレクションを確認
3. Security Rules追加・修正
4. `firebase deploy --only firestore:rules` でデプロイ
5. 再テスト実行

### エラー4: `Timeout 30000ms exceeded`

**原因**: ページ読み込みが遅い

**解決**:
```typescript
// テストのタイムアウトを延長
test.setTimeout(60000); // 60秒
```

### エラー5: 認証エラー

**原因**: ブラウザの認証状態が保存されていない

**解決**:
1. 本番環境に手動でログイン
2. ブラウザの認証状態を保存
3. 再テスト実行

---

## テスト結果の確認

### 成功時

```
Running 5 tests using 1 worker

  ✓ 1 ユーザー詳細ページでPermission errorが発生しない (3s)
  ✓ 2 セキュリティアラートページでPermission errorが発生しない (2s)
  ✓ 3 バージョン履歴表示でPermission errorが発生しない (2s)
  ✓ 4 管理画面の主要ページでPermission errorが発生しない (8s)
  ✓ 5 ログイン直後にPermission errorが発生しない (4s)

  5 passed (19s)
```

### 失敗時

```
Running 5 tests using 1 worker

  ✓ 1 ユーザー詳細ページでPermission errorが発生しない (3s)
  ✗ 2 セキュリティアラートページでPermission errorが発生しない (2s)

  1) Permission error自動検出 - 管理画面 › セキュリティアラートページでPermission errorが発生しない

    Error: Permission error detected: Failed to get security alerts: FirebaseError: Missing or insufficient permissions.

      at e2e/permission-errors.spec.ts:45:5
```

→ `firestore.rules` に `securityAlerts` コレクションのルール追加が必要

---

## デバッグ方法

### コンソールログ確認

```bash
# デバッグ用テストを実行
npm run test:e2e:permission -- --grep "コンソールログ"
```

出力例:
```
--- All Console Messages ---
[0] log: ✅ Firestore auth token refreshed
[1] log: ✅ Restored facility from localStorage
[2] error: Failed to get security alerts: FirebaseError: Missing or insufficient permissions.

--- Error Messages ---
[0] Failed to get security alerts: FirebaseError: Missing or insufficient permissions.
```

### スクリーンショット確認

テスト失敗時、`playwright-report/` にスクリーンショットが保存されます。

```bash
# レポートを開く
npx playwright show-report
```

---

## 定期実行の推奨

### 週次実行

毎週月曜日にGitHub Actionsで手動実行することを推奨。

### デプロイ前実行

重要な変更（Security Rules変更、コレクション追加）の前に実行。

---

**マニュアル作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**次のドキュメント**: `phase18-monitoring-setup-guide.md`
