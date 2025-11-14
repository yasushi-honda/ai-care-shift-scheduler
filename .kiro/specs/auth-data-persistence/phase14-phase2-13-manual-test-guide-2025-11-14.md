# Phase 14: Phase 2/13機能 手動テストガイド

**作成日**: 2025-11-14
**Phase**: Phase 14（E2Eテスト） + Phase 16（本番検証）統合版
**対象機能**: Phase 2（Firestoreクエリ最適化）+ Phase 13（監査ログ・セキュリティアラート）

---

## 1. テストガイドの目的

このガイドは、Phase 2およびPhase 13で実装された以下の機能の本番環境動作確認を行うための手動テストガイドです：

**Phase 2機能**:
- AuditLogsページネーション（50件/ページ）
- SecurityAlertsページネーション（25件/ページ）
- UsageReportsキャッシュ（5分間有効）

**Phase 13機能**:
- 監査ログ記録
- セキュリティアラート生成
- RBAC権限チェック（SYSTEM_ADMIN権限）

**なぜ手動テストか**:
- すべての機能が**SYSTEM_ADMIN権限**を必要とする
- Firebase Auth Emulator未導入のため、自動E2Eテストが困難
- 本番環境での実際の動作確認が必要

---

## 2. 前提条件

### 2.1 テスト環境

- **本番環境**: https://ai-care-shift-scheduler.web.app
- **権限**: SYSTEM_ADMIN権限を持つアカウントでログイン済み

### 2.2 テスト前の確認事項

1. ✅ Firebase Console へのアクセス権限がある
   - URL: https://console.firebase.google.com/project/ai-care-shift-scheduler
2. ✅ Chrome DevToolsを使用できる（F12キーで開く）
3. ✅ SYSTEM_ADMIN権限アカウントでログイン済み

---

## 3. テストケース一覧

| ID | カテゴリ | テストケース | 所要時間 | 優先度 |
|----|----------|-------------|---------|--------|
| T01 | Phase 2 | AuditLogsページネーション動作確認 | 5分 | 高 |
| T02 | Phase 2 | SecurityAlertsページネーション動作確認 | 5分 | 高 |
| T03 | Phase 2 | UsageReportsキャッシュ動作確認 | 10分 | 高 |
| T04 | Phase 13 | 監査ログ記録確認 | 5分 | 高 |
| T05 | Phase 13 | セキュリティアラート生成確認 | 5分 | 高 |
| T06 | Phase 13 | RBAC権限チェック | 10分 | 中 |
| T07 | インフラ | Firestoreインデックス確認 | 5分 | 高 |
| T08 | パフォーマンス | UIレスポンス速度測定 | 10分 | 中 |

**合計推定時間**: 55分

---

## 4. テストケース詳細

### T01: AuditLogsページネーション動作確認

**目的**: Phase 2で実装したAuditLogsページネーション（50件/ページ）が正常動作しているか確認

**前提条件**:
- SYSTEM_ADMIN権限でログイン済み
- auditLogsコレクションに50件以上のデータが存在する（デモデータまたは実データ）

**手順**:

1. **ページアクセス**
   ```
   URL: https://ai-care-shift-scheduler.web.app/admin/audit-logs
   ```
   - ✅ ページが正常に表示される
   - ✅ 監査ログ一覧が表示される

2. **初期表示確認**
   - ✅ 最大50件のログが表示される
   - ✅ 「次へ」ボタンが表示される（50件以上ある場合）
   - ✅ 「前へ」ボタンは無効化されている（初期表示のため）

3. **「次へ」ボタンクリック**
   - ✅ 次の50件が表示される
   - ✅ 「前へ」ボタンが有効になる
   - ✅ ページネーション番号が更新される

4. **「前へ」ボタンクリック**
   - ✅ 前の50件が表示される
   - ✅ 初期表示と同じデータが表示される

5. **フィルター適用**
   - 施設フィルター: 特定の施設を選択
   - ✅ フィルターされたログのみが表示される
   - ✅ ページネーションボタンが正常動作する（フィルター結果が50件以上の場合）

6. **コンソールエラー確認**
   - Chrome DevTools（F12）でConsoleタブを開く
   - ✅ エラーログがないことを確認

**期待結果**:
- ✅ 50件ごとにページネーション動作
- ✅ 「次へ」「前へ」ボタンが正常動作
- ✅ フィルターとページネーションが併用可能
- ✅ コンソールエラーなし

