# Phase 19.3.3: 使用状況レポート機能の拡充 - 実装計画

**作成日**: 2025-11-14
**仕様ID**: auth-data-persistence
**Phase**: 19.3.3
**前提Phase**: Phase 19.3.2（バックアップ・リストア機能）完了
**推定工数**: 約2-3時間

---

## 1. 概要

### 1.1 目的

システム使用状況を詳細に把握し、運用改善のための定量的データを提供する。

### 1.2 背景

Phase 19.3.2でバックアップ・リストア機能が完成し、Phase 19.3（運用改善）の最終フェーズとして、使用状況レポート機能を実装します。

**マスタープラン定義**（phase19-plan-2025-11-13.md L455-479）:

```markdown
### Phase 19.3.3: 使用状況レポート機能の拡充

**目的**: システム使用状況を詳細に把握

**実装内容**:
1. ダッシュボードの拡充
   - 施設別利用統計の詳細化
   - ユーザー別活動ログ
   - シフト生成統計（成功率、所要時間）

2. レポート生成
   - 月次レポートの自動生成
   - 年次レポートの自動生成
   - PDFまたはCSV形式での出力

3. アラート機能
   - 使用量閾値アラート
   - 異常な活動の検出

**実装ファイル**:
- `src/pages/admin/UsageReports.tsx` - 使用状況レポート画面
- `functions/src/generateMonthlyReport.ts` - 月次レポート生成Cloud Function
- `src/components/UsageChart.tsx` - 使用状況グラフコンポーネント

**推定工数**: 約2-3時間
```

### 1.3 成果物

- 管理画面に使用状況レポートページを追加
- 施設別・ユーザー別の利用統計表示
- シフト生成統計（成功率、所要時間）の表示
- CSV/PDFエクスポート機能
- 基本的なアラート機能（閾値検知）

---

## 2. 技術調査

### 2.1 既存実装の確認

#### 2.1.1 監査ログ（AuditLogs）

**ファイル**: `src/pages/admin/AuditLogs.tsx`

既存の監査ログシステムは以下のデータを記録：
- ユーザーID（userId）
- 施設ID（facilityId）
- アクション（action）: CREATE, UPDATE, DELETE, etc.
- リソースタイプ（resourceType）: staff, schedule, backup, etc.
- タイムスタンプ（timestamp）
- 結果（result）: success, failure
- 詳細情報（details）: JSON形式

**Firestore構造**:
```
auditLogs/{logId}
  - userId: string
  - facilityId: string
  - action: AuditLogAction
  - resourceType: string
  - resourceId: string | null
  - timestamp: Timestamp
  - result: 'success' | 'failure'
  - details: object
  - deviceInfo: object
  - errorMessage?: string
```

#### 2.1.2 型定義（types.ts）

**確認済み型定義**:
- `AuditLog` (L264): 監査ログの完全な型定義
- `AuditLogAction` (L251): CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
- `Schedule` (L94): シフトスケジュールデータ
- `ScheduleVersion` (L106): シフトバージョン履歴

#### 2.1.3 AdminDashboard

**ファイル**: `src/pages/admin/AdminDashboard.tsx`

現在のダッシュボードは：
- シンプルなクイックリンク表示のみ
- 統計情報なし
- グラフ表示なし

**Phase 19.3.3での拡充内容**:
- 統計カード追加（総施設数、総ユーザー数、今月のシフト生成数）
- 施設別利用統計
- ユーザー別活動ログ
- シフト生成統計グラフ

### 2.2 データソース分析

#### 2.2.1 施設別利用統計

**データソース**: `auditLogs`コレクション

```typescript
// 施設ごとのアクション数を集計
const facilityStats = auditLogs
  .filter(log => log.timestamp >= startDate)
  .reduce((acc, log) => {
    acc[log.facilityId] = (acc[log.facilityId] || 0) + 1;
    return acc;
  }, {});
```

#### 2.2.2 ユーザー別活動ログ

**データソース**: `auditLogs`コレクション

```typescript
// ユーザーごとの最近の活動を取得
const userActivities = auditLogs
  .filter(log => log.timestamp >= startDate)
  .reduce((acc, log) => {
    if (!acc[log.userId]) {
      acc[log.userId] = [];
    }
    acc[log.userId].push(log);
    return acc;
  }, {});
```

