# 既存E2Eテストパターン分析

**調査日**: 2025-11-01
**仕様ID**: auth-data-persistence
**Phase**: Phase 14 - 統合テストとE2Eテスト（準備資料）

---

## 概要

Phase 14（E2Eテスト）実装に先立ち、既存E2Eテストファイル（5ファイル、529行）のパターンとベストプラクティスを分析しました。本ドキュメントは、新規E2Eテスト作成時の参考資料です。

---

## 既存E2Eテストファイル一覧

| ファイル | 行数 | 対象機能 | テスト数 |
|---------|------|----------|---------|
| `e2e/app.spec.ts` | 65 | アプリ基本動作 | 5 |
| `e2e/staff-management.spec.ts` | 103 | スタッフ管理 | 6 |
| `e2e/shift-creation.spec.ts` | 100 | シフト作成 | 5 |
| `e2e/leave-request.spec.ts` | 102 | 休暇希望入力 | 6 |
| `e2e/ai-shift-generation.spec.ts` | 159 | AIシフト生成 | 複数 |
| **合計** | **529** | - | **22+** |

---

## 共通パターン

### 1. 基本構造

すべてのテストファイルで共通の構造:

```typescript
import { test, expect } from '@playwright/test';

test.describe('機能名', () => {
  test.beforeEach(async ({ page }) => {
    // 各テスト前の共通セットアップ
    await page.goto('/');
  });

  test('テストケース1', async ({ page }) => {
    // テスト実装
  });
});
```

### 2. セレクター戦略

既存テストでは3種類のセレクターを使用:

#### 推奨: `page.getByRole()` (アクセシビリティ重視)
```typescript
// ボタン
await page.getByRole('button', { name: 'シフト作成実行' }).click();

// セル（テーブル）
await expect(page.getByRole('cell', { name: '田中 愛' })).toBeVisible();

// ヘッディング
await expect(page.getByRole('heading', { name: 'AIシフト自動作成' })).toBeVisible();
```

**利点**:
- アクセシビリティ向上
- UIの内部構造変更に強い
- スクリーンリーダー対応と一致

#### 次善: `page.getByText()` (テキスト内容による検索)
```typescript
await page.getByText('スタッフ情報設定').click();
await expect(page.getByText('介護・福祉事業所向け')).toBeVisible();
```

**利点**:
- 簡潔で読みやすい
- ラベルやテキストベースのUI要素に最適

**欠点**:
- テキスト変更でテストが壊れる可能性

#### 最後の手段: `page.locator()` (CSSセレクター)
```typescript
const firstStaffCard = page.locator('.bg-white.rounded-lg.border').first();
const dateCell = page.locator('td').first();
```

**利点**:
- 細かい制御が可能
- 複雑な要素選択に対応

**欠点**:
- スタイル変更で壊れやすい
- 保守性が低い

### 3. 待機戦略

#### 推奨: `toBeVisible({ timeout: ... })`
```typescript
await expect(page.getByRole('cell', { name: '田中 愛' })).toBeVisible({ timeout: 5000 });
```

#### 非推奨だが使用中: `page.waitForTimeout()`
```typescript
await page.waitForTimeout(500);
```

**問題点**:
- 固定時間待機は不安定（環境による速度差）
- テスト実行時間の無駄

**今後の改善点**:
- `waitForSelector()`, `waitForLoadState()`などの動的待機に置き換え推奨

### 4. テストのスキップ

CI環境などで特定テストをスキップ:

```typescript
test.skip('対象月を変更できる', async ({ page }) => {
  // スキップされるテスト
});

// または条件付きスキップ
const shouldSkipAITests = process.env.CI === 'true';

test('AI生成の正常系UIフロー', async ({ page }) => {
  test.skip(shouldSkipAITests, 'CI環境ではスキップ');
  // テスト内容
});
```

---

## ファイル別の特徴と学び

### `e2e/app.spec.ts` - アプリケーション基本動作 (65行)

**目的**: アプリケーションの基本的なUI要素の表示確認

**テストケース**:
1. ページタイトル確認
2. ヘッダー表示確認
3. 左パネル（設定エリア）表示確認
4. 右パネル（シフト表示エリア）表示確認
5. 対象月表示確認
6. 初期スタッフ表示確認

**パターン**:
```typescript
// ページタイトル確認
await expect(page).toHaveTitle(/AIシフト自動作成/);

// 初期データ確認（アコーディオン展開後）
await page.getByText('スタッフ情報設定').click();
await expect(page.getByText('田中 愛')).toBeVisible();
```

**学び**:
- ✅ シンプルで明確
- ✅ 認証なしで実行可能
- ❌ 深いUI操作はテストしていない

---

