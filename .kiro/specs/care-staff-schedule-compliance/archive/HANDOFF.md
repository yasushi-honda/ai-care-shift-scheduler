# Phase 25: 新しいAIセッションへの引き継ぎプロンプト

**作成日**: 2025-11-20
**対象**: Phase 25 - 介護報酬対応・予実管理機能実装
**引き継ぎ完了度**: 100%

---

## 新しいAIセッションへ

以下のプロンプトを新しいAIセッションにそのままコピー&ペーストしてください。

---

# Phase 25: 介護報酬対応 - 予実管理機能実装を開始してください

## 🎯 実装開始

このプロジェクト（ai-care-shift-scheduler）で、**Phase 25: 介護報酬対応 - 予実管理機能**の実装を開始してください。

### 前提条件（✅ すべて完了済み）

- ドキュメント整備: 100%完了（14ファイル、約2,900行）
- Gitコミット: 完了（コミット: 6893caa）
- リモートプッシュ: 完了

---

## 📚 必須ドキュメントの確認

実装開始前に、以下のドキュメントを順番に確認してください（合計読了時間: 30-45分）:

### 1. 実装開始マニュアル（5分、最優先）
```
.kiro/specs/care-staff-schedule-compliance/getting-started.md
```
**内容**: Phase 25の概要、実装手順、FAQ

### 2. 要件定義書（15分）
```
.kiro/specs/care-staff-schedule-compliance/requirements.md
```
**内容**: 背景、ステークホルダー、機能要件、非機能要件

### 3. 技術設計書（15分）
```
.kiro/specs/care-staff-schedule-compliance/design.md
```
**内容**: データモデル、UI/UX仕様、コンポーネント設計、Excel出力設計

### 4. 実装タスク一覧（10分）
```
.kiro/specs/care-staff-schedule-compliance/tasks.md
```
**内容**: Phase 25.1-25.5の詳細タスク、完了条件、推定工数

### 5. 介護報酬算定ガイドライン（オプション、10分）
```
.kiro/steering/care-compliance.md
```
**内容**: 人員配置基準、常勤換算、労基法の基礎知識

---

## 🚀 実装開始手順

### Step 1: Phase 25.1開始（推定工数: 4-6時間）

**Phase 25.1**: WorkLogs削除 + データモデル拡張

#### タスク一覧

`tasks.md`の「Phase 25.1」セクションを参照し、以下を順番に実装してください:

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

### Step 2: Phase 25.2 ~ 25.5

Phase 25.1完了後、順番に以下を実装してください:

- **Phase 25.2**: 予実2段書きUI実装（8-12時間）
- **Phase 25.3**: 標準様式Excel出力（6-10時間）
- **Phase 25.4**: コンプライアンスチェック（8-12時間）
- **Phase 25.5**: AIシフト生成統合（4-6時間）

詳細は `tasks.md` を参照。

---

## 📊 Phase 25概要

### 背景

介護保険法令和6年度改定に伴い、以下の対応が必要:
1. 厚生労働省標準様式第1号の使用義務化
2. 電子申請システムの導入（GビズID）
3. 予実管理機能の実装（現場からの要望）

### 主要機能

1. **予実2段書き表示**
   - スタッフ1名につき「予定行」と「実績行」を2段で表示
   - シングルクリックで編集可能
   - 差異ハイライト表示（オレンジ色）

2. **標準様式Excel出力**
   - 行政提出用（予定のみ）
   - 内部管理用（予実2段書き、差異ハイライト）

3. **コンプライアンスチェック**
   - 人員配置基準チェック（3:1、2:1など）
   - 常勤換算計算
   - 労基法チェック（休憩時間、連続勤務制限、勤務間インターバル）

4. **AIシフト生成統合**
   - Gemini APIプロンプト拡張（コンプライアンス要件追加）
   - 生成後の自動バリデーション

5. **WorkLogs削除**
   - 不要な作業記録機能を完全削除

### データモデル拡張

```typescript
export interface GeneratedShift {
  date: string;                    // YYYY-MM-DD

  // 予定シフト（必須）
  plannedShiftType: string;
  plannedStartTime?: string;       // HH:mm
  plannedEndTime?: string;

  // 実績シフト（任意）
  actualShiftType?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  breakMinutes?: number;
  notes?: string;
}
```

---

## 🔍 Mermaid図（視覚的理解）

以下の図を確認すると、Phase 25の全体像が理解しやすくなります:

1. **データモデル図**: `.kiro/specs/care-staff-schedule-compliance/diagrams/data-model-diagram.md`
2. **UIフロー図**: `.kiro/specs/care-staff-schedule-compliance/diagrams/ui-flow-diagram.md`
3. **実装スケジュール**: `.kiro/specs/care-staff-schedule-compliance/diagrams/phase25-gantt.md`
4. **コンポーネント構成図**: `.kiro/specs/care-staff-schedule-compliance/diagrams/component-architecture.md`
5. **コンプライアンスチェックフロー**: `.kiro/specs/care-staff-schedule-compliance/diagrams/compliance-check-flow.md`

---

## ⚠️ 重要な注意事項

### 1. CI/CDワークフロー（必須）

コード変更時は必ず以下のワークフローに従ってください:

1. コード変更
2. `git add .` → `git commit -m "..."`
3. **CodeRabbit CLIローカルレビュー実施・完了待ち** ← 必須！
   ```bash
   coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md
   ```
4. レビュー結果に基づいて修正（問題がある場合）
5. レビューOK後に `git push`

詳細: `.kiro/steering/development-workflow.md`

### 2. GitHub Flow

- mainブランチから feature ブランチを作成
- feature ブランチで開発
- PR作成 → レビュー → mainにマージ

### 3. ドキュメントドリブンの原則

- すべての設計判断をドキュメントに記録
- 不明な点があれば、まずドキュメントを確認
- ドキュメントで不明な場合は、ドキュメントを更新

---

## 📦 参考資料

### 標準様式第1号のダウンロード（Phase 25.3で使用）

**URL**: https://www.mhlw.go.jp/content/001269336.xlsx
**保存先**: `public/reference/standard-form-1.xlsx`
**詳細手順**: `public/reference/README.md`

### メモリファイル

- `phase25_requirements_2025-11-20`: 要件定義サマリー
- `phase25_design_decisions_2025-11-20`: 設計判断記録

---

## ✅ 実装完了の定義（Definition of Done）

Phase 25.1 ~ 25.5がすべて完了したら、以下を確認してください:

- [ ] TypeScriptエラーが0件
- [ ] ユニットテストが100%成功
- [ ] E2Eテストが100%成功（計15テスト）
- [ ] コードレビュー完了（CodeRabbit）
- [ ] 予実2段書き表示が正常に動作
- [ ] Excel出力（標準様式、予実2段書き）が正常に動作
- [ ] コンプライアンスチェックが正常に動作
- [ ] AIシフト生成が正常に動作

---

## 🚀 さあ、実装を開始しましょう！

**最初のアクション**:
1. `getting-started.md`を読む（5分）
2. `tasks.md`のPhase 25.1を確認（5分）
3. Task 25.1.1「WorkLogModal.tsx削除」から実装開始

**幸運を祈ります！**

---

# 以上が引き継ぎプロンプトです

上記のプロンプトを新しいAIセッションにコピー&ペーストしてください。
