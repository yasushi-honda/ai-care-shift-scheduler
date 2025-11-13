# Phase 2実装計画: Firestoreクエリ最適化

**更新日**: 2025-11-14
**Phase**: 技術的負債解消 Phase 2
**優先度**: 高
**推定工数**: 4-6時間

---

## 1. 概要

Phase 19完了後に残された技術的負債のうち、**Firestoreクエリ最適化**を実施します。
現在、監査ログ・セキュリティアラート・使用状況レポートのクエリにページネーションとインデックスが実装されていないため、大規模データでのパフォーマンス低下が予想されます。

### 1.1 目的

- 大規模データでのクエリパフォーマンス向上
- Firestore読み取り課金の最適化
- ユーザー体験の向上（高速なページ読み込み）

### 1.2 対象範囲

1. **Firestoreインデックスの作成**（`firestore.indexes.json`）
2. **AuditLogs.tsxのページネーション実装**
3. **SecurityAlerts.tsxのページネーション実装**
4. **UsageReports.tsxのクエリ最適化**

---

## 2. 現状分析

### 2.1 AuditLogs.tsx

**現状**:
- `limit: 100`で固定
- ページネーション未実装
- すべてのログを一度に取得

**問題点**:
- 100件を超えるログがある場合、古いログが見えない
- フィルタリング時に毎回100件取得

**影響**:
- 大規模運用時に最新100件以外のログにアクセス不可
- Firestore読み取り料金の増加

### 2.2 SecurityAlerts.tsx

**現状**:
- 全件取得（limit未設定の可能性）
- ページネーション未実装

**問題点**:
- アラート数が増加すると読み込み時間が長くなる
- 不要なデータまで取得

### 2.3 UsageReports.tsx

**現状**:
- 月次レポートデータを取得
- 集計済みデータを利用しているため、比較的最適化されている

**改善余地**:
- 期間が長い場合のサンプリング戦略
- キャッシュ戦略の最適化

### 2.4 Firestoreインデックス

**現状**:
- `firestore.indexes.json`が存在しない
- 複合クエリ時にFirestoreが自動でインデックス作成を要求

**問題点**:
- 初回クエリ実行時にエラーが発生
- 手動でインデックスを作成する必要がある
- CI/CDでのデプロイが自動化されていない

---

## 3. 実装内容

### 3.1 Firestoreインデックスの作成

#### 3.1.1 ファイル作成

**新規ファイル**: `firestore.indexes.json`

**配置場所**: プロジェクトルート

