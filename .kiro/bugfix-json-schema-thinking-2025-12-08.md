# BUG-013: JSONスキーマとthinkingBudgetの非互換性

**発生日**: 2025-12-08
**修正日**: 2025-12-08
**状態**: 修正完了
**重要度**: 高（AI生成が100%失敗）

## 症状

BUG-012で`@google/genai` SDKに移行後も同じエラーが継続：

```
finishReason: 'MAX_TOKENS',
thoughtsTokenCount: 65535  // thinkingBudget: 16384を設定しているのに無視される
responseLength: 0  // 出力が空
```

## 根本原因

**Gemini APIの既知の問題**: `responseSchema`（JSONスキーマ）と`thinkingConfig.thinkingBudget`を同時に使用すると、`thinkingBudget`が無視される。

### 公式フォーラムでの報告

> "I just removed the json schema from the call and it seems to respect the thinking budget now"
>
> — [Google AI Developers Forum](https://discuss.ai.google.dev/t/latest-google-genai-with-2-5-flash-ignoring-thinking-budget/102497)

### 現在のコード（問題箇所）

```typescript
// phased-generation.ts:527-541
const result = await client.models.generateContent({
  model: VERTEX_AI_MODEL,
  contents: prompt,
  config: {
    responseMimeType: 'application/json',
    responseSchema: getSkeletonSchema(...),  // ❌ これがthinkingBudgetを無効化
    thinkingConfig: {
      thinkingBudget: 16384,  // ❌ 無視される
    },
  },
});
```

## 解決策の選択肢

### 選択肢A: JSONスキーマを削除

```typescript
config: {
  responseMimeType: 'application/json',
  // responseSchema を削除
  thinkingConfig: {
    thinkingBudget: 16384,  // ✅ 機能する
  },
}
```

**デメリット**: プロンプトでJSON形式を指示する必要あり。パース失敗リスク増加。

### 選択肢B: 思考モードを無効化

```typescript
config: {
  responseMimeType: 'application/json',
  responseSchema: getSkeletonSchema(...),  // ✅ 維持
  thinkingConfig: {
    thinkingBudget: 0,  // 思考モード無効化
  },
}
```

**デメリット**: 思考モードのメリット（品質向上）を失う。

### 選択肢C: 段階的アプローチ（推奨）

1. 最初のリクエスト（骨子生成）: JSONスキーマなし + thinkingBudget有効
2. JSONパース成功後、必要に応じてスキーマでバリデーション

### 選択肢D: Googleの修正を待つ

フォーラムでは「修正がロールアウトされた」との報告があるが、まだ反映されていない可能性。

## 採用した解決策

**選択肢A（JSONスキーマ削除）を実装**:
- `responseSchema`パラメータを削除
- `responseMimeType: 'application/json'`は維持（JSON出力を指示）
- 既存の`parseGeminiJsonResponse`でエラーハンドリング済み

### 変更ファイル

1. `functions/src/phased-generation.ts`
   - `generateSkeleton`: responseSchema削除
   - `generateDetailedShifts`: responseSchema削除
   - `getSkeletonSchema`, `_getDetailedShiftSchema`: 一時的に未使用（void参照で保持）

2. `functions/src/shift-generation.ts`
   - 小規模一括生成: responseSchema削除
   - `_getShiftSchema`: 一時的に未使用（void参照で保持）

### 将来の対応

Googleが問題を修正したら、以下を復元：
1. `responseSchema`パラメータを復活
2. `void`参照を削除
3. 関数名から`_`プレフィックスを削除

## 参考資料

- [Google AI Developers Forum - thinkingBudget無視問題](https://discuss.ai.google.dev/t/latest-google-genai-with-2-5-flash-ignoring-thinking-budget/102497)
- [Gemini Thinking Documentation](https://ai.google.dev/gemini-api/docs/thinking)
