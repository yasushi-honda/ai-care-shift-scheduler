# Phase 17実装計画: 本番環境最適化 + Firebase Auth Emulator導入

**作成日**: 2025-11-14
**Phase**: Phase 17
**前提条件**: Phase 2, 13, 14, 16完了

---

## 1. Phase 17の目的

Phase 14/16で作成した手動テストガイドの自動化と、残存する技術的負債の解消を行う。

**主な目標**:
1. **Firebase Auth Emulator導入**: E2Eテストの完全自動化
2. **staffServiceテストカバレッジ改善**: 66.07% → 80%以上
3. **監査ログアーカイブ機能実装**（オプション）: Firestoreコスト削減

---

## 2. Phase 17サブタスク

### Phase 17-1: Firebase Auth Emulator導入（優先度: 高）

**目的**: E2Eテストの完全自動化を可能にする

**現状の課題**:
- Phase 14.1（認証フロー）、14.3（RBAC）のE2Eテストがtest.skipされている
- 理由: Firebase Auth Emulator未導入のため、認証済み状態のテストが困難
- data-crud.spec.ts、version-management.spec.ts、data-restoration.spec.tsも同様にtest.skip

**実装内容**:

#### 1. Firebase Emulator Suite設定

**firebase.json更新**:
```json
{
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

**package.json更新**:
```json
{
  "scripts": {
    "emulators": "firebase emulators:start --only auth,firestore",
    "emulators:exec": "firebase emulators:exec --only auth,firestore",
    "test:e2e:emulator": "firebase emulators:exec --only auth,firestore 'playwright test'"
  }
}
```

#### 2. Playwright設定更新

**playwright.config.ts更新**:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Emulator使用時は並列実行を無効化
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Emulator使用時は1ワーカーのみ
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### 3. Emulator用テストヘルパー作成

**e2e/helpers/auth-emulator.ts**:
```typescript
import { Page } from '@playwright/test';

/**
 * Firebase Auth Emulatorにテストユーザーを作成
 */
export async function createEmulatorUser(params: {
  email: string;
  password: string;
  displayName: string;
  customClaims?: Record<string, unknown>;
}): Promise<string> {
  const response = await fetch('http://localhost:9099/emulator/v1/projects/ai-care-shift-scheduler/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      displayName: params.displayName,
      emailVerified: true,
    }),
  });

  const data = await response.json();

  // Custom Claimsを設定
  if (params.customClaims) {
    await setEmulatorCustomClaims(data.localId, params.customClaims);
  }

  return data.localId;
}

/**
 * Firebase Auth EmulatorのユーザーにCustom Claimsを設定
 */
