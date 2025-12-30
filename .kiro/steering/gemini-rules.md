# Gemini マルチモデル設定ルール

**最終更新**: 2025-12-30
**対象**: Cloud Functions での Gemini API 利用
**バージョン**: AI_CONFIG_VERSION 2.1.0-japan

---

## BUG-022: シングルモデル戦略（2025-12-30 更新）

### 背景

Gemini 2.5 Flashの`thinkingBudget`が無視されるバグが発生。さらに調査の結果、以下の制限が判明:

| Model | asia-northeast1 | 問題 |
|-------|-----------------|------|
| gemini-2.5-pro | ✅ | thinking常時ON（**採用**） |
| gemini-2.5-flash | ✅ | thinkingBudgetバグ（使用不可） |
| gemini-2.5-flash-lite | ❌ | 未対応 |
| gemini-3-flash | ❌ | 未対応（globalのみ） |
| gemini-2.0-flash | ❌ | 未対応 |

### 対策: asia-northeast1 + gemini-2.5-proのみ

**日本国内データ処理要件**のため、global endpointは使用せず、asia-northeast1で利用可能なモデルのみ使用。

結果: **全タスクでgemini-2.5-proを使用**（コスト高いが安定・データ居住地保証）

### モデル割り当て（現行）

| セクション | プライマリ | フォールバック | 理由 |
|-----------|-----------|---------------|------|
| Phase 1 骨子生成 | `gemini-2.5-pro` | `gemini-2.5-pro` | 深い推論が必要 |
| Phase 2 詳細バッチ | `gemini-2.5-pro` | `gemini-2.5-pro` | 日本リージョンで他選択肢なし |
| 小規模生成 (≤5名) | `gemini-2.5-pro` | `gemini-2.5-pro` | 正確性重視 |

### 設定例

```typescript
import { GENERATION_CONFIGS, buildGeminiConfig, AI_LOCATION } from './ai-model-config';

// asia-northeast1（日本リージョン）でクライアント作成
const client = new GoogleGenAI({
  vertexai: true,
  project: projectId,
  location: AI_LOCATION, // 'asia-northeast1'
});

// gemini-2.5-pro（thinking常時ON、thinkingConfig不要）
const result = await client.models.generateContent({
  model: 'gemini-2.5-pro',
  contents: prompt,
  config: buildGeminiConfig(GENERATION_CONFIGS.skeleton.primary),
});
```

### 重要: thinkingConfigは使用しない

- **gemini-2.5-pro**: thinking常時有効（無効化できない）
- thinkingConfig設定は不要（バグ回避）

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

### タイムアウト設定（BUG-004/010/022）

**BUG-022対応**: gemini-2.5-pro（thinking常時ON）は処理時間が大幅に増加

| スタッフ数 | 想定処理時間 | クライアントタイムアウト |
|-----------|-------------|------------------------|
| 5名以下 | 90-180秒 | 240秒 |
| 6-10名 | 180-300秒 | 360秒 |
| 11-15名 | 300-400秒 | 420秒 |
| 16名以上 | 400秒以上 | 540秒 |

**設計原則**: `想定処理時間 × 1.1 < クライアント(360s) < サーバー(540s)`

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
