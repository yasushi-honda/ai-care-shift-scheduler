# BUG-001: CORSエラー修正記録

**発見日**: 2025-12-05
**修正完了日**: 2025-12-05
**重要度**: Critical（本番環境でAIシフト生成が完全に動作不能）
**影響期間**: 2025-11-14 〜 2025-12-05（約3週間）

---

## 概要

本番環境でAIシフト生成機能を実行すると、CORSエラーが発生し機能が完全に使用不能となっていた。調査の結果、**Cloud Functionsのデプロイが約3週間失敗し続けていた**ことが判明。

## エラー内容

```
Access to fetch at 'https://asia-northeast1-ai-care-shift-scheduler.cloudfunctions.net/generateShift'
from origin 'https://ai-care-shift-scheduler.web.app' has been blocked by CORS policy
```

---

## 根本原因分析

### 直接原因

`cloudscheduler.googleapis.com` APIが有効化されておらず、GitHub ActionsによるCloud Functionsデプロイが**すべて失敗**していた。

```
⚠  functions: missing required API cloudscheduler.googleapis.com. Enabling now...
Error: Permissions denied enabling cloudscheduler.googleapis.com.
```

### なぜ気づかなかったか（反省点）

1. **CI/CDワークフローの設計問題**
   - Functionsデプロイ失敗時も`|| echo "⚠️ Functions deployment had warnings (non-critical)"`でワークフロー全体は成功扱い
   - HostingとFirestore Rulesのデプロイは成功するため、全体が「成功」と表示
   - **デプロイ失敗がマスクされていた**

2. **監視体制の欠如**
   - Cloud Functionsの実際のデプロイ状況を確認する習慣がなかった
   - デプロイログの詳細を確認していなかった
   - 本番環境でのエンドツーエンド動作確認が不足

3. **リージョン移行時のテスト不足**
   - 2025-11-26にCloud Functionsを`us-central1`→`asia-northeast1`に移行
   - 移行後の動作確認が不十分だった（実際にはデプロイ自体が失敗していた）

4. **エラーの誤認**
   - CORSエラーは「CORS設定の問題」と思い込みやすい
   - 実際は「関数が存在しない」ことが原因だった

### タイムライン

| 日付 | イベント |
|------|---------|
| 2025-10-31 | 最後に成功したFunctionsデプロイ（`us-central1`） |
| 2025-11-14 | `cloudscheduler.googleapis.com`権限エラー開始 |
| 2025-11-26 | `asia-northeast1`リージョン移行コミット（デプロイ失敗） |
| 2025-12-05 | 手動テストでCORSエラー発見・修正 |

---

## 修正内容

### Step 1: Cloud Scheduler API有効化

```bash
gcloud auth login admin@fuku-no-tane.com
gcloud services enable cloudscheduler.googleapis.com --project=ai-care-shift-scheduler
```

### Step 2: 古いus-central1関数の削除

```bash
gcloud functions delete generateShift --region=us-central1 --project=ai-care-shift-scheduler --quiet
gcloud functions delete assignSuperAdminOnFirstUser --region=us-central1 --project=ai-care-shift-scheduler --quiet
gcloud functions delete updateLastLogin --region=us-central1 --project=ai-care-shift-scheduler --quiet
gcloud functions delete archiveAuditLogs --region=us-central1 --project=ai-care-shift-scheduler --quiet
```

### Step 3: Cloud Functions再デプロイ

```bash
git commit --allow-empty -m "fix: redeploy Cloud Functions after deleting legacy us-central1 functions"
git push origin main
```

### デプロイ結果

以下の関数が`asia-northeast1`にデプロイ成功：

| 関数名 | リージョン | 状態 |
|--------|-----------|------|
| generateShift | asia-northeast1 | ✅ Created |
| assignSuperAdminOnFirstUser | asia-northeast1 | ✅ Created |
| updateLastLogin | asia-northeast1 | ✅ Created |
| archiveAuditLogs | asia-northeast1 | ✅ Created |
| backupFacilityData | asia-northeast1 | ✅ Created |
| restoreFacilityData | asia-northeast1 | ✅ Created |
| scheduledBackup | asia-northeast1 | ✅ Created |
| generateMonthlyReport | asia-northeast1 | ✅ Created |
| scheduledMonthlyReport | asia-northeast1 | ✅ Created |
| fixFirstUserRole | asia-northeast1 | ✅ Updated |
| onUserDelete | us-central1 | ✅ Updated |

---

## 再発防止策

### 1. CI/CDワークフロー改善

Functionsデプロイ失敗時はワークフロー全体を失敗させる（または明確な警告を出す）

```yaml
# 現状（問題あり）
firebase deploy --only functions || echo "⚠️ Functions deployment had warnings"

# 改善案
firebase deploy --only functions
# 失敗時はワークフロー失敗とする
```

### 2. デプロイ後の動作確認追加

```yaml
- name: Cloud Functions動作確認
  run: |
    curl -X POST https://asia-northeast1-ai-care-shift-scheduler.cloudfunctions.net/generateShift \
      -H "Content-Type: application/json" \
      -d '{"healthCheck": true}' \
      --fail
```

### 3. 定期的な本番環境テスト

- 週次でAIシフト生成の動作確認を実施
- 手動テストチェックリストに必須項目として追加

### 4. Cloud Functions監視設定

- Cloud Monitoringでデプロイ状況をアラート化
- 関数の存在確認をCI/CDに組み込む

---

## 学び・教訓

1. **「成功」表示を信じない** - 詳細ログを確認する習慣が必要
2. **リージョン移行は慎重に** - 移行後は必ず実機テスト
3. **CORSエラーの真因を疑う** - 設定問題だけでなく「存在しない」可能性も
4. **手動テストの重要性** - 自動テストだけでは検出できない問題がある
5. **エラーハンドリングの透明性** - 失敗をマスクしない設計

---

## 関連ドキュメント

- [gemini_region_critical_rule](.serena/memories/gemini_region_critical_rule.md) - リージョン設定ルール
- [firebase_cli_error_handling](.serena/memories/firebase_cli_error_handling.md) - Firebase CLI対処方針
- [manual-test-checklist](docs/manual-test-checklist.md) - 手動テストチェックリスト

---

## 今後の対応

- [ ] CI/CDワークフローの改善（Functionsデプロイ失敗検知）
- [ ] Cloud Monitoring設定追加
- [ ] MT-001（AIシフト生成）の再テスト実施
- [ ] 手動テスト継続実施
