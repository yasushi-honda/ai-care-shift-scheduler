# Phase 44: AIシフト生成パイプライン改善 - 引継ぎドキュメント

**作成日時**: 2025-12-07 22:30
**最終更新**: 2025-12-07 22:50
**対象**: 別AIセッションへの引継ぎ用

---

## 1. エグゼクティブサマリー

### プロジェクト概要
- **システム**: 介護施設向けAIシフト自動生成システム
- **対象施設**: デイサービス（日曜休業、夜勤なし）
- **AIモデル**: Gemini 2.5 Flash（思考モード有効）
- **技術スタック**: React + TypeScript + Firebase + Cloud Functions

### Phase 44 の目的
シフト生成の品質向上（充足率100%、制約違反0件を目指す）

### 現在の進捗: **約95%完了** ✅

| 項目 | 状態 |
|------|------|
| 根本原因分析 | ✅ 完了 |
| デモデータ修正 | ✅ 完了 |
| 評価ロジック改善 | ✅ 完了 |
| プロンプト強化（日勤のみ制約） | ✅ **完了** |
| 看護師配置ロジック強化 | ✅ **完了** |
| timeSlotPreference違反検出 | ✅ **完了** |

---

## 2. 今回のセッションで解決した問題

### 2.1 動的プロンプト制約の実装

**問題**:
- 田中太郎: `timeSlotPreference = "日勤のみ"`
- 実際の配置: 早番12日、日勤8日 ← AIが制約を無視していた

**解決策**: `buildDynamicTimeSlotConstraints()` 関数を追加

```typescript
// スタッフデータから動的に制約を生成（ハードコードなし）
const dayOnlyStaff = staffList.filter(
  s => s.timeSlotPreference === TimeSlotPreference.DayOnly
);
```

**効果**: 田中太郎の配置が「日勤21日 + 休10日」に改善

### 2.2 看護師配置制約の動的生成

**問題**: 8日間看護師が日勤に未配置

**解決策**: `buildDynamicNurseConstraints()` 関数を追加

```typescript
// 看護師資格保有者を動的に抽出し、制約を生成
const nurses = staffList.filter(staff =>
  (staff.qualifications || []).some(q => String(q).includes('看護師'))
);
```

### 2.3 timeSlotPreference違反検出

**追加機能**: `checkTimeSlotPreferenceViolation()` メソッド

- 「日勤のみ」スタッフの早番・遅番配置を検出
- 「夜勤のみ」スタッフの日勤配置を検出
- 評価スコアに自動反映

---

## 3. テスト結果比較

### Before（プロンプト強化前）
```
充足率: 96%
制約違反: 12件
田中太郎: 早番12日、日勤8日（timeSlotPreference違反）
timeSlotPreference違反: あり
```

### After（プロンプト強化後）
```
充足率: 98%  (+2ポイント)
制約違反: 3件  (-75%)
田中太郎: 日勤21日、休10日 ✅
timeSlotPreference違反: なし ✅
```

---

## 4. 残存課題

### 軽微な問題（Phase 45以降で対応可能）

1. **早番人員不足が3日残存**
   - staffShortage 3件
   - 数学的制約の可能性（スタッフ数 vs 必要人員）

2. **処理時間が長い（約180秒）**
   - 思考トークン約57,000消費
   - コストは1回約4円で許容範囲

---

## 5. 関連ファイル一覧

### 今回修正したコード
| ファイル | 変更内容 |
|----------|----------|
| `functions/src/shift-generation.ts` | `buildDynamicTimeSlotConstraints()`, `buildDynamicNurseConstraints()` 追加 |
| `functions/src/phased-generation.ts` | `buildDetailedDynamicConstraints()` 追加 |
| `functions/src/evaluation/evaluationLogic.ts` | `checkTimeSlotPreferenceViolation()` 追加 |

### 参照ドキュメント
| ファイル | 説明 |
|----------|------|
| `docs/phase44-root-cause-analysis-2025-12-07.md` | 根本原因分析 |
| `docs/phase44-final-evaluation-meeting-2025-12-07.md` | 評価ミーティング |
| `docs/phase44-ai-shift-pipeline.html` | ダッシュボード |

---

## 6. Gemini 2.5 Flash コスト分析（2025年12月時点）

### 最新料金（Pay-as-you-go）

| 項目 | 料金（100万トークンあたり） |
|------|--------------------------|
| 入力トークン | $0.30 |
| 出力トークン（思考含む） | $2.50 |
| バッチ処理（入力） | $0.15 |
| バッチ処理（出力） | $1.25 |

**出典**: [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)

### 今回のシフト生成コスト計算

| Phase | 入力 | 思考+出力 | 小計 |
|-------|------|----------|------|
| Phase 1（骨子） | 910 | 57,378 | $0.143 |
| Phase 2（詳細） | 約2,000 | 8,422 | $0.022 |
| **合計** | | | **約$0.165（約25円）** |

### コスト試算

| シナリオ | コスト |
|----------|--------|
| 1回のシフト生成 | 約25円 |
| 月間10施設 | 約250円/月 |
| 年間10施設 | 約3,000円/年 |

### コスト最適化オプション

1. **バッチ処理活用**: 50%コスト削減可能
2. **Gemini 2.5 Flash-Lite**: $0.10入力/$0.40出力（最大80%削減、ただし品質検証必要）
3. **Context Caching**: 繰り返し呼び出しで$0.03/1Mに削減

**結論**: 1回25円、月間250円は十分に低コスト。品質維持のため現状維持を推奨。

---

## 7. Serenaメモリ参照

次のセッションで読むべきメモリ:
- `phase44_dynamic_constraints_2025-12-07`（今回作成）
- `phase44_completion_handoff_2025-12-07`
- `gemini_max_output_tokens_critical_rule`
- `gemini_region_critical_rule`

---

## 8. 次のセッションへの引継ぎプロンプト

```
【引継ぎコンテキスト】
Phase 44: AIシフト生成パイプライン改善は約95%完了しました。

【達成済み】
- 充足率98%達成（目標100%）
- timeSlotPreference違反検出と動的プロンプト制約を実装
- 田中太郎の「日勤のみ」制約が正しく適用されるようになった
- Gemini 2.5 Flashコスト分析完了（1回約25円、月間10施設で約250円）

【実装した機能】
1. buildDynamicTimeSlotConstraints() - 日勤のみ/夜勤のみ制約を動的生成
2. buildDynamicNurseConstraints() - 看護師配置制約を動的生成
3. checkTimeSlotPreferenceViolation() - 違反検出と評価スコア反映

【残存課題（軽微）】
- 早番人員不足が3日残存（数学的制約の可能性）
- Phase 45以降で対応可能

【参照ドキュメント】
- docs/phase44-handoff-summary-2025-12-07.md（この文書）
- Serenaメモリ: phase44_dynamic_constraints_2025-12-07
- Serenaメモリ: PROJECT_HANDOFF_LATEST（最初に読むべき）

【次のPhase候補】
- Phase 45: 通知機能（シフト変更通知、休暇残高アラート）
- または残存課題の完全解決
```

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-07 22:50
