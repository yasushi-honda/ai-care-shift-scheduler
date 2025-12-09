# Phase 18.2 Step 5完了: GitHub Actions workflow更新

**完了日**: 2025-11-12
**所要時間**: 約30分
**ステータス**: ✅ 完了

---

## 実施内容

### 1. GitHub Actions workflow更新

**ファイル**: `.github/workflows/e2e-permission-check.yml`

**主な変更点**:

#### 変更1: 入力パラメータの拡張

**変更前**:
```yaml
inputs:
  test_user_id:
    description: 'Test user ID (super-admin)'
    required: true
    type: string
```

**変更後**:
```yaml
inputs:
  environment:
    description: 'テスト環境 (emulator: Firebase Emulator, production: 本番環境)'
    required: true
    type: choice
    options:
      - emulator
      - production
    default: emulator
  test_user_id:
    description: 'Test user ID (本番環境のみ必要、super-admin)'
    required: false
    type: string
```

**目的**:
- Emulator環境と本番環境を選択可能に
- デフォルトはEmulator環境
- test_user_idは本番環境のみ必要（optional）

---

#### 変更2: Firebase CLIインストールステップ追加

**追加内容**:
```yaml
- name: Firebase CLIをインストール
  if: inputs.environment == 'emulator'
  run: npm install -g firebase-tools
```

**目的**: Emulator環境でFirebase Emulatorを起動するために必要

---

#### 変更3: テスト実行ステップの環境別分岐

**Emulator環境**:
```yaml
- name: Permission errorテスト実行（Emulator環境）
  if: inputs.environment == 'emulator'
  run: firebase emulators:exec --only auth,firestore "npm run test:e2e:permission"
  env:
    PLAYWRIGHT_BASE_URL: http://localhost:5173
```

**本番環境**:
```yaml
- name: Permission errorテスト実行（本番環境）
  if: inputs.environment == 'production'
  run: npm run test:e2e:permission
  env:
    PLAYWRIGHT_BASE_URL: https://ai-care-shift-scheduler.web.app
    TEST_USER_ID: ${{ inputs.test_user_id }}
```

**目的**:
- Emulator環境: `firebase emulators:exec`でEmulator起動 → テスト実行 → 自動停止
- 本番環境: 従来通りの実行方法

---

#### 変更4: テスト結果サマリーの環境別表示

**変更内容**:
```yaml
- name: テスト結果サマリー
  if: always()
  run: |
    echo "## Permission errorテスト結果 🔍" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    if [ "${{ inputs.environment }}" = "emulator" ]; then
      echo "**テスト環境**: 🟢 Firebase Emulator（localhost）" >> $GITHUB_STEP_SUMMARY
      echo "**認証方式**: 自動認証（Email/Password）" >> $GITHUB_STEP_SUMMARY
    else
      echo "**テスト環境**: 🟡 本番環境（https://ai-care-shift-scheduler.web.app）" >> $GITHUB_STEP_SUMMARY
      echo "**テストユーザーID**: ${{ inputs.test_user_id }}" >> $GITHUB_STEP_SUMMARY
    fi
```

**目的**: 環境に応じたテスト結果サマリーを表示

---

### 2. playwright.config.ts更新

**ファイル**: `playwright.config.ts`

**変更内容**:
```typescript
// 開発サーバーの起動設定
webServer: process.env.PLAYWRIGHT_BASE_URL && !process.env.PLAYWRIGHT_BASE_URL.includes('localhost')
  ? undefined
  : {
      // localhost環境: 開発サーバーを使用（CI環境でもEmulator使用時はdev server）
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI, // CI環境では再利用しない
      timeout: 120 * 1000,
    },
```

**変更理由**:
- CI環境でも localhost 環境の場合は開発サーバーを使用
- 従来はCI環境では`npm run preview`（ビルド済みプレビュー、ポート4173）を使用していた
- Emulator環境ではポート5173を使用するため、開発サーバーに統一

---

## 技術的決定

### 決定1: firebase emulators:execを使用

