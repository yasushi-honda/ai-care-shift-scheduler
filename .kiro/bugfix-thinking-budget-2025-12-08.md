# BUG-008: Gemini thinkingBudget制限によるMAX_TOKENSエラー修正

**発生日**: 2025-12-08
**修正日**: 2025-12-08
**影響範囲**: Cloud Functions (generateShift), AI自動シフト生成機能
**重大度**: 高（シフト生成が完全に失敗）

---

## 1. 問題概要

### 症状
1. デモ環境でシフト生成を実行すると「Failed to parse Gemini JSON response: Unexpected end of JSON input」エラー
2. Cloud Functions 500エラー
3. 12名スタッフ（常勤8名 + パート4名）構成で発生

### 期待される動作
- シフト生成が正常に完了
- 充足率98%以上のシフトが生成される

---

## 2. 根本原因分析

### Cloud Functionsログの調査結果

```json
{
  "finishReason": "MAX_TOKENS",
  "responseLength": 0,
  "usageMetadata": {
    "promptTokenCount": 4523,
    "thoughtsTokenCount": 65535,
    "candidatesTokenCount": 0,
    "totalTokenCount": 70058
  }
}
```

### 問題の本質

Gemini 2.5 Flashの「思考モード」は `maxOutputTokens` の予算から思考トークンを消費する。

| 項目 | 設定値 | 消費量 |
|------|--------|--------|
| maxOutputTokens | 65536 | - |
| thoughtsTokenCount | - | 65535 |
| candidatesTokenCount | - | 0 |
| **残りトークン** | - | **1** |

思考トークンが全予算を使い切り、出力用トークンが0になったため、JSONレスポンスが空になった。

### なぜ12名スタッフで発生したか

- 以前のデモデータ: 8名（常勤のみ）
- 今回のデモデータ: 12名（常勤8名 + パート4名）

スタッフ数が増加したことで、AIが考慮すべき制約（勤務希望、資格、ローテーション等）が増え、思考トークン消費量が増大した。

---

## 3. 修正内容

### 解決策: thinkingBudget制限の追加

Gemini 2.5 Flashには `thinkingConfig.thinkingBudget` パラメータがあり、思考トークンの上限を設定できる（範囲: 0-24576）。

### 修正ファイル

#### 1. functions/src/phased-generation.ts

**generateSkeleton関数** (Line 346-349):
```typescript
generationConfig: {
  maxOutputTokens: 65536,
  // 思考トークンを制限（12名スタッフで65535トークン使い切りエラー対策）
  thinkingConfig: {
    thinkingBudget: 16384,  // 思考に16K、残りを出力に使用
  },
}
```

**generateDetailedShifts関数** (Line 628-631):
```typescript
generationConfig: {
  maxOutputTokens: 65536,
  // 思考トークンを制限（バッチ処理用）
  thinkingConfig: {
    thinkingBudget: 8192,  // バッチなので8Kで十分
  },
}
```

#### 2. functions/src/shift-generation.ts

**小規模一括生成** (Line 156-159):
```typescript
generationConfig: {
  maxOutputTokens: 65536,
  // 思考トークンを制限（小規模一括生成用）
  thinkingConfig: {
    thinkingBudget: 16384,  // 5名以下なので16Kで十分
  },
}
```

#### 3. functions/package.json

```json
{
  "dependencies": {
    "@google-cloud/vertexai": "^1.10.0"  // 1.9.0から更新
  }
}
```

### thinkingBudget設計根拠

| 処理種別 | thinkingBudget | 理由 |
|----------|----------------|------|
| generateSkeleton | 16384 | 全体構造の生成、複雑な制約考慮が必要 |
| generateDetailedShifts | 8192 | バッチ処理、スケルトン参照で思考量削減 |
| 小規模一括生成 | 16384 | 5名以下、一括で全制約を考慮 |

**トークン配分**:
- 思考: 16384トークン（約25%）
- 出力: 49152トークン（約75%）

---

## 4. 関連する過去のバグ

| BUG ID | 問題 | 解決策 | 関連性 |
|--------|------|--------|--------|
| BUG-003 | maxOutputTokens 8192不足 | 65536に増加 | 思考モードトークン問題 |
| BUG-004 | タイムアウト | 5分に延長 | 思考モード処理時間 |
| **BUG-008** | thinkingBudget無制限 | 16384/8192に制限 | 思考トークン過消費 |

---

## 5. 検証方法

1. デモログインでアクセス
2. シフト管理 → AI自動生成
3. 確認項目:
   - エラーなしで完了
   - 充足率98%以上
   - Cloud Functionsログで `finishReason: 'STOP'` を確認

---

## 6. 再発防止策

### 即時対応
- [x] thinkingBudgetを明示的に設定
- [x] @google-cloud/vertexaiを最新版に更新

### 長期対応
- [ ] スタッフ数に応じた動的thinkingBudget調整（候補）
- [ ] 大規模施設（20名以上）でのテスト実施

### CLAUDE.mdへの追記

```markdown
## Gemini thinkingBudget設定ルール（BUG-008教訓）

思考モードは `maxOutputTokens` 予算から消費する。必ず制限すること:

\`\`\`typescript
thinkingConfig: {
  thinkingBudget: 16384,  // 最大24576、通常16384推奨
}
\`\`\`
```

---

## 7. 関連コミット

- `d96aee3` - fix: Gemini 2.5 Flash thinkingBudget制限を追加

---

## 8. 学び

1. **思考モードはトークン予算を共有する**: `maxOutputTokens` を増やしても、思考がすべて消費すれば出力は空になる
2. **スケールに注意**: 8名では問題なくても、12名では破綻することがある
3. **明示的な制限が重要**: デフォルト（制限なし）に頼らず、明示的にbudgetを設定する

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