### `e2e/staff-management.spec.ts` - スタッフ管理 (103行)

**目的**: スタッフCRUD操作のUIテスト

**テストケース**:
1. 新規スタッフ追加
2. スタッフ情報編集
3. 役職情報表示
4. 資格情報表示
5. 削除確認ダイアログ
6. 全スタッフ一覧表示

**パターン**:
```typescript
// カウント確認（追加前後の変化）
const initialStaffCount = await page.locator('.bg-white.rounded-lg.border').count();
await addButton.click();
const newStaffCount = await page.locator('.bg-white.rounded-lg.border').count();
expect(newStaffCount).toBe(initialStaffCount + 1);

// ダイアログ処理
page.on('dialog', async dialog => {
  expect(dialog.message()).toContain('新規スタッフ');
  await dialog.accept();
});

// カード展開
const firstStaffCard = page.locator('.bg-white.rounded-lg.border').first();
await firstStaffCard.click();
await expect(page.getByText('資格')).toBeVisible();
```

**学び**:
- ✅ CRUD操作の基本フロー確認
- ✅ ダイアログ処理パターン
- ❌ データ永続化（Firestore）は未確認
- ❌ ページリロード後の状態復元は未確認

---

### `e2e/shift-creation.spec.ts` - シフト作成 (100行)

**目的**: シフト作成機能とデモシフトのテスト

**テストケース**:
1. デモシフト生成
2. タブ切り替え
3. CSVエクスポート
4. 対象月変更（スキップ中）
5. AIシフト作成ボタン表示

**パターン**:
```typescript
// ダウンロードイベント
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'CSV形式でダウンロード' }).click();
const download = await downloadPromise;
expect(download.suggestedFilename()).toMatch(/shift_\d{4}-\d{2}\.csv/);

// タブ切り替え
await page.getByRole('button', { name: '休暇希望入力' }).click();
await page.waitForTimeout(500);
await expect(page.locator('table')).toBeVisible();
```

**学び**:
- ✅ ダウンロード機能テストパターン
- ✅ タブ切り替えの確認
- ❌ 実際のAI生成はコスト理由でスキップ
- ❌ バージョン管理（下書き・確定）は未確認

---

### `e2e/leave-request.spec.ts` - 休暇希望入力 (102行)

**目的**: 休暇希望カレンダーUIのテスト

**テストケース**:
1. カレンダー表示
2. 日付表示
3. 休暇希望入力
4. 初期データ表示
5. 月変更とカレンダー更新（スキップ中）
6. シフト表タブへの切り替え

**パターン**:
```typescript
// カレンダーグリッドのセル数確認
const allCells = page.locator('td');
const cellCount = await allCells.count();
expect(cellCount).toBeGreaterThan(100); // スタッフ5人 × 30日 = 150セル以上

// セルクリックでUI変更確認
const firstCell = page.locator('tbody tr').first().locator('td').nth(1);
await firstCell.click();

const hasDropdown = await page.locator('select, .dropdown, [role="menu"]').count() > 0;
const hasModal = await page.locator('.modal, [role="dialog"]').count() > 0;
expect(hasDropdown || hasModal).toBeTruthy();

// 初期データ確認（正規表現）
const leaveIndicators = tanakaRow.locator('td').filter({
  hasText: /有|有給|P|paid|休暇/
});
const count = await leaveIndicators.count();
expect(count).toBeGreaterThan(0);
```

**学び**:
- ✅ 柔軟な要素検出（複数パターン対応）
- ✅ 正規表現を使った柔軟なテキストマッチング
- ❌ 実際の保存・読み込みは未確認

---

### `e2e/ai-shift-generation.spec.ts` - AIシフト生成 (159行)

**目的**: AI自動シフト生成機能のE2Eテスト

**テストケース**:
- AI生成の正常系UIフロー
- エラーハンドリング
- ローディング状態表示
- 生成結果の表示確認

**パターン**:
```typescript
// 環境変数による条件分岐
const shouldSkipAITests = process.env.CI === 'true';

test('AI生成の正常系UIフロー', async ({ page }) => {
  test.skip(shouldSkipAITests, 'CI環境ではスキップ');

  const aiButton = page.getByRole('button', { name: 'シフト作成実行' });
  await expect(aiButton).toBeVisible();
  await aiButton.click();

  // ローディング状態確認
  const loadingMessage = page.getByText('AIがシフトを作成中...');
  await expect(loadingMessage).toBeVisible({ timeout: 2000 });
});
```

**学び**:
- ✅ 環境変数による条件分岐パターン
- ✅ ローディング状態の確認
- ❌ 実際のCloud Function呼び出しは未確認（コスト理由）

---

## Phase 14要件とのギャップ