**内容**:
```json
{
  "indexes": [
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "order": "DESCENDING" },
        { "fieldPath": "facilityId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "order": "DESCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "action", "order": "ASCENDING" },
        { "fieldPath": "resourceType", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "securityAlerts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

#### 3.1.2 インデックスの説明

**Index 1: auditLogs - timestamp + facilityId**
- 用途: 施設別の監査ログを時系列で取得
- クエリ例: `where('facilityId', '==', id).orderBy('timestamp', 'desc')`

**Index 2: auditLogs - timestamp + userId**
- 用途: ユーザー別の監査ログを時系列で取得
- クエリ例: `where('userId', '==', id).orderBy('timestamp', 'desc')`

**Index 3: auditLogs - action + resourceType + timestamp**
- 用途: アクション種別とリソース種別でフィルタリング
- クエリ例: `where('action', '==', 'CREATE').where('resourceType', '==', 'schedule').orderBy('timestamp', 'desc')`

**Index 4: securityAlerts - createdAt + status**
- 用途: ステータス別のアラートを時系列で取得
- クエリ例: `where('status', '==', 'active').orderBy('createdAt', 'desc')`

---

### 3.2 AuditLogs.tsxのページネーション実装

#### 3.2.1 変更ファイル

**ファイル**: `src/pages/admin/AuditLogs.tsx`

#### 3.2.2 実装方針

- **ページサイズ**: 50件/ページ
- **ナビゲーション**: 「前へ」「次へ」ボタン
- **状態管理**: `lastVisible`, `firstVisible`, `currentPage`

#### 3.2.3 実装内容

**追加する状態変数**:
```typescript
const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null);
const [currentPage, setCurrentPage] = useState(1);
const [hasMore, setHasMore] = useState(false);
const PAGE_SIZE = 50;
```

**ページネーション付きloadLogs関数**:
```typescript
const loadLogs = async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
  setLoading(true);
  setError(null);

  const filters: {
    userId?: string;
    action?: AuditLogAction;
    resourceType?: string;
    facilityId?: string | null;
    limit?: number;
    startAfter?: DocumentSnapshot;
    startBefore?: DocumentSnapshot;
  } = { limit: PAGE_SIZE };

  if (filterUserId) filters.userId = filterUserId;
  if (filterAction) filters.action = filterAction;
  if (filterResourceType) filters.resourceType = filterResourceType;
  if (filterFacilityId !== '') {
    filters.facilityId = filterFacilityId || null;
  }

  // ページネーション処理
  if (direction === 'next' && lastVisible) {
    filters.startAfter = lastVisible;
  } else if (direction === 'prev' && firstVisible) {
    filters.startBefore = firstVisible;
  }

  const result = await AuditLogService.getAuditLogs(filters);

  if (!result.success) {
    assertResultError(result);
    setError(result.error.message);
    setLoading(false);
    return;
  }

  setLogs(result.data);

  // DocumentSnapshotを保存（次のページ用）
  if (result.data.length > 0) {
    setFirstVisible(result.data[0]);
    setLastVisible(result.data[result.data.length - 1]);
    setHasMore(result.data.length === PAGE_SIZE);
  } else {
    setHasMore(false);
  }

  // ページ番号を更新
  if (direction === 'next') {
    setCurrentPage(prev => prev + 1);
  } else if (direction === 'prev') {
    setCurrentPage(prev => Math.max(1, prev - 1));
  } else {
    setCurrentPage(1);
  }

  setLoading(false);
};
```

**ページネーションUI**:
```tsx
<div className="flex items-center justify-between mt-4">
  <div className="text-sm text-gray-700">
    ページ {currentPage} | 表示中: {logs.length}件
  </div>
  <div className="flex gap-2">
    <Button
      variant="primary"
      onClick={() => loadLogs('prev')}
      disabled={currentPage === 1 || loading}
    >
      ← 前へ
    </Button>
    <Button
      variant="primary"
      onClick={() => loadLogs('next')}
      disabled={!hasMore || loading}
    >
      次へ →
    </Button>
  </div>
</div>
```

---

### 3.3 SecurityAlerts.tsxのページネーション実装

#### 3.3.1 変更ファイル

**ファイル**: `src/pages/admin/SecurityAlerts.tsx`

#### 3.3.2 実装内容

AuditLogs.tsxと同様のページネーションロジックを実装。
ページサイズは **25件/ページ**（セキュリティアラートは重要度が高いため、少なめに設定）。

#### 3.3.3 追加機能

- ステータスフィルタ（active, resolved, dismissed）
- 重要度フィルタ（high, medium, low）

---

### 3.4 UsageReports.tsxのクエリ最適化

#### 3.4.1 変更ファイル

**ファイル**: `src/pages/admin/UsageReports.tsx`

#### 3.4.2 実装内容

**現状**: 月次レポートデータ（`/reports/monthly/data/`）を取得

**最適化案**:
1. **期間フィルタの追加**: デフォルトで直近3ヶ月のみ表示
2. **キャッシュ戦略**: 取得済みデータをメモリキャッシュ（5分間有効）
3. **サンプリング**: 6ヶ月以上の期間を選択した場合、週次サンプリング

**コード例**:
```typescript
const [reportCache, setReportCache] = useState<Map<string, CachedReport>>(new Map());
const CACHE_DURATION = 5 * 60 * 1000; // 5分

