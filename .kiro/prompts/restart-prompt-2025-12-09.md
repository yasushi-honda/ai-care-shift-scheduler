# AI Care Shift Scheduler - 再開プロンプト

**作成日**: 2025-12-09
**目的**: 新規AIセッションでプロジェクトを即座に再開するためのドキュメントベースプロンプト

---

## 使用方法

このプロンプトを新しいClaudeセッションにコピーして実行してください。

---

## 再開プロンプト

```
あなたはAI Care Shift Schedulerプロジェクトの開発を担当するClaudeです。
以下の手順でプロジェクトの現状を把握し、作業を開始してください。

### Step 1: 最新引き継ぎドキュメントを読む

最初に以下のファイルを順番に読んでください：

1. `.kiro/HANDOFF-2025-12-09.md` - 最新の引き継ぎ情報
2. `CLAUDE.md` - プロジェクトルール・制約（最重要）
3. `.kiro/ai-system-evaluation-2025-12-09.md` - AI評価レポート

### Step 2: Serenaメモリを確認

Serenaの `list_memories` を実行し、以下のメモリが存在する場合は読んでください：

- `PROJECT_HANDOFF_LATEST` - プロジェクト引き継ぎ情報
- `project_overview` - プロジェクト概要
- `tech_stack` - 技術スタック

### Step 3: 現在の状態を確認

以下のコマンドを実行：

git status
gh run list --limit 3

### Step 4: タスク確認

以下のいずれかを確認してユーザーの指示を待つ：

1. 前回セッションで未完了のタスクがあれば、それを提示
2. HANDOFF文書の「次のタスク候補」を確認
3. ユーザーからの新しい指示を待つ

### 重要な技術的制約（必ず守ること）

1. **Gemini 2.5 Flash設定**:
   - `@google/genai` SDK使用必須
   - `maxOutputTokens: 65536`
   - `thinkingBudget: 16384`
   - `responseSchema`/`responseMimeType`使用禁止

2. **デプロイワークフロー**:
   - Firebase CLI認証エラー時はGitHub Actions経由でデプロイ
   - コード変更後はCodeRabbitレビュー必須

3. **AIシステムの位置づけ**:
   - 「完全自動シフト生成」ではなく「叩き台提供」
   - 最終判断は人間が行う前提

### プロジェクト概要

- **名称**: AI Care Shift Scheduler
- **目的**: 介護施設向けAI自動シフト生成システム
- **技術スタック**: React + TypeScript + Vite / Firebase / Gemini 2.5 Flash
- **本番URL**: https://ai-care-shift-scheduler.web.app

準備ができたら、ユーザーの指示を待つか、または前回の未完了タスクについて報告してください。
```

---

## 補足情報

### 最新完了ステータス（2025-12-09）

| Phase/BUG | 内容 | ステータス |
|-----------|------|-----------|
| Phase 54 | AI評価履歴・再評価機能 | 完了 |
| Phase 53 | 制約レベル別評価システム | 完了 |
| BUG-019 | Firestoreインデックスデプロイ | 解決済み |
| AI評価 | 総合スコア4.0/5.0 | クライアント納品可能レベル |

### 優先タスク候補

1. **Phase 45継続**: AIシフト生成進行状況表示機能
2. **EvaluationService**: リファクタリング（1000行超→分割）
3. **評価ロジック**: ユニットテスト追加

### 関連ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| `.kiro/HANDOFF-2025-12-09.md` | 最新引き継ぎ |
| `.kiro/ai-system-evaluation-2025-12-09.md` | AI評価レポート |
| `.kiro/ai-quality-improvement-guide.md` | 品質改善ガイド |
| `docs/ai-shift-algorithm.html` | GitHub Pages AIアルゴリズム説明 |
| `docs/phase53-constraint-level-evaluation.html` | Phase 53説明ページ |

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-09
