# AIシフト自動作成システム - 引き継ぎプロンプト

**最終更新**: 2026-02-19 JST
**前回セッション担当**: Claude Sonnet 4.6

### 今セッションの作業（2026-02-19）
- Phase 65「人員配置基準ダッシュボード強化」PR #102 マージ完了
- ハンドオフメモ更新

### 前セッションの作業（2026-02-18）
- ハンドオフメモ更新（PR #76〜#80の反映）

### 前々セッションの作業（2026-02-16〜2026-02-18）

#### PR #76: LLM→Solver完全移行（2026-02-16）
- LLM（Gemini）コードを完全削除し、CP-SAT Solver一本化を完了
- Backend ~7,400行削減（LLM関連12ファイル削除、shift-generation.ts 660→168行）
- Gemini SDK依存削除（`@google/genai`, `@google-cloud/vertexai`）
- UI表記を「AI生成」→「自動生成」に統一
- 型定義リネーム: `AIEvaluationResult`→`EvaluationResult`, `AIEvaluationError`→`EvaluationError`
- ドキュメント整理: gemini-rules.md, phased-generation-contract.md 削除

#### PR #77: ReportPageバンドルサイズ最適化（2026-02-16）
- バンドルサイズ 470KB→48KB（90%削減、gzip: 148KB→12KB）
- pdfService（jsPDF + html2canvas）を動的importに変更
- Chart.jsをchart-vendorチャンクに分離
- 6つのインラインサブコンポーネントを個別ファイルに分割

#### PR #78: 招待機能race condition修正・技術的負債解消（2026-02-16）
- `acceptInvitation`をFirestoreトランザクション化（race condition防止）
- CI型チェックの`continue-on-error: true`を削除（型エラーでCI失敗に）
- `vite.config.ts`からGemini環境変数残骸を削除
- `tech.md`をCP-SAT Solver実態に更新

#### PR #79: Solver Level 2 事前検証警告（2026-02-18）
- CP-SAT Solverの`_add_staffing`/`_add_qualification`で制約がサイレントスキップされる問題を解消
- 配置可能スタッフ不足時にSolverが警告（`SolverWarning`）を事前検知し返却
- `SolverWarningDict`型追加、`unified_builder.py`に警告収集ロジック追加
- Pythonテスト5件追加（`TestPreValidationWarnings`）

#### PR #80: Solver警告フロントエンド表示（2026-02-18）
- `EvaluationPanel`に`SolverWarningsSection`コンポーネント新設
- `constraintType`でグループ化: `staffShortage`(橙色) / `qualificationMissing`(紫色)
- グループ内でシフト種別ごとにサブグループ化、日付チップ表示
- 5グループ超は折りたたみ（「+N件を表示」ボタン）

### 以前の作業（2026-02-10以前）
- Phase 1-2プロンプト改善、看護師制約強化、rebalanceQualifications実装
- constraintCheckers/scoreCalculators/commentGenerators抽出リファクタリング
- ユニットテスト大量追加（PR #38-55）

---

## プロジェクト概要

介護事業所向けシフト自動作成・管理システム。
CP-SAT Solver（OR-Tools）でシフトを決定論的に自動生成し、4段階レベル評価で「使えるシフト」を提供する。

**重要な位置づけ**: 本システムは**完全自動シフト生成ではなく、AIアシストによる「叩き台」提供**

**本番URL**: https://ai-care-shift-scheduler.web.app/
**GitHub**: https://github.com/yasushi-honda/ai-care-shift-scheduler

---

## 最新の完了ステータス（2026-02-19更新）

### 最近の完了（PR #101〜#102、2026-02-19）
| PR | 内容 |
|----|------|
| #102 | Phase 65: 人員配置基準ダッシュボード強化（Closes #99） |
| #101 | Phase 64: 休暇残高管理 UX刷新 |