const loadReports = async (startMonth: string, endMonth: string) => {
  const cacheKey = `${startMonth}-${endMonth}`;
  const cached = reportCache.get(cacheKey);

  // キャッシュチェック
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    setReports(cached.data);
    return;
  }

  // Firestoreから取得
  const result = await fetchMonthlyReports(startMonth, endMonth);

  if (result.success) {
    // キャッシュに保存
    setReportCache(prev => new Map(prev).set(cacheKey, {
      data: result.data,
      timestamp: Date.now()
    }));
    setReports(result.data);
  }
};
```

---

## 4. AuditLogServiceの変更

### 4.1 変更ファイル

**ファイル**: `src/services/auditLogService.ts`

### 4.2 getAuditLogs関数の拡張

**追加パラメータ**:
- `startAfter?: DocumentSnapshot`
- `startBefore?: DocumentSnapshot`

**実装例**:
```typescript
public static async getAuditLogs(filters: {
  userId?: string;
  action?: AuditLogAction;
  resourceType?: string;
  facilityId?: string | null;
  limit?: number;
  startAfter?: DocumentSnapshot;
  startBefore?: DocumentSnapshot;
}): Promise<Result<AuditLogDocument[]>> {
  try {
    const db = getFirestore();
    let q = query(collection(db, 'auditLogs'));

    // フィルタ適用
    if (filters.userId) {
      q = query(q, where('userId', '==', filters.userId));
    }
    if (filters.action) {
      q = query(q, where('action', '==', filters.action));
    }
    if (filters.resourceType) {
      q = query(q, where('resourceType', '==', filters.resourceType));
    }
    if (filters.facilityId !== undefined) {
      q = query(q, where('facilityId', '==', filters.facilityId));
    }

    // ソート（必須）
    q = query(q, orderBy('timestamp', 'desc'));

    // ページネーション
    if (filters.startAfter) {
      q = query(q, startAfter(filters.startAfter));
    } else if (filters.startBefore) {
      q = query(q, endBefore(filters.startBefore), limitToLast(filters.limit || 50));
    }

    // リミット
    if (!filters.startBefore) {
      q = query(q, limit(filters.limit || 50));
    }

    const snapshot = await getDocs(q);

    const logs: AuditLogDocument[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // DocumentSnapshotも保存して返す（ページネーション用）
      _snapshot: doc
    } as AuditLogDocument));

    return createSuccess(logs);
  } catch (error) {
    return createFailure(handleFirestoreError(error));
  }
}
```

---

## 5. デプロイ手順

### 5.1 Firestoreインデックスのデプロイ

#### ローカル環境（Emulator）

```bash
# Emulatorでは自動生成されるため、特に操作不要
firebase emulators:start --only firestore
```

#### 本番環境

```bash
# Firebase CLIでデプロイ
firebase deploy --only firestore:indexes
```

**GitHub Actions CI/CDに追加**:
```yaml
# .github/workflows/firebase-deploy.yml
- name: Deploy Firestore Indexes
  run: firebase deploy --only firestore:indexes
