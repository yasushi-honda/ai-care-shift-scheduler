# E2Eテストアーキテクチャ改善計画

**作成日**: 2025-12-29
**ステータス**: 計画中
**優先度**: 高

---

## 1. 現状分析

### 1.1 テスト実行結果（2025-12-29）

| 環境 | 実行テスト | 成功 | 失敗 | スキップ |
|------|-----------|------|------|---------|
| CI/CD (GitHub Actions) | app.spec.ts (3件) | 3 | 0 | 0 |
| ローカル Emulator | 全テスト (182件) | 20 | 81 | 81 |

### 1.2 失敗原因の分類

| 原因 | 件数 | 例 |
|------|------|-----|
| テストデータ不足 | ~70 | スタッフ「田中 愛」が存在しない |
| タイムアウト | ~10 | 要素が見つからず30秒超過 |
| Playwright設定問題 | 1 | test.use()のdescribe内使用 |

### 1.3 アーキテクチャ上の問題点

```
問題1: テストデータアーキテクチャの欠如
┌─────────────────────────────────────────────────────┐
│ global-setup.ts                                     │
│ ├── Firebase Admin SDK初期化 ✅                    │
│ ├── Auth Emulator接続 ✅                           │
│ └── テストデータ投入 ❌ ← ここが欠落              │
└─────────────────────────────────────────────────────┘

問題2: テストの本番データ依存
┌─────────────────────────────────────────────────────┐
│ staff-management.spec.ts:50-57                      │
│ // 特定のスタッフ名をハードコード                   │
│ const tanakaCard = page.locator(...).filter({       │
│   hasText: '田中 愛'  ← 本番データに依存           │
│ });                                                 │
└─────────────────────────────────────────────────────┘

問題3: 環境分離の不完全さ
┌─────────────────────────────────────────────────────┐
│ CI/CD: app.spec.tsのみ実行（問題回避）             │
│ ローカル: 全テスト実行（失敗多発）                 │
│ 本番: テストなし（手動確認のみ）                   │
└─────────────────────────────────────────────────────┘
```

---

## 2. 改善目標

### 2.1 短期目標（1週間）
- [ ] E2Eテストフィクスチャの作成
- [ ] ローカルで全テストが成功する状態
- [ ] 修正をコミット・push

### 2.2 中期目標（1ヶ月）
- [ ] CI/CDで主要テストを実行
- [ ] テストカテゴリの分離（スモーク/統合/E2E）

### 2.3 長期目標（3ヶ月）
- [ ] テストカバレッジ80%以上
- [ ] 全テストのCI/CD自動実行

---

## 3. 改善戦略

### 3.1 Phase 1: テストフィクスチャの作成（即効性）

**アプローチ**: seedDemoData.tsの構造を流用し、Emulator用フィクスチャを作成

```
e2e/
├── fixtures/
│   ├── index.ts                    # フィクスチャエントリポイント
│   ├── test-facility.ts            # テスト用施設データ
│   ├── test-staff.ts               # テスト用スタッフデータ
│   ├── test-shift-requirements.ts  # シフト要件データ
│   └── test-leave-requests.ts      # 休暇申請データ
├── helpers/
│   ├── auth-helper.ts              # 既存
│   └── data-helper.ts              # 新規：データセットアップ
└── global-setup.ts                 # 修正：フィクスチャ投入追加
```

**データ設計**:

| データ種別 | 件数 | 内容 |
|-----------|------|------|
| 施設 | 1 | test-facility-001 |
| スタッフ | 8 | 田中太郎、佐藤花子など（デモデータと同一） |
| シフト要件 | 3 | 早番・日勤・遅番 |
| 休暇申請 | 4 | テスト用 |

### 3.2 Phase 2: テスト修正（持続可能性）

**修正パターン**:

```typescript
// Before: 本番データ依存
const tanakaCard = page.locator(...).filter({ hasText: '田中 愛' });

// After: テストフィクスチャ参照
import { TEST_STAFF } from '../fixtures/test-staff';
const staffCard = page.locator(...).filter({ hasText: TEST_STAFF[0].name });
```

### 3.3 Phase 3: CI/CD拡張（自動化）

```yaml
# .github/workflows/ci.yml 修正案
e2e-test:
  steps:
    - name: テストフィクスチャ投入
      run: |
        firebase emulators:exec --only auth,firestore \
          "npx tsx e2e/fixtures/seed-test-data.ts"

    - name: E2Eテスト実行
      run: |
        npx playwright test --reporter=github
```

---

## 4. 実装タスク

### 4.1 Phase 1 タスク（優先度：高）

| # | タスク | 工数 | 依存 |
|---|--------|------|------|
| 1.1 | e2e/fixtures/test-staff.ts 作成 | 30分 | - |
| 1.2 | e2e/fixtures/test-facility.ts 作成 | 15分 | - |
| 1.3 | e2e/fixtures/test-shift-requirements.ts 作成 | 20分 | - |
| 1.4 | e2e/fixtures/index.ts 作成 | 15分 | 1.1-1.3 |
| 1.5 | e2e/helpers/data-helper.ts 作成 | 45分 | 1.4 |
| 1.6 | e2e/global-setup.ts 修正 | 30分 | 1.5 |
| 1.7 | double-click-shift.spec.ts 修正 | 10分 | - |
| 1.8 | ローカルテスト実行・検証 | 30分 | 1.1-1.7 |

**合計工数**: 約3時間

### 4.2 Phase 2 タスク（優先度：中）

| # | タスク | 工数 |
|---|--------|------|
| 2.1 | staff-management.spec.ts 修正 | 30分 |
| 2.2 | shift-creation.spec.ts 修正 | 30分 |
| 2.3 | ai-evaluation-panel.spec.ts 修正 | 30分 |
| 2.4 | その他テストファイル修正 | 2時間 |

### 4.3 Phase 3 タスク（優先度：低）

| # | タスク | 工数 |
|---|--------|------|
| 3.1 | CI/CD設定修正 | 1時間 |
| 3.2 | テストカテゴリ分離 | 2時間 |

---

## 5. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Firestore Emulatorのデータ永続性 | テスト間でデータが残る | beforeEach/afterEachでクリーンアップ |
| テストの実行順序依存 | 並列実行時に失敗 | 各テストが独立したデータを使用 |
| CI/CD実行時間増加 | PR待ち時間増加 | テストを並列実行、カテゴリ分離 |

---

## 6. 成功基準

### Phase 1 完了基準
- [ ] `npm run test:e2e` でローカル全テスト成功率 > 90%
- [ ] 失敗テストが10件以下
- [ ] CI/CDが引き続き成功

### Phase 2 完了基準
- [ ] ローカル全テスト成功率 100%
- [ ] 全テストがテストフィクスチャを使用

### Phase 3 完了基準
- [ ] CI/CDで主要テスト（20件以上）が実行される
- [ ] テスト実行時間 < 5分

---

## 7. 参考資料

- [Phase 14 E2Eテストパターン](../memories/phase14_e2e_test_patterns)
- [デモデータテストガイド](../memories/demo_data_testing_guide)
- [Playwright公式ドキュメント](https://playwright.dev/docs/test-fixtures)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)

---

## 8. 変更履歴

| 日付 | 変更内容 | 担当 |
|------|---------|------|
| 2025-12-29 | 初版作成 | Claude Opus 4.5 |