**トラブルシューティング**:

| 問題 | 原因 | 対処 |
|------|------|------|
| データが表示されない | Firestoreインデックス未作成 | T07を実施してインデックス確認 |
| ページネーションボタンが動作しない | startAfterId/startBeforeIdのバグ | src/services/auditLogService.tsのgetAuditLogs関数を確認 |
| 50件より多く/少なく表示される | limitパラメータのバグ | src/pages/admin/AuditLogs.tsxのloadAuditLogs関数を確認 |

---

### T02: SecurityAlertsページネーション動作確認

**目的**: Phase 2で実装したSecurityAlertsページネーション（25件/ページ）が正常動作しているか確認

**前提条件**:
- SYSTEM_ADMIN権限でログイン済み
- securityAlertsコレクションに25件以上のデータが存在する

**手順**:

1. **ページアクセス**
   ```
   URL: https://ai-care-shift-scheduler.web.app/admin/security-alerts
   ```
   - ✅ ページが正常に表示される
   - ✅ セキュリティアラート一覧が表示される

2. **初期表示確認**
   - ✅ 最大25件のアラートが表示される
   - ✅ 「次へ」ボタンが表示される（25件以上ある場合）
   - ✅ 「前へ」ボタンは無効化されている（初期表示のため）

3. **「次へ」ボタンクリック**
   - ✅ 次の25件が表示される
   - ✅ 「前へ」ボタンが有効になる

4. **「前へ」ボタンクリック**
   - ✅ 前の25件が表示される

5. **ステータスフィルター適用**
   - ステータスフィルター: 「NEW」を選択
   - ✅ NEW状態のアラートのみが表示される
   - ✅ ページネーションボタンが正常動作する

6. **コンソールエラー確認**
   - Chrome DevTools（F12）でConsoleタブを開く
   - ✅ エラーログがないことを確認

**期待結果**:
- ✅ 25件ごとにページネーション動作
- ✅ 「次へ」「前へ」ボタンが正常動作
- ✅ ステータスフィルターとページネーションが併用可能
- ✅ コンソールエラーなし

**トラブルシューティング**:

| 問題 | 原因 | 対処 |
|------|------|------|
| データが表示されない | Firestoreインデックス未作成 | T07を実施してインデックス確認 |
| ページネーションボタンが動作しない | startAfterId/startBeforeIdのバグ | src/services/securityAlertService.tsのgetAlerts関数を確認 |
| 25件より多く/少なく表示される | limitパラメータのバグ | src/pages/admin/SecurityAlerts.tsxのloadAlerts関数を確認 |

---

### T03: UsageReportsキャッシュ動作確認

**目的**: Phase 2で実装したUsageReportsキャッシュ（5分間有効）が正常動作しているか確認

**前提条件**:
- SYSTEM_ADMIN権限でログイン済み
- auditLogsコレクションにデータが存在する

**手順**:

1. **ページアクセス**
   ```
   URL: https://ai-care-shift-scheduler.web.app/admin/usage-reports
   ```
   - ✅ ページが正常に表示される
   - ✅ デフォルトで「直近3ヶ月」のデータが表示される

2. **Chrome DevToolsでコンソールを開く**
   - F12キーを押してConsoleタブを開く
   - ログ出力を確認する準備

3. **初回ロード確認**
   - ✅ レポートデータが表示される
   - ✅ コンソールに「Using cached report data」ログが**表示されない**（初回ロードのため）

4. **別の期間を選択**
   - 期間フィルター: 「今月」を選択
   - ✅ 今月のデータが表示される
   - ✅ コンソールに「Using cached report data」ログが**表示されない**（新しいキャッシュキーのため）

5. **再度「直近3ヶ月」を選択（キャッシュヒット）**
   - 期間フィルター: 「直近3ヶ月」を選択
   - ✅ 直近3ヶ月のデータが**即座に**表示される
   - ✅ コンソールに「Using cached report data: YYYY-MM-DD-YYYY-MM-DD」ログが**表示される**

6. **5分待機後に再度「直近3ヶ月」を選択（キャッシュ期限切れ）**
   - 5分間待機
   - 期間フィルター: 「直近3ヶ月」を選択
   - ✅ データが再取得される（Firestoreクエリ実行）
   - ✅ コンソールに「Using cached report data」ログが**表示されない**（キャッシュ期限切れのため）