```

### 5.2 コードのデプロイ

通常のGitHub Flowに従ってデプロイ：
1. コード修正
2. コミット
3. CodeRabbitレビュー
4. プッシュ
5. GitHub Actions CI/CD（自動デプロイ）

---

## 6. 検証計画

### 6.1 ページネーション機能のテスト

#### テストシナリオ1: 基本的なページネーション

1. 監査ログページを開く
2. 「次へ」ボタンをクリック → 2ページ目が表示される
3. 「前へ」ボタンをクリック → 1ページ目に戻る
4. ページ数とデータ件数が正しく表示される

#### テストシナリオ2: フィルタリング + ページネーション

1. ユーザーIDでフィルタリング
2. ページネーションが正しく動作することを確認
3. フィルタをクリアしてページがリセットされることを確認

#### テストシナリオ3: 境界値テスト

1. データが50件未満の場合 → 「次へ」ボタンが無効化される
2. データがちょうど50件の場合 → 「次へ」ボタンが有効
3. 最初のページで「前へ」ボタンが無効化される

### 6.2 パフォーマンステスト

#### メトリクス

- **初回ロード時間**: 2秒以内
- **ページ遷移時間**: 1秒以内
- **Firestore読み取り回数**: ページサイズ + 1回以内

#### 測定方法

```typescript
const startTime = performance.now();
await loadLogs('next');
const endTime = performance.now();
console.log(`Page load time: ${endTime - startTime}ms`);
```

### 6.3 インデックスの検証

#### Firestoreコンソールでの確認

1. Firebaseコンソールを開く
2. Firestore → インデックス
3. 作成したインデックスが「有効」になっていることを確認

#### クエリエラーの確認

- 複合クエリ実行時にエラーが発生しないことを確認
- Firestoreコンソールにインデックス作成の提案が表示されないことを確認

---

## 7. リスク分析と対策

### 7.1 リスク1: DocumentSnapshotのシリアライズ

**問題**: DocumentSnapshotはシリアライズできないため、Reactの状態管理が複雑になる

**対策**:
- DocumentSnapshotをコンポーネント外（useRef）に保存
- または、`_lastId`などの識別子のみを保存してクエリを再構築

### 7.2 リスク2: 「前へ」ボタンの実装の複雑さ

**問題**: Firestoreは「前のページ」を取得するためのネイティブAPIがない

**対策**:
- `limitToLast()`と`endBefore()`を組み合わせて実装
- または、ページ履歴をスタックで管理（簡易実装）

### 7.3 リスク3: キャッシュの無効化タイミング

**問題**: データが更新された場合、キャッシュが古くなる

**対策**:
- キャッシュ有効期限を5分に設定
- 手動でキャッシュをクリアできるボタンを追加

---

## 8. 成功基準

### 8.1 機能要件

- ✅ Firestoreインデックスが正常にデプロイされている
- ✅ AuditLogs.tsxで50件ごとのページネーションが動作する
- ✅ SecurityAlerts.tsxで25件ごとのページネーションが動作する
- ✅ フィルタリングとページネーションが併用できる
- ✅ 「次へ」「前へ」ボタンが正しく動作する

### 8.2 非機能要件

- ✅ ページロード時間が2秒以内
- ✅ ページ遷移時間が1秒以内
- ✅ Firestore読み取り回数が最小化されている（ページサイズ + 1回以内）
- ✅ TypeScriptエラーがゼロ
- ✅ ビルドが成功する
- ✅ E2Eテストが成功する

### 8.3 コード品質

- ✅ CodeRabbitレビューで指摘がない
- ✅ コードがDRY原則に従っている（ページネーションロジックの共通化）
- ✅ 適切なエラーハンドリングがされている

---

## 9. 今後の拡張案

### 9.1 高度なページネーション

- **ページ番号ジャンプ**: 特定のページに直接ジャンプ
- **ページサイズ変更**: ユーザーが50件/100件/200件から選択可能

### 9.2 検索機能の追加

- **全文検索**: Algolia/Elasticsearchとの統合
- **日付範囲フィルタ**: 特定期間のログを検索

### 9.3 エクスポート機能の拡張

- **全ページエクスポート**: 現在のフィルタ条件で全データをエクスポート
- **バックグラウンドエクスポート**: Cloud Functionsで大量データをエクスポート

---

## 10. 関連ドキュメント

- [technical-debt-resolution-plan-2025-11-14.md](./technical-debt-resolution-plan-2025-11-14.md) - Phase 2を含む技術的負債解消計画全体
- [phase19-complete-declaration-2025-11-14.md](./phase19-complete-declaration-2025-11-14.md) - Phase 19完了宣言（技術的負債の発見経緯）

---

## 11. タイムライン

| ステップ | 内容 | 推定時間 |
|---------|-----|---------|
| 1 | `firestore.indexes.json`作成 | 30分 |
| 2 | AuditLogServiceの拡張 | 1時間 |
| 3 | AuditLogs.tsxのページネーション実装 | 2時間 |
| 4 | SecurityAlerts.tsxのページネーション実装 | 1.5時間 |
| 5 | UsageReports.tsxの最適化 | 1時間 |
| 6 | テスト・検証 | 1時間 |
| **合計** | | **6-7時間** |

---

**次のステップ**: この実装計画のレビューと承認後、Phase 2の実装を開始します。