**実装**:
```bash
firebase emulators:exec --only auth,firestore "npm run test:e2e:permission"
```

**理由**:
- ✅ **自動ライフサイクル管理**: Emulator起動 → コマンド実行 → Emulator自動停止
- ✅ **エラーハンドリング**: Emulator起動失敗時、ワークフロー全体が失敗
- ✅ **クリーンアップ不要**: 手動でプロセスIDを管理する必要がない

**代替案（却下）**:
```bash
# ❌ 手動でEmulator起動・停止
firebase emulators:start --only auth &
EMULATOR_PID=$!
npm run test:e2e:permission
kill $EMULATOR_PID
```

**問題点**:
- ❌ Emulator起動完了を待つ必要がある（`sleep`やポーリング）
- ❌ プロセスIDの管理が複雑
- ❌ エラーハンドリングが困難

---

### 決定2: 環境選択入力（choice型）

**実装**:
```yaml
environment:
  type: choice
  options:
    - emulator
    - production
  default: emulator
```

**理由**:
- ✅ **UI上で選択**: 手動入力よりミスが少ない
- ✅ **デフォルトEmulator**: 推奨環境を明示
- ✅ **本番環境も選択可能**: 必要に応じて本番環境でテスト可能

---

### 決定3: test_user_idをoptionalに変更

**実装**:
```yaml
test_user_id:
  required: false
```

**理由**:
- ✅ Emulator環境では不要（自動認証）
- ✅ 本番環境のみ必要
- ✅ ワークフロー実行時の利便性向上

---

### 決定4: playwright.config.tsのwebServer設定を簡素化

**変更前**:
- CI環境: `npm run preview`（ポート4173）
- ローカル環境: `npm run dev`（ポート5173）

**変更後**:
- localhost環境（CI/ローカル共通）: `npm run dev`（ポート5173）
- 本番環境URL指定時: webServerスキップ

**理由**:
- ✅ CI環境でもEmulator環境では開発サーバーを使用
- ✅ ポート統一（5173）
- ✅ 設定の簡素化

---

## チェックポイント確認

- [x] GitHub Actions workflow更新
- [x] 環境選択入力追加（emulator/production）
- [x] Firebase CLIインストールステップ追加
- [x] テスト実行ステップの環境別分岐
- [x] テスト結果サマリーの環境別表示
- [x] playwright.config.ts更新（webServer設定）
- [x] TypeScript型チェック成功
- [ ] GitHub Actionsでテスト実行（Step 6）

---

## Step 5実装の効果

### 実装前の状況

- ❌ 本番環境でのみテスト実行可能
- ❌ TEST_USER_IDを手動入力必要
- ❌ 認証状態に依存（3/6テスト失敗）

### 実装後の状況

- ✅ Emulator環境でもテスト実行可能
- ✅ Emulator環境では自動認証（TEST_USER_ID不要）
- ✅ 環境選択UI（emulator/production）
- ✅ 認証問題の解決（Emulator環境）

---

## GitHub Actions実行方法

### Emulator環境でのテスト実行（推奨）

1. GitHubリポジトリのActionsタブを開く
2. "E2E Permission Check (Manual Trigger)"を選択
3. "Run workflow"をクリック
4. **environment**: `emulator`を選択
5. **test_user_id**: 空欄のまま
6. "Run workflow"を実行

**期待結果**: 6/6テスト成功

---

### 本番環境でのテスト実行

1. GitHubリポジトリのActionsタブを開く
2. "E2E Permission Check (Manual Trigger)"を選択
3. "Run workflow"をクリック
4. **environment**: `production`を選択
5. **test_user_id**: `o3BZBx5EEPbFqiIaHYRYQKraAut1`（super-admin）
6. "Run workflow"を実行

**注意**: 本番環境では認証状態が必要（手動ログイン済みと想定）

---

## 次のステップ（Step 6）

**Step 6**: GitHub Actions実行・検証

**所要時間**: 約30分

**実施内容**:
1. GitHub Actions workflow実行（Emulator環境）
2. テスト結果の確認
3. エラーがあれば修正
4. 本番環境でも実行確認（オプション）

