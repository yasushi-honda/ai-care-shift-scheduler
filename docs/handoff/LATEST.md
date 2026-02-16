# ハンドオフメモ - 最新状態

**更新日**: 2026-02-16（LLM→Solver完全移行 本番デプロイ完了）
**フェーズ**: LLM→Solver完全移行 **本番稼働中** ✅
**最新作業**: PR #76マージ・Firebaseデプロイ完了（46ファイル, +450/-8,450行）

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

---

## 直近の変更（最新5件）

1. **PR #76本番デプロイ完了** (2026-02-16): LLM→Solver完全移行 Firebaseデプロイ成功
   - コミット: `61fed5c` - refactor: LLM→Solver完全移行 - Geminiコード削除・UI表記統一 (#76)
   - CI/CD全通過（ビルド/Lighthouse/Solver/デモデータ検証/E2Eテスト）
   - Firebaseデプロイ成功: solverUnifiedGenerate, solverGenerateShift稼働確認
   - CodeRabbitレビュー完了（4/4チェック通過）
   - 削減規模: 48ファイル変更、+450/-8,450行

2. **LLM→Solver完全移行** (2026-02-16): コード削除・UI表記統一
   - Backend: 14ファイル削除（phased-generation.ts, ai-model-config.ts等~6,000行）、@google/genai削除
   - Frontend: geminiService→shiftGenerationService, AIGenerationProgress→GenerationProgress等リネーム
   - 型定義: AIEvaluationResult→EvaluationResult, AIEvaluationError→EvaluationError
   - ドキュメント: CLAUDE.md更新、steering旧ファイル4件削除（gemini-rules.md等）
   - Firestore互換性: コレクション名・フィールド値は変更なし

3. **PR #73** (2026-02-16): Solver relative_gap_limit緩和で4シフト対応高速化
   - **問題**: 本番テストで15名×4シフト→30s、FEASIBLE（タイムアウト）
   - **修正**: `relative_gap_limit: 0.01→0.05` に緩和（最適値の5%以内で早期終了）
   - **結果**: 15名×4シフト **5.8s, OPTIMAL**達成、50名×4シフト **8.44s**
   - 新規スケーラビリティテスト（TestScalability4Shifts）追加、60/60テスト全通過 ✅
   - Firebaseデプロイ成功 ✅

2. **PR #72** (2026-02-16): solver-functions predeploy修正（本番デプロイ成功）
   - **問題**: CI環境（Ubuntu/dash）で `command -v python3.12 ... || echo '...()'` がシンタックスエラー
   - **修正**: POSIX互換のシンプルコマンドに変更（CIですでにvenv作成済み）
   - **結果**: solverUnifiedGenerate新規作成、solverGenerateShift更新成功
   - CI/CD全チェック通過、mainマージ完了 ✅

2. **PR #71** (2026-02-16): 統合CP-SAT Solver実装（Phase 3全体最適化）
   - LLM Phase1 + Solver Phase2 + Algorithm Phase3 → 単一CP-SATモデルに統合
   - LLMを生成パイプラインから完全除去
   - 性能: 12名0.22s, 50名0.89s, 100名<30s（全目標達成）
   - 58テスト全通過（+25テスト追加）

3. **PR #70** (2026-02-15): tailwindcss v3→v4移行（CSS-first設定）

4. **PR #69** (2026-02-15): firebase-functions v6→v7, uuid→crypto.randomUUID()に置換

5. **PR #68** (2026-02-15): jspdf v3→v4, vite v6→v7メジャー更新

---

## MVP実装状況

| モジュール | 状態 | 備考 |
|-----------|------|------|
| **統合Solver** | ✅ 本番デプロイ完了 | 単一CP-SATモデル、LLM完全廃止済み |
| **CP-SAT Solver** | ✅ 本番稼働中 | 決定的スケジュール生成、100名対応 |
| **評価システム** | ✅ 4段階評価 | Level 1-4対応、動的制約生成 |

---

## ✅ Phase 3 統合Solver 完了（2026-02-16）

### A/B比較結果

| 指標 | LLM版（Phase 1+2+3） | 統合Solver | 改善 |
|------|---------------------|-----------|------|
| 12名処理時間 | 90-400秒 | 0.22秒 | 99.8%削減 |
| 50名処理時間 | タイムアウト | 0.89秒 | 対応不可→対応可 |
| 100名処理時間 | 対応不可 | <30秒 | 新規対応 |
| Level 1違反 | 0-5件 | 0件 | 数学的保証 |
| 評価スコア | 72-100 | 100 | 安定的最適解 |
| 決定性 | 非決定的 | 完全決定的 | 分散0 |
| LLMコスト/回 | ~$0.15 | $0.00 | 100%削減 |

### 実装概要
- **コアファイル**: `solver-functions/solver/unified_builder.py`
- **変数**: `x[staff_id, day, shift_type]` = BoolVar
- **ハード制約**: exactly-one, 人員充足, 連続勤務上限, 遅番→早番禁止, 夜勤チェーン, 固定休日
- **ソフト制約**: シフト希望ボーナス, 公平性, 夜勤公平性, 休息間隔, 勤務日数目標
- **テスト**: 60/60全通過（単体15 + スケーラビリティ5 + PoC34 + A/B比較6）

---

## 次のアクション候補（優先度順）

### A. 本番動作検証 ✅ 完了
- **修正前**: 15名×4シフト 30s（FEASIBLE）
- **修正後**: 15名×4シフト 5.8s（OPTIMAL、目標<10s達成）
- ウォームスタート: 5.7s（安定）

### B. その他改善
- 既存バグ修正
- UI/UX改善

---

## デプロイ済みインフラ

| 環境 | ステータス | 備考 |
|------|-----------|------|
| **開発** | ✅ 運用中 | Firebase Emulator, Node.js v20 |
| **本番** | ✅ 運用中 | Cloud Functions (Node.js + Python Solver), Cloud Firestore |
| **Solver (Phase2)** | ✅ 本番稼働中 | asia-northeast1, メモリ1GB, タイムアウト60秒 |
| **統合Solver** | ✅ 本番稼働中（PR #72） | solverUnifiedGenerate, solverGenerateShift, asia-northeast1 |

---

## E2Eテスト状況

- **Playwright**: UI自動テスト実装済み
- **Solver**: 60/60テスト通過（単体15 + スケーラビリティ5 + PoC34 + A/B比較6）

---

## 重要な判断・制約

1. **CP-SAT Solver**: LLMコード完全削除、Solver一本化
   - 統合Solver: 単一CP-SATモデルで全制約を一括求解
   - LLMフォールバックパス削除済み（useSolver/useUnifiedSolverフラグ廃止）
   - 参考: [ADR-0004](../adr/0004-hybrid-architecture-adoption.md)

2. **4段階評価システ**: Level 1-4の制約評価
   - Level 1（労基法）: 即0点
   - Level 2（人員不足）: -12点/件
   - Level 3（希望休）: -4点/件
   - Level 4（推奨）: 0点

3. **決定性の重要性**: ユーザー信頼性確保
   - Solver: 完全決定的（同一入力→同一出力）
   - LLM: 確率的（実行ごとに異なる）

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

- [x] `git status` がclean（未コミット変更なし）✅
- [x] `git log` で最新コミット確認（PR #76 Firebaseデプロイ完了）✅
- [x] CI/CD ジョブが全て pass（Lighthouse + CI/CD Pipeline + Firebaseデプロイ）✅
- [x] LLM→Solver完全移行 本番稼働確認（solverUnifiedGenerate稼働中）✅
- [x] テスト全通過確認（Frontend 161, Backend 230, Solver 60）✅

---

## 本セッション作業内容（2026-02-16セッション2：技術的負債解消 PR #78）

### A. 技術的負債調査（Explore agent）
- **スコープ**: セキュリティ、テスト、TODO、CI、パフォーマンス、ドキュメント
- **優先度**: P0-P3で分類、推奨順：P0 → P1 → P2
- **結果**: 推奨4項目を確認

### B. P0-P1の実装計画 & 実装
1. **A: invitationService.ts RACE CONDITION修正** (P0)
   - 招待受け入れの検証→ステータス更新をFirestoreトランザクションでアトミック化
   - `runTransaction`で同一招待の二重受け入れ防止
   - rollback時の状態を`pending`に設定

2. **B: CI型チェック厳格化** (P1)
   - `continue-on-error: true`削除（型エラーでCIが止まるように修正）
   - 本番への型エラー漏洩を防止

3. **C: vite.config.ts残骸削除** (P1)
   - Gemini環境変数の`define`ブロック削除
   - CodeRabbitレビュー対応：`loadEnv`インポート・`env`変数削除

4. **D: tech.md Solver実態更新** (P1)
   - バックエンド欄からVertex AI削除
   - CP-SAT Solverセクション新設
   - エンドポイント一覧更新（solverUnifiedGenerate等）

### C. CodeRabbit指摘対応
- **subDocRef安全性**: `transaction.set(..., { merge: true })`に3箇所変更
  - L395, L406, L435でトランザクション内のupdate→setに変更
- **loadEnv未使用**: vite.config.tsから削除完了

### D. 品質ゲート＆マージ
- **品質ゲート**: tsc OK / ビルド 2.27s / テスト 161件全通過
- **CI/CD全通過**: ビルド/Lighthouse/Solver/デモデータ検証/E2Eテスト/GitGuardian/CodeRabbit
- **マージ**: PR #78 スカッシュマージ完了（f950eec）

### 成果
- **技術的負債削減**: Race condition修正、CI品質向上、LLM残骸完全除去、ドキュメント整合
- **コード品質**: Firestore安全性向上、トランザクション設計の堅牢化
- **ドキュメント**: Solver実態を100%反映

---

**次セッション開始時**: このファイルを読んで現状把握してから作業開始