7. **手動更新ボタン確認**
   - 「更新」ボタンをクリック
   - ✅ データが再取得される
   - ✅ レポートが更新される

**期待結果**:
- ✅ デフォルト期間が「直近3ヶ月」
- ✅ キャッシュヒット時にコンソールログ「Using cached report data」表示
- ✅ 5分後にキャッシュが期限切れになる
- ✅ コンソールエラーなし

**トラブルシューティング**:

| 問題 | 原因 | 対処 |
|------|------|------|
| キャッシュが動作しない | キャッシュキー生成ロジックのバグ | src/pages/admin/UsageReports.tsxのgenerateCacheKey関数を確認 |
| 常にFirestoreクエリが実行される | CACHE_DURATION設定のバグ | src/pages/admin/UsageReports.tsxのCACHE_DURATION定数を確認 |
| 5分後もキャッシュが有効 | 期限切れチェックのバグ | src/pages/admin/UsageReports.tsxのloadUsageData関数を確認 |

---

### T04: 監査ログ記録確認

**目的**: Phase 13で実装した監査ログ記録機能が正常動作しているか確認

**前提条件**:
- SYSTEM_ADMIN権限でログイン済み
- Firebase Consoleへのアクセス権限がある

**手順**:

1. **Firebase Consoleでaudit Logsコレクション確認**
   ```
   URL: https://console.firebase.google.com/project/ai-care-shift-scheduler/firestore/data/auditLogs
   ```
   - ✅ auditLogsコレクションが存在する
   - ✅ 最近のログが記録されている

2. **フィールド確認**
   - ✅ `timestamp`: Timestampフィールドが存在
   - ✅ `userId`: ユーザーIDが記録されている
   - ✅ `action`: アクション（CREATE, UPDATE, DELETE, READ, GENERATE, etc.）が記録されている
   - ✅ `resourceType`: リソースタイプ（STAFF, SHIFT, SCHEDULE, etc.）が記録されている
   - ✅ `facilityId`: 施設IDが記録されている
   - ✅ `resourceId`: リソースIDが記録されている（オプション）
   - ✅ `ipAddress`: IPアドレスが記録されている（オプション）
   - ✅ `userAgent`: User Agentが記録されている（オプション）

3. **テストアクション実行**
   - 本番環境でテストアクションを実行:
     - 例1: スタッフ追加（CREATE STAFF）
     - 例2: シフト生成（GENERATE SHIFT）
     - 例3: スタッフ編集（UPDATE STAFF）

4. **Firebase Consoleで新しいログ確認**
   - ✅ テストアクション実行後、auditLogsコレクションに新しいログが追加される
   - ✅ 実行したアクションが正しく記録されている

5. **AuditLogsページで確認**
   - URL: https://ai-care-shift-scheduler.web.app/admin/audit-logs
   - ✅ 実行したテストアクションが一覧に表示される

**期待結果**:
- ✅ 監査ログが正しく記録されている
- ✅ 必須フィールド（timestamp, userId, action, resourceType, facilityId）がすべて存在
- ✅ テストアクション後に新しいログが生成される

---

### T05: セキュリティアラート生成確認

**目的**: Phase 13で実装したセキュリティアラート生成機能が正常動作しているか確認

**前提条件**:
- SYSTEM_ADMIN権限でログイン済み
- Firebase Consoleへのアクセス権限がある

**手順**:

1. **Firebase ConsoleでsecurityAlertsコレクション確認**
   ```
   URL: https://console.firebase.google.com/project/ai-care-shift-scheduler/firestore/data/securityAlerts
   ```
   - ✅ securityAlertsコレクションが存在する
   - ✅ 過去のアラートが記録されている（存在する場合）

2. **フィールド確認**
   - ✅ `type`: アラートタイプ（SUSPICIOUS_ACCESS, UNAUTHORIZED_ATTEMPT, etc.）
   - ✅ `severity`: 深刻度（LOW, MEDIUM, HIGH, CRITICAL）
   - ✅ `status`: ステータス（NEW, ACKNOWLEDGED, INVESTIGATING, RESOLVED, FALSE_POSITIVE）
   - ✅ `userId`: ユーザーID（オプション）
   - ✅ `facilityId`: 施設ID（オプション）
   - ✅ `title`: アラートタイトル
   - ✅ `description`: アラート説明
   - ✅ `metadata`: メタデータ（オブジェクト）
   - ✅ `detectedAt`: 検出日時（Timestamp）

