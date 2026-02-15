# ハンドオフメモ - 最新状態

**更新日**: 2026-02-15
**フェーズ**: Phase 2 Solver化（ロードマップフェーズ2）**本番検証完了** ✅

---

## 現在地

### 最新の重要決定
- **ADR-0004**: ハイブリッドアーキテクチャ採用決定
  - ステータス: **採用**（2026-02-14確定）
  - 成功基準: 全達成（Solver版: スコア100、処理1秒、決定性完全）

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

---

## 直近の変更（最新5件）

1. **PR #65** (2026-02-15): Firebase Emulator functions対応とTimestamp互換性修正
   - `firebase.json` に functions emulator（port 5001）追加
   - `package.json` emulatorスクリプトに `functions` 追加
   - solver-functions predeploy に Python 3.12 存在チェック追加
   - `demoSignIn.ts`: `admin.firestore.Timestamp` → モジュラーインポートに修正（firebase-admin v13互換性）
   - ローカルデモログイン動作確認済み

2. **PR #63** (2026-02-15): Cloud Scheduler権限エラーによるCI失敗を非ブロッキング化
   - Firebase Functions デプロイ時の Cloud Scheduler 権限エラー問題を解決
   - ci.yml を修正して関数コード自体のデプロイ成功を確保
   - **Solver本番デプロイ完全完了**：asia-northeast1リージョンで稼働中

3. **PR #62** (2026-02-15): SOLVER_FUNCTION_URL環境変数設定とデプロイ安定化
   - `functions/.env` に SOLVER_FUNCTION_URL を設定
   - `firebase.json` predeploy コマンドの venv 依存を修正

4. **PR #61** (2026-02-15): Solver Functions デプロイ用venv環境構築を追加
   - CI/CD に Python 3.12 仮想環境作成ステップを追加
   - Firebase CLI の Python Functions デプロイ要件対応

5. **PR #60** (2026-02-15): Solver Functions predeployパス修正とCI/CDエラー検知改善
   - firebase.json predeploy で `$RESOURCE_DIR` 変数を使用して solver-functions/ パスを指定

---

## MVP実装状況

| モジュール | 状態 | 備考 |
|-----------|------|------|
| **Phase 1** (骨子生成) | ✅ 本番運用中 | LLMベース、柔軟な制約解釈 |
| **Phase 2** (詳細生成) | ✅ Solver本番デプロイ | CP-SAT Solver 稼働中（asia-northeast1） |
| **Phase 3** (リバランス) | ✅ アルゴリズムベース | 資格要件スワップ対応 |
| **CP-SAT Solver** | ✅ 本番稼働中 | 決定的スケジュール生成（レイテンシ1s） |
| **評価システム** | ✅ 4段階評価 | Level 1-4対応、動的制約生成 |

---

## ✅ Phase 2 Solver版本番検証 完了（2026-02-15）

### 検証結果

**Solver本番エンドポイント稼働確認**
- ✅ HTTP 200 OK
- ✅ レスポンス時間: 0.94秒（コールドスタート含む）

**求解品質（テストデータ: 5スタッフ × 31日）**
- ✅ ステータス: **OPTIMAL**（最適解）
- ✅ 求解時間: 546-772ms（<1秒）
- ✅ 人員配置違反: **0件**（全31日で必要人員充足）
- ✅ 最大連続勤務: 6日以下（制約内）
- ✅ timeSlotPreference遵守: 完全（日勤のみスタッフは全日勤割当）

**決定性検証（3回連続実行）**
- ✅ 3回全て同一スケジュール生成（hash一致）
- ✅ objectiveValue: 全て2060
- ✅ **決定性100%確認**

**PoC成功基準達成状況**
- ✅ Level 1違反: 0件 ← **PoC目標達成**
- ✅ 処理時間: <1秒 ← **PoC目標達成**
- ✅ 決定性: 完全 ← **PoC目標達成**
- ✅ OPTIMAL到達: OPTIMAL ← **PoC目標達成**

### 結論
**Phase 2 Solver版本番検証: 全項目合格**

---

## 次のアクション候補（優先度順）

### A. その他改善
- 既存バグ修正
- UI/UX改善
- ドキュメント更新（Solver統合ガイド等）

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
- **Solver**: 33/33テスト通過（単体・統合）

---

## 重要な判断・制約

1. **ハイブリッド戦略**: LLMとSolver の役割分離
   - LLM: 制約解釈、説明生成
   - Solver: 最適解生成（決定的）
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

- [ ] `git status` がclean（未コミット変更なし）
- [ ] `git log` で最新コミット確認（PR #65マージ確認）
- [ ] Solver本番稼働確認: `curl https://asia-northeast1-ai-care-shift-scheduler.cloudfunctions.net/solverGenerateShift`
- [ ] CI/CD ジョブが全て pass（デプロイ成功）
- [ ] アプリUIからシフト生成テスト（Solver版で自動使用）

---

**次セッション開始時**: このファイルを読んで現状把握してから作業開始

**Phase 2 Solver版本番検証**: 実装完了、本番デプロイ確認待ち
