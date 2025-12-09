# Phase 18.1: Permission error自動検出E2Eテスト - 段階的実装計画

**作成日**: 2025-11-12
**対象読者**: 実装者、将来のAIセッション
**実装方針**: ドキュメントドリブン・段階的実装
**予想所要時間**: 3-4時間

---

## 実装方針

**段階的実装 + 各ステップで振り返りドキュメント作成**

各ステップで以下を実施：
1. 実装
2. TypeScript型チェック
3. CodeRabbitレビュー
4. コミット・デプロイ
5. 振り返りドキュメント作成

---

## Phase 18.1の目的（再確認）

**Phase 17で発見された5つのPermission errorの80-90%をデプロイ前に自動検出**

Phase 17で9時間以上費やしたPermission error修正を、E2Eテストで事前に検出することで、同じ失敗を繰り返さない。

---

## 実装ステップ

### Step 1: ConsoleMonitor helper実装

**目的**: ブラウザコンソールのエラーメッセージを監視・検出

**実装ファイル**:
- `e2e/helpers/console-monitor.ts`

**実装内容**:
```typescript
export class ConsoleMonitor {
  private consoleMessages: ConsoleMessage[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupListeners();
  }

  private setupListeners() {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
      });
    });
  }

  hasPermissionError(): ConsoleMessage | null {
    for (const msg of this.consoleMessages) {
      if (msg.type !== 'error' && msg.type !== 'warning') continue;
      for (const pattern of PERMISSION_ERROR_PATTERNS) {
        if (pattern.test(msg.text)) return msg;
      }
    }
    return null;
  }
}
```

**チェックポイント**:
- [ ] TypeScript型定義が正確
- [ ] Permission errorパターンが網羅的
- [ ] TypeScript型チェック成功
- [ ] CodeRabbitレビュー完了

**振り返りドキュメント**: `phase18-1-step1-completion-2025-11-12.md`

**所要時間**: 約30-45分

---

### Step 2: Permission error検出テスト実装

**目的**: Phase 17で発生した5つのPermission errorを検出するテスト

**実装ファイル**:
- `e2e/permission-errors.spec.ts`

**実装内容**:
```typescript
test.describe('Permission error自動検出', () => {
  let monitor: ConsoleMonitor;

  test.beforeEach(async ({ page }) => {
    monitor = new ConsoleMonitor(page);
    // super-adminでログイン
    await loginAsSuperAdmin(page);
  });

  test('ユーザー詳細ページでPermission errorが発生しない', async ({ page }) => {
    await page.goto('/admin/users/test-user-id');
    await expect(page.getByText(/ユーザー詳細/i)).toBeVisible();

    const error = monitor.hasPermissionError();
    expect(error, `Permission error detected: ${error?.text}`).toBeNull();
  });

  // 他の4テストケース...
});
```

**テストケース**（Phase 17の実例ベース）:
1. ✅ ユーザー詳細ページ（Phase 17.9）
2. ✅ セキュリティアラートページ（Phase 17.11）
3. ✅ バージョン履歴表示（Phase 17.5）
4. ✅ ユーザー一覧ページ（Phase 17.8）
5. ✅ ログイン直後の認証トークン初期化（Phase 17.8）

**チェックポイント**:
- [ ] 5つのテストケース実装
- [ ] ConsoleMonitor統合
- [ ] エラーメッセージが明確
- [ ] TypeScript型チェック成功
- [ ] CodeRabbitレビュー完了

**振り返りドキュメント**: `phase18-1-step2-completion-2025-11-12.md`

**所要時間**: 約1-1.5時間

---

### Step 3: package.json + GitHub Actions workflow作成

**目的**: テスト実行スクリプトとCI/CD統合

**実装ファイル**:
- `package.json` - スクリプト追加
- `.github/workflows/e2e-permission-check.yml` - 手動トリガーworkflow

**package.json**:
```json
{
  "scripts": {
    "test:e2e:permission": "playwright test e2e/permission-errors.spec.ts"
  }
}
```

**GitHub Actions workflow**:
```yaml
name: E2E Permission Check (Manual Trigger)

on:
  workflow_dispatch:
    inputs:
      test_user_id:
        description: 'Test user ID (super-admin)'
        required: true
        type: string

jobs:
  e2e-permission-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:e2e:permission
        env:
          PLAYWRIGHT_BASE_URL: https://ai-care-shift-scheduler.web.app
          TEST_USER_ID: ${{ inputs.test_user_id }}
```

**チェックポイント**:
- [ ] スクリプトが動作
- [ ] GitHub Actions workflowが有効
- [ ] 環境変数が正しく設定
- [ ] TypeScript型チェック成功（package.json影響なし）
- [ ] CodeRabbitレビュー完了

**振り返りドキュメント**: `phase18-1-step3-completion-2025-11-12.md`

**所要時間**: 約30-45分

---

### Step 4: ローカル動作確認

**目的**: 実装したテストをローカル環境で実行・検証

**実行手順**:
```bash
# 1. 環境変数設定
export PLAYWRIGHT_BASE_URL=https://ai-care-shift-scheduler.web.app
export TEST_USER_ID=<Firebase ConsoleでコピーしたUID>

# 2. テスト実行
npm run test:e2e:permission

# 3. 結果確認
# → 5つのテストがすべて成功することを確認
```