3. **SecurityAlertsページで確認**
   ```
   URL: https://ai-care-shift-scheduler.web.app/admin/security-alerts
   ```
   - ✅ セキュリティアラート一覧が表示される
   - ✅ アラート詳細が確認できる

4. **アラートステータス変更テスト**
   - 特定のアラートを選択
   - ステータスを「NEW」→「ACKNOWLEDGED」に変更
   - ✅ ステータスが正常に更新される
   - ✅ Firebase Consoleで変更が反映されている

5. **アラートステータス変更テスト2**
   - 同じアラートを選択
   - ステータスを「ACKNOWLEDGED」→「RESOLVED」に変更
   - ✅ ステータスが正常に更新される
   - ✅ `resolvedBy`と`resolvedAt`フィールドが記録される

**期待結果**:
- ✅ セキュリティアラートが正しく生成されている
- ✅ アラートステータス変更が正常動作する
- ✅ Firebase Consoleで変更が反映される

---

### T06: RBAC権限チェック

**目的**: SYSTEM_ADMIN権限でのみアクセス可能な機能が正しく保護されているか確認

**前提条件**:
- FACILITY_ADMIN権限アカウントが必要（テスト用）
- SYSTEM_ADMIN権限アカウントが必要

**手順**:

1. **FACILITY_ADMINでログイン**
   - FACILITY_ADMIN権限アカウントでログイン

2. **監査ログページアクセス試行**
   ```
   URL: https://ai-care-shift-scheduler.web.app/admin/audit-logs
   ```
   - ✅ Forbiddenページ（403エラーページ）が表示される
   - ✅ 「このページへのアクセス権限がありません」メッセージが表示される

3. **セキュリティアラートページアクセス試行**
   ```
   URL: https://ai-care-shift-scheduler.web.app/admin/security-alerts
   ```
   - ✅ Forbiddenページが表示される

4. **UsageReportsページアクセス試行**
   ```
   URL: https://ai-care-shift-scheduler.web.app/admin/usage-reports
   ```
   - ✅ Forbiddenページが表示される

5. **SYSTEM_ADMINでログイン**
   - SYSTEM_ADMIN権限アカウントでログイン

6. **監査ログページアクセス**
   - ✅ 正常に表示される

7. **セキュリティアラートページアクセス**
   - ✅ 正常に表示される

8. **UsageReportsページアクセス**
   - ✅ 正常に表示される

**期待結果**:
- ✅ FACILITY_ADMINで監査ログ・アラートが参照不可
- ✅ SYSTEM_ADMINでのみアクセス可能

---

### T07: Firestoreインデックス確認

**目的**: Phase 2で定義したFirestoreインデックスが正しくデプロイされているか確認

**前提条件**:
- Firebase Consoleへのアクセス権限がある

**手順**:

1. **Firebase Consoleでインデックス一覧を確認**
   ```
   URL: https://console.firebase.google.com/project/ai-care-shift-scheduler/firestore/indexes
   ```
   - 「Composite indexes」タブを選択

2. **インデックス1: schedules（4フィールド）**
   - ✅ Collection: schedules
   - ✅ Fields:
     - targetMonth (Ascending)
     - idempotencyHash (Ascending)
     - status (Ascending)
     - createdAt (Descending)
   - ✅ Status: Enabled

3. **インデックス2: facilities**
   - ✅ Collection: facilities
   - ✅ Fields: createdAt (Descending)
   - ✅ Status: Enabled

4. **インデックス3: users**
   - ✅ Collection: users
   - ✅ Fields: lastLoginAt (Descending)
   - ✅ Status: Enabled

5. **インデックス4: schedules（2フィールド）**
   - ✅ Collection: schedules
   - ✅ Fields:
     - targetMonth (Ascending)
     - createdAt (Descending)
   - ✅ Status: Enabled

6. **インデックス5: auditLogs（timestamp + facilityId）**
   - ✅ Collection: auditLogs
   - ✅ Fields:
     - timestamp (Descending)
     - facilityId (Ascending)
   - ✅ Status: Enabled

