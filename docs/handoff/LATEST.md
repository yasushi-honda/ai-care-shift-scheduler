# ハンドオフメモ - 最新状態

**更新日**: 2026-02-19（Phase 61 administrative-compliance-ui 完了・PR #94 マージ済み）
**フェーズ**: LLM→Solver完全移行 **本番稼働中** ✅
**最新作業**: Phase 61 運営指導モード・月別書類管理（行政対応UI）を追加

---

## 現在地

### 最新の重要決定
- **LLM→Solver完全移行**: LLMコード完全削除、UI表記統一
  - Backend: LLM関連12ファイル削除（~2,300行）、Gemini SDK依存削除
  - Frontend: サービス・コンポーネントリネーム（AI→自動生成）、タイムアウト360s→60s
  - Firestore互換性維持: コレクション名・フィールド値は変更なし
- **ADR-0004**: CP-SAT Solver完全採用
  - 性能: 12名0.22s, 50名0.89s, 100名<30s
  - 決定的生成、LLMコスト100%削減

### Active Specifications

| Spec | Phase | Status |
|------|-------|--------|
| ai-shift-integration-test | - | ✅ 完了 |
| auth-data-persistence | 0-12.5 | ✅ 完了 |
| monthly-report-enhancement | 41 | ✅ 完了 |
| ui-design-improvement | 42 | ✅ 完了 |
| navigation-improvement | 42.1 | ✅ 完了 |
| demo-login | 42.2 | ✅ 完了 |
| demo-environment-improvements | 43 | ✅ 完了 |
| ai-evaluation-feedback | 44 | ✅ 完了 |
| ai-generation-progress | 45 | ✅ 完了 |
| constraint-level-evaluation | 53 | ✅ 完了 |
| evaluation-history-reevaluate | 54 | ✅ 完了 |
| data-configuration-diagnosis | 55 | ✅ 完了 |
| hybrid-solver-poc | 57 | ✅ 完了 |
| solver-production-deploy | 58 | ✅ 完了 |
| dependency-updates-p0-p3 | 59 | ✅ 完了 |
| compliance-leave-management | 25 | ✅ 完了 |
| shift-type-settings | 38 | ✅ 完了 |
| leave-balance-management | 39 | ✅ 完了 |
| double-click-shift-edit | 38.5 | ✅ 完了 |
| arrow-key-navigation | - | ✅ 完了 |
| ctrl-arrow-navigation | - | ✅ 完了 |
| home-end-navigation | - | ✅ 完了 |
| pageup-pagedown-navigation | - | ✅ 完了 |
| keyboard-accessibility | - | ✅ 完了 |
| keyboard-shortcut-help | - | ✅ 完了 |
| ci-cd-e2e-integration | - | ✅ 完了 |
| demo-data-improvement | - | ✅ 完了 |
| demo-shift-removal | - | ✅ 完了 |
| github-pages-optimization | - | ✅ 完了 |
| mobile-touch-support | - | ✅ 完了 |
| undo-functionality | - | ✅ 完了 |
| redo-functionality | - | ✅ 完了 |
| administrative-compliance-ui | 61 | ✅ 完了 |

---

## 直近の変更（最新5件）

1. **PR #94マージ** (2026-02-19): Phase 61 運営指導モード・月別書類管理（administrative-compliance-ui）
   - 書類アーカイブ（Firestore保存・一覧・再DL・一括ZIP DL）
   - 運営指導モードトグル（全画面ダッシュボード切替）
   - 常勤換算値・人員配置基準ダッシュボード
   - 電子申請フロー案内モーダル（4ステップ）
   - tasks.md 全チェックボックス `[x]` 完了確認済み

2. **PR #92マージ** (2026-02-19): demo-shift-removal 残工事完了・CLAUDE.md Spec一覧全件更新
   - CLAUDE.md の Active Specifications テーブルに未登録Specを全件追加

3. **PR #91マージ** (2026-02-19): Phase 39 tasks.md の全チェックボックスを完了状態に更新
   - leave-balance-management tasks.md のドキュメント未更新を解消

4. **PR #88マージ** (2026-02-19): シフト確定時に休暇残高を自動同期（Phase 25 #F）
   - `handleConfirmSchedule` 後に `updateLeaveUsage` でベストエフォート同期

5. **PR #87マージ** (2026-02-19): コンプライアンスチェックUIを追加（Phase 25 #E）
   - `ComplianceContent.tsx`: 常勤換算FTEテーブル・役職別FTE合計・違反一覧

---

## MVP実装状況

