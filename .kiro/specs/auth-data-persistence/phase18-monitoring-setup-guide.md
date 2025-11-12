# Phase 18.2: 監視アラート設定 - セットアップガイド

**作成日**: 2025-11-12
**対象**: Phase 18.2実装者
**所要時間**: 約1-2時間

---

## 設定手順

### 1. Permission Error アラート設定

**Google Cloud Console での作業**:

1. [Google Cloud Console](https://console.cloud.google.com/) → プロジェクト `ai-care-shift-scheduler`

2. **Logging** → **Logs Explorer**

3. クエリ入力:
   ```
   resource.type="cloud_run_revision" OR resource.type="cloud_function"
   severity>=ERROR
   (textPayload=~"Missing or insufficient permissions" OR
    textPayload=~"PERMISSION_DENIED" OR
    textPayload=~"Failed to get.*permission")
   ```

4. **Create alert** ボタンをクリック

5. アラート設定:
   - **Alert name**: `Firestore Permission Error Alert`
   - **Condition**: ログエントリが **5分間に3回以上**
   - **Notification channel**: Email (プロジェクト管理者)
   - **Documentation**:
     ```
     Permission error detected in production.

     Possible causes:
     1. Missing Security Rules in firestore.rules
     2. Security Rules design inconsistency
     3. Auth token initialization issue

     Action:
     1. Check phase18-test-manual.md for troubleshooting
     2. Review firestore.rules for the collection
     3. Run npm run test:e2e:permission locally
     ```

6. **Create** をクリック

---

### 2. Cloud Functions エラーアラート設定

1. **Cloud Functions** → 関数選択（例: `generateShift`）

2. **Metrics** タブ

3. **Create Alert Policy**

4. アラート設定:
   - **Metric**: `cloud.googleapis.com/functions/execution/error_count`
   - **Condition**: Count > **3**（5分間）
   - **Notification channel**: Email
   - **Documentation**:
     ```
     Cloud Function error rate exceeded threshold.

     Check Cloud Functions logs for details.
     ```

5. **Create**

---

### 3. 通知チャネル設定（Email）

**デフォルトで設定済み** - Firebase プロジェクトの管理者メールアドレスに通知

確認方法:
1. **Monitoring** → **Alerting** → **Notification Channels**
2. Email チャネルが存在することを確認

---

### 4. Slack通知設定（オプション）

**前提条件**: Slack Workspace + Incoming Webhook URL

**手順**:

1. Slack で Incoming Webhook URL を取得:
   - Slack Workspace設定 → Apps → Incoming Webhooks
   - Webhook URL をコピー

2. Google Cloud Console:
   - **Monitoring** → **Alerting** → **Notification Channels**
   - **Add New** → **Slack**
   - Webhook URL を貼り付け
   - チャネル名入力（例: `#ai-care-alerts`）
   - **Test Connection**
   - **Save**

3. 既存のアラートポリシーに Slack チャネルを追加:
   - アラートポリシーを編集
   - Notification channels に Slack を追加
   - **Save**

---

## 動作確認

### Permission Error アラートのテスト

**警告**: 本番環境に影響する可能性があるため、慎重に実施

**方法1: テスト用コレクションでテスト**（推奨）

1. `firestore.rules` に一時的なテスト用コレクション追加:
   ```javascript
   match /test_permission_alert/{docId} {
     allow read, write: if false; // 意図的にPermission error
   }
   ```

2. Firebase Console でドキュメントにアクセス（Permission error発生）

3. 5分以内に3回アクセス

4. Email または Slack に通知が届くことを確認

5. `firestore.rules` からテスト用コレクションを削除

**方法2: ローカルE2Eテストでエラーを発生させる**

1. 既存のコレクションの Security Rules を一時的にコメントアウト

2. E2Eテスト実行（Permission error発生）

3. アラートが届くことを確認

4. Security Rules を元に戻す

---

### Cloud Functions エラーアラートのテスト

```bash
# generateShift関数を不正なデータで実行
gcloud functions call generateShift \
  --data '{"invalid": "data"}' \
  --region us-central1

# 5分以内に3回実行
# → アラートが届くことを確認
```

---

## トラブルシューティング

### アラートが届かない

**原因1**: 通知チャネルが未設定

**解決**: **Monitoring** → **Alerting** → **Notification Channels** で Email 確認

---

**原因2**: アラート条件の閾値が高すぎる

**解決**: アラートポリシーを編集して閾値を調整（5分間に3回 → 1回）

---

**原因3**: クエリが間違っている

**解決**: **Logs Explorer** でクエリを再確認

---

### 誤検知が多い

**原因**: アラート条件の閾値が低すぎる

**解決**: 閾値を調整（5分間に3回 → 10回）

---

## メンテナンス

### アラートポリシーの確認（月次推奨）

1. **Monitoring** → **Alerting** → **Policies**
2. すべてのポリシーが **Enabled** であることを確認
3. 過去30日間のアラート発生状況を確認

### 不要なアラートポリシーの削除

古いアラートポリシーは削除して整理する。

---

## 完了確認

- [ ] Permission Error アラート設定完了
- [ ] Cloud Functions エラーアラート設定完了
- [ ] Email 通知確認完了
- [ ] Slack 通知設定完了（オプション）
- [ ] 動作確認完了（テストアラート送信成功）
- [ ] ドキュメント作成完了

---

**ガイド作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**次のドキュメント**: `phase18-troubleshooting.md`