#### 2.2.3 シフト生成統計

**データソース**: `auditLogs`コレクション（`action: CREATE, resourceType: schedule`）

```typescript
// シフト生成の成功率と所要時間
const shiftStats = auditLogs
  .filter(log =>
    log.action === AuditLogAction.CREATE &&
    log.resourceType === 'schedule'
  )
  .reduce((acc, log) => {
    acc.total++;
    if (log.result === 'success') acc.success++;
    if (log.details?.duration) acc.totalDuration += log.details.duration;
    return acc;
  }, { total: 0, success: 0, totalDuration: 0 });

const successRate = (shiftStats.success / shiftStats.total) * 100;
const avgDuration = shiftStats.totalDuration / shiftStats.total;
```

### 2.3 グラフ表示ライブラリ

**選択肢**:
1. **Chart.js** + **react-chartjs-2** (推奨)
   - 軽量（~60KB gzipped）
   - レスポンシブ対応
   - 豊富なチャート種別（折れ線、棒、円グラフ）
   - React統合が容易

2. **Recharts**
   - React専用
   - コンポーネントベース
   - やや重い（~120KB gzipped）

3. **Victory**
   - React/React Native対応
   - アニメーション豊富
   - 学習曲線あり

**決定**: **Chart.js + react-chartjs-2** を採用
理由：軽量、実績豊富、Phase 19.1（パフォーマンス最適化）の方針と一致

### 2.4 エクスポート機能

#### 2.4.1 CSV形式

**ライブラリ**: `papaparse` または組み込み実装

```typescript
function exportToCSV(data: any[], filename: string) {
  const csv = [
    Object.keys(data[0]).join(','),
    ...data.map(row => Object.values(row).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
```

#### 2.4.2 PDF形式

**ライブラリ**: `jsPDF` + `html2canvas`（Phase 19.3.1で使用済み）

```typescript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF();
  pdf.addImage(imgData, 'PNG', 10, 10);
  pdf.save(filename);
}
```

**決定**: Phase 19.3.1で実装済みの`jsPDF + html2canvas`を再利用

### 2.5 Cloud Function設計

#### 2.5.1 月次レポート生成

**Cloud Function**: `generateMonthlyReport`

**トリガー**:
- Cloud Scheduler（毎月1日 午前9時JST）
- または手動実行（HTTPSトリガー）

**処理内容**:
1. 前月の監査ログを取得
2. 統計データを集計
3. レポートデータをFirestoreに保存
4. 管理者にメール通知（オプション）

**Firestore保存先**:
```
reports/monthly/{year}-{month}
  - generatedAt: Timestamp
  - period: { start: Date, end: Date }
  - facilityStats: { [facilityId]: { actions: number, users: Set } }
  - userStats: { [userId]: { actions: number, lastActive: Date } }
  - shiftStats: { total: number, success: number, avgDuration: number }
```

---

## 3. 実装内容

### 3.1 フロントエンド実装

#### 3.1.1 UsageReports.tsx（新規）

**保存先**: `src/pages/admin/UsageReports.tsx`

**機能**:
- 期間選択（今月、先月、過去3ヶ月、カスタム）
- 施設別利用統計テーブル
- ユーザー別活動ログテーブル
- シフト生成統計カード
- CSV/PDFエクスポートボタン

**主要コンポーネント構成**:
```tsx
export function UsageReports() {
  // 状態管理
  const [period, setPeriod] = useState('thisMonth');
  const [loading, setLoading] = useState(true);
  const [facilityStats, setFacilityStats] = useState([]);
  const [userStats, setUserStats] = useState([]);
  const [shiftStats, setShiftStats] = useState(null);

  // データ取得
  useEffect(() => {
    loadUsageData();
  }, [period]);

  return (
    <div>
      {/* 期間選択 */}
      <PeriodSelector value={period} onChange={setPeriod} />

      {/* 統計カード */}
      <StatsCards shiftStats={shiftStats} />

      {/* 施設別利用統計 */}
      <FacilityStatsTable data={facilityStats} />

      {/* ユーザー別活動ログ */}
      <UserActivityTable data={userStats} />

      {/* エクスポートボタン */}
      <ExportButtons onExportCSV={...} onExportPDF={...} />
    </div>
  );
}
```