### 以前の完了（PR #76-80、2026-02-16〜2026-02-18）
| PR | 内容 |
|----|------|
| #80 | Solver警告フロントエンド表示（SolverWarningsSection） |
| #79 | Solver Level 2 事前検証警告（SolverWarning機構） |
| #78 | 招待機能race condition修正・CI型チェック強制化・LLM残骸クリーンアップ |
| #77 | ReportPageバンドルサイズ最適化（90%削減） |
| #76 | LLM→Solver完全移行（Geminiコード削除・UI表記統一） |

**テスト総数**: Frontend 298件（全通過）/ 型チェック 0エラー（2026-02-19時点）


### 以前の完了ステータス

| Phase/BUG | 内容 | ステータス |
|-----------|------|-----------|
| テストカバレッジ向上 | 67件のユニットテスト追加（PR #38-41） | ✅ 完了（2026-01-23） |
| shift-rebalanceテスト追加 | 11件のユニットテスト追加（PR #37） | ✅ 完了（2026-01-23） |
| EvaluationServiceリファクタリング | scoreCalculators.ts、commentGenerators.ts抽出（PR #36） | ✅ 完了（2026-01-23） |
| constraintCheckers抽出 | evaluationLogicから制約チェッカー分離（PR #34） | ✅ 完了（2026-01-22） |
| implementation-log分割 | 3034行→月次アーカイブ化（PR #35） | ✅ 完了（2026-01-22） |
| ADR作成 | docs/adr/0003-constraint-checkers-extraction.md | ✅ 完了（2026-01-22） |
| ドキュメント監査 | NAVIGATION.md復元、INDEX.md作成、README.mdリンク修正 | ✅ 完了（2026-01-22） |
| Phase 54 | AI評価履歴・再評価機能 | ✅ 完了 |
| Phase 53 | 制約レベル別評価システム | ✅ 完了 |
| Phase 45 | AI生成進行状況表示機能 | ✅ 完了（2026-01-02） |
| AI評価レポート | 総合スコア4.0/5.0 | クライアント納品可能レベル |

### AI評価結果サマリー

- **総合スコア**: 4.0 / 5.0（良好）
- **結論**: クライアント納品可能レベル
- **詳細**: `.kiro/ai-system-evaluation-2025-12-09.md`

### Phase 53: 制約レベル別評価システム

**4段階レベル**:
| レベル | 名称 | 対象 | 減点 |
|-------|------|------|------|
| 1 | 絶対必須 | 労基法違反 | 即0点 |
| 2 | 運営必須 | 人員不足、資格要件 | -5点/件 |
| 3 | 努力目標 | 希望休、連勤 | -4点/件 |
| 4 | 推奨 | 将来拡張用 | 0点 |

---

## Phase 65: 人員配置基準ダッシュボード強化（2026-02-19完了）

**PR #102 / Closes #99**

### 実装内容

#### Task 65.0: 型定義・定数追加
- `types.ts`（+70行）、`constants.ts`（+50行）に型定義・定数追加
- 追加型: `StaffingRequirementEntry`, `StaffingStandardConfig`, `DailyFulfillmentResult`, `MonthlyFulfillmentSummary`, `StaffingStandardError`
- `DEFAULT_STAFFING_STANDARDS`: サービス種別デフォルト配置基準マスタ追加

#### Task 65.1: 人員配置基準設定UI
- `src/services/staffingStandardService.ts` 新規作成
  - `getStaffingStandard`, `saveStaffingStandard`, `subscribeStaffingStandard` 実装
- `src/components/StaffingStandardSettings.tsx` 新規作成（サイドバーAccordion内設定UI）
- `App.tsx` に「人員配置基準設定」Accordionセクション追加

#### Task 65.2: 日次充足率計算ロジック
- `src/services/complianceService.ts` に純粋関数追加
  - `calculateDailyFulfillment`, `calculateMonthlyFulfillmentSummary`
  - fixed/ratio 2方式対応、met/warning/shortage 3段階ステータス

#### Task 65.3: シフトグリッドへの充足バッジ表示
- `src/components/DailyFulfillmentBadges.tsx` 新規作成
  - シフトグリッドヘッダー下に充足バッジ（✅⚠️❌）表示