| モジュール | 状態 | 備考 |
|-----------|------|------|
| **統合Solver** | ✅ 本番デプロイ完了 | 単一CP-SATモデル、LLM完全廃止済み |
| **CP-SAT Solver** | ✅ 本番稼働中 | 決定的スケジュール生成、100名対応 |
| **評価システム** | ✅ 4段階評価 | Level 1-4対応、動的制約生成 |
| **事前検証警告** | ✅ PR #79マージ済み | staffShortage/qualificationMissing警告 |
| **警告UI表示** | ✅ PR #80マージ済み | EvaluationPanelにSolverWarningsSection追加 |
| **希望休重複バリデーション** | ✅ PR #81マージ済み | 資格要件競合を診断フェーズで事前検出 |
| **スタッフ設定UI改善** | ✅ PR #82マージ済み | 最大連続勤務日数フィールド追加 |
| **連勤最小化ソフト制約** | ✅ PR #83マージ済み | `_add_consecutive_work_soft()` soft_limit=maxDays-1、重み4 |
| **Phase 25 型定義** | ✅ PR #84マージ済み | employmentType・weeklyContractHours・standardWeeklyHours追加 |
| **コンプライアンスサービス** | ✅ PR #85マージ済み | FTE計算・休憩時間チェック・インターバルチェック |
| **Excelエクスポート** | ✅ PR #86マージ済み | 標準様式第1号・予実2段書き、ExcelJS動的import |
| **コンプライアンスUI** | ✅ PR #87マージ済み | レポートページにコンプライアンスタブ追加 |
| **シフト確定→休暇残高連動** | ✅ PR #88マージ済み | 確定後にupdateLeaveUsageでベストエフォート同期 |
| **書類アーカイブ** | ✅ PR #94マージ済み | Firestore保存・一覧・再DL・一括ZIP DL |
| **運営指導モード** | ✅ PR #94マージ済み | 全画面ダッシュボード・印刷対応 |
| **電子申請案内モーダル** | ✅ PR #94マージ済み | 4ステップ案内・印刷ボタン |

---

## A/B比較結果（Phase 3 統合Solver 完了）

| 指標 | LLM版 | 統合Solver | 改善 |
|------|-------|-----------|------|
| 12名処理時間 | 90-400秒 | 0.22秒 | 99.8%削減 |
| 50名処理時間 | タイムアウト | 0.89秒 | 対応不可→対応可 |
| 100名処理時間 | 対応不可 | <30秒 | 新規対応 |
| Level 1違反 | 0-5件 | 0件 | 数学的保証 |
| 評価スコア | 72-100 | 100 | 安定的最適解 |
| LLMコスト/回 | ~$0.15 | $0.00 | 100%削減 |

---

## 次のアクション候補（優先度順）

### A. 既存バグ修正・UI/UX改善
- 特になし（全PR マージ済み・ワーキングツリークリーン）

### B. 次フェーズ候補
- Phase 62: 通知システム（未着手）

---

## デプロイ済みインフラ

| 環境 | ステータス | 備考 |
|------|-----------|------|
| **開発** | ✅ 運用中 | Firebase Emulator, Node.js v20 |
| **本番** | ✅ 運用中 | Cloud Functions (Node.js + Python Solver), Cloud Firestore |
| **Solver** | ✅ 本番稼働中 | asia-northeast1, メモリ1GB, タイムアウト60秒 |

---

## E2Eテスト状況

- **Playwright**: UI自動テスト実装済み
- **Solver**: 68/68テスト通過（単体15 + スケーラビリティ5 + PoC34 + A/B比較6 + 事前検証5 + 連勤最小化3）
- **Frontend**: 204テスト通過（Phase 25 追加: complianceService 6 + exportExcel 15 + leaveConflict 11 + 他）
- **Backend**: 230テスト通過

---

## 重要な判断・制約

1. **CP-SAT Solver**: LLMコード完全削除、Solver一本化
   - 統合Solver: 単一CP-SATモデルで全制約を一括求解
   - LLMフォールバックパス削除済み（useSolver/useUnifiedSolverフラグ廃止）
   - 参考: [ADR-0004](../adr/0004-hybrid-architecture-adoption.md)

2. **4段階評価システム**: Level 1-4の制約評価
   - Level 1（労基法）: 即0点
   - Level 2（人員不足）: -12点/件
   - Level 3（希望休）: -4点/件
   - Level 4（推奨）: 0点

3. **決定性の重要性**: ユーザー信頼性確保
   - Solver: 完全決定的（同一入力→同一出力）

---

## 技術スタック

- **Frontend**: React, TypeScript
- **Backend**: Node.js Cloud Functions, TypeScript
- **Solver**: Python 3.12, OR-Tools, Flask
- **Database**: Cloud Firestore
- **Testing**: Jest (Node.js), pytest (Python), Playwright (E2E)
- **Infrastructure**: Firebase, Google Cloud Platform

---

## 再開チェックリスト

再開前に以下を確認:

- [x] `git log` で最新コミット確認（PR #94 Phase 61 administrative-compliance-ui マージ済み）✅
- [x] CI/CD ジョブ確認（Lighthouse CI 成功、CI/CD Pipeline in_progress）✅
- [x] LLM→Solver完全移行 本番稼働確認（solverUnifiedGenerate稼働中）✅
- [x] テスト全通過確認（Frontend 204, Backend 230, Solver 68）✅
- [x] ワーキングツリークリーン確認（未コミット変更なし）✅

---

**次セッション開始時**: このファイルを読んで現状把握してから作業開始