#### 3.1.2 UsageChart.tsx（新規）

**保存先**: `src/components/UsageChart.tsx`

**機能**:
- Chart.jsを使用したグラフ表示
- 折れ線グラフ: 日別アクション数推移
- 棒グラフ: 施設別アクション数比較
- 円グラフ: アクション種別分布

**実装例**:
```tsx
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Chart.js設定
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface UsageChartProps {
  type: 'line' | 'bar' | 'pie';
  data: any;
  options?: any;
}

export function UsageChart({ type, data, options }: UsageChartProps) {
  const chartComponents = {
    line: Line,
    bar: Bar,
    pie: Pie,
  };

  const ChartComponent = chartComponents[type];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <ChartComponent data={data} options={options} />
    </div>
  );
}
```

#### 3.1.3 AdminDashboard.tsx（更新）

**変更内容**: 統計カードを追加

```tsx
// 追加部分
const [dashboardStats, setDashboardStats] = useState({
  totalFacilities: 0,
  totalUsers: 0,
  thisMonthShifts: 0,
  shiftSuccessRate: 0,
});

useEffect(() => {
  loadDashboardStats();
}, []);

return (
  <div>
    {/* 統計カード */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="総施設数"
        value={dashboardStats.totalFacilities}
        icon="🏢"
      />
      <StatCard
        title="総ユーザー数"
        value={dashboardStats.totalUsers}
        icon="👥"
      />
      <StatCard
        title="今月のシフト生成"
        value={dashboardStats.thisMonthShifts}
        icon="📅"
      />
      <StatCard
        title="シフト生成成功率"
        value={`${dashboardStats.shiftSuccessRate}%`}
        icon="✅"
      />
    </div>

    {/* 既存のクイックリンク */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* ... */}
    </div>
  </div>
);
```

#### 3.1.4 AdminLayout.tsx（更新）

**変更内容**: ナビゲーションに「使用状況レポート」を追加

```tsx
const navigationItems = [
  { path: '/admin/facilities', label: '施設管理', icon: '🏢' },
  { path: '/admin/users', label: 'ユーザー管理', icon: '👥' },
  { path: '/admin/audit-logs', label: '監査ログ', icon: '📋' },
  { path: '/admin/security-alerts', label: 'セキュリティアラート', icon: '🚨' },
  { path: '/admin/backup', label: 'バックアップ管理', icon: '💾' },
  { path: '/admin/usage-reports', label: '使用状況レポート', icon: '📊' }, // 追加
];
```

#### 3.1.5 index.tsx（更新）

**変更内容**: ルーティングに `/admin/usage-reports` を追加

```tsx
const UsageReports = lazy(() => import('./src/pages/admin/UsageReports'));

// ...

<Route path="/admin" element={...}>
  {/* ... 既存ルート ... */}
  <Route path="usage-reports" element={<UsageReports />} /> {/* 追加 */}
</Route>
```

### 3.2 バックエンド実装

#### 3.2.1 generateMonthlyReport.ts（新規）

**保存先**: `functions/src/generateMonthlyReport.ts`

**機能**:
- 月次レポート自動生成
- 監査ログから統計データ集計
- Firestoreに保存

