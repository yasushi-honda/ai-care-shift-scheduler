# Gemini 2.5 Flash 設定ルール

**最終更新**: 2025-12-29
**対象**: Cloud Functions での Gemini API 利用

---

## クイックリファレンス

```typescript
import { GoogleGenAI } from '@google/genai';  // ❗ 必須SDK

const client = new GoogleGenAI({
  vertexai: true,
  project: projectId,
  location: 'asia-northeast1',
});

const result = await client.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
  config: {
    maxOutputTokens: 65536,      // ❗ 必須
    thinkingConfig: {
      thinkingBudget: 16384,     // ❗ 必須
    },
    // responseSchema: 使用禁止（thinkingBudgetと非互換）
    // responseMimeType: 使用禁止（thinkingBudgetと非互換）
  },
});
```

---

## 必須ルール一覧

| ルール | 設定値 | 理由 |
|--------|--------|------|
| SDK | `@google/genai` | `@google-cloud/vertexai`はthinkingConfig非対応 |
| maxOutputTokens | `65536` | 思考+出力で12,000-24,000消費 |
| thinkingBudget | `16384` | 思考トークンの上限制御 |
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
- ポストモーテム → `.kiro/postmortem-gemini-bugs-2025-12-05.md`
