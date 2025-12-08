# AI Care Shift Scheduler - 引継ぎプロンプト

**作成日**: 2025-12-08
**前任者**: Claude Opus 4.5

---

## 次のAIへの引継ぎプロンプト

以下のプロンプトをそのままコピーして次のAIセッションに貼り付けてください：

---

```
# AI Care Shift Scheduler 引継ぎ

## プロジェクト概要
介護施設向けのAI自動シフト生成システム。
Gemini 2.5 Flash + Vertex AI を使用して月間シフトを自動生成。

## 直近の作業内容（Phase 46-49 + BUG-012〜014）

### Phase 46: バグ修正（完了）
- BUG-008: thinkingBudget制限追加
- BUG-009: デモユーザー権限同期
- BUG-010: タイムアウト延長（180s→240s）

### Phase 47-49: AI品質改善（完了）
- `buildDynamicPartTimeConstraints`関数追加
- `buildDynamicConsecutiveConstraints`関数追加
- `buildDynamicStaffingConstraints`関数追加

### BUG-012〜015: Gemini thinkingBudget問題・形式変換（完了・検証待ち）
- BUG-012: @google/genai SDKに移行（thinkingConfig対応）
- BUG-013: responseSchema削除（thinkingBudgetと非互換）
- BUG-014: responseMimeType削除（これもthinkingBudgetを無視）
- **BUG-015: generateDetailedShiftsの出力形式変換追加（shifts → monthlyShifts）**
- 参考: https://discuss.ai.google.dev/t/latest-google-genai-with-2-5-flash-ignoring-thinking-budget/102497

## 最優先タスク

1. **本番環境でAI生成テスト**
   - デモログインでシフト管理 → AI自動生成を実行
   - 評価パネルで以下を確認：
     - 連続勤務超過: 0件（目標）
     - 制約違反合計: 10件以下（SLA目標）
     - 総合スコア: 70点以上（目標）

2. **結果に応じた対応**
   - 目標達成 → ドキュメント更新、コミット
   - 目標未達 → 根本原因分析、追加修正

## 重要な設計原則

### 動的制約生成パターン（CLAUDE.md参照）
1. データ駆動型: staffListから動的に抽出
2. 条件付き生成: 該当者がいなければ空文字
3. 明示的な警告: 「違反したシフトは無効」
4. 可読性重視: スタッフ名をリスト化

### Gemini 2.5 Flash設定（重要！）
- SDK: @google/genai（@google-cloud/vertexaiは使用禁止）
- location: 'asia-northeast1'（日本リージョン必須）
- model: 'gemini-2.5-flash'（-latestなし）
- maxOutputTokens: 65536
- thinkingBudget: 16384
- **responseSchema使用禁止**（thinkingBudgetを無視）
- **responseMimeType使用禁止**（thinkingBudgetを無視）
- → プロンプト末尾でJSON出力を明示指定

## 必読ドキュメント

1. `.kiro/HANDOFF-2025-12-08.md` - 詳細な引継ぎ情報
2. `CLAUDE.md` - プロジェクトルール・設計パターン
3. `.kiro/ai-production-quality-review-2025-12-08.md` - AI品質レビュー

## Serenaメモリ

以下のメモリを読むことを推奨：
- `PROJECT_HANDOFF_LATEST` - 最新引継ぎ情報
- `bug014_responsemimetype_thinking_budget_2025-12-08` - BUG-014
- `gemini_thinking_budget_critical_rule` - Gemini設定ルール
- `ai_production_quality_review_2025-12-08` - AI品質レビュー

## 検証コマンド

```bash
# デプロイ確認
gh run list --limit 1

# Cloud Functionsログ確認
gcloud functions logs read generateShift --region=asia-northeast1 --limit=50

# 権限検証（権限エラー時）
npx tsx scripts/verifyDemoPermissions.ts
```

## 注意事項

- CLAUDE.mdを必ず読んでからコード変更すること
- 新しい制約を追加する場合は動的制約パターンに従うこと
- デプロイはGitHub Actions経由（直接firebase deployは使わない）
```

---

## 使用方法

1. 上記のMarkdownブロック内（```で囲まれた部分）をコピー
2. 新しいAIセッションを開始
3. 最初のメッセージとして貼り付け
4. AIが引継ぎ内容を理解してから作業開始

## 補足情報

### 本番環境URL
- https://ai-care-shift-scheduler.web.app/

### GitHub Actions
- `.github/workflows/firebase-hosting-merge.yml` でmainブランチへのプッシュ時に自動デプロイ

### 権限エラーが発生した場合
1. `firestore.rules`のhasRole関数を確認
2. `npx tsx scripts/verifyDemoPermissions.ts`で検証
3. users.facilitiesとfacilities.membersの両方を同期

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
