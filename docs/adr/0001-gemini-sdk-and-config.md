# ADR-0001: Gemini SDK選択と設定ルール

**日付**: 2025-12-05（遡及記録）
**ステータス**: 採用
**関連バグ**: BUG-002, BUG-003, BUG-008, BUG-012, BUG-013, BUG-014, BUG-022

## コンテキスト

Cloud FunctionsからGemini APIを呼び出す際、複数のSDKとAPI設定オプションが存在する。当初の実装では設定不備による空レスポンスや推論品質の低下が頻発した。

### 主な問題

1. `@google-cloud/vertexai` SDKでは`thinkingConfig`が機能しない
2. `maxOutputTokens`を低く設定すると思考トークンで枯渇して出力が空になる
3. `responseSchema`/`responseMimeType`を使用するとthinkingが無効化される
4. asia-northeast1リージョンでは使用可能なモデルが限定される

## 決定

### SDK: `@google/genai`を使用

```typescript
// 採用
import { GoogleGenAI } from '@google/genai';

// 禁止
import { VertexAI } from '@google-cloud/vertexai';
```

### API設定ルール

| 設定 | 値 | 理由 |
|------|-----|------|
| maxOutputTokens | `65536` | 思考+出力の合計上限 |
| responseSchema | 使用禁止 | thinkingを無効化する |
| responseMimeType | 使用禁止 | thinkingを無効化する |
| モデル | `gemini-2.5-pro` | asia-northeast1で安定動作する唯一の選択肢 |

### リージョン: `asia-northeast1`固定

日本国内データ処理要件のため、global endpointは使用しない。

## 影響

- **正**: 推論品質が安定、空レスポンスが解消
- **負**: gemini-2.5-proはコストが高い

## 参照

- [gemini-rules.md](../../.kiro/steering/gemini-rules.md)
- [postmortem-gemini-bugs-2025-12-05.md](../../.kiro/postmortem-gemini-bugs-2025-12-05.md)