- `src/components/ShiftTable.tsx` に `dailyFulfillmentResults` prop 追加

#### Task 65.4: 月次充足率グラフ
- `src/components/MonthlyFulfillmentChart.tsx` 新規作成
  - Chart.js Line で月次充足率グラフ描画（100%基準線・80%警告線）
- `src/pages/reports/ComplianceContent.tsx` に「人員配置基準充足状況」セクション追加
- `src/pages/reports/ReportPage.tsx` に `staffingConfig` prop 渡す処理追加

#### Task 65.5: 品質確認
- 型チェック: 0エラー
- テスト: 298/298 通過

### 新規ファイル（6本）
- `src/services/staffingStandardService.ts`
- `src/components/StaffingStandardSettings.tsx`
- `src/services/__tests__/staffingStandardService.test.ts`
- `src/services/__tests__/complianceService.staffing.test.ts`
- `src/components/DailyFulfillmentBadges.tsx`
- `src/components/MonthlyFulfillmentChart.tsx`

### 変更ファイル（7本）
- `types.ts`
- `constants.ts`
- `src/services/complianceService.ts`
- `src/components/ShiftTable.tsx`
- `App.tsx`
- `src/pages/reports/ComplianceContent.tsx`
- `src/pages/reports/ReportPage.tsx`

---

## 作業中のPhase

現在作業中のPhaseはありません。

### アーキテクチャ現状（2026-02-19）

- **シフト生成**: CP-SAT Solver一本化完了（LLM完全廃止）
- **Solver警告**: Level 2違反の根本原因（配置不足・資格不足）を事前検知しUIに表示
- **評価システム**: 4段階制約レベル（Level 1-4）による自動評価
- **EvaluationServiceリファクタリング**: evaluationLogic.ts 50%削減済み（1185行→588行）
- **人員配置基準ダッシュボード**: 日次充足バッジ（シフトグリッド）＋月次充足率グラフ（レポート）追加済み


---

## 重要なルール（CLAUDE.md必読）

1. **Solver一本化**: LLM完全廃止済み、CP-SAT Solverのみで生成
2. **実装前テストルール**: 型チェック必須、本番で初めてエラー発見を避ける
3. **CI/CDワークフロー**: CodeRabbitレビュー → push → GitHub Actions
4. **権限管理**: `users.facilities`と`facilities.members`両方を更新
5. **Firestoreインデックス**: サブコレクションは`COLLECTION_GROUP`必須

---

## 再開時の必読ドキュメント

1. `CLAUDE.md` - プロジェクトルール（最重要）
2. `.kiro/steering/development-workflow.md` - 開発ワークフロー・アカウント設定
3. `.kiro/ai-system-evaluation-2025-12-09.md` - AI評価レポート
4. Serenaメモリ `account_settings_2025-12-11` - GitHub/GCP設定詳細

## 再開プロンプト

`.kiro/prompts/restart-prompt-2025-12-09.md` を参照

---

## 次のタスク候補

1. **希望休重複の事前バリデーション** - 看護師等の有資格者が同日に希望休を申請した場合にUIで警告
2. **連勤超過（Level 3警告）の改善** - 5連勤ギリギリが5名、シフト品質向上
3. **人員配置基準ダッシュボードの拡張** - Phase 65で追加した充足率機能の追加カスタマイズ対応
4. **新機能の要件定義** - 新しいSpecの立ち上げ

---

## セッション開始時の推奨コマンド

```bash
# 1. アカウント設定確認（direnvで自動設定済み）
gh auth status          # yasushi-honda がアクティブか確認
gcloud config list      # admin@fuku-no-tane.com か確認

# 2. 最新状態を確認
git status
gh run list --limit 3

# 3. Serenaメモリで詳細確認
# - project_overview
# - tech_stack
# - account_settings_2025-12-11
```

---

## 連絡先・担当

- **プロジェクト提案者**: 本田
- **主要ステークホルダー**: 介護事業所管理者
