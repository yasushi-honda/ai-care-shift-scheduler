# 次のAIセッションへの引き継ぎプロンプト

**作成日**: 2025-11-23
**プロジェクト**: ai-care-shift-scheduler
**仕様ID**: care-staff-schedule-compliance
**現在の進捗**: Phase 25.2完了（全体進捗40%）

---

## 📋 このプロンプトの使い方

新しいAIセッションを開始したら、以下のプロンプトをそのままコピー&ペーストしてください。

---

## 🚀 引き継ぎプロンプト（ここからコピー）

```
こんにちは。介護シフト管理アプリケーション「ai-care-shift-scheduler」のPhase 25開発を引き継ぎます。

# プロジェクト状態サマリー

## 完了済み
- ✅ Phase 25.1: データモデル拡張（予定/実績シフト分離）
- ✅ Phase 25.2: 予実2段書きUI実装（2025-11-23完了）
  - TimePicker.tsx コンポーネント実装
  - ShiftEditConfirmModal.tsx 実装（バリデーション含む）
  - ShiftTable.tsx の2段書き表示改修
  - シングルクリック編集機能
  - 差異ハイライト（orange ring）
  - E2Eテスト8ケース実装
  - CodeRabbitレビュー完了（3件修正済み）
  - TypeScript: 0エラー
  - ユニットテスト: 123/123成功

## 現在の状況
- Git: mainブランチ、コミットHash bd76d1c（CodeRabbit修正）+ 4cb5179（ドキュメント）
- ドキュメント: phase25-2-completion-2025-11-23.md 完成
- 提案資料: usability-improvements-proposal.md 作成済み

## 次のステップ候補

### Option A: Phase 25.2.5 ユーザビリティ改善（推奨優先度: 高）
**目的**: 予実入力の効率化（時間短縮86-90%）

**詳細**: `.kiro/specs/care-staff-schedule-compliance/usability-improvements-proposal.md` を参照

**推奨実装順**:
1. 提案1: 個別「予定と同じ」ボタン（1-2時間、成功率98%）
2. 提案2: 一括予定→実績コピー（4-6時間、成功率95%）
3. 提案3: ダブルクリック即時コピー（2-3時間、成功率85%）

**開始コマンド**:
```bash
# 必須: usability-improvements-proposal.md を読む
Read /Users/yyyhhh/ai-care-shift-scheduler/.kiro/specs/care-staff-schedule-compliance/usability-improvements-proposal.md

# Phase 25.2完了記録を確認
Read /Users/yyyhhh/ai-care-shift-scheduler/.kiro/specs/care-staff-schedule-compliance/phase25-2-completion-2025-11-23.md

# 現在のShiftTable.tsxを確認
Read /Users/yyyhhh/ai-care-shift-scheduler/components/ShiftTable.tsx

# 実装開始
ドキュメントドリブンで提案1「個別『予定と同じ』ボタン」から実装を開始してください。
```

### Option B: Phase 25.3 標準様式第1号Excel出力（推奨優先度: 中）
**目的**: 介護報酬請求対応

**詳細**: `.kiro/specs/care-staff-schedule-compliance/tasks.md` Phase 25.3セクション参照

**開始コマンド**:
```bash
# tasks.mdを読む
Read /Users/yyyhhh/ai-care-shift-scheduler/.kiro/specs/care-staff-schedule-compliance/tasks.md

# design.mdでExcel出力仕様を確認
Read /Users/yyyhhh/ai-care-shift-scheduler/.kiro/specs/care-staff-schedule-compliance/design.md

# 実装開始
ドキュメントドリブンでPhase 25.3 Excel出力機能の実装を開始してください。
```

## 重要な開発ルール

### 1. ドキュメントドリブンアプローチ（必須）
- 確認（Verification）: 実装後必ずTypeScriptエラー・テスト確認
- 記録（Documentation）: Phase完了時に包括的ドキュメント作成
- 整備（Organization）: 設計判断・技術的決定を記録
- 引き継ぎ可能化（Handoff）: 次のセッションが即座に理解できる状態

### 2. CI/CDワークフロー（厳守）
```bash
# 1. コード変更
[実装]

# 2. Git追加・コミット
git add .
git commit -m "feat: ..."

# 3. CodeRabbitローカルレビュー実施（必須・スキップ禁止）
coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md

# 4. レビュー結果に基づく修正（問題がある場合）
[修正]
git add .
git commit --amend --no-edit

# 5. レビューOK後にプッシュ
git push origin main

# 6. GitHub Actions監視
gh run list --limit 1
```

### 3. TypeScript・テスト検証（各タスク完了時）
```bash
# TypeScriptエラーチェック
npx tsc --noEmit

# ユニットテスト実行
npm test