7. **インデックス6: auditLogs（timestamp + userId）**
   - ✅ Collection: auditLogs
   - ✅ Fields:
     - timestamp (Descending)
     - userId (Ascending)
   - ✅ Status: Enabled

8. **インデックス7: auditLogs（action + resourceType + timestamp）**
   - ✅ Collection: auditLogs
   - ✅ Fields:
     - action (Ascending)
     - resourceType (Ascending)
     - timestamp (Descending)
   - ✅ Status: Enabled

9. **インデックス8: securityAlerts**
   - ✅ Collection: securityAlerts
   - ✅ Fields:
     - detectedAt (Descending)
     - status (Ascending)
   - ✅ Status: Enabled

**期待結果**:
- ✅ 8つのコンポジットインデックスがすべてEnabled状態
- ✅ 「Creating」または「Error」状態のインデックスがない

**トラブルシューティング**:

| 問題 | 原因 | 対処 |
|------|------|------|
| インデックスが表示されない | firestore.indexes.jsonがデプロイされていない | `firebase deploy --only firestore:indexes`を実行 |
| Status: Creating | インデックス作成中 | 数分待ってから再確認 |
| Status: Error | インデックス定義エラー | firestore.indexes.jsonの定義を確認 |

---

### T08: UIレスポンス速度測定

**目的**: Phase 2のクエリ最適化によるUIレスポンス速度の改善を定量的に測定

**前提条件**:
- SYSTEM_ADMIN権限でログイン済み
- Chrome DevToolsを使用できる

**手順**:

1. **Chrome DevToolsでPerformanceタブを開く**
   - F12キーを押す
   - 「Performance」タブを選択

2. **AuditLogs初期ロード時間測定**
   - ページをリロード（Cmd+R / Ctrl+R）
   - ✅ ロード完了まで待機
   - ✅ 初期ロード時間を記録（目標: < 2秒）

3. **SecurityAlerts初期ロード時間測定**
   - SecurityAlertsページ（/admin/security-alerts）にアクセス
   - ページをリロード
   - ✅ 初期ロード時間を記録（目標: < 1.5秒）

4. **UsageReports初期ロード時間測定**
   - UsageReportsページ（/admin/usage-reports）にアクセス
   - ページをリロード
   - ✅ 初期ロード時間を記録（目標: < 3秒）

5. **ページネーション応答時間測定**
   - AuditLogsページで「次へ」ボタンをクリック
   - ✅ 次ページ表示までの時間を記録（目標: < 1秒）

6. **キャッシュヒット時の応答時間測定**
   - UsageReportsページで期間を変更後、元の期間に戻す
   - ✅ キャッシュヒット時の表示時間を記録（目標: < 0.5秒）

**期待結果**:
- ✅ AuditLogs初期ロード < 2秒
- ✅ SecurityAlerts初期ロード < 1.5秒
- ✅ UsageReports初期ロード < 3秒
- ✅ ページネーション応答 < 1秒
- ✅ キャッシュヒット < 0.5秒

---

## 5. テスト結果記録

### 5.1 テスト実施記録シート

| ID | テストケース | 実施日 | 実施者 | 結果 | 備考 |
|----|-------------|--------|--------|------|------|
| T01 | AuditLogsページネーション | YYYY-MM-DD | | ✅ / ❌ | |
| T02 | SecurityAlertsページネーション | YYYY-MM-DD | | ✅ / ❌ | |
| T03 | UsageReportsキャッシュ | YYYY-MM-DD | | ✅ / ❌ | |
| T04 | 監査ログ記録 | YYYY-MM-DD | | ✅ / ❌ | |
| T05 | セキュリティアラート生成 | YYYY-MM-DD | | ✅ / ❌ | |
| T06 | RBAC権限チェック | YYYY-MM-DD | | ✅ / ❌ | |
| T07 | Firestoreインデックス | YYYY-MM-DD | | ✅ / ❌ | |
| T08 | UIレスポンス速度 | YYYY-MM-DD | | ✅ / ❌ | |

### 5.2 パフォーマンス測定結果

| 測定項目 | 目標値 | 実測値 | 判定 |
|---------|--------|--------|------|
| AuditLogs初期ロード | < 2秒 | ___秒 | ✅ / ❌ |
| SecurityAlerts初期ロード | < 1.5秒 | ___秒 | ✅ / ❌ |
| UsageReports初期ロード | < 3秒 | ___秒 | ✅ / ❌ |
| ページネーション応答 | < 1秒 | ___秒 | ✅ / ❌ |
| キャッシュヒット | < 0.5秒 | ___秒 | ✅ / ❌ |