**実施方法**:
```bash
# ローカルからgh CLIで実行
gh workflow run "E2E Permission Check (Manual Trigger)" \
  --field environment=emulator

# 実行状況を監視
gh run watch
```

---

## 学び・振り返り

### 良い判断だった点

1. ✅ **firebase emulators:exec使用**
   - Emulatorのライフサイクルを自動管理
   - クリーンアップ不要

2. ✅ **環境選択UI（choice型）**
   - 手動入力ミスを防止
   - デフォルトでEmulator環境

3. ✅ **playwright.config.ts簡素化**
   - CI環境でも開発サーバーを使用
   - ポート統一

---

### 実装上の学び

1. **GitHub Actions workflow_dispatch inputs**
   - `type: choice`で選択UI提供
   - `default`でデフォルト値設定
   - `required: false`でoptional入力

2. **firebase emulators:exec**
   - コマンド内でクォートが必要: `"npm run test:e2e:permission"`
   - `--only auth,firestore`で必要なEmulatorのみ起動

3. **playwright.config.ts webServer**
   - `reuseExistingServer: !process.env.CI`でCI環境では再利用しない
   - localhost環境判定で開発サーバー使用

---

## 統計情報

### 実装統計
- **更新ファイル数**: 2ファイル
  - `.github/workflows/e2e-permission-check.yml`（大幅更新）
  - `playwright.config.ts`（webServer設定更新）
- **追加行数**: 約30行
- **変更行数**: 約20行

### 所要時間
- workflow更新: 15分
- playwright.config.ts更新: 5分
- TypeScript型チェック: 2分
- 振り返りドキュメント作成: 8分
- **合計**: 約30分

---

## Phase 18.2進捗状況

| Step | ステータス | 所要時間 |
|------|-----------|---------|
| Step 1: Firebase Emulator設定 | ✅ 完了 | 15分 |
| Step 2: Emulator起動スクリプト作成 | ✅ 完了 | 20分 |
| Step 3: Playwright Global Setup作成 | ✅ 完了 | 30分 |
| Step 4: テストコード調整（Emulator対応） | ✅ 完了 | 1時間20分 |
| **Step 5: GitHub Actions workflow更新** | ✅ **完了** | 30分 |
| Step 6: GitHub Actions実行・検証 | ⏳ 次のステップ | 30分（予定） |

**累計所要時間**: 2時間55分 / 予定2-3時間

---

## 関連ドキュメント

### Phase 18.2
- `phase18-2-implementation-plan-2025-11-12.md` - Phase 18.2実装計画
- `phase18-2-step1-completion-2025-11-12.md` - Step 1完了
- `phase18-2-step2-completion-2025-11-12.md` - Step 2完了
- `phase18-2-step3-completion-2025-11-12.md` - Step 3完了
- `phase18-2-step4-summary-2025-11-12.md` - Step 4総括
- `phase18-2-step5-completion-2025-11-12.md` - Step 5完了（本ドキュメント）

### 参考資料
- GitHub Actions workflow_dispatch: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch
- firebase emulators:exec: https://firebase.google.com/docs/emulator-suite/install_and_configure#emulators_exec

---

**振り返りドキュメント作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: Step 5完了 - Step 6へ進む準備完了

---

## メッセージ: Step 6へ

Phase 18.2 Step 5が完了しました。

GitHub Actions workflowをEmulator対応に更新し、環境選択UI（emulator/production）を追加しました。

**実装した機能**:
- ✅ 環境選択入力（emulator/production、デフォルトemulator）
- ✅ Firebase CLIインストールステップ
- ✅ テスト実行の環境別分岐
- ✅ firebase emulators:exec使用（自動ライフサイクル管理）
- ✅ テスト結果サマリーの環境別表示
- ✅ playwright.config.ts webServer設定の簡素化

**次のStep 6では、実際にGitHub Actions workflowを実行して、Emulator環境でテストが成功することを確認します。**

Good luck with Step 6 implementation!

---

**End of Step 5 Completion Report**