**実装**:
```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * 月次レポート生成（定期実行）
 *
 * スケジュール: 毎月1日 午前9時（JST）
 */
export const scheduledMonthlyReport = onSchedule(
  {
    schedule: '0 9 1 * *', // 毎月1日午前9時
    timeZone: 'Asia/Tokyo',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async (event) => {
    const db = admin.firestore();

    // 前月の期間を計算
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    console.log(`Generating monthly report for ${year}-${month.toString().padStart(2, '0')}`);

    // 監査ログを取得
    const logsSnapshot = await db.collection('auditLogs')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .get();

    const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 統計データ集計
    const facilityStats: Record<string, { actions: number, users: Set<string> }> = {};
    const userStats: Record<string, { actions: number, lastActive: Date }> = {};
    let shiftTotal = 0;
    let shiftSuccess = 0;
    let shiftTotalDuration = 0;

    for (const log of logs) {
      // 施設別統計
      if (!facilityStats[log.facilityId]) {
        facilityStats[log.facilityId] = { actions: 0, users: new Set() };
      }
      facilityStats[log.facilityId].actions++;
      facilityStats[log.facilityId].users.add(log.userId);

      // ユーザー別統計
      if (!userStats[log.userId]) {
        userStats[log.userId] = { actions: 0, lastActive: log.timestamp.toDate() };
      }
      userStats[log.userId].actions++;
      if (log.timestamp.toDate() > userStats[log.userId].lastActive) {
        userStats[log.userId].lastActive = log.timestamp.toDate();
      }

      // シフト生成統計
      if (log.action === 'CREATE' && log.resourceType === 'schedule') {
        shiftTotal++;
        if (log.result === 'success') shiftSuccess++;
        if (log.details?.duration) shiftTotalDuration += log.details.duration;
      }
    }

    // レポートデータ作成
    const reportData = {
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      period: {
        start: admin.firestore.Timestamp.fromDate(startDate),
        end: admin.firestore.Timestamp.fromDate(endDate),
      },
      facilityStats: Object.fromEntries(
        Object.entries(facilityStats).map(([id, stats]) => [
          id,
          { actions: stats.actions, userCount: stats.users.size },
        ])
      ),
      userStats: Object.fromEntries(
        Object.entries(userStats).map(([id, stats]) => [
          id,
          { actions: stats.actions, lastActive: admin.firestore.Timestamp.fromDate(stats.lastActive) },
        ])
      ),
      shiftStats: {
        total: shiftTotal,
        success: shiftSuccess,
        successRate: shiftTotal > 0 ? (shiftSuccess / shiftTotal) * 100 : 0,
        avgDuration: shiftTotal > 0 ? shiftTotalDuration / shiftTotal : 0,
      },
    };

    // Firestoreに保存
    const reportId = `${year}-${month.toString().padStart(2, '0')}`;
    await db.collection('reports').doc('monthly').collection('data').doc(reportId).set(reportData);

    console.log(`Monthly report saved: ${reportId}`);
  }
);

/**
 * 手動レポート生成
 *
 * 認証: super-admin のみ
 */
export const generateMonthlyReport = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '認証が必要です');
    }

    if (request.auth.token.role !== 'super-admin') {
      throw new HttpsError('permission-denied', 'レポート生成権限がありません（super-adminのみ）');
    }

    // scheduledMonthlyReportと同じロジックを実行
    // （実装簡略化のため省略）

    return { success: true, message: 'レポート生成が完了しました' };
  }
);
```

#### 3.2.2 index.ts（更新）

**変更内容**: 新しいCloud Functionをエクスポート

```typescript
export { scheduledMonthlyReport, generateMonthlyReport } from './generateMonthlyReport';
```

### 3.3 インフラ設定

#### 3.3.1 firebase.json（確認）

Cloud Schedulerのデプロイ設定は自動的に行われるため、追加設定不要。

#### 3.3.2 Firestore Security Rules（更新）

**追加ルール**: `reports`コレクションへのアクセス制御

```javascript
match /reports/{reportType}/{document=**} {
  // super-adminのみ読み取り可能
  allow read: if request.auth != null
    && request.auth.token.role == 'super-admin';
  // Functionsのみ書き込み可能
  allow write: if false;
}
```

---

## 4. 実装ステップ

### Step 1: 依存パッケージのインストール

```bash
# Chart.js とReact統合
npm install chart.js react-chartjs-2

# 型定義
npm install --save-dev @types/chart.js
```

**推定時間**: 5分

### Step 2: UsageChart.tsx 実装

1. コンポーネントファイル作成
2. Chart.js設定
3. 3種類のグラフ対応（Line, Bar, Pie）
4. レスポンシブ対応

**推定時間**: 30分

### Step 3: UsageReports.tsx 実装

1. ページコンポーネント作成
2. 監査ログ取得ロジック実装
3. 統計データ集計ロジック実装
4. 期間選択UI実装
5. テーブル表示実装
6. UsageChartコンポーネント統合

**推定時間**: 60分

### Step 4: CSV/PDFエクスポート機能

