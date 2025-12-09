# AI Care Shift Scheduler - 再開プロンプト

**作成日**: 2025-12-09
**最終更新**: 2025-12-09 18:00 JST
**目的**: 新規AIセッションでプロジェクトを即座に再開するためのドキュメントベースプロンプト

---

## 使用方法

このプロンプトを新しいClaudeセッションにコピーして実行してください。

---

## 再開プロンプト

```
プロジェクト再開します。
以下のファイルを読んで現状を把握してください。

1. CLAUDE.md
2. .kiro/HANDOFF-2025-12-09.md
3. .kiro/prompts/restart-prompt-2025-12-09.md

把握できたら、次に着手すべきタスクを提案してください。
```

---

## プロジェクト概要（参考）

| 項目 | 内容 |
|------|------|
| **名称** | AI Care Shift Scheduler |
| **目的** | 介護施設向けAI自動シフト生成システム |
| **技術スタック** | React + TypeScript + Vite / Firebase / Gemini 2.5 Flash |
| **本番URL** | https://ai-care-shift-scheduler.web.app |
| **GitHub** | https://github.com/yasushi-honda/ai-care-shift-scheduler |

---

## 最新完了ステータス（2025-12-09 18:00 JST）

| Phase/BUG | 内容 | ステータス |
|-----------|------|-----------|
| BUG-020 | アコーディオン展開UI重複修正 | ✅ 解決済み |
| Phase 54 | AI評価履歴・再評価機能 | ✅ 完了 |
| Phase 53 | 制約レベル別評価システム | ✅ 完了 |
| BUG-019 | Firestoreインデックスデプロイ | ✅ 解決済み |
| AI評価レポート | 総合スコア4.0/5.0 | クライアント納品可能レベル |

---

## 次のタスク候補

### 優先度高
1. **Phase 45継続**: AIシフト生成進行状況表示機能（作業中）

### 中期改善（保守フェーズ）
2. EvaluationServiceのリファクタリング（1000行超→分割）
3. 評価ロジックのユニットテスト追加
4. Few-shot例のプロンプト追加

### 長期構想
5. ハイブリッドアプローチ（LLM + 制約ソルバー）調査
6. Evalシステム構築（複数テストケース自動実行）

---

## 重要な技術的制約（必ず守ること）

### 1. Gemini 2.5 Flash設定
- `@google/genai` SDK使用必須
- `maxOutputTokens: 65536`
- `thinkingBudget: 16384`
- `responseSchema`/`responseMimeType`使用禁止

### 2. デプロイワークフロー
- Firebase CLI認証エラー時はGitHub Actions経由でデプロイ
- コード変更後はCodeRabbitレビュー必須

### 3. AIシステムの位置づけ
- 「完全自動シフト生成」ではなく「叩き台提供」
- 最終判断は人間が行う前提

### 4. アコーディオンUI（BUG-020）
- `max-h-screen`方式は使用禁止
- CSS Grid方式（`grid-rows-[0fr]/[1fr]`）を使用

---

## 関連ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| `.kiro/HANDOFF-2025-12-09.md` | 最新引き継ぎ |
| `.kiro/ai-system-evaluation-2025-12-09.md` | AI評価レポート |
| `.kiro/bugfix-accordion-overlap-2025-12-09.md` | BUG-020修正詳細 |
| `.kiro/ai-quality-improvement-guide.md` | 品質改善ガイド |
| `docs/index.html` | GitHub Pagesホーム |
| `docs/bugfix-accordion-overlap-2025-12-09.html` | BUG-020説明ページ |

---

## Serenaメモリ（参照推奨）

```bash
# 最新（2025-12-09）
read_memory PROJECT_HANDOFF_LATEST
read_memory ai_system_evaluation_2025-12-09
read_memory bug019_firestore_index_cicd_2025-12-09

# 重要（常時参照推奨）
read_memory project_overview
read_memory tech_stack
```

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-09 18:00 JST
