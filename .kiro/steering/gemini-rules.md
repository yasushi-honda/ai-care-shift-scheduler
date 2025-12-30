# Gemini マルチモデル設定ルール

**最終更新**: 2025-12-30
**対象**: Cloud Functions での Gemini API 利用

---

## BUG-022: マルチモデル戦略（2025-12-30）

Gemini 2.5 FlashのthinkingBudgetが無視されるバグ対応として、セクション別にモデルを使い分け。

### モデル割り当て

| セクション | プライマリ | フォールバック |
|-----------|-----------|---------------|
| Phase 1 骨子生成 | `gemini-3-flash-preview` (thinkingLevel: high) | `gemini-2.5-pro` |
| Phase 2 詳細バッチ | `gemini-2.5-flash-lite` (thinkingBudget: 0) | `gemini-3-flash-preview` |
| 小規模生成 (≤5名) | `gemini-3-flash-preview` (thinkingLevel: medium) | `gemini-2.5-flash-lite` |

### Gemini 3 vs 2.5 の違い

| パラメータ | Gemini 3 | Gemini 2.5 |
|-----------|----------|------------|
| 思考制御 | `thinkingLevel` (low/medium/high) | `thinkingBudget` (数値) |
| 安定性 | ✅ 動作確認済 | ⚠️ バグあり (BUG-022) |
| 無効化 | `thinkingLevel: 'minimal'` | `thinkingBudget: 0` |

### 設定例

```typescript
import { GENERATION_CONFIGS, buildGeminiConfig } from './ai-model-config';

// Gemini 3 Flash (thinkingLevel)
const result = await client.models.generateContent({
  model: 'gemini-3-flash-preview',
  contents: prompt,
  config: buildGeminiConfig(GENERATION_CONFIGS.skeleton.primary),
});

// Gemini 2.5 Flash-Lite (thinkingBudget: 0)
const result = await client.models.generateContent({
  model: 'gemini-2.5-flash-lite',
  contents: prompt,
  config: buildGeminiConfig(GENERATION_CONFIGS.detailBatch.primary),
});
```

---

## 共通ルール

| ルール | 設定値 | 理由 |
|--------|--------|------|
| SDK | `@google/genai` | `@google-cloud/vertexai`はthinkingConfig非対応 |
| maxOutputTokens | `65536` | 思考+出力の合計上限 |
| responseSchema | **使用禁止** | thinkingBudgetを無視する |
| responseMimeType | **使用禁止** | thinkingBudgetを無視する |
| サーバータイムアウト | `300秒` | Cloud Functions設定 |
| クライアントタイムアウト | `240秒` | fetch AbortController |

---

## 詳細説明

### SDK選択（BUG-012）

```typescript
// ✅ 正しい
import { GoogleGenAI } from '@google/genai';

// ❌ 禁止 - thinkingConfigが機能しない
import { VertexAI } from '@google-cloud/vertexai';
```

### maxOutputTokens: 65536（BUG-003）

思考モードは`maxOutputTokens`から思考トークンを消費する。

| カテゴリ | 典型的な消費 |
|---------|-------------|
| 思考トークン | 8,000-16,000 |
| 出力トークン | 4,000-8,000 |
| **合計** | 12,000-24,000 |

`8192`では思考だけで使い切り、出力が空になる。

### thinkingBudget: 16384（BUG-008）

スタッフ数増加で思考トークン消費が急増。必ず上限を設定。

| 処理種別 | thinkingBudget |
|----------|----------------|
| generateSkeleton | 16384 |
| generateDetailedShifts | 8192 |
| 小規模一括生成（5名以下） | 16384 |

### responseSchema/responseMimeType禁止（BUG-013/014）

**どちらも`thinkingBudget`を無視する**（Gemini APIの既知問題）。

```typescript
// ❌ 禁止
config: {
  responseSchema: schema,
  thinkingConfig: { thinkingBudget: 16384 },  // 無視される！
}

// ✅ 正しい - プロンプトでJSON形式を指示
const jsonPrompt = `${prompt}

# 出力形式
\`\`\`json
{ "staffSchedules": [...] }
\`\`\`
`;
```

参考: https://discuss.ai.google.dev/t/latest-google-genai-with-2-5-flash-ignoring-thinking-budget/102497

### タイムアウト設定（BUG-004/010）

| スタッフ数 | 想定処理時間 | クライアントタイムアウト |
|-----------|-------------|------------------------|
| 5名以下 | 60-90秒 | 120秒 |
| 6-10名 | 90-150秒 | 180秒 |
| 11-15名 | 150-240秒 | 240秒 |
| 16名以上 | 240秒以上 | 300秒 |

**設計原則**: `想定処理時間 × 1.2 < クライアント(240s) < サーバー(300s)`

### 429エラー対策（Phase 51）

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 2000,
  maxDelayMs: 32000,
  backoffMultiplier: 2,
};
```

---

## デバッグログ必須項目

```typescript
console.log('📊 AI Response Details:', {
  finishReason,          // 'STOP'以外は異常
  responseLength,        // 0は異常
  usageMetadata: {
    promptTokenCount,
    thoughtsTokenCount,  // 思考トークン消費量
    candidatesTokenCount,
    totalTokenCount,
  },
  processingTimeMs,
});
```

| finishReason | 意味 | 対処 |
|-------------|------|------|
| `STOP` | 正常完了 | なし |
| `MAX_TOKENS` | トークン不足 | maxOutputTokens増加 |
| `SAFETY` | 安全性フィルタ | プロンプト見直し |

---

## 関連バグ修正記録

- BUG-002: propertyOrdering → `.kiro/bugfix-gemini-empty-response-2025-12-05.md`
- BUG-003: maxOutputTokens → `.kiro/bugfix-gemini-thinking-tokens-2025-12-05.md`
- BUG-008: thinkingBudget → `.kiro/bugfix-thinking-budget-2025-12-08.md`
- BUG-012: SDK移行 → `.kiro/bugfix-sdk-migration-2025-12-08.md`
- BUG-013: responseSchema → `.kiro/bugfix-json-schema-thinking-2025-12-08.md`
- BUG-014: responseMimeType → `.kiro/bugfix-responsemimetype-thinking-2025-12-08.md`
- **BUG-022: マルチモデル戦略** → `functions/src/ai-model-config.ts`
- ポストモーテム → `.kiro/postmortem-gemini-bugs-2025-12-05.md`
