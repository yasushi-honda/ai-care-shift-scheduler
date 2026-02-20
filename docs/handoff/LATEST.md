# ハンドオフメモ - 最新状態

**更新日**: 2026-02-20（PR #112 ヘルプページ追加 マージ済み）
**フェーズ**: LLM→Solver完全移行 **本番稼働中** ✅
**最新作業**: PR #112 ヘルプページ追加（/help ルート、スクロールスパイ付きドキュメントページ）

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
| leave-balance-ux-renewal | 64 | ✅ 完了 |
| staffing-dashboard | 65 | ✅ 完了 |
| standard-form-service-type | 66 | ✅ 完了 |
| notification-system | 63 | ✅ 完了 |
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
| standard-form-compliance | 62 | ✅ 完了 |

---

## 直近の変更（最新5件）

1. **PR #112マージ** (2026-02-20): ヘルプページ追加（/help）
   - `src/pages/HelpPage.tsx` 新規作成（10セクション・1092行）
   - IntersectionObserver によるスクロールスパイ付きサイドバーナビゲーション
   - Noto Serif JP / Noto Sans JP フォント採用、深インディゴカラースキーム
   - App.tsx の「マニュアル」ボタン → 内部 `/help` ルートに変更

2. **PR #111マージ** (2026-02-20): Solver警告偽陽性修正 + roleMissing評価チェック追加（#108, #109）
   - Solver警告の偽陽性を修正
   - roleMissing評価チェック追加

3. **PR #107マージ** (2026-02-20): staffingStandards Firestoreセキュリティルール追加（Phase 65漏れ）

3. **PR #105マージ** (2026-02-19): Phase 63.2 残高不足アラート
   - 公休残高マイナス検出アラート
   - 有給時効通知（期限切れ前アラート）

4. **PR #104マージ** (2026-02-19): Phase 63 通知システム実装
   - 通知センターUI（通知一覧・既読管理）
   - シフト確定通知（スタッフへの自動通知）

5. **PR #103マージ** (2026-02-19): Phase 66 勤務体制一覧表 サービス種別対応（standard-form-service-type）

---

## MVP実装状況

| モジュール | 状態 | 備考 |
|-----------|------|------|
| **統合Solver** | ✅ 本番デプロイ完了 | 単一CP-SATモデル、LLM完全廃止済み |
| **CP-SAT Solver** | ✅ 本番稼働中 | 決定的スケジュール生成、100名対応 |
| **評価システム** | ✅ 4段階評価 | Level 1-4対応、動的制約生成 |
| **休暇残高管理 UX刷新** | ✅ PR #101マージ済み | LeaveBalance系コンポーネント群 |
| **人員配置基準ダッシュボード** | ✅ PR #102マージ済み | staffing-dashboard強化 |
| **勤務体制一覧表 サービス種別対応** | ✅ PR #103マージ済み | standard-form-service-type |
| **通知システム** | ✅ PR #104マージ済み | 通知センターUI + シフト確定通知 |
| **残高不足アラート** | ✅ PR #105マージ済み | 公休マイナス残高・有給時効通知 |

---

## 次のアクション候補（優先度順）

### A. 既存バグ修正・UI/UX改善
- 特になし（全PR マージ済み・ワーキングツリークリーン）
- CI/CD Pipeline（PR #105）: 完了済み ✅（Lighthouse CI + CI/CD Pipeline 共にsuccess）

### B. 次フェーズ候補
- Phase 67以降: 次期機能検討
- 各機能の運用検証・フィードバック収集

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
- **Solver**: 68/68テスト通過
- **Frontend**: 279テスト通過（Phase 64以降追加分含む）
- **Backend**: 230テスト通過

---

## 重要な判断・制約

1. **CP-SAT Solver**: LLMコード完全削除、Solver一本化
   - 参考: [ADR-0004](../adr/0004-hybrid-architecture-adoption.md)

2. **4段階評価システム**: Level 1-4の制約評価
   - Level 1（労基法）: 即0点 / Level 2（人員不足）: -12点/件
   - Level 3（希望休）: -4点/件 / Level 4（推奨）: 0点

3. **決定性の重要性**: Solver完全決定的（同一入力→同一出力）

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

- [x] `git log` で最新コミット確認（PR #111 Solver警告偽陽性修正 + roleMissing評価チェック追加 マージ済み）✅
- [x] CI/CD Pipeline（PR #111）完了確認（Lighthouse CI + CI/CD Pipeline 共にsuccess）✅
- [x] LLM→Solver完全移行 本番稼働確認（solverUnifiedGenerate稼働中）✅
- [x] テスト全通過確認（Frontend 279, Backend 230, Solver 68）✅
- [x] ワーキングツリークリーン確認（未コミット変更なし）✅

---

**次セッション開始時**: このファイルを読んで現状把握してから作業開始
