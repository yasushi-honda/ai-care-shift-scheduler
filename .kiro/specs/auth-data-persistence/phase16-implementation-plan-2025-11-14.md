# Phase 16実装計画: 本番環境検証・改善

**作成日**: 2025-11-14
**Phase**: 技術的負債解消 Phase 16
**前提条件**: Phase 2完了・本番デプロイ済み

---

## 1. Phase 16の目的

Phase 2（Firestoreクエリ最適化）およびPhase 13（監査ログ・セキュリティアラート）機能の本番環境での動作確認と改善を行う。

**主な目標**:
1. 本番環境でのPhase 2/13機能動作確認
2. パフォーマンス測定と分析
3. 監査ログアーカイブ機能の実装（オプション）
4. 技術的負債の最終確認と解消

---

## 2. Phase 16サブタスク

### Phase 16-1: 本番環境動作確認（Phase 2機能）

**目的**: Phase 2で実装したFirestoreクエリ最適化が正常動作しているか確認

**確認項目**:

#### 1. Firestoreインデックスのデプロイ確認
```bash
# Firebase Consoleで確認
# https://console.firebase.google.com/project/ai-care-shift-scheduler/firestore/indexes

# または gcloud CLIで確認
gcloud firestore indexes list --project=ai-care-shift-scheduler
```

**期待結果**:
- `firestore.indexes.json`で定義した7つの複合インデックスがすべて「Enabled」状態

#### 2. AuditLogsページネーション動作確認
- 本番環境（https://ai-care-shift-scheduler.web.app/admin/audit-logs）にアクセス
- 「次へ」「前へ」ボタンで50件ごとにページ遷移できるか
- フィルタリング（施設、ユーザー、アクション）と組み合わせて動作するか
- ブラウザコンソールにエラーがないか

#### 3. SecurityAlertsページネーション動作確認
- 本番環境（https://ai-care-shift-scheduler.web.app/admin/security-alerts）にアクセス
- 「次へ」「前へ」ボタンで25件ごとにページ遷移できるか
- ステータスフィルタ（NEW, ACKNOWLEDGED, etc.）と組み合わせて動作するか
- ブラウザコンソールにエラーがないか

#### 4. UsageReportsキャッシュ機能確認
- 本番環境（https://ai-care-shift-scheduler.web.app/admin/usage-reports）にアクセス
- デフォルトで「直近3ヶ月」のデータが表示されるか
- 同じ期間を再選択した際にキャッシュが使用されるか（ブラウザコンソールで"Using cached report data"ログ確認）
- 5分後にキャッシュが期限切れになるか

---

### Phase 16-2: 本番環境動作確認（Phase 13機能）

**目的**: Phase 13で実装した監査ログ・セキュリティアラートが正常動作しているか確認

**確認項目**:

#### 1. 監査ログ記録確認
- Firebase Consoleで`auditLogs`コレクションを確認
- 最近のログが正しく記録されているか（timestamp, userId, action, resourceType, facilityId）
- テストアクション実行（例: スタッフ追加、シフト作成）→ログが記録されるか確認

#### 2. セキュリティアラート生成確認
- Firebase Consoleで`securityAlerts`コレクションを確認
- 異常検知が正常動作しているか（短時間に複数回失敗、深夜アクセスなど）
- SecurityAlertsページでアラートが正しく表示されるか
- アラートステータス変更（NEW → ACKNOWLEDGED → RESOLVED）が正常動作するか

#### 3. RBAC権限チェック
- FACILITY_ADMIN権限で監査ログ・セキュリティアラートが参照できないことを確認
- SYSTEM_ADMIN権限でのみアクセス可能なことを確認

---

### Phase 16-3: パフォーマンス監視

**目的**: Phase 2の最適化効果を定量的に測定

**測定項目**:

#### 1. Firestoreクエリパフォーマンス
```bash
# Cloud Loggingでクエリ実行時間を確認
gcloud logging read "resource.type=cloud_firestore_database" \
  --limit 50 --format json --project=ai-care-shift-scheduler
```

**測定値**:
- AuditLogsクエリ実行時間: 目標 < 500ms
- SecurityAlertsクエリ実行時間: 目標 < 300ms
- UsageReportsクエリ実行時間: 目標 < 1000ms

