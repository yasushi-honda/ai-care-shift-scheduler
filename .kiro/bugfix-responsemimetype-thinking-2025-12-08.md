# BUG-014: responseMimeTypeとthinkingBudgetの非互換性修正

**更新日**: 2025-12-08
**コミット**: e927af8
**重要度**: Critical

## 問題

BUG-013で`responseSchema`を削除したが、`thinkingBudget: 16384`が依然として無視されていた。

### ログ証拠

```
📊 Vertex AI Response Details: {
  finishReason: 'MAX_TOKENS',
  usageMetadata: {
    promptTokenCount: 1675,
    totalTokenCount: 67210,
    trafficType: 'ON_DEMAND',
    thoughtsTokenCount: 65535  // ← 16384に制限されていない！
  }
}
```

- `thinkingBudget: 16384`を設定しているのに、`thoughtsTokenCount: 65535`
- 思考トークンで全予算を消費し、出力が0トークン
- JSON Parseエラー発生

## 原因

**`responseMimeType: 'application/json'`も`thinkingBudget`を無視する**

Google AI Developers Forumで同様の問題が報告されている:
https://discuss.ai.google.dev/t/latest-google-genai-with-2-5-flash-ignoring-thinking-budget/102497

> "I just removed the json schema from the call and it seems to respect the thinking budget now."

BUG-013で`responseSchema`を削除したが、`responseMimeType`は残していたためthinkingBudgetが機能しなかった。

## 修正内容

### 1. generateSkeleton / generateDetailedShifts

```typescript
// ❌ 修正前
const result = await client.models.generateContent({
  model: VERTEX_AI_MODEL,
  contents: prompt,
  config: {
    responseMimeType: 'application/json',  // ← これが原因
    thinkingConfig: {
      thinkingBudget: 16384,  // ← 無視される
    },
  },
});

// ✅ 修正後
const jsonPrompt = `${prompt}

# 🔴 絶対厳守: JSON出力形式
以下の形式で**純粋なJSONのみ**を出力してください。
\`\`\`json
{ "staffSchedules": [...] }
\`\`\`
`;

const result = await client.models.generateContent({
  model: VERTEX_AI_MODEL,
  contents: jsonPrompt,
  config: {
    // responseMimeType削除
    thinkingConfig: {
      thinkingBudget: 16384,  // ← 正しく機能
    },
  },
});
```

### 2. parseGeminiJsonResponse

テキスト中からJSONを抽出するロジックを追加:

```typescript
// 1. Markdownコードブロック内のJSONを抽出
const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

// 2. テキスト中の { ... } または [ ... ] を抽出
const jsonObjectMatch = cleanedText.match(/(\{[\s\S]*\})/);
```

## 期待される動作

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| thoughtsTokenCount | 65535 | ~16000以下 |
| finishReason | MAX_TOKENS | STOP |
| 出力トークン | 0 | 数千 |
| 結果 | JSON Parse Error | 正常なJSON |

## 関連バグ

| BUG ID | 問題 | 修正内容 |
|--------|------|---------|
| BUG-012 | @google-cloud/vertexaiがthinkingConfigをサポートしない | @google/genaiに移行 |
| BUG-013 | responseSchemaがthinkingBudgetを無視 | responseSchema削除 |
| **BUG-014** | responseMimeTypeもthinkingBudgetを無視 | responseMimeType削除 |

## 教訓

Gemini 2.5 Flash + thinkingConfig を使用する場合:

1. `responseSchema`を使用しない
2. `responseMimeType`も使用しない
3. プロンプトでJSON形式を明示的に指示
4. parseGeminiJsonResponseでテキストからJSONを抽出

## 参考資料

- [Google AI Developers Forum - thinkingBudget無視問題](https://discuss.ai.google.dev/t/latest-google-genai-with-2-5-flash-ignoring-thinking-budget/102497)
- [BUG-013修正記録](.kiro/bugfix-json-schema-thinking-2025-12-08.md)
