# Phase 25: 実装開始マニュアル

**作成日**: 2025-11-20
**対象**: Phase 25 - 介護報酬対応・予実管理機能実装
**推定工数**: 30-46時間

---

## このドキュメントについて

このドキュメントは、**他のAIセッションや将来の開発者が、会話履歴を見ずに即座にPhase 25の実装を開始できる**ように作成されました。

---

## 1分で理解するPhase 25

### 目的
介護保険法令和6年度改定に対応し、予実管理機能を実装する。

### 主要機能
1. **予実2段書き表示**: スタッフ1名につき「予定行」と「実績行」を2段で表示
2. **標準様式Excel出力**: 行政提出用と内部管理用の2種類
3. **コンプライアンスチェック**: 人員配置基準、常勤換算、労基法の自動チェック
4. **AIシフト生成統合**: コンプライアンス要件を考慮したシフト生成

### 実装順序
Phase 25.1 → 25.2 → 25.3 → 25.4 → 25.5（合計30-46時間）

---

## 実装開始前の準備

### 1. 必須ドキュメントの確認

以下のドキュメントを順番に読んでください（合計読了時間: 30-45分）:

1. **要件定義書**（15分）:
   ```
   .kiro/specs/care-staff-schedule-compliance/requirements.md
   ```
   - 背景、ステークホルダー、機能要件、非機能要件を理解

2. **技術設計書**（15分）:
   ```
   .kiro/specs/care-staff-schedule-compliance/design.md
   ```
   - データモデル、UI/UX仕様、コンポーネント設計を理解

3. **実装タスク一覧**（10分）:
   ```
   .kiro/specs/care-staff-schedule-compliance/tasks.md
   ```
   - Phase 25.1のタスクを確認

4. **介護報酬算定ガイドライン**（オプション、10分）:
   ```
   .kiro/steering/care-compliance.md
   ```
   - 人員配置基準、常勤換算、労基法の基礎知識

### 2. Mermaid図の確認（オプション）

視覚的に理解したい場合、以下の図を確認してください:

1. **データモデル図**:
   ```
   .kiro/specs/care-staff-schedule-compliance/diagrams/data-model-diagram.md
   ```

2. **UIフロー図**:
   ```
   .kiro/specs/care-staff-schedule-compliance/diagrams/ui-flow-diagram.md
   ```

3. **実装スケジュール**:
   ```
   .kiro/specs/care-staff-schedule-compliance/diagrams/phase25-gantt.md
   ```

4. **コンポーネント構成図**:
   ```
   .kiro/specs/care-staff-schedule-compliance/diagrams/component-architecture.md
   ```

5. **コンプライアンスチェックフロー**:
   ```
   .kiro/specs/care-staff-schedule-compliance/diagrams/compliance-check-flow.md
   ```

### 3. 参考資料のダウンロード

**標準様式第1号**をダウンロードしてください（Phase 25.3で使用）:

```
URL: https://www.mhlw.go.jp/content/001269336.xlsx
保存先: public/reference/standard-form-1.xlsx
```

詳細手順: `public/reference/README.md`

---

## 実装開始手順（ステップバイステップ）

### Step 1: Phase 25.1開始

Phase 25.1は「WorkLogs削除 + データモデル拡張」です。

#### 実装タスク

```
.kiro/specs/care-staff-schedule-compliance/tasks.md
```

の「Phase 25.1」セクションを参照し、以下のタスクを順番に実装してください:

1. **Task 25.1.1**: WorkLogModal.tsx削除（30分）
2. **Task 25.1.2**: App.tsxからworkLogs関連コード削除（1時間）
3. **Task 25.1.3**: ShiftTable.tsxからworkLogs関連コード削除（1時間）
4. **Task 25.1.4**: types.tsのWorkLogs関連インターフェース削除（15分）
5. **Task 25.1.5**: GeneratedShiftインターフェース拡張（1時間）
6. **Task 25.1.6**: scheduleService.tsの後方互換性実装（1.5時間）
7. **Task 25.1.7**: E2Eテスト更新（30分）

#### 完了条件

- [ ] TypeScriptエラーが0件（`npx tsc --noEmit`）
- [ ] ユニットテストが100%成功（`npm test`）
- [ ] E2Eテストが100%成功（Phase 22の6テストは維持）
- [ ] 開発サーバーが正常に起動（`npm run dev`）
- [ ] 既存のScheduleデータが正常に表示される