#### 2. Firestore読み取り課金確認
```bash
# Firebase Consoleで使用量を確認
# https://console.firebase.google.com/project/ai-care-shift-scheduler/usage
```

**測定値**:
- Phase 2前後での読み取り回数比較
- 目標削減率: 50-75%（ページネーション）、100%（キャッシュヒット時）

#### 3. UIレスポンス速度測定
- Chrome DevToolsのPerformanceタブでページロード時間測定
- AuditLogs初期ロード: 目標 < 2秒
- SecurityAlerts初期ロード: 目標 < 1.5秒
- UsageReports初期ロード: 目標 < 3秒

---

### Phase 16-4: 監査ログアーカイブ機能（オプション・Phase 17へ延期推奨）

**目的**: 古い監査ログを自動アーカイブしてFirestoreのコスト削減

**現状の問題**:
- 10,000件を超えるとセキュリティアラートが生成されるのみ
- ログが無制限に増加してFirestore課金が増加
- 古いログの検索パフォーマンスが低下

**実装案**（Phase 17で実装推奨）:

#### 1. アーカイブ戦略
- **対象**: 6ヶ月以上前の監査ログ
- **保存先**: Cloud Storage（`gs://ai-care-shift-scheduler-archives/auditLogs/YYYY/MM/`）
- **フォーマット**: JSON Lines（.jsonl）
- **実行頻度**: 月次（Cloud Schedulerで自動実行）

#### 2. 実装方法
```typescript
// functions/src/archiveAuditLogs.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Storage } from '@google-cloud/storage';

export const archiveAuditLogs = onSchedule({
  schedule: 'every month',
  timeZone: 'Asia/Tokyo',
  region: 'us-central1',
}, async (event) => {
  const db = getFirestore();
  const storage = new Storage();

  // 6ヶ月前の日付を計算
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // 古いログを取得
  const oldLogsQuery = db.collection('auditLogs')
    .where('timestamp', '<', Timestamp.fromDate(sixMonthsAgo))
    .limit(1000); // バッチサイズ

  const snapshot = await oldLogsQuery.get();

  if (snapshot.empty) {
    console.log('No logs to archive');
    return;
  }

  // JSON Linesフォーマットでエクスポート
  const lines = snapshot.docs.map(doc =>
    JSON.stringify({ id: doc.id, ...doc.data() })
  );

  const yearMonth = sixMonthsAgo.toISOString().substring(0, 7); // YYYY-MM
  const fileName = `auditLogs/${yearMonth}/archive-${Date.now()}.jsonl`;

  // Cloud Storageにアップロード
  await storage.bucket('ai-care-shift-scheduler-archives')
    .file(fileName)
    .save(lines.join('\n'));

  // Firestoreから削除
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  console.log(`Archived ${snapshot.size} logs to ${fileName}`);
});
```

#### 3. デプロイ手順
```bash
# Cloud Storageバケット作成
gsutil mb -p ai-care-shift-scheduler -l us-central1 gs://ai-care-shift-scheduler-archives

# Functionデプロイ
firebase deploy --only functions:archiveAuditLogs
```

**注意**: Phase 16-4は実装コストが高いため、Phase 17として別途計画することを推奨。Phase 16では動作確認とパフォーマンス測定に集中。

---

## 3. Phase 16実施手順

### ステップ1: 本番環境アクセス確認
```bash
# 本番環境URLを確認
firebase hosting:sites:get ai-care-shift-scheduler

# 期待結果: https://ai-care-shift-scheduler.web.app
```

### ステップ2: Phase 16-1実施（Phase 2機能確認）
1. Firestoreインデックス確認
2. AuditLogsページネーション確認
3. SecurityAlertsページネーション確認
4. UsageReportsキャッシュ確認

**所要時間**: 30分

### ステップ3: Phase 16-2実施（Phase 13機能確認）
1. 監査ログ記録確認
2. セキュリティアラート生成確認
3. RBAC権限チェック

**所要時間**: 30分

### ステップ4: Phase 16-3実施（パフォーマンス測定）
1. Firestoreクエリパフォーマンス測定
2. Firestore読み取り課金確認
3. UIレスポンス速度測定

**所要時間**: 30分