1. CSVエクスポート関数実装
2. PDFエクスポート関数実装（Phase 19.3.1の実装を再利用）
3. エクスポートボタンUI実装

**推定時間**: 20分

### Step 5: AdminDashboard.tsx 更新

1. 統計データ取得ロジック追加
2. StatCardコンポーネント作成
3. レイアウト調整

**推定時間**: 20分

### Step 6: AdminLayout.tsx & index.tsx 更新

1. ナビゲーションアイテム追加
2. ルーティング設定

**推定時間**: 5分

### Step 7: generateMonthlyReport.ts 実装

1. Cloud Function作成
2. 定期実行版（scheduledMonthlyReport）実装
3. 手動実行版（generateMonthlyReport）実装
4. 統計集計ロジック実装
5. Firestore保存処理実装

**推定時間**: 40分

### Step 8: Firestore Security Rules 更新

1. `reports`コレクションのルール追加
2. デプロイ

**推定時間**: 5分

### Step 9: ビルド・型チェック・デプロイ

```bash
# 型チェック
npm run type-check

# ビルド
npm run build

# デプロイ（GitHub Actions経由）
git add .
git commit -m "feat(phase19.3.3): 使用状況レポート機能実装"
git push origin main
```

**推定時間**: 10分

### Step 10: 動作確認・テスト

1. Emulatorでの動作確認
2. 統計データ表示確認
3. グラフ描画確認
4. CSV/PDFエクスポート確認
5. Cloud Function手動実行テスト

**推定時間**: 20分

---

## 5. リスク分析

### 5.1 技術的リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Chart.jsのバンドルサイズ増加 | 中 | Tree shakingとCode Splittingで最適化 |
| 大量の監査ログによるクエリ遅延 | 中 | ページネーション実装、月次レポート事前集計活用 |
| Cloud Schedulerのコールドスタート | 低 | minInstances=0で問題なし（月1回実行） |
| PDF生成の日本語フォント対応 | 低 | Phase 19.3.1で既に対応済み |

### 5.2 運用リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 月次レポート生成失敗 | 中 | エラー監視、手動実行バックアップ機能 |
| レポートデータの肥大化 | 低 | 古いレポートの自動削除（12ヶ月以上前） |

### 5.3 ユーザビリティリスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| グラフが複雑で理解しづらい | 低 | シンプルなグラフ種別選択、ツールチップで詳細表示 |
| モバイルでのグラフ視認性低下 | 中 | レスポンシブ設計、Chart.jsのresponsive: true |

---

## 6. テスト計画

### 6.1 単体テスト

**対象**: 統計集計ロジック

```typescript
// tests/usageReports.test.ts
describe('UsageReports - Statistics Calculation', () => {
  it('should calculate facility stats correctly', () => {
    const logs = [
      { facilityId: 'f1', userId: 'u1', action: 'CREATE', timestamp: new Date() },
      { facilityId: 'f1', userId: 'u2', action: 'UPDATE', timestamp: new Date() },
      { facilityId: 'f2', userId: 'u1', action: 'DELETE', timestamp: new Date() },
    ];

    const stats = calculateFacilityStats(logs);

    expect(stats['f1'].actions).toBe(2);
    expect(stats['f1'].userCount).toBe(2);
    expect(stats['f2'].actions).toBe(1);
    expect(stats['f2'].userCount).toBe(1);
  });

  it('should calculate shift success rate correctly', () => {
    const logs = [
      { action: 'CREATE', resourceType: 'schedule', result: 'success' },
      { action: 'CREATE', resourceType: 'schedule', result: 'success' },
      { action: 'CREATE', resourceType: 'schedule', result: 'failure' },
    ];

    const stats = calculateShiftStats(logs);

    expect(stats.total).toBe(3);
    expect(stats.success).toBe(2);
    expect(stats.successRate).toBeCloseTo(66.67, 2);
  });
});
```

### 6.2 統合テスト

**シナリオ**:
1. 管理画面に使用状況レポートページにアクセス
2. 期間を「今月」に選択
3. 施設別利用統計が表示されることを確認
4. ユーザー別活動ログが表示されることを確認
5. シフト生成統計が表示されることを確認
6. CSVエクスポートが実行できることを確認
7. PDFエクスポートが実行できることを確認

