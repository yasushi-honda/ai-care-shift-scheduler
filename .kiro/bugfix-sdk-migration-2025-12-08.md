# BUG-012: @google/genai SDK移行

**発生日**: 2025-12-08
**修正日**: 2025-12-08
**重要度**: 高（AI生成が完全に失敗）

## 症状

本番環境でAIシフト生成がMAX_TOKENSエラーで100%失敗：

```
finishReason: 'MAX_TOKENS',
thoughtsTokenCount: 65535  // 思考トークンが上限まで使用
responseLength: 0  // 出力が空
```

## 根本原因

`@google-cloud/vertexai` SDK（v1.10.0）は`thinkingConfig`パラメータをサポートしていない。

コードに`thinkingConfig: { thinkingBudget: 16384 }`を設定していたが、SDKが認識しないため無視されていた。

### SDK比較

| SDK | thinkingConfig | Gemini 2.5思考モード |
|-----|----------------|---------------------|
| `@google-cloud/vertexai` | ❌ 未サポート | 自動（制限不可） |
| `@google/genai` | ✅ サポート | 制御可能 |

## 解決策

`@google-cloud/vertexai` から `@google/genai` SDKに移行：

### 変更前（@google-cloud/vertexai）

```typescript
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: projectId,
  location: 'asia-northeast1',
});

const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: {
    maxOutputTokens: 65536,
    thinkingConfig: {  // ❌ 無視される
      thinkingBudget: 16384,
    },
  } as any,
});

const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
```

### 変更後（@google/genai）

```typescript
import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({
  vertexai: true,
  project: projectId,
  location: 'asia-northeast1',
});

const result = await client.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,  // 直接文字列でOK
  config: {
    maxOutputTokens: 65536,
    thinkingConfig: {  // ✅ 正しく機能
      thinkingBudget: 16384,
    },
  },
});

const responseText = result.text || '';  // シンプルなAPI
```

## 変更ファイル

1. `functions/package.json` - `@google/genai`依存関係追加
2. `functions/src/phased-generation.ts` - generateSkeleton, generateDetailedShifts
3. `functions/src/shift-generation.ts` - 小規模一括生成

## 検証

1. TypeScriptビルド成功
2. CI/CDパイプライン通過
3. 本番環境でAI生成成功（ユーザー検証待ち）

## 教訓

1. **SDK選択の重要性**: 新しいモデル機能（思考モード）を使う場合、SDKがサポートしているか確認
2. **型キャスト（as any）の警告**: `as any`を使った箇所は実際に機能しているか検証が必要
3. **ログの重要性**: `thoughtsTokenCount`のログがなければ原因特定が困難だった

## 参考資料

- [Thinking | Generative AI on Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thinking)
- [@google/genai npm](https://www.npmjs.com/package/@google/genai)
- [Google Gen AI SDK GitHub](https://github.com/googleapis/js-genai)