### ステップ5: 結果ドキュメント作成
- `phase16-verification-results-2025-11-14.md`作成
- 測定データ、スクリーンショット、問題点を記録

**所要時間**: 30分

**Phase 16-1～16-3合計所要時間**: 約2時間

---

## 4. 検証チェックリスト

### Phase 16-1: Phase 2機能確認
- [ ] Firestoreインデックス7つがすべてEnabled
- [ ] AuditLogsページネーション正常動作
- [ ] SecurityAlertsページネーション正常動作
- [ ] UsageReportsキャッシュ正常動作（ブラウザコンソールログ確認）
- [ ] ブラウザコンソールにエラーなし

### Phase 16-2: Phase 13機能確認
- [ ] 監査ログが正しく記録されている
- [ ] セキュリティアラートが正しく生成されている
- [ ] SecurityAlertsページでアラートが正しく表示される
- [ ] アラートステータス変更が正常動作する
- [ ] FACILITY_ADMINで監査ログ・アラートが参照不可
- [ ] SYSTEM_ADMINでのみアクセス可能

### Phase 16-3: パフォーマンス測定
- [ ] AuditLogsクエリ実行時間 < 500ms
- [ ] SecurityAlertsクエリ実行時間 < 300ms
- [ ] UsageReportsクエリ実行時間 < 1000ms
- [ ] Firestore読み取り削減率 50-75%達成
- [ ] AuditLogs初期ロード < 2秒
- [ ] SecurityAlerts初期ロード < 1.5秒
- [ ] UsageReports初期ロード < 3秒

---

## 5. 期待される成果

### Phase 16完了後の状態
1. ✅ Phase 2機能が本番環境で正常動作していることを確認
2. ✅ Phase 13機能が本番環境で正常動作していることを確認
3. ✅ パフォーマンス改善効果が定量的に測定・記録されている
4. ✅ 技術的負債がすべて解消されている（型エラー0、テスト100%合格）

### 次のステップ候補
- **Phase 14: E2Eテスト** - Playwrightで包括的なE2Eテスト実装
- **Phase 17: 監査ログアーカイブ機能** - Cloud FunctionsとCloud Storageでアーカイブ実装
- **Phase 18: パフォーマンス最適化** - さらなる最適化（React.memo、useMemo、etc.）

---

## 6. トラブルシューティング

### 問題1: Firestoreインデックスが作成されていない

**症状**: Firebase Consoleでインデックスが表示されない

**原因**: `firestore.indexes.json`がデプロイされていない

**対処**:
```bash
firebase deploy --only firestore:indexes
```

### 問題2: ページネーションが動作しない

**症状**: 「次へ」ボタンをクリックしてもデータが表示されない

**原因**: Firestoreインデックスが未作成、またはStartAfter/EndBeforeの実装バグ

**対処**:
1. Firebase Consoleでインデックスを確認
2. ブラウザコンソールでエラーログを確認
3. `src/services/auditLogService.ts`のgetAuditLogs関数を確認

### 問題3: キャッシュが動作しない

**症状**: 同じ期間を再選択してもFirestoreクエリが実行される

**原因**: キャッシュキー生成ロジックのバグ、または有効期限切れ

**対処**:
1. ブラウザコンソールで"Using cached report data"ログが表示されるか確認
2. `src/pages/admin/UsageReports.tsx`のcacheKey生成ロジックを確認
3. CACHE_DURATION（5分）を延長して確認

---

## 7. 関連ドキュメント

### Phase 2関連
- [phase2-implementation-plan-2025-11-14.md](./phase2-implementation-plan-2025-11-14.md)
- [phase2-completion-summary-2025-11-14.md](./phase2-completion-summary-2025-11-14.md)
- [phase2-diagram-2025-11-14.md](./phase2-diagram-2025-11-14.md)

### Phase 13関連
- [phase13-completion-summary-2025-11-01.md](./phase13-completion-summary-2025-11-01.md)
- [phase13-diagram-2025-11-01.md](./phase13-diagram-2025-11-01.md)

### 全体
- [phase13_next_steps（メモリ）]
- [NAVIGATION.md](../../NAVIGATION.md)

---

**作成日**: 2025-11-14
**作成者**: Claude Code AI
**Phase 16推定所要時間**: 2時間（Phase 16-1～16-3のみ）