### 6.3 Cloud Function テスト

**手動テスト**:
```bash
# Emulatorで実行
firebase emulators:start --only functions

# 別ターミナルから手動実行
curl -X POST \
  http://localhost:5001/ai-care-shift-scheduler/us-central1/generateMonthlyReport \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -d '{}'
```

### 6.4 E2Eテスト（オプション）

**Playwright シナリオ**:
```typescript
test('Usage Reports - Full Flow', async ({ page }) => {
  // 管理画面にログイン
  await loginAsSuperAdmin(page);

  // 使用状況レポートページに移動
  await page.goto('/admin/usage-reports');

  // 統計データが表示されることを確認
  await expect(page.locator('text=施設別利用統計')).toBeVisible();
  await expect(page.locator('text=ユーザー別活動ログ')).toBeVisible();

  // グラフが描画されることを確認
  await expect(page.locator('canvas')).toBeVisible();

  // CSVエクスポート
  const downloadPromise = page.waitForEvent('download');
  await page.click('text=CSVエクスポート');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.csv');
});
```

---

## 7. コスト分析

### 7.1 Firestore読み取り

**月次レポート生成時**:
- 前月の監査ログ取得: 約10,000ドキュメント/月（施設10個、平均1,000アクション/施設）
- コスト: $0.036/10万ドキュメント = **$0.0036/月**

**フロントエンドでの統計表示**:
- 今月の監査ログ取得: 約3,000ドキュメント/月（頻度: 10回/月）
- コスト: $0.036/10万ドキュメント × 30,000 = **$0.0108/月**

**合計読み取りコスト**: **約$0.015/月**

### 7.2 Cloud Functions実行

**scheduledMonthlyReport**:
- 実行頻度: 1回/月
- 実行時間: 約30秒
- メモリ: 512MiB
- コスト: $0.0000025/GB秒 × 0.5GB × 30秒 = **$0.0000375/月**

**generateMonthlyReport（手動）**:
- 実行頻度: 2回/月（想定）
- コスト: $0.0000375 × 2 = **$0.000075/月**

**合計Function実行コスト**: **約$0.0001125/月**（無視できるレベル）

### 7.3 Firestore書き込み

**月次レポート保存**:
- 書き込み回数: 1回/月
- コスト: $0.18/10万ドキュメント = **$0.0000018/月**

### 7.4 Cloud Storage（レポートデータ）

**レポートデータサイズ**:
- 1レポート: 約100KB
- 12ヶ月分: 約1.2MB
- コスト: $0.026/GB/月 × 0.0012GB = **$0.00003/月**

### 7.5 総コスト見積もり

**Phase 19.3.3の月額コスト**: **約$0.016/月**（≒ ¥2.4/月）

**Phase 19全体の月額コスト**:
- Phase 19.3.1（エクスポート機能）: $0.02/月
- Phase 19.3.2（バックアップ・リストア）: $0.12/月
- Phase 19.3.3（使用状況レポート）: $0.016/月
- **合計**: **約$0.156/月**（≒ ¥23.4/月）

**結論**: Phase 19.3.3は非常にコスト効率が良い（ほぼゼロコスト）

---

## 8. 改善提案（Phase 19.3.3完了後）

### 優先度: 高

1. **リアルタイムアラート機能**
   - 閾値超過時の即時通知（Firebaseメッセージング）
   - 異常検知アルゴリズムの実装（統計的外れ値検出）

2. **レポートの自動メール送信**
   - 月次レポートをPDF添付でメール送信
   - SendGridまたはFirebase Extensions（Mailgun）の統合

### 優先度: 中

3. **予測分析機能**
   - 過去データから将来の使用量を予測
   - 機械学習モデルの統合（Vertex AI）

4. **カスタムダッシュボード**
   - ユーザーがウィジェットを配置できるダッシュボード
   - ドラッグ&ドロップUI

### 優先度: 低

5. **複数施設比較分析**
   - 施設間のベンチマーク
   - 業界標準との比較

---

## 9. 成功基準

### 9.1 機能要件

