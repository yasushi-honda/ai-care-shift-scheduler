# 技術的負債解消 - 実装計画

**作成日**: 2025-11-14
**仕様ID**: auth-data-persistence
**前提Phase**: Phase 19完了
**推定工数**: 約10-15時間

---

## 目次

1. [概要](#1-概要)
2. [技術調査](#2-技術調査)
3. [実装内容](#3-実装内容)
4. [実装手順](#4-実装手順)
5. [成功基準](#5-成功基準)
6. [リスクと緩和策](#6-リスクと緩和策)
7. [関連ドキュメント](#7-関連ドキュメント)

---

## 1. 概要

### 1.1 目的

Phase 19完了後に残された技術的負債を解消し、プロジェクトの品質と保守性を向上させる。

### 1.2 背景

Phase 19完了宣言（`phase19-complete-declaration-2025-11-14.md`）の「7.2 改善すべき点」と「7.3.2 技術的負債の解消」に記載されている技術的負債を解消します。

### 1.3 対象となる技術的負債

**優先度高**:
1. **Firestoreクエリ最適化**（Phase 19.1.2未実施分）
2. **モバイルE2Eテストの追加**
3. **パフォーマンス継続監視体制の確立**

**優先度中**:
4. **既存TypeScriptエラーの解消**（`ExportMenu.tsx`, `exportCSV.ts`, `exportPDF.ts`）
5. **date-fns依存関係の完全削除**
6. **未使用コードの削除**

### 1.4 推定工数

| タスク | 推定工数 | 優先度 |
|--------|---------|--------|
| Firestoreクエリ最適化 | 4-6時間 | 高 |
| モバイルE2Eテスト追加 | 3-4時間 | 高 |
| パフォーマンス継続監視 | 2-3時間 | 高 |
| TypeScriptエラー解消 | 1-2時間 | 中 |
| date-fns削除 | 0.5-1時間 | 中 |
| 未使用コード削除 | 0.5-1時間 | 中 |
| **合計** | **11-17時間** | |

---

## 2. 技術調査

### 2.1 Firestoreクエリ最適化の現状

#### 2.1.1 Phase 19.1.2で実施されなかった項目

Phase 19.1.2では以下を実施：
- ✅ Tree Shaking強化
- ✅ 依存関係削減（date-fns削除）
- ✅ Build設定最適化

Phase 19.1.2で**実施されなかった項目**:
- ❌ Firestoreインデックス最適化
- ❌ Firestoreクエリのページネーション実装
- ❌ Firestoreクエリのキャッシュ戦略最適化

#### 2.1.2 パフォーマンス問題が発生する可能性がある箇所

**1. 監査ログ（AuditLogs.tsx）**
```typescript
// 現状: 全監査ログを取得（ページネーションなし）
const logsQuery = query(
  collection(db, 'auditLogs'),
  orderBy('timestamp', 'desc')
);
const snapshot = await getDocs(logsQuery);
```

**問題**:
- 監査ログが数千〜数万件になると読み込みが遅くなる
- Firestoreの読み取り回数が増加（コスト増）

**2. セキュリティアラート（SecurityAlerts.tsx）**
```typescript
// 現状: 全アラートを取得（ページネーションなし）
const alertsQuery = query(
  collection(db, 'securityAlerts'),
  orderBy('createdAt', 'desc')
);
const snapshot = await getDocs(alertsQuery);
```

**問題**:
- アラートが数百件になると読み込みが遅くなる

**3. 使用状況レポート（UsageReports.tsx）**
```typescript
// 現状: 期間内の全監査ログを取得
const logsSnapshot = await db
  .collection('auditLogs')
  .where('timestamp', '>=', startDate)
  .where('timestamp', '<=', endDate)
  .get();
```

**問題**:
- 長期間（過去3ヶ月など）を選択すると数万件の読み込みが発生

#### 2.1.3 必要なFirestoreインデックス

現在の`firestore.indexes.json`を確認:

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

**必要なインデックス**:
1. **auditLogs**: `timestamp`（降順）+ `facilityId`
2. **auditLogs**: `timestamp`（降順）+ `userId`
3. **auditLogs**: `timestamp`（降順）+ `action` + `resourceType`
4. **securityAlerts**: `createdAt`（降順）+ `status`

---

### 2.2 モバイルE2Eテストの現状

#### 2.2.1 現在のE2Eテスト構成

**既存のE2Eテスト**:
- `e2e/shift-generation.spec.ts`: シフト生成フロー
- `e2e/auth-flow.spec.ts`: 認証フロー
- `e2e/facility-selection.spec.ts`: 施設選択フロー

**問題**:
- すべてデスクトップブラウザでの実行のみ
- モバイルデバイスエミュレーションなし

#### 2.2.2 Playwright Mobile Emulationの調査

Playwrightは以下のモバイルデバイスプリセットをサポート:
- iPhone 12 Pro（390x844）
- iPhone SE（375x667）
- iPad（768x1024）
- Pixel 5（393x851）

**Playwright設定例**:
```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 12 Pro'] } },
    { name: 'ipad', use: { ...devices['iPad'] } },
  ],
});
```

---

### 2.3 パフォーマンス継続監視の現状

#### 2.3.1 既存のパフォーマンス測定基盤

**Phase 19.1.1で導入済み**:
- ✅ Lighthouse CI（GitHub Actions統合）
- ✅ Web Vitals測定（`src/utils/webVitals.ts`）
- ✅ Google Analyticsへのレポート送信

**問題**:
- Lighthouse CIはPR作成時のみ実行（継続的監視なし）
- Web Vitalsデータの可視化ダッシュボードなし
- パフォーマンス劣化の自動アラートなし

#### 2.3.2 Firebase Performance Monitoringの調査

Firebase Performance Monitoringは以下を提供:
- リアルタイムパフォーマンスデータ収集
- カスタムトレース（任意の処理の計測）
- ネットワークリクエスト監視
- Firebase Consoleでの可視化

**導入方法**:
```typescript
import { getPerformance, trace } from 'firebase/performance';

const perf = getPerformance();
const t = trace(perf, 'custom_trace');
t.start();
// ... some code
t.stop();
```

---

### 2.4 TypeScriptエラーの現状

#### 2.4.1 既存のTypeScriptエラー

```bash
npm run type-check
```

**エラー一覧**:
1. `src/components/ExportMenu.tsx(82,11)`: Property 'addToast' does not exist on type 'never'
2. `src/components/ExportMenu.tsx(179,9)`: Type '"secondary"' is not assignable to type '"primary" | "danger"'
3. `src/utils/exportCSV.ts(15,24)`: Cannot find module 'date-fns' or its corresponding type declarations
4. `src/utils/exportPDF.ts(17,24)`: Cannot find module 'date-fns' or its corresponding type declarations

#### 2.4.2 date-fns削除の影響

Phase 19.1.2で`date-fns`を削除したが、一部のファイルでimport文が残っている。

**影響範囲**:
- `src/utils/exportCSV.ts`: `format` 関数
- `src/utils/exportPDF.ts`: `format` 関数

**対策**:
- `Intl.DateTimeFormat`または`Date.prototype.toLocaleDateString()`に置き換え

---

### 2.5 未使用コードの調査

#### 2.5.1 未使用コードの特定方法

```bash
# 未使用のexportを検出
npx ts-prune

# 未使用のimportを検出
npx eslint . --ext .ts,.tsx --rule 'no-unused-vars: error'
```

**想定される未使用コード**:
- 削除されたコンポーネントへの参照
- 使われていないユーティリティ関数
- 古い型定義

---

## 3. 実装内容

### 3.1 Firestoreクエリ最適化

#### 3.1.1 Firestoreインデックスの作成

**ファイル**: `firestore.indexes.json`

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

#### 3.1.2 AuditLogs.tsxのページネーション実装

**変更ファイル**: `src/pages/admin/AuditLogs.tsx`

**実装内容**:
1. `limit()`でページサイズを制限（例: 50件/ページ）
2. `startAfter()`で次のページを読み込み
3. ページネーションUIの追加（「前へ」「次へ」ボタン）

**コード例**:
```typescript
const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
const [page, setPage] = useState(1);
const PAGE_SIZE = 50;

const loadLogs = async (isNextPage: boolean) => {
  let logsQuery = query(
    collection(db, 'auditLogs'),
    orderBy('timestamp', 'desc'),
    limit(PAGE_SIZE)
  );

  if (isNextPage && lastVisible) {
    logsQuery = query(logsQuery, startAfter(lastVisible));
  }

  const snapshot = await getDocs(logsQuery);
  setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
  // ... rest of logic
};
```

#### 3.1.3 SecurityAlerts.tsxのページネーション実装

**変更ファイル**: `src/pages/admin/SecurityAlerts.tsx`

同様にページネーションを実装。

#### 3.1.4 UsageReports.tsxのクエリ最適化

**変更ファイル**: `src/pages/admin/UsageReports.tsx`

**実装内容**:
1. 期間が長い場合（3ヶ月以上）はサンプリング
2. 集計済みデータがあれば利用（`/reports/monthly/data/`）
3. キャッシュ戦略の最適化

---

### 3.2 モバイルE2Eテストの追加

#### 3.2.1 Playwright設定の更新

**変更ファイル**: `playwright.config.ts`

```typescript
export default defineConfig({
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'iphone', use: { ...devices['iPhone 12 Pro'] } },
    { name: 'ipad', use: { ...devices['iPad'] } },
    { name: 'android', use: { ...devices['Pixel 5'] } },
  ],
});
```

#### 3.2.2 モバイル専用E2Eテストの作成

**新規ファイル**: `e2e/mobile/auth-flow.spec.ts`

**テスト内容**:
- モバイルでのログインフロー
- タッチ操作の検証
- レスポンシブUIの検証

**新規ファイル**: `e2e/mobile/facility-selection.spec.ts`

**テスト内容**:
- モバイルでの施設選択
- スワイプ操作の検証

**新規ファイル**: `e2e/mobile/shift-calendar.spec.ts`

**テスト内容**:
- モバイルでのシフトカレンダー表示
- ピンチズーム、スワイプ操作

---

### 3.3 パフォーマンス継続監視体制の確立

#### 3.3.1 Firebase Performance Monitoring導入

**変更ファイル**: `src/firebase.ts`

```typescript
import { getPerformance } from 'firebase/performance';

// Firebase Performance Monitoring初期化
if (import.meta.env.PROD) {
  const perf = getPerformance(app);
  console.log('Firebase Performance Monitoring initialized');
}
```

#### 3.3.2 カスタムトレースの追加

**変更ファイル**: `src/services/scheduleService.ts`

```typescript
import { getPerformance, trace } from 'firebase/performance';

export async function generateShift(...) {
  const perf = getPerformance();
  const t = trace(perf, 'shift_generation');
  t.start();

  try {
    // ... shift generation logic
  } finally {
    t.stop();
  }
}
```

#### 3.3.3 Lighthouse CI定期実行の設定

**変更ファイル**: `.github/workflows/lighthouse-ci.yml`

**追加内容**:
- スケジュール実行（毎日1回）
- mainブランチでの定期実行

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 9 * * *'  # 毎日午前9時（UTC）= 午後6時（JST）
```

---

### 3.4 TypeScriptエラー解消

#### 3.4.1 ExportMenu.tsxの型エラー修正

**変更ファイル**: `src/components/ExportMenu.tsx`

**エラー1**: `Property 'addToast' does not exist`
```typescript
// Before
const { addToast } = useContext(ToastContext);

// After
const toastContext = useContext(ToastContext);
if (!toastContext) {
  throw new Error('ToastContext is not available');
}
const { addToast } = toastContext;
```

**エラー2**: `Type '"secondary"' is not assignable`
```typescript
// Before
variant="secondary"

// After
variant="primary"  // または "danger"
```

#### 3.4.2 exportCSV.tsとexportPDF.tsのdate-fns削除

**変更ファイル**: `src/utils/exportCSV.ts`, `src/utils/exportPDF.ts`

```typescript
// Before
import { format } from 'date-fns';
const formattedDate = format(date, 'yyyy-MM-dd');

// After
const formattedDate = date.toLocaleDateString('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).replace(/\//g, '-');
```

---

### 3.5 date-fns依存関係の完全削除

#### 3.5.1 package.jsonから削除

**変更ファイル**: `package.json`

```bash
npm uninstall date-fns
```

#### 3.5.2 全ファイルでのimport文削除確認

```bash
# date-fnsのimportを検索
grep -r "from 'date-fns'" src/
grep -r 'from "date-fns"' src/
```

---

### 3.6 未使用コードの削除

#### 3.6.1 未使用コードの特定

```bash
npx ts-prune | tee unused-exports.txt
```

#### 3.6.2 未使用コードの削除

特定された未使用コードを削除。

---

## 4. 実装手順

### 4.1 実装順序

**Phase 1: TypeScriptエラー解消（優先度: 最高）**
1. ExportMenu.tsxの型エラー修正
2. exportCSV.ts/exportPDF.tsのdate-fns削除
3. date-fns依存関係の完全削除
4. 型チェック実行（`npm run type-check`）

**Phase 2: Firestoreクエリ最適化（優先度: 高）**
1. `firestore.indexes.json`作成
2. AuditLogs.tsxにページネーション実装
3. SecurityAlerts.tsxにページネーション実装
4. UsageReports.tsxのクエリ最適化
5. Firestore Indexesデプロイ（`firebase deploy --only firestore:indexes`）

**Phase 3: モバイルE2Eテスト追加（優先度: 高）**
1. `playwright.config.ts`更新
2. `e2e/mobile/auth-flow.spec.ts`作成
3. `e2e/mobile/facility-selection.spec.ts`作成
4. `e2e/mobile/shift-calendar.spec.ts`作成
5. E2Eテスト実行（`npm run test:e2e`）

**Phase 4: パフォーマンス継続監視（優先度: 高）**
1. Firebase Performance Monitoring初期化
2. カスタムトレース追加（scheduleService.ts）
3. Lighthouse CI定期実行設定
4. Firebase Consoleでの確認

**Phase 5: 未使用コード削除（優先度: 中）**
1. 未使用コードの特定（`npx ts-prune`）
2. 未使用コードの削除
3. ビルド・テスト実行

---

### 4.2 各Phaseのチェックリスト

#### Phase 1: TypeScriptエラー解消

- [ ] ExportMenu.tsxの型エラー修正
- [ ] exportCSV.tsのdate-fns削除
- [ ] exportPDF.tsのdate-fns削除
- [ ] package.jsonからdate-fns削除
- [ ] `npm run type-check`実行
- [ ] TypeScriptエラーゼロ確認
- [ ] ビルド成功確認（`npm run build`）
- [ ] コミット・プッシュ

#### Phase 2: Firestoreクエリ最適化

- [ ] `firestore.indexes.json`作成
- [ ] AuditLogs.tsxにページネーション実装
- [ ] SecurityAlerts.tsxにページネーション実装
- [ ] UsageReports.tsxのクエリ最適化
- [ ] ローカルE2Eテスト実行
- [ ] コミット・プッシュ
- [ ] Firebase Indexesデプロイ（GitHub Actions）
- [ ] 本番環境動作確認

#### Phase 3: モバイルE2Eテスト追加

- [ ] `playwright.config.ts`更新
- [ ] `e2e/mobile/auth-flow.spec.ts`作成
- [ ] `e2e/mobile/facility-selection.spec.ts`作成
- [ ] `e2e/mobile/shift-calendar.spec.ts`作成
- [ ] E2Eテスト実行（デスクトップ）
- [ ] E2Eテスト実行（モバイル）
- [ ] コミット・プッシュ
- [ ] GitHub Actions E2Eテスト成功確認

#### Phase 4: パフォーマンス継続監視

- [ ] Firebase Performance Monitoring初期化
- [ ] カスタムトレース追加
- [ ] Lighthouse CI定期実行設定
- [ ] ビルド・デプロイ
- [ ] Firebase Consoleでパフォーマンスデータ確認
- [ ] コミット・プッシュ

#### Phase 5: 未使用コード削除

- [ ] `npx ts-prune`実行
- [ ] 未使用コードの削除
- [ ] ビルド成功確認
- [ ] E2Eテスト実行
- [ ] コミット・プッシュ

---

## 5. 成功基準

### 5.1 TypeScriptエラー解消

- ✅ `npm run type-check`がエラーゼロ
- ✅ `npm run build`が成功
- ✅ E2Eテストが全て合格

### 5.2 Firestoreクエリ最適化

- ✅ AuditLogs.tsxの読み込み時間が50%短縮（目標: 2秒以内）
- ✅ SecurityAlerts.tsxの読み込み時間が50%短縮（目標: 1秒以内）
- ✅ UsageReports.tsxの読み込み時間が30%短縮（目標: 3秒以内）
- ✅ Firestore読み取り回数が削減される

### 5.3 モバイルE2Eテスト追加

- ✅ モバイル専用E2Eテストが3件追加される
- ✅ 全てのE2Eテストが合格（デスクトップ + モバイル）
- ✅ GitHub ActionsでモバイルE2Eテストが実行される

### 5.4 パフォーマンス継続監視

- ✅ Firebase Performance MonitoringがFirebase Consoleで確認できる
- ✅ カスタムトレース（shift_generation）がFirebase Consoleで確認できる
- ✅ Lighthouse CIが毎日実行される

### 5.5 未使用コード削除

- ✅ `npx ts-prune`の出力が削減される
- ✅ ビルドサイズが削減される（目標: 5%削減）

---

## 6. リスクと緩和策

### 6.1 Firestoreインデックス作成に時間がかかる

**リスク**: Firestoreインデックスの作成に数分〜数十分かかる可能性がある

**影響度**: 中

**緩和策**:
- インデックス作成をバックグラウンドで実行
- 作成完了まで既存のクエリを継続使用
- Firebase Consoleでインデックス作成状況を監視

---

### 6.2 ページネーション実装によるUI変更

**リスク**: ページネーション実装により、ユーザーがすべてのログを一覧できなくなる

**影響度**: 中

**緩和策**:
- ページサイズを50件に設定（十分な数）
- 検索・フィルター機能を追加（将来）
- CSV/PDFエクスポートで全件取得可能にする

---

### 6.3 モバイルE2Eテストの実行時間増加

**リスク**: モバイルデバイスエミュレーションにより、E2Eテスト実行時間が増加する

**影響度**: 低

**緩和策**:
- GitHub Actionsのmatrix buildでデバイスを並列実行
- 重要なテストのみモバイルで実行

---

### 6.4 Firebase Performance Monitoringのコスト

**リスク**: Firebase Performance Monitoringの利用によりコストが増加する可能性

**影響度**: 低

**緩和策**:
- Firebase Performance Monitoringは無料枠が大きい（1日10万イベント）
- カスタムトレースは必要最小限に絞る

---

## 7. 関連ドキュメント

- `phase19-complete-declaration-2025-11-14.md` - Phase 19完了宣言（技術的負債の記載）
- `phase19.1.2-complete-2025-11-13.md` - Phase 19.1.2完了報告（date-fns削除の記録）
- `phase19-plan-2025-11-13.md` - Phase 19マスタープラン（Firestoreクエリ最適化の計画）

---

**🤖 Generated with [Claude Code](https://claude.com/claude-code)**

**Co-Authored-By: Claude <noreply@anthropic.com>**