### Step 2: Phase 25.2開始

Phase 25.1が完了したら、Phase 25.2「予実2段書きUI実装」に進んでください。

詳細は `tasks.md` の「Phase 25.2」セクションを参照。

### Step 3: Phase 25.3 ~ 25.5

同様に、Phase 25.2完了後、順番にPhase 25.3、25.4、25.5を実装してください。

---

## 開発ワークフロー

### CI/CDワークフロー（重要）

Phase 25実装時も、既存のCI/CDワークフローに従ってください:

1. コード変更
2. `git add .` → `git commit -m "..."`
3. **CodeRabbit CLIローカルレビュー実施・完了待ち** ← 必須！
   ```bash
   coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md
   ```
4. レビュー結果に基づいて修正（問題がある場合）
5. レビューOK後に `git push`
6. GitHub Actions CI/CD実行を監視

詳細: `.kiro/steering/development-workflow.md`

### Git Workflow（GitHub Flow）

1. mainブランチから feature ブランチを作成
2. feature ブランチで開発
3. PR作成
4. レビュー・CI/CD通過後、mainにマージ
5. feature ブランチ削除

---

## よくある質問（FAQ）

### Q1: Phase 25.1から順番に実装する必要がありますか？

**A**: はい、必須です。Phase 25.1で削除するWorkLogs機能が、Phase 25.2のShiftTable改修と競合するためです。

---

### Q2: WorkLogs削除後、既存のE2Eテストが失敗しますか？

**A**: はい、workLogs関連のE2Eテストが失敗します。Task 25.1.7で削除してください。

---

### Q3: GeneratedShiftインターフェース拡張後、既存のScheduleデータは読み込めますか？

**A**: はい、Task 25.1.6で実装する`migrateGeneratedShift`関数により、旧データを自動変換します。

---

### Q4: 標準様式第1号がダウンロードできません

**A**: `public/reference/README.md`の「トラブルシューティング」を参照してください。代替手段として、高知県庁または高知市のサイトからもダウンロード可能です。

---

### Q5: Phase 25の実装を中断した場合、どこから再開すればよいですか？

**A**:
1. `tasks.md`の完了条件を確認
2. 未完了のタスクから再開
3. 完了したタスクは✅をつけて記録

---

### Q6: このドキュメントで不明な点があります

**A**: 以下のドキュメントを参照してください:
- 要件定義書: `requirements.md`
- 技術設計書: `design.md`
- 介護報酬算定ガイドライン: `../../steering/care-compliance.md`

それでも不明な場合は、メモリファイルを確認:
- `phase25_requirements_2025-11-20`
- `phase25_design_decisions_2025-11-20`

---

## 実装完了後のチェックリスト

Phase 25.1 ~ 25.5がすべて完了したら、以下を確認してください:

- [ ] TypeScriptエラーが0件
- [ ] ユニットテストが100%成功
- [ ] E2Eテストが100%成功（計15テスト）
- [ ] コードレビュー完了（CodeRabbit）
- [ ] 開発サーバーが正常に起動
- [ ] 予実2段書き表示が正常に動作
- [ ] Excel出力（標準様式、予実2段書き）が正常に動作
- [ ] コンプライアンスチェックが正常に動作
- [ ] AIシフト生成が正常に動作

---

## 次のステップ

Phase 25完了後:

1. **完了サマリー作成**:
   ```
   .kiro/記録予定/phase25-completion-summary-YYYY-MM-DD.md
   ```

2. **Mermaid図更新**:
   - 実装タイムライン（実績）
   - 最終的なアーキテクチャ図

3. **メモリファイル更新**:
   ```
   phase25_completion_2025-11-20
   ```

4. **Phase 26計画**（機能拡張候補）

---

## 緊急時の連絡先

**ドキュメントドリブンの原則**: このドキュメントで不明な点がある場合、まずドキュメントを更新してください。

**更新すべきドキュメント**:
- このファイル（getting-started.md）: よくある質問を追加
- requirements.md: 要件の追加・変更
- design.md: 設計の追加・変更

---

**実装開始**: Phase 25.1のタスク一覧を確認し、Task 25.1.1から開始してください。

**幸運を祈ります！**