**期待される結果**:
```
Running 5 tests using 1 worker

  ✓ 1 ユーザー詳細ページでPermission errorが発生しない (3s)
  ✓ 2 セキュリティアラートページでPermission errorが発生しない (2s)
  ✓ 3 バージョン履歴表示でPermission errorが発生しない (2s)
  ✓ 4 ユーザー一覧ページでPermission errorが発生しない (3s)
  ✓ 5 ログイン直後にPermission errorが発生しない (4s)

  5 passed (14s)
```

**トラブルシューティング**:
- 参照: `phase18-troubleshooting.md`

**チェックポイント**:
- [ ] 5つのテストがすべて成功
- [ ] Permission errorが検出されない（正常動作）
- [ ] エラーメッセージが明確（テスト失敗時）
- [ ] テスト実行時間が妥当（15秒以内）

**振り返りドキュメント**: `phase18-1-step4-completion-2025-11-12.md`

**所要時間**: 約30-45分

---

### Step 5: GitHub Actions手動トリガーテスト

**目的**: CI/CD環境でテストが動作することを確認

**実行手順**:
1. GitHub → Actions → "E2E Permission Check (Manual Trigger)"
2. "Run workflow" クリック
3. `test_user_id` に super-admin UID を入力
4. "Run workflow" 実行
5. 結果確認（約2-3分）

**期待される結果**:
- ✅ ビルド成功
- ✅ テスト実行成功（5つすべて成功）
- ✅ アーティファクト保存（playwright-report）

**チェックポイント**:
- [ ] GitHub Actionsが成功
- [ ] テスト結果が確認できる
- [ ] エラー時のレポートが生成される

**振り返りドキュメント**: `phase18-1-completion-2025-11-12.md`（最終完了レポート）

**所要時間**: 約15-30分

---

## Phase 18.1完了基準

すべてのステップが完了し、以下の基準を満たすこと：

1. ✅ **実装完了**
   - ConsoleMonitor helper実装
   - 5つのテストケース実装
   - package.json スクリプト追加
   - GitHub Actions workflow作成

2. ✅ **動作確認完了**
   - ローカル環境でテスト成功（5/5）
   - GitHub Actions手動トリガーでテスト成功（5/5）

3. ✅ **品質保証完了**
   - TypeScript型チェック成功（各ステップ）
   - CodeRabbitレビュー完了（各ステップ）
   - 振り返りドキュメント作成（各ステップ + 最終）

4. ✅ **ドキュメント完了**
   - 各ステップの振り返りドキュメント（5件）
   - Phase 18.1完了レポート（1件）
   - 次のセッション引き継ぎメモ更新（1件）

---

## タイムライン（予定）

```
13:45 - 14:15: Step 1 - ConsoleMonitor実装
14:15 - 15:45: Step 2 - Permission errorテスト実装
15:45 - 16:30: Step 3 - package.json + GitHub Actions
16:30 - 17:15: Step 4 - ローカル動作確認
17:15 - 17:45: Step 5 - GitHub Actions手動トリガーテスト
17:45 - 18:00: Phase 18.1完了レポート作成
```

**総所要時間**: 約3-4時間

---

## リスク管理

### リスク1: ローカルテストでPermission error検出

**発生確率**: 中（30%）

**原因**: 既存のSecurity Rulesに不備がある可能性

**対処**:
1. エラーメッセージを確認
2. `firestore.rules` で該当コレクションを修正
3. デプロイ
4. 再テスト

**想定追加時間**: 30分-1時間

---

### リスク2: GitHub Actionsで認証エラー

**発生確率**: 低（10%）

**原因**: 認証状態がCI/CDに保存されていない

**対処**:
- 手動トリガー（workflow_dispatch）のみで実行
- 自動実行は今回実装しない（Phase 19以降で検討）

**想定追加時間**: 0分（設計済み）

---

### リスク3: Playwrightのタイムアウト

**発生確率**: 低（15%）

**原因**: ページ読み込みが遅い、要素が見つからない

**対処**:
1. タイムアウト時間を延長（60秒）
2. 要素の待機条件を明示的に指定
3. `--headed` モードでデバッグ

**想定追加時間**: 30分

---

## 次のステップ（Phase 18.1完了後）

Phase 18.1完了後の選択肢：

**オプション1**: Phase 18.2実装（推奨）
- Google Cloud Monitoring設定
- 所要時間: 1-2時間

**オプション2**: 振り返りと休憩
- Phase 18.1の振り返りドキュメントを確認
- 次のセッションで続行

**オプション3**: 他のタスクに進む
- ビジネス要件に応じて優先順位を変更

---

## 関連ドキュメント

### Phase 18計画
- `phase18-README.md` - ドキュメント索引
- `phase18-requirements.md` - 要件定義
- `phase18-design.md` - 技術設計
- `phase18-implementation-guide.md` - 実装ガイド（詳細版）
- `phase18-test-manual.md` - テスト実行マニュアル
- `phase18-troubleshooting.md` - トラブルシューティング

### Phase 17振り返り
- `phase17-summary-2025-11-12.md` - Phase 17総括レポート
- `phase17-18-context.md` - Phase 17の経緯と教訓

### 引き継ぎ
- `handover-to-next-session-2025-11-12.md` - 次のセッション引き継ぎメモ

---

**計画作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: 準備完了 - Step 1から開始可能

---

## メッセージ: 実装開始前に

Phase 18.1は、Phase 17の教訓を活かした重要な実装です。

段階的に進めることで：
- ✅ 各ステップで確実に動作確認
- ✅ 問題が発生しても影響範囲を限定
- ✅ 振り返りドキュメントで知見を蓄積

**焦らず、一歩ずつ確実に進めましょう。**

Good luck with Phase 18.1 implementation!

---

**End of Phase 18.1 Implementation Plan**