### 5.3 発見された問題

| ID | 問題内容 | 再現手順 | 深刻度 | ステータス | 対応予定 |
|----|---------|---------|--------|-----------|---------|
| | | | 高/中/低 | Open/Fixed | |
| | | | | | |

---

## 6. トラブルシューティング

### 6.1 一般的な問題と対処

| 問題 | 原因 | 対処 |
|------|------|------|
| SYSTEM_ADMINでログインできない | 権限設定エラー | Firebase ConsoleでユーザーのcustomClaimsを確認 |
| ページが表示されない | ビルドエラー | GitHub ActionsのCI/CD結果を確認 |
| データが表示されない | Firestoreルールエラー | Firebase Consoleでセキュリティルールを確認 |
| ページネーションが動作しない | Firestoreインデックス未作成 | T07を実施してインデックスを確認 |

### 6.2 Firebase Consoleでの確認方法

**ユーザーのcustomClaimsを確認**:
1. Firebase Console → Authentication → Users
2. 対象ユーザーをクリック
3. 「Custom claims」セクションを確認
4. `role: "super-admin"` が設定されていることを確認

**Firestoreセキュリティルールを確認**:
1. Firebase Console → Firestore Database → Rules
2. `/auditLogs`、`/securityAlerts`コレクションのルールを確認
3. `allow read: if isSuperAdmin()` が設定されていることを確認

**CI/CD結果を確認**:
```bash
gh run list --limit 5
```
最新のCI/CDがsuccessであることを確認

---

## 7. テスト完了基準

### 7.1 完了条件

以下のすべてが満たされた場合、Phase 14（Phase 2/13機能）のテストは完了とみなします：

- ✅ 8つのテストケース（T01～T08）がすべて合格
- ✅ 発見された問題がすべて修正済みまたは対応予定が明確
- ✅ テスト結果記録シートが記入済み
- ✅ パフォーマンス測定結果が目標値を達成

### 7.2 不合格時の対応

テストが不合格となった場合：
1. 問題内容を記録（5.3 発見された問題）
2. 深刻度を判定（高/中/低）
3. 対応方針を決定：
   - 高: 即座に修正
   - 中: Phase 17で修正
   - 低: Phase 18以降で修正または受容

---

## 8. 次のステップ

### 8.1 テスト完了後

- **Phase 16完全完了**: 手動検証18項目（Phase 16-1～16-3）がすべて完了
- **Phase 14部分完了**: Phase 2/13機能のテストが完了
- **次の推奨ステップ**: Phase 17（Firebase Auth Emulator導入 + 自動E2Eテスト拡充）

### 8.2 Phase 17予定

- Firebase Auth Emulator導入
- test.skipを解除して自動E2Eテストを実装
- staffServiceテストカバレッジ改善（66.07% → 80%以上）
- 監査ログアーカイブ機能実装（Cloud Scheduler + Cloud Storage）

---

## 9. 関連ドキュメント

### Phase 2関連
- [phase2-implementation-plan-2025-11-14.md](./phase2-implementation-plan-2025-11-14.md)
- [phase2-completion-summary-2025-11-14.md](./phase2-completion-summary-2025-11-14.md)
- [phase2-diagram-2025-11-14.md](./phase2-diagram-2025-11-14.md)

### Phase 13関連
- [phase13-completion-summary-2025-11-01.md](./phase13-completion-summary-2025-11-01.md)
- [phase13-diagram-2025-11-01.md](./phase13-diagram-2025-11-01.md)

### Phase 14関連
- [phase14_progress_final_20251102（メモリ）]
- [phase14_e2e_test_patterns（メモリ）]

### Phase 16関連
- [phase16-implementation-plan-2025-11-14.md](./phase16-implementation-plan-2025-11-14.md)
- [phase16-verification-results-2025-11-14.md](./phase16-verification-results-2025-11-14.md)
- [phase16-summary-2025-11-14.md](./phase16-summary-2025-11-14.md)

---

**作成日**: 2025-11-14
**作成者**: Claude Code AI
**推定所要時間**: 55分（8テストケース）
**対象Phase**: Phase 14 + Phase 16統合
