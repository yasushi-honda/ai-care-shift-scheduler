# ハンドオフメモ - 最新状態

**更新日**: 2026-02-18（Solver警告フロントエンド表示 PR作成中）
**フェーズ**: LLM→Solver完全移行 **本番稼働中** ✅
**最新作業**: Solver警告フロントエンド表示（PR #79のBackend実装に対するUI対応）

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

1. **PR #80（作成中）** (2026-02-18): Solver警告フロントエンド表示
   - PR #79のBackend `SolverWarning` に対するフロントエンドUI対応
   - `SolverWarningsSection` コンポーネント新設（constraintType別グループ化、日付チップ、折りたたみ）
   - フロントエンド型定義追加（`SolverWarning`, `EvaluationResult.solverWarnings`, `GenerateShiftResponse.solverWarnings`）
   - Backend `GenerateShiftResponse` にも `solverWarnings` フィールド追加（型安全性修正）
   - `formatDateWithDay` 重複解消（ファイルトップレベルに共通化）
   - 変更ファイル: `types.ts`, `EvaluationPanel.tsx`, `shiftGenerationService.ts`, `functions/src/types.ts`

2. **PR #79マージ** (2026-02-18): Solver Level 2 事前検証警告
   - コミット: `8427a4b` - feat: Solver Level 2 事前検証警告 - 制約スキップを事前検知し警告返却
   - CP-SAT Solverの `_add_staffing` / `_add_qualification` でサイレントスキップを解消
   - 配置可能スタッフ不足時に `SolverWarning`（`staffShortage` / `qualificationMissing`）を事前検知して返却
   - 警告をevaluation結果とAPIレスポンス両方に添付。Level 2違反の原因が明確に
   - 変更ファイル: `types.py`, `unified_builder.py`, `service.py`, `types.ts`, `solver-client.ts`, `shift-generation.ts`
   - Pythonテスト: 65/65全通過（`TestPreValidationWarnings` 5テスト新規追加）
   - CI/CDはマージ後 in_progress（完了次第確認推奨）

2. **PR #78マージ** (2026-02-16): 技術的負債解消
   - 招待機能race condition修正（Firestoreトランザクション化）
   - CI型チェック厳格化（`continue-on-error: true` 削除）
   - vite.config.ts LLM残骸削除
   - tech.md Solver実態更新

3. **PR #76本番デプロイ完了** (2026-02-16): LLM→Solver完全移行 Firebaseデプロイ成功
   - 削減規模: 48ファイル変更、+450/-8,450行

4. **PR #77** (2026-02-16): ReportPageバンドルサイズ最適化（90%削減）

5. ~~PR #73 (2026-02-16): Solver relative_gap_limit緩和で4シフト対応高速化~~

---

## MVP実装状況

| モジュール | 状態 | 備考 |
|-----------|------|------|
| **統合Solver** | ✅ 本番デプロイ完了 | 単一CP-SATモデル、LLM完全廃止済み |
| **CP-SAT Solver** | ✅ 本番稼働中 | 決定的スケジュール生成、100名対応 |
| **評価システム** | ✅ 4段階評価 | Level 1-4対応、動的制約生成 |
| **事前検証警告** | ✅ PR #79マージ済み | staffShortage/qualificationMissing警告 |
| **警告UI表示** | 🔧 PR作成中 | EvaluationPanelにSolverWarningsSection追加 |

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
- **Solver**: 65/65テスト通過（単体15 + スケーラビリティ5 + PoC34 + A/B比較6 + 事前検証5）

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
- [x] `git log` で最新コミット確認（PR #79 Solver Level 2 事前検証警告 マージ済み）✅
- [x] CI/CD ジョブ確認（PR #79 main push → CI/CD Pipeline + Lighthouse CI 全成功）✅
- [x] LLM→Solver完全移行 本番稼働確認（solverUnifiedGenerate稼働中）✅
- [x] テスト全通過確認（Frontend 161, Backend 230, Solver 65）✅

---

## 本セッション作業内容（2026-02-18セッション：Solver警告フロントエンド表示）

### 実装内容
- PR #79のBackend `SolverWarning` に対するフロントエンドUI対応
- `SolverWarningsSection` コンポーネント新設（constraintType別グループ化、日付チップ、5件超折りたたみ）
- フロントエンド型定義追加（`SolverWarning`, `EvaluationResult.solverWarnings`, `GenerateShiftResponse.solverWarnings`）
- Backend `GenerateShiftResponse` の型安全性修正（`solverWarnings` フィールド追加）
- コードレビュー指摘対応: `formatDateWithDay` 重複解消、React keyの一意化

### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `types.ts` (root) | `SolverWarning` interface追加、`EvaluationResult`/`GenerateShiftResponse` 拡張 |
| `src/components/EvaluationPanel.tsx` | `SolverWarningsSection` コンポーネント追加、`formatDateWithDay` 共通化 |
| `services/shiftGenerationService.ts` | `SolverWarning` import、ログ出力追加 |
| `functions/src/types.ts` | `GenerateShiftResponse` に `solverWarnings` フィールド追加 |

### 成果
- **品質**: Level 2違反の根本原因がUIで可視化（配置可能スタッフ不足 / 資格要件未充足）
- **型安全性**: FE/BE両方の `GenerateShiftResponse` で `solverWarnings` 型定義済み
- **検証**: Frontend/Backend型チェック + ビルド全通過

---

**次セッション開始時**: このファイルを読んで現状把握してから作業開始