export async function setEmulatorCustomClaims(
  uid: string,
  customClaims: Record<string, unknown>
): Promise<void> {
  await fetch(`http://localhost:9099/emulator/v1/projects/ai-care-shift-scheduler/accounts/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customAttributes: JSON.stringify(customClaims) }),
  });
}

/**
 * Emulator環境でログイン
 */
export async function loginWithEmulator(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/');

  // ログインボタンをクリック
  await page.getByRole('button', { name: 'ログイン' }).click();

  // Emulator環境では、Firebase UIではなく直接signInWithEmailAndPasswordを呼び出す
  await page.evaluate(async ({ email, password }) => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { auth } = await import('../firebase');
    await signInWithEmailAndPassword(auth, email, password);
  }, { email, password });

  // ログイン完了を待機
  await page.waitForURL('/');
}

/**
 * Emulator環境をクリーンアップ
 */
export async function clearEmulatorAuth(): Promise<void> {
  await fetch('http://localhost:9099/emulator/v1/projects/ai-care-shift-scheduler/accounts', {
    method: 'DELETE',
  });
}

/**
 * Emulator環境でテストユーザーを作成してログイン
 */
export async function setupAuthenticatedUser(
  page: Page,
  params: {
    email: string;
    password: string;
    displayName: string;
    role?: 'super-admin' | 'admin' | 'editor' | 'viewer';
  }
): Promise<string> {
  // Custom Claimsを設定
  const customClaims = params.role ? { role: params.role } : undefined;

  // ユーザー作成
  const uid = await createEmulatorUser({
    email: params.email,
    password: params.password,
    displayName: params.displayName,
    customClaims,
  });

  // ログイン
  await loginWithEmulator(page, params.email, params.password);

  return uid;
}
```

#### 4. test.skipを解除してテスト実装

**e2e/auth-flow.spec.ts更新**:
```typescript
import { test, expect } from '@playwright/test';
import { setupAuthenticatedUser, clearEmulatorAuth } from './helpers/auth-emulator';

test.describe('認証フロー（Emulator環境）', () => {
  test.beforeEach(async () => {
    // Emulator環境をクリーンアップ
    await clearEmulatorAuth();
  });

  test('初回ユーザー登録とsuper-admin付与', async ({ page }) => {
    // テストユーザーを作成してログイン
    await setupAuthenticatedUser(page, {
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
      role: 'super-admin',
    });

    // super-admin権限でログインできたことを確認
    await expect(page.getByText('管理画面')).toBeVisible();
  });

  // 他のtest.skipを解除してテスト実装
});
```

**推定所要時間**: 4-6時間

---

### Phase 17-2: staffServiceテストカバレッジ改善（優先度: 中）

**目的**: scheduleService.tsのテストカバレッジを66.07%から80%以上に改善

**現状**:
```
File              | % Stmts | % Branch | % Funcs | % Lines |
------------------|---------|----------|---------|---------|
scheduleService.ts|  66.07  |  47.22   | 100     |  65.91  |
```

**実装内容**:

#### 1. 既存テストの確認

**src/services/__tests__/scheduleService.test.ts確認**:
```bash
# 現在のテストケースを確認
cat src/services/__tests__/scheduleService.test.ts | grep "test('" -A 3
```

#### 2. 不足しているテストケースの特定

**カバレッジ詳細確認**:
```bash
npm run test:unit:coverage -- --reporter=verbose src/services/scheduleService.ts
```

#### 3. 追加テストケース実装

**追加すべきテストケース例**:
- getScheduleByMonthのエラーハンドリング
- getScheduleVersionsの境界値テスト
- restoreVersionの競合テスト
- deleteScheduleのFirestoreエラーテスト
- exportToCSVの大規模データテスト

**推定所要時間**: 2-3時間

---

### Phase 17-3: 監査ログアーカイブ機能実装（優先度: 低、オプション）

**目的**: 古い監査ログを自動アーカイブしてFirestoreコスト削減

**現状の問題**:
- 監査ログが無制限に蓄積
- 10,000件を超えるとセキュリティアラート生成のみ
- Firestore課金が増加
- 古いログの検索パフォーマンスが低下

**実装内容**:

#### 1. Cloud Storageバケット作成

```bash
# バケット作成
gsutil mb -p ai-care-shift-scheduler -l us-central1 gs://ai-care-shift-scheduler-archives

# バケットにライフサイクルポリシー設定（7年後に削除）
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 2555}
      }
    ]
  }
}
EOF
gsutil lifecycle set lifecycle.json gs://ai-care-shift-scheduler-archives
```

#### 2. Cloud Function実装

**functions/src/archiveAuditLogs.ts**:
```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Storage } from '@google-cloud/storage';

/**
 * 監査ログアーカイブ機能
 *
 * 月次で実行され、6ヶ月以上前の監査ログをCloud Storageにアーカイブ
 */
export const archiveAuditLogs = onSchedule({
  schedule: 'every month',
  timeZone: 'Asia/Tokyo',
  region: 'us-central1',
  memory: '512MiB',
}, async (event) => {
  const db = getFirestore();
  const storage = new Storage();
  const bucketName = 'ai-care-shift-scheduler-archives';

  // 6ヶ月前の日付を計算
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoffTimestamp = Timestamp.fromDate(sixMonthsAgo);

  console.log(`Archiving logs older than ${sixMonthsAgo.toISOString()}`);

  let archivedCount = 0;
  let hasMore = true;
  const batchSize = 500;

  while (hasMore) {
    // 古いログを取得（バッチサイズ500）
    const oldLogsQuery = db.collection('auditLogs')
      .where('timestamp', '<', cutoffTimestamp)
      .orderBy('timestamp', 'asc')
      .limit(batchSize);

    const snapshot = await oldLogsQuery.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    // JSON Linesフォーマットでエクスポート
    const lines = snapshot.docs.map(doc =>
      JSON.stringify({ id: doc.id, ...doc.data() })
    );

    // ファイル名: auditLogs/YYYY/MM/archive-timestamp.jsonl
    const year = sixMonthsAgo.getFullYear();
    const month = String(sixMonthsAgo.getMonth() + 1).padStart(2, '0');
    const fileName = `auditLogs/${year}/${month}/archive-${Date.now()}.jsonl`;

    // Cloud Storageにアップロード
    await storage.bucket(bucketName)
      .file(fileName)
      .save(lines.join('\n'), {
        metadata: {
          contentType: 'application/x-ndjson',
          metadata: {
            archivedAt: new Date().toISOString(),
            cutoffDate: sixMonthsAgo.toISOString(),
            documentCount: snapshot.size.toString(),
          },
        },
      });

    console.log(`Archived ${snapshot.size} logs to ${fileName}`);

    // Firestoreから削除
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    archivedCount += snapshot.size;

    // バッチサイズより少ない場合は最後のバッチ
    if (snapshot.size < batchSize) {
      hasMore = false;
    }
  }

  console.log(`Total archived: ${archivedCount} logs`);

  return { archivedCount };
});
```

#### 3. デプロイ

```bash
# Functionデプロイ
firebase deploy --only functions:archiveAuditLogs

# 初回手動実行（テスト）
gcloud functions call archiveAuditLogs \
  --region=us-central1 \
  --project=ai-care-shift-scheduler
```

**推定所要時間**: 3-4時間

---

## 3. Phase 17実施手順

### ステップ1: Phase 17-1実施（Firebase Auth Emulator導入）

1. **firebase.json更新**
   - emulators設定を追加

2. **package.json更新**
   - emulators関連スクリプトを追加

3. **playwright.config.ts更新**
   - Emulator環境用の設定を追加

4. **e2e/helpers/auth-emulator.ts作成**
   - Emulator用ヘルパー関数を実装

5. **test.skip解除**
   - auth-flow.spec.ts
   - rbac-permissions.spec.ts
   - data-crud.spec.ts

6. **ローカルテスト実行**
   ```bash
   npm run test:e2e:emulator
   ```

**所要時間**: 4-6時間

### ステップ2: Phase 17-2実施（staffServiceテストカバレッジ改善）

1. **現状カバレッジ確認**
   ```bash
   npm run test:unit:coverage
   ```

2. **不足テストケース特定**
   - カバレッジレポートを確認
   - 未カバーの分岐を特定

3. **テストケース追加**
   - scheduleService.test.tsに追加

4. **カバレッジ確認**
   ```bash
   npm run test:unit:coverage
   ```
   - 目標: 80%以上

**所要時間**: 2-3時間

### ステップ3: Phase 17-3実施（監査ログアーカイブ機能）（オプション）

1. **Cloud Storageバケット作成**
   ```bash
   gsutil mb gs://ai-care-shift-scheduler-archives
   ```

2. **functions/src/archiveAuditLogs.ts作成**

3. **ローカルテスト**
   - Emulator環境でテスト

4. **デプロイ**
   ```bash
   firebase deploy --only functions:archiveAuditLogs
   ```

5. **初回手動実行**
   ```bash
   gcloud functions call archiveAuditLogs
   ```

**所要時間**: 3-4時間

**Phase 17-1～17-3合計所要時間**: 9-13時間（17-3はオプション）

---

## 4. 検証チェックリスト

### Phase 17-1: Firebase Auth Emulator導入
- [ ] firebase.json更新完了
- [ ] package.json更新完了
- [ ] playwright.config.ts更新完了
- [ ] e2e/helpers/auth-emulator.ts作成完了
- [ ] auth-flow.spec.tsのtest.skip解除・テスト実装完了
- [ ] rbac-permissions.spec.tsのtest.skip解除・テスト実装完了
- [ ] data-crud.spec.tsのtest.skip解除・テスト実装完了
- [ ] `npm run test:e2e:emulator`が成功

### Phase 17-2: staffServiceテストカバレッジ改善
- [ ] 現状カバレッジ確認完了
- [ ] 不足テストケース特定完了
- [ ] テストケース追加完了
- [ ] カバレッジ80%以上達成
- [ ] `npm run test:unit`が成功

### Phase 17-3: 監査ログアーカイブ機能（オプション）
- [ ] Cloud Storageバケット作成完了
- [ ] archiveAuditLogs.ts実装完了
- [ ] ローカルテスト成功
- [ ] Functionデプロイ成功
- [ ] 初回手動実行成功
- [ ] アーカイブされたファイルをCloud Storageで確認

---

## 5. 期待される成果

### Phase 17完了後の状態
1. ✅ Firebase Auth Emulator導入によりE2Eテストが完全自動化
2. ✅ test.skipが解除され、CI/CDでE2Eテストが実行可能
3. ✅ staffServiceテストカバレッジが80%以上に改善
4. ✅ 監査ログアーカイブ機能により Firestoreコストが削減（オプション）

### 技術的負債の状態
- ✅ **Firebase Auth Emulator未導入**: Phase 17-1で解消
- ✅ **scheduleServiceの低カバレッジ**: Phase 17-2で解消
- ✅ **監査ログの無制限蓄積**: Phase 17-3で解消（オプション）

### 次のステップ候補
- **Phase 18: パフォーマンス最適化** - React.memo、useMemo、useCallback追加
- **Phase 19: 追加機能開発** - 新規要件に基づく機能追加

---

## 6. トラブルシューティング

### 問題1: Firebase Auth Emulatorが起動しない

**症状**: `firebase emulators:start`でエラー

**原因**: ポート9099が既に使用されている

**対処**:
```bash
# ポート使用状況確認
lsof -i :9099

# プロセスを終了
kill -9 <PID>
```

### 問題2: Emulatorでログインできない

**症状**: loginWithEmulator関数でエラー

**原因**: Firebase SDKがEmulatorに接続していない

**対処**:
```typescript
// firebase.ts でEmulatorに接続
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

### 問題3: archiveAuditLogsでメモリ不足

**症状**: Cloud Function実行時にメモリエラー

**原因**: バッチサイズが大きすぎる

**対処**:
```typescript
// バッチサイズを500から250に削減
const batchSize = 250;

// またはメモリ割り当てを増やす
export const archiveAuditLogs = onSchedule({
  // ...
  memory: '1GiB', // 512MiBから1GiBに増やす
}, async (event) => {
  // ...
});
```

---

## 7. 関連ドキュメント

### Phase 14/16関連
- [phase14-phase2-13-manual-test-guide-2025-11-14.md](./phase14-phase2-13-manual-test-guide-2025-11-14.md)
- [phase14-phase16-integration-summary-2025-11-14.md](./phase14-phase16-integration-summary-2025-11-14.md)
- [phase16-summary-2025-11-14.md](./phase16-summary-2025-11-14.md)

### Phase 2関連
- [phase2-completion-summary-2025-11-14.md](./phase2-completion-summary-2025-11-14.md)

### Phase 13関連
- [phase13-completion-summary-2025-11-01.md](./phase13-completion-summary-2025-11-01.md)

### メモリ
- phase13_next_steps
- phase14_progress_final_20251102
- phase14_e2e_test_patterns

---

**作成日**: 2025-11-14
**作成者**: Claude Code AI
**Phase 17推定所要時間**: 9-13時間（Phase 17-3はオプション）
