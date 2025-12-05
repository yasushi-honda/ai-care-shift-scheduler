# BUG-003: Gemini 2.5 Flash 思考トークン問題修正記録

**発見日**: 2025-12-05
**修正完了日**: 2025-12-05
**重要度**: Critical（本番環境でAIシフト生成が完全に動作不能）
**前提バグ**: BUG-002（propertyOrdering追加）修正後に発覚

---

## 概要

BUG-002修正後も「Failed to parse Gemini JSON response: Unexpected end of JSON input」エラーが継続。しかし今回は**原因が異なる**。

- **BUG-002**: `propertyOrdering`なしで空レスポンス
- **BUG-003**: `MAX_TOKENS`（トークン制限超過）で空レスポンス

## エラー内容

```
❌ JSON Parse Error: SyntaxError: Unexpected end of JSON input
Response text length: 0
```

**新しいログ情報**（BUG-002修正で追加したデバッグログにより発見）:
```
📊 Vertex AI Response Details: {
  candidatesCount: 1,
  finishReason: 'MAX_TOKENS',  ← 重要！
  usageMetadata: {
    promptTokenCount: 985,
    totalTokenCount: 9176,
    thoughtsTokenCount: 8191  ← 思考に8191トークン消費
  }
}
```

**ポイント**: `finishReason: 'MAX_TOKENS'` + `thoughtsTokenCount: 8191` → 思考トークンがmaxOutputTokens(8192)を使い切り、出力用トークンが残らなかった

---

## 根本原因分析

### Gemini 2.5 Flash「思考モード」の仕様

Gemini 2.5 Flash/Proには「思考モード（Thinking Mode）」が内蔵されており、複雑な問題を段階的に推論する。

**問題点**:
- 思考トークン（`thoughtsTokenCount`）は`maxOutputTokens`の予算から消費される
- 思考に多くのトークンを使うと、実際の出力に使えるトークンが不足
- `thoughtsTokenCount + outputTokenCount > maxOutputTokens`の場合、`finishReason: 'MAX_TOKENS'`で空レスポンス

### 既知の問題（外部報告）

[googleapis/python-genai Issue #782](https://github.com/googleapis/python-genai/issues/782):
> "If MAX_TOKENS finish reason is triggered, the response text is empty, making debugging very difficult."

---

## 修正内容

### 修正ファイル

1. `functions/src/phased-generation.ts`
2. `functions/src/shift-generation.ts`

### 修正内容

```typescript
// Before
maxOutputTokens: 8192,

// After
maxOutputTokens: 65536,  // Gemini 2.5 Flash thinking mode uses tokens from this budget
```

**変更箇所**: 3箇所（phased-generation.ts: 2箇所、shift-generation.ts: 1箇所）

### なぜ65536か

- Gemini 2.5 Flashの最大出力トークン: 65,536（asia-northeast1リージョン）
- 思考トークン（~8,000-16,000）+ 出力トークン（~4,000-8,000）を十分にカバー
- コスト影響: 出力トークン単価は変わらないため、実際に使用したトークン分のみ課金

---

## 調査プロセス（ドキュメントドリブン）

### Step 1: Cloud Functionsログ確認

```bash
gcloud functions logs read generateShift --region=asia-northeast1 --project=ai-care-shift-scheduler --limit=30
```

結果:
- `finishReason: 'MAX_TOKENS'` を発見
- `thoughtsTokenCount: 8191` を発見

### Step 2: BUG-002デバッグログの効果

BUG-002修正時に追加したデバッグログにより、今回の問題を即座に特定できた：
```typescript
console.log('📊 Vertex AI Response Details:', {
  finishReason: candidate?.finishReason || 'N/A',
  usageMetadata: response.usageMetadata || {},
});
```

### Step 3: Web検索による裏付け

- [googleapis/python-genai Issue #782](https://github.com/googleapis/python-genai/issues/782)
- [Google AI Developers Forum: max_output_tokens isn't respected](https://discuss.ai.google.dev/t/max-output-tokens-isnt-respected-when-using-gemini-2-5-flash-model/106708)

---

## BUG-001/002/003の関連

```
BUG-001: CORSエラー
  ↓ 修正後
BUG-002: propertyOrderingなしで空レスポンス
  ↓ 修正後（+ デバッグログ追加）
BUG-003: MAX_TOKENSで空レスポンス ← デバッグログのおかげで即特定
```

**教訓**: 適切なログを残すことで、次の問題発見が格段に早くなる

---

## 技術的詳細

### Gemini 2.5 Flash 思考モードのトークン消費

| カテゴリ | 今回のケース |
|---------|-------------|
| プロンプトトークン | 985 |
| 思考トークン | 8,191 |
| 出力トークン | 0（不足） |
| 合計 | 9,176 |
| maxOutputTokens設定 | 8,192 |
| 結果 | MAX_TOKENS + 空レスポンス |

### 修正後の予想

| カテゴリ | 予想 |
|---------|------|
| プロンプトトークン | ~1,000 |
| 思考トークン | ~8,000-16,000 |
| 出力トークン | ~4,000-8,000 |
| 合計 | ~13,000-25,000 |
| maxOutputTokens設定 | 65,536 |
| 結果 | 正常完了 |

---

## 再発防止策

### 1. モニタリング

以下の指標を監視：
- `finishReason`: `STOP`以外（特に`MAX_TOKENS`）は警告
- `thoughtsTokenCount`: 急増している場合は調査

### 2. 設定ルール（CLAUDE.md更新）

```
maxOutputTokens: 65536  // Gemini 2.5 Flash思考モード対応
```

---

## 関連ドキュメント

- [BUG-001修正記録](bugfix-cors-cloud-functions-2025-12-05.md) - CORSエラー
- [BUG-002修正記録](bugfix-gemini-empty-response-2025-12-05.md) - propertyOrdering
- [gemini_region_critical_rule](.serena/memories/gemini_region_critical_rule.md) - リージョン設定ルール

---

## 学び・教訓

1. **デバッグログの価値**: BUG-002で追加したログがBUG-003の即時発見に貢献
2. **Gemini 2.5の新機能に注意**: 思考モードは強力だが、トークン消費に影響
3. **空レスポンスには複数の原因**: `responseLength: 0`だけでは原因特定不可、`finishReason`確認が必須
4. **余裕を持った設定**: トークン制限は余裕を持って設定（8192 → 65536）

---

## 修正コミット

```
fix(BUG-003): increase maxOutputTokens for Gemini 2.5 Flash thinking mode

- Increase maxOutputTokens from 8192 to 65536
- Gemini 2.5 Flash uses thinking tokens from this budget
- When thoughtsTokenCount exceeds budget, response text is empty
- Reference: googleapis/python-genai#782
```