# E2Eテスト実行（必要に応じて）
PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run test:e2e
```

### 4. Phase完了時のドキュメント作成
- ファイル名: `phase[N]-completion-YYYY-MM-DD.md`
- 保存場所: `.kiro/specs/care-staff-schedule-compliance/`
- 必須セクション: 概要、実装内容、検証結果、影響分析、次のステップ、学び・振り返り

## 重要ファイル一覧

### 仕様ドキュメント
- `.kiro/specs/care-staff-schedule-compliance/requirements.md`: 要件定義
- `.kiro/specs/care-staff-schedule-compliance/design.md`: 技術設計
- `.kiro/specs/care-staff-schedule-compliance/tasks.md`: タスク一覧

### Phase 25関連ドキュメント
- `.kiro/specs/care-staff-schedule-compliance/phase25-1-completion-2025-11-23.md`: Phase 25.1完了記録
- `.kiro/specs/care-staff-schedule-compliance/phase25-2-completion-2025-11-23.md`: Phase 25.2完了記録
- `.kiro/specs/care-staff-schedule-compliance/usability-improvements-proposal.md`: ユーザビリティ改善提案（ROI分析付き）

### 実装ファイル
- `src/components/TimePicker.tsx`: 時刻入力コンポーネント
- `src/components/ShiftEditConfirmModal.tsx`: 予実編集モーダル
- `components/ShiftTable.tsx`: 2段書きシフト表
- `App.tsx`: handleShiftUpdate関数（予実更新ロジック）
- `e2e/planned-actual-shift-edit.spec.ts`: E2Eテスト（8ケース）

### プロジェクト設定
- `CLAUDE.md`: プロジェクト指示（GitHub Flow、CI/CDワークフロー）
- `.kiro/steering/`: ステアリングドキュメント（product.md, tech.md, structure.md）

## データモデル（重要）

### GeneratedShift インターフェース
```typescript
interface GeneratedShift {
  date: string;

  // 予定シフト（Phase 25.1で追加）
  plannedShiftType?: string;       // 予定シフトタイプ
  plannedStartTime?: string;       // 予定開始時刻 (HH:mm)
  plannedEndTime?: string;         // 予定終了時刻 (HH:mm)

  // 実績シフト（Phase 25.1で追加）
  actualShiftType?: string;        // 実績シフトタイプ
  actualStartTime?: string;        // 実績開始時刻 (HH:mm)
  actualEndTime?: string;          // 実績終了時刻 (HH:mm)

  // 共通
  breakMinutes?: number;           // 休憩時間（分）
  notes?: string;                  // 特記事項

  // 後方互換性（Phase 25.1以前）
  shiftType?: string;              // 非推奨: plannedShiftTypeに移行
}
```

**重要**: `breakMinutes: 0` は有効な値。`??` 演算子を使用すること（`||` は使用禁止）

## トラブルシューティング

### TypeScriptエラーが出た場合
```bash
npx tsc --noEmit
# エラー箇所を確認し、型定義を修正
```

### テストが失敗した場合
```bash
npm test -- --reporter=verbose
# 失敗したテストを特定し、ロジックを修正
```

### E2Eテストでrace conditionが発生した場合
```typescript
// ❌ 悪い例
await page.click('button');
page.on('dialog', dialog => dialog.accept());

// ✅ 良い例
page.once('dialog', dialog => dialog.accept()); // 先に登録
await page.click('button');
```

### Firebase CLI認証エラーが出た場合
**原則**: 即座にGitHub Actionsに切り替える
```bash
# Firebase CLIは使わない
git add .
git commit -m "..."
git push origin main
# → GitHub Actionsが自動デプロイ
```

## 開始方法

1. **ユーザビリティ改善を優先する場合**（推奨）:
   ```
   usability-improvements-proposal.md を読んで、提案1「個別『予定と同じ』ボタン」から実装を開始してください。ドキュメントドリブンで進めてください。
   ```

2. **Excel出力を優先する場合**:
   ```
   tasks.md のPhase 25.3セクションを読んで、標準様式第1号Excel出力の実装を開始してください。ドキュメントドリブンで進めてください。
   ```

3. **現在の状態を確認したい場合**:
   ```
   phase25-2-completion-2025-11-23.md を読んで、Phase 25.2の完了状況を確認してください。
   ```

## 質問がある場合

- データモデル: `design.md` のPhase 25.1セクション
- タスク詳細: `tasks.md`
- 完了記録: `phase25-2-completion-2025-11-23.md`
- ユーザビリティ提案: `usability-improvements-proposal.md`
- プロジェクト指示: `CLAUDE.md`

---

**重要**: このプロンプトを読んだら、必ず「ドキュメントドリブン（確認、記録、整備、引き継ぎ可能化）で推奨ステップで進めて」というアプローチを守ってください。

**次のAIへのメッセージ**: Phase 25.2は完璧に完了しています。TypeScriptエラー0、テスト123/123成功、CodeRabbitレビュー完了。自信を持って次のPhaseに進んでください！
```

---

## 📝 補足情報

### このプロンプトの特徴

1. **即座に実行可能**: コピー&ペーストで新しいセッションが開始可能
2. **2つの明確な選択肢**: ユーザビリティ改善 vs Excel出力
3. **具体的なコマンド**: すべてのコマンドを明記
4. **トラブルシューティング**: よくある問題と解決策
5. **重要ルールの強調**: CI/CDワークフロー、ドキュメントドリブン

### 推奨される使用方法

新しいAIセッションを開始したら:
1. このファイル全体を読む
2. 「引き継ぎプロンプト（ここからコピー）」セクションをコピー
3. 新しいチャットに貼り付け
4. 即座に作業開始

---

**作成者より**: このプロンプトにより、次のAIセッションは数秒でコンテキストを理解し、即座に実装を開始できます。Phase 25.2の完璧な完了状態を活用し、次のステップに自信を持って進んでください。