既存E2Eテストは、Phase 14要件と以下のギャップがあります:

### ❌ 認証フロー (Phase 14.1) - **完全未実装**

**欠落している内容**:
- Google OAuthログインフロー
- 初回ユーザー登録とsuper-admin付与
- ログアウトと再ログイン
- 認証状態の永続化

**理由**:
既存テストはすべて認証なしで実行。ログインページの表示すら確認していない。

---

### ⚠️ データCRUD操作 (Phase 14.2) - **部分的実装**

**実装済み（UIレベルのみ）**:
- ✅ スタッフ管理UI操作
- ✅ シフト作成UI操作
- ✅ 休暇申請UI操作

**欠落している内容**:
- ❌ Firestoreへの実際の保存確認
- ❌ データ読み込み後の表示確認
- ❌ ページリロード後のデータ復元
- ❌ 要件設定のCRUDテスト

**理由**:
既存テストはUIの表示確認のみで、データ永続化層との統合を確認していない。

---

### ❌ RBAC権限チェック (Phase 14.3) - **完全未実装**

**欠落している内容**:
- super-adminの全権限テスト
- admin権限の施設管理とメンバー招待テスト
- editor権限のシフト作成・編集テスト
- viewer権限の閲覧のみテスト
- 権限なし操作の拒否テスト

**理由**:
認証が未実装のため、権限チェックも不可能。

---

### ❌ バージョン管理 (Phase 14.4) - **完全未実装**

**欠落している内容**:
- 下書き保存と確定
- バージョン履歴の作成と表示
- 過去バージョンへの復元
- バージョン履歴の不変性

**理由**:
バージョン管理機能のUIテストが存在しない。

---

### ❌ データ復元とリロード対応 (Phase 14.5) - **完全未実装**

**欠落している内容**:
- ページリロード後の認証状態復元
- 施設データの自動復元
- シフトデータの自動復元
- ローディング状態とエラーハンドリング

**理由**:
既存テストはすべて1ページ内で完結。リロード後の動作確認がない。

---

## 新規Phase 14テスト実装時の推奨パターン

### 1. 認証フローテスト (`e2e/auth-flow.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('認証フロー', () => {
  test('未認証状態でログインページにリダイレクト', async ({ page }) => {
    await page.goto('/');

    // ログインページに自動リダイレクト
    await expect(page).toHaveURL(/\/login/);

    // Googleログインボタン表示確認
    const loginButton = page.getByRole('button', { name: /Google.*ログイン/ });
    await expect(loginButton).toBeVisible();
  });

  test('初回ユーザーにsuper-admin権限が付与される', async ({ page }) => {
    // 実際のFirebase Authenticationを使用
    // テスト用アカウントでログイン（事前準備）

    await page.goto('/login');
    // ログイン処理（実装依存）

    // ダッシュボードにリダイレクト
    await expect(page).toHaveURL('/');

    // super-admin権限確認（管理者メニュー表示など）
    await expect(page.getByText('管理者メニュー')).toBeVisible();
  });
});
```

### 2. RBACテスト (`e2e/rbac-permissions.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('RBAC権限チェック', () => {
  test('super-adminは全画面アクセス可能', async ({ page }) => {
    // super-adminアカウントでログイン
    // ...

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'ユーザー管理' })).toBeVisible();

    await page.goto('/admin/facilities');
    await expect(page.getByRole('heading', { name: '施設管理' })).toBeVisible();
  });

  test('viewerは編集ボタンが表示されない', async ({ page }) => {
    // viewerアカウントでログイン
    // ...

    await page.goto('/');

    // シフト表は表示される
    await expect(page.getByRole('button', { name: 'デモシフト作成' })).toBeVisible();

    // 編集ボタンは表示されない
    const editButton = page.getByRole('button', { name: /編集|追加|削除/ });
    await expect(editButton).not.toBeVisible();
  });
});
```

### 3. データ復元テスト (`e2e/data-restoration.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('データ復元とリロード対応', () => {
  test('ページリロード後もログイン状態維持', async ({ page }) => {
    // ログイン
    await page.goto('/login');
    // ログイン処理

    await expect(page).toHaveURL('/');

    // ページリロード
    await page.reload();

    // ログイン状態維持（ログインページにリダイレクトされない）
    await expect(page).toHaveURL('/');
    await expect(page.getByText('ログアウト')).toBeVisible();
  });

  test('選択中の施設データが復元される', async ({ page }) => {
    // ログインして施設選択
    await page.goto('/');
    await page.getByRole('button', { name: '施設A' }).click();

    // 施設Aのデータ表示確認
    await expect(page.getByText('施設A')).toBeVisible();

    // ページリロード
    await page.reload();

    // 施設Aが再選択されている
    await expect(page.getByText('施設A')).toBeVisible();
  });
});
```

---

## テストデータ管理のベストプラクティス

### 問題: 既存テストは固定データに依存

現在のテストは初期データ（田中愛、鈴木太郎など）に依存しています。これは以下の問題があります:

- データ変更でテストが壊れる
- 並列実行時にデータ競合
- テスト後のクリーンアップが困難

### 推奨: 独立したテストデータ

Phase 14では以下のアプローチを推奨:

```typescript
test.describe('スタッフ管理 (Phase 14)', () => {
  let testFacilityId: string;
  let testUserId: string;

  test.beforeEach(async ({ page }) => {
    // テスト用施設・ユーザーを作成
    testFacilityId = await createTestFacility('E2E Test Facility');
    testUserId = await createTestUser('test@example.com', 'viewer');

    // ログイン
    await loginAsUser(page, testUserId);
  });

  test.afterEach(async () => {
    // テストデータクリーンアップ
    await deleteTestFacility(testFacilityId);
    await deleteTestUser(testUserId);
  });

  test('スタッフ追加が正常に動作', async ({ page }) => {
    // 独立したテストデータで実行
    // ...
  });
});
```

---

## CI/CD環境での考慮事項

### 現状: E2Eテストは無効化

`.github/workflows/ci.yml` (lines 63-84)でE2Eテストがコメントアウトされています:

```yaml
# E2Eテストは一時的に無効化（UIが頻繁に変更されるため）
# - name: Playwrightブラウザをインストール
#   run: npx playwright install --with-deps chromium
# - name: E2Eテスト実行
#   run: npm test
```

### 推奨: 段階的な再有効化

Phase 14実装後、以下の順序で再有効化:

1. **ローカルで全テスト成功を確認**
2. **CI環境でテスト用Firebase環境を用意**
   - 本番環境とは分離
   - テストデータの自動クリーンアップ
3. **段階的にテストを追加**
   - まず認証フローテスト
   - 次にRBACテスト
   - 最後にデータ復元テスト
4. **CI/CDワークフローのコメント解除**

---

## 待機戦略の改善提案

### 問題: `waitForTimeout()`の多用

既存テストでは固定時間待機が多用されています:

```typescript
await page.waitForTimeout(500);
```

### 推奨: 動的待機への置き換え

```typescript
// ❌ 固定時間待機（非推奨）
await page.waitForTimeout(500);
await expect(page.locator('table')).toBeVisible();