- ✅ 管理画面に使用状況レポートページが追加されている
- ✅ 施設別利用統計が正しく表示される
- ✅ ユーザー別活動ログが正しく表示される
- ✅ シフト生成統計（成功率、所要時間）が正しく表示される
- ✅ 期間選択機能が動作する
- ✅ CSVエクスポートが動作する
- ✅ PDFエクスポートが動作する
- ✅ グラフが正しく描画される（Line, Bar, Pie）
- ✅ Cloud Functionが月次レポートを自動生成する

### 9.2 非機能要件

- ✅ ページ読み込み時間が3秒以内（通常時）
- ✅ グラフ描画が1秒以内
- ✅ エクスポート処理が5秒以内
- ✅ モバイルデバイスでレスポンシブに表示される
- ✅ 型エラーゼロ（TypeScript）
- ✅ ビルドエラーゼロ
- ✅ Lighthouseスコア低下なし（Phase 19.1の成果を維持）

### 9.3 運用要件

- ✅ Cloud Functionが定期実行される（毎月1日午前9時）
- ✅ レポートデータがFirestoreに保存される
- ✅ エラーログが記録される
- ✅ コストが予算内（$0.02/月）

---

## 10. 参考資料

### 10.1 マスタープラン

- `phase19-plan-2025-11-13.md`: Phase 19全体計画
- Phase 19.3.3定義: L455-479

### 10.2 関連Phase

- Phase 19.3.1（エクスポート機能）: PDF生成実装を参考
- Phase 19.3.2（バックアップ・リストア）: Cloud Function実装パターンを参考

### 10.3 技術ドキュメント

