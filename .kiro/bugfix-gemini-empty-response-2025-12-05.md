# BUG-002: Gemini 2.5 Flash 空レスポンス修正記録

**発見日**: 2025-12-05
**修正完了日**: 2025-12-05
**重要度**: Critical（本番環境でAIシフト生成が完全に動作不能）
**前提バグ**: BUG-001（CORSエラー）修正後に発覚

---

## 概要

BUG-001（CORSエラー）修正後、AIシフト生成を実行すると「Failed to parse Gemini JSON response: Unexpected end of JSON input」エラーが発生。調査の結果、**Vertex AI (Gemini 2.5 Flash)が空のレスポンスを返していた**ことが判明。

## エラー内容

```
❌ JSON Parse Error: SyntaxError: Unexpected end of JSON input
Response text length: 0
Response text (first 500 chars):
Response text (last 500 chars):
```

**ポイント**: `responseLength: 0` → JSONパースの問題ではなく、**APIからの応答自体が空**

---

## 根本原因分析

### 直接原因

`responseSchema`に`propertyOrdering`フィールドが指定されておらず、Gemini 2.5 Flashが構造化出力を正しく生成できなかった。

### なぜ空レスポンスになったか

Google公式ドキュメントによると：

> "If there are any descriptions (for example, in a bulleted list), schemas, or examples in the prompt, they must present the **same property ordering** as is specified in the responseSchema. A mismatch in ordering can confuse the model and lead to incorrect or malformed output."

参照: [Structured output | Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output)

### Web検索で発見した関連情報

複数のユーザーがGemini 2.5モデルで空レスポンス問題を報告：
- [Empty response.text from Gemini 2.5 Pro](https://discuss.ai.google.dev/t/empty-response-text-from-gemini-2-5-pro-despite-no-safety-and-max-tokens-issues/98010)
- [Gemini 2.5 Pro with empty response.text](https://discuss.ai.google.dev/t/gemini-2-5-pro-with-empty-response-text/81175)

共通点：`finishReason: STOP`で正常終了扱いだが、テキストが空。

---

## 修正内容

### 修正ファイル

1. `functions/src/phased-generation.ts`
2. `functions/src/shift-generation.ts`

### 修正内容

#### 1. `propertyOrdering`フィールドの追加

**Before**:
```typescript
{
  type: 'object',
  properties: {
    staffSchedules: { ... }
  },
  required: ['staffSchedules'],
}
```

**After**:
```typescript
{
  type: 'object',
  properties: {
    staffSchedules: { ... }
  },
  propertyOrdering: ['staffSchedules'],  // 追加
  required: ['staffSchedules'],
}
```

#### 2. ネストされたオブジェクトにも`propertyOrdering`を追加

```typescript
items: {
  type: 'object',
  properties: {
    staffId: { type: 'string', description: 'スタッフID' },
    staffName: { type: 'string', description: 'スタッフ名' },
    restDays: { ... },
    nightShiftDays: { ... },
    nightShiftFollowupDays: { ... },
  },
  propertyOrdering: ['staffId', 'staffName', 'restDays', 'nightShiftDays', 'nightShiftFollowupDays'],
  required: ['staffId', 'staffName', 'restDays', 'nightShiftDays', 'nightShiftFollowupDays'],
}
```

#### 3. プロンプトとSchemaの順序整合

プロンプト内の「出力形式」説明をSchemaの`propertyOrdering`と一致させた。

---

## 調査プロセス（ドキュメントドリブン）

### Step 1: 既存ドキュメント確認

- `gemini_json_parsing_troubleshooting`メモリを読んで過去の類似問題を確認
- 過去の問題は「Markdownラップ」「トークン制限」だったが、今回は`responseLength: 0`で異なる

### Step 2: Cloud Functionsログ確認

```bash
gcloud functions logs read generateShift --region=asia-northeast1 --project=ai-care-shift-scheduler --limit=30
```

結果：
- `Response text length: 0`
- `finishReason`は取得できていなかった（デバッグログ追加前）

### Step 3: Web検索による裏付け

- Google公式ドキュメントで`propertyOrdering`の重要性を確認
- Gemini 2.5モデルで空レスポンス問題が複数報告されていることを確認

### Step 4: 修正実装

- `propertyOrdering`を全Schemaに追加
- プロンプトの説明順序をSchemaと整合

---

## 技術的詳細

### Gemini 2.5 Flash + responseSchema のベストプラクティス

1. **`propertyOrdering`を必ず指定**
   - ネストされた全オブジェクトに指定
   - `required`フィールドと同じ順序を推奨

2. **プロンプトとSchemaの順序一致**
   - プロンプト内で出力形式を説明する場合、Schemaと同じ順序で記述

3. **`description`フィールドの活用**
   - 各プロパティに明確なdescriptionを追加

4. **`type: 'number'`より`type: 'integer'`**
   - 日付など整数を期待する場合は`integer`を使用

### 設定の維持（変更なし）

- **モデル**: `gemini-2.5-flash`（変更なし）
- **リージョン**: `asia-northeast1`（変更なし）

---

## 再発防止策

### 1. Schema変更時のチェックリスト

- [ ] 全オブジェクトに`propertyOrdering`が指定されているか
- [ ] `required`と`propertyOrdering`の順序が一致しているか
- [ ] プロンプト内の説明とSchemaの順序が一致しているか

### 2. デバッグログの追加（実施済み）

Vertex AIレスポンスの詳細情報をログ出力：
- `finishReason`
- `blockReason`
- `safetyRatings`
- `usageMetadata`

---

## 関連ドキュメント

- [BUG-001修正記録](bugfix-cors-cloud-functions-2025-12-05.md) - 前提となるCORSエラー修正
- [gemini_region_critical_rule](.serena/memories/gemini_region_critical_rule.md) - リージョン設定ルール
- [gemini_json_parsing_troubleshooting](.serena/memories/gemini_json_parsing_troubleshooting.md) - JSONパース問題

---

## 学び・教訓

1. **公式ドキュメントを先に確認** - Web検索で`propertyOrdering`の重要性を発見
2. **空レスポンス ≠ パースエラー** - `responseLength: 0`はAPI側の問題
3. **Gemini 2.5は構造化出力に厳格** - 旧バージョンで動いていたSchemaでも失敗する可能性
4. **デバッグログの重要性** - `finishReason`等の情報がないと原因特定が困難

---

## 修正コミット

```
fix(BUG-002): add propertyOrdering to Gemini responseSchema for Gemini 2.5 Flash compatibility

- Add propertyOrdering field to all JSON schemas
- Align prompt property descriptions with schema ordering
- Add descriptions to schema properties
- Change 'number' to 'integer' type for day arrays
```