// ✅ 動的待機（推奨）
await expect(page.locator('table')).toBeVisible({ timeout: 5000 });

// ✅ より詳細な制御
await page.waitForLoadState('networkidle');
await page.waitForSelector('table', { state: 'visible' });
```

---

## まとめ

### ✅ 既存テストの強み

1. **基本的なUIフロー確認**: アプリの基本動作は網羅
2. **明確なテスト構造**: 各機能ごとにファイル分割
3. **アクセシビリティ重視**: `getByRole()`の使用
4. **ダウンロード機能テスト**: CSVエクスポートの確認パターン

### ❌ 既存テストの弱点（Phase 14で解決）

1. **認証なし**: すべてのテストが未認証で実行
2. **データ永続化未確認**: Firestoreとの統合が欠如
3. **RBAC未確認**: 権限による制御が未テスト
4. **リロード対応未確認**: 状態復元がテストされていない
5. **固定データ依存**: 独立したテストデータ管理が必要
6. **固定時間待機**: `waitForTimeout()`の多用

### 📋 Phase 14実装時の行動計画

1. **認証フローテスト作成** (`e2e/auth-flow.spec.ts`)
2. **RBACテスト作成** (`e2e/rbac-permissions.spec.ts`)
3. **データ復元テスト作成** (`e2e/data-restoration.spec.ts`)
4. **バージョン管理テスト作成** (`e2e/version-management.spec.ts`)
5. **既存テストの改善**:
   - 固定データ依存の解消
   - `waitForTimeout()`の置き換え
   - データ永続化確認の追加
6. **CI/CD再有効化**: `.github/workflows/ci.yml`更新

---

## 関連ドキュメント

- [phase14-status-2025-11-01.md](./phase14-status-2025-11-01.md) - Phase 14実装状況とギャップ分析
- [tasks.md](./../tasks.md) - Phase 14タスク詳細
- [playwright.config.ts](./../../playwright.config.ts) - Playwright設定
- [.github/workflows/ci.yml](./../../.github/workflows/ci.yml) - CI/CD設定

---

**作成日**: 2025-11-01
**目的**: Phase 14実装時の参考資料として既存E2Eテストパターンを体系化
**次のステップ**: Phase 14.1（認証フローテスト）実装開始