- [Chart.js公式ドキュメント](https://www.chartjs.org/docs/)
- [react-chartjs-2 GitHub](https://github.com/reactchartjs/react-chartjs-2)
- [Firebase Cloud Scheduler](https://firebase.google.com/docs/functions/schedule-functions)
- [Firestore集計クエリ](https://firebase.google.com/docs/firestore/query-data/aggregation-queries)

### 10.4 既存実装

- `src/pages/admin/AuditLogs.tsx`: 監査ログ表示パターン
- `src/pages/admin/AdminDashboard.tsx`: ダッシュボードレイアウト
- `functions/src/backupFacilityData.ts`: Cloud Function実装パターン

---

## 11. タイムライン

**総推定工数**: 約2.5時間

| ステップ | 推定時間 | 累計時間 |
|---------|---------|---------|
| Step 1: パッケージインストール | 5分 | 5分 |
| Step 2: UsageChart.tsx | 30分 | 35分 |
| Step 3: UsageReports.tsx | 60分 | 95分 |
| Step 4: エクスポート機能 | 20分 | 115分 |
| Step 5: AdminDashboard.tsx更新 | 20分 | 135分 |
| Step 6: ルーティング更新 | 5分 | 140分 |
| Step 7: generateMonthlyReport.ts | 40分 | 180分 |
| Step 8: Firestore Rules更新 | 5分 | 185分 |
| Step 9: ビルド・デプロイ | 10分 | 195分 |
| Step 10: 動作確認・テスト | 20分 | 215分 |

**目標完了日時**: 2025-11-14（実装計画作成日）

---

## 12. チェックリスト

### 実装前

- [ ] phase19-plan-2025-11-13.md を確認
- [ ] Phase 19.3.2完了を確認
- [ ] 依存パッケージ（Chart.js, react-chartjs-2）をインストール
- [ ] 既存のAuditLogsコンポーネントを確認

### 実装中

- [ ] UsageChart.tsx 実装
- [ ] UsageReports.tsx 実装
- [ ] CSV/PDFエクスポート機能実装
- [ ] AdminDashboard.tsx 更新
- [ ] AdminLayout.tsx 更新
- [ ] index.tsx 更新
- [ ] generateMonthlyReport.ts 実装
- [ ] Firestore Security Rules 更新

### テスト

- [ ] 型チェック通過（`npm run type-check`）
- [ ] ビルド成功（`npm run build`）
- [ ] Emulatorで動作確認
- [ ] 統計データ表示確認
- [ ] グラフ描画確認
- [ ] CSV/PDFエクスポート確認
- [ ] Cloud Function手動実行テスト
- [ ] モバイルデバイスで表示確認

### デプロイ後

- [ ] 本番環境で動作確認
- [ ] Lighthouseスコア確認
- [ ] Cloud Schedulerの動作確認（翌月1日）
- [ ] 完了レポート作成（`phase19.3.3-completion-report-2025-11-14.md`）

---

## 13. 次のステップ（Phase 19.3.3完了後）

### 推奨: Phase 19完了宣言

**Phase 19全体の完了条件**:
- ✅ Phase 19.1.1~19.1.5（パフォーマンス監視と最適化）
- ✅ Phase 19.2.1~19.2.3（ユーザビリティ改善）
- ✅ Phase 19.3.1（エクスポート機能）
- ✅ Phase 19.3.1.1（日本語フォント対応）
- ✅ Phase 19.3.2（バックアップ・リストア機能）
- [ ] Phase 19.3.3（使用状況レポート機能）← 本Phase完了で全て達成

**完了レポート作成**:
- `phase19-complete-declaration-2025-11-14.md`
- Phase 19全体の成果、学び、統計情報をまとめる

### または: Phase 19.4（オプショナル）

**Phase 19.4: セキュリティ強化**（phase19-planには未定義、追加提案）
- 二要素認証（2FA）
- セッション管理強化
- IPホワイトリスト機能

**注**: Phase 19.4は phase19-plan に記載されていないため、ユーザーに確認が必要

---

## 付録A: Chart.jsチート シート

### 折れ線グラフ（日別アクション数推移）

```typescript
const lineChartData = {
  labels: ['11/01', '11/02', '11/03', ...],
  datasets: [
    {
      label: 'アクション数',
      data: [45, 52, 48, ...],
      borderColor: 'rgb(59, 130, 246)', // Tailwind blue-500
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.3, // 曲線
    },
  ],
};

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top' },
    title: { display: true, text: '日別アクション数推移' },
  },
  scales: {
    y: { beginAtZero: true },
  },
};
```

### 棒グラフ（施設別アクション数比較）

```typescript
const barChartData = {
  labels: ['施設A', '施設B', '施設C', ...],
  datasets: [
    {
      label: 'アクション数',
      data: [120, 85, 95, ...],
      backgroundColor: [
        'rgba(59, 130, 246, 0.6)',
        'rgba(16, 185, 129, 0.6)',
        'rgba(251, 146, 60, 0.6)',
      ],
    },
  ],
};

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: true, text: '施設別アクション数' },
  },
  scales: {
    y: { beginAtZero: true },
  },
};
```

### 円グラフ（アクション種別分布）

```typescript
const pieChartData = {
  labels: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'],
  datasets: [
    {
      data: [120, 85, 45, 200, 180],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(251, 146, 60, 0.8)',
        'rgba(168, 85, 247, 0.8)',
      ],
    },
  ],
};

const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'right' },
    title: { display: true, text: 'アクション種別分布' },
  },
};
```

---

## 付録B: Firestore クエリ最適化

### インデックス作成（推奨）

```javascript
// Firestore Console → Indexes で作成
{
  collectionGroup: 'auditLogs',
  fields: [
    { fieldPath: 'timestamp', order: 'DESCENDING' },
    { fieldPath: 'facilityId', order: 'ASCENDING' },
  ],
}

{
  collectionGroup: 'auditLogs',
  fields: [
    { fieldPath: 'timestamp', order: 'DESCENDING' },
    { fieldPath: 'action', order: 'ASCENDING' },
    { fieldPath: 'resourceType', order: 'ASCENDING' },
  ],
}
```

### ページネーション実装

```typescript
// 最初のページ
const firstQuery = db.collection('auditLogs')
  .where('timestamp', '>=', startDate)
  .orderBy('timestamp', 'desc')
  .limit(50);

// 次のページ
const lastVisible = firstSnapshot.docs[firstSnapshot.docs.length - 1];
const nextQuery = db.collection('auditLogs')
  .where('timestamp', '>=', startDate)
  .orderBy('timestamp', 'desc')
  .startAfter(lastVisible)
  .limit(50);
```

---

**実装計画作成者**: Claude (AI Assistant)
**レビュー待ち**: 人間のレビュー・承認が必要
**次のアクション**: ユーザーの承認後、実装開始
