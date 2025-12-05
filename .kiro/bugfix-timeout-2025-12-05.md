# BUG-004: タイムアウト問題修正記録

**発見日**: 2025-12-05
**修正完了日**: 2025-12-05
**重要度**: High（本番環境でAIシフト生成がタイムアウト）
**前提バグ**: BUG-003（maxOutputTokens増加）修正後に発覚

---

## 概要

BUG-003修正後、サーバー側（Cloud Functions + Vertex AI）は正常に動作するようになったが、**クライアント側のタイムアウト（60秒）が短すぎる**ため、AI生成完了前にリクエストが中断されていた。

## エラー内容

```
AbortError: signal is aborted without reason
リクエストがタイムアウトしました。シフト生成に時間がかかっています。
```

**クライアントログ**:
- 10:11:12 - リクエスト開始
- 10:12:12 - タイムアウト（60秒後）

**サーバーログ**（Cloud Functions）:
- 10:11:12 - Phase 1開始
- 10:12:37 - Phase 1完了（約85秒）
- 10:12:37 - Phase 2開始
- 10:13:32 - Phase 2完了（約55秒）
- **合計: 約2分20秒**

---

## 根本原因分析

### 処理時間の内訳

| フェーズ | 処理内容 | 時間 | トークン消費 |
|---------|---------|------|-------------|
| Phase 1 | 骨子生成 | ~85秒 | 思考: 21,501 / 出力: 1,366 |
| Phase 2 | 詳細生成 | ~55秒 | 出力: 5,810 |
| **合計** | | **~140秒** | |

### Gemini 2.5 Flash思考モードの影響

BUG-003でmaxOutputTokensを65536に増やしたことで、Gemini 2.5 Flashが十分な思考トークンを使えるようになった。結果として：

- **思考トークン**: 21,501（BUG-003修正前は8,191で打ち切り）
- **処理時間増加**: より深い思考により、処理時間が増加
- **品質向上**: 出力品質は向上（finishReason: STOP）

---

## 修正内容

### 1. フロントエンド（services/geminiService.ts）

```typescript
// Before
const timeoutId = setTimeout(() => controller.abort(), 60000);  // 60秒

// After
const timeoutId = setTimeout(() => controller.abort(), 180000);  // 180秒（3分）
```

### 2. Cloud Functions（functions/src/shift-generation.ts）

```typescript
// Before
timeoutSeconds: 120,  // 2分

// After
timeoutSeconds: 300,  // 5分
```

---

## BUG-001/002/003/004の関連

```
BUG-001: CORSエラー（関数未デプロイ）
  ↓ 修正後
BUG-002: propertyOrderingなしで空レスポンス
  ↓ 修正後
BUG-003: MAX_TOKENSで空レスポンス（思考トークン不足）
  ↓ 修正後（maxOutputTokens: 65536）
BUG-004: タイムアウト（思考モード有効化で処理時間増加）
```

**連鎖の教訓**: 1つの修正が別の問題を顕在化させることがある。包括的なテストが重要。

---

## 設定値の整合性

| 層 | 設定 | 修正前 | 修正後 | 備考 |
|----|------|--------|--------|------|
| フロントエンド | fetch timeout | 60秒 | 180秒 | AbortController |
| Cloud Functions | timeoutSeconds | 120秒 | 300秒 | onRequest設定 |
| index.ts | グローバルタイムアウト | 120秒 | 120秒 | 変更なし |

**重要**: 階層間でタイムアウトの整合性を保つこと
- フロントエンド < Cloud Functions（余裕を持たせる）

---

## 再発防止策

### 1. タイムアウト設定ルール（CLAUDE.md更新推奨）

```
フロントエンドタイムアウト: 180秒（3分）
Cloud Functionsタイムアウト: 300秒（5分）
```

### 2. 処理時間モニタリング

Cloud Functionsログで以下を監視：
- 各フェーズの開始・終了時刻
- `thoughtsTokenCount`（思考トークン消費量）

---

## 関連ドキュメント

- [BUG-001修正記録](bugfix-cors-cloud-functions-2025-12-05.md) - CORSエラー
- [BUG-002修正記録](bugfix-gemini-empty-response-2025-12-05.md) - propertyOrdering
- [BUG-003修正記録](bugfix-gemini-thinking-tokens-2025-12-05.md) - maxOutputTokens

---

## 学び・教訓

1. **修正の連鎖効果**: BUG-003修正で思考モードが有効化 → 処理時間増加 → タイムアウト
2. **層間の整合性**: フロントエンド・バックエンドのタイムアウト設定は連動して調整
3. **ログの重要性**: サーバーログで「成功」を確認できたことで、問題がクライアント側と特定
4. **余裕を持った設定**: 処理時間の1.5-2倍のタイムアウトを設定

---

## 修正コミット

```
fix(BUG-004): increase timeout for Gemini 2.5 Flash thinking mode

- Frontend: 60s → 180s (3 minutes)
- Cloud Functions: 120s → 300s (5 minutes)
- Gemini 2.5 Flash thinking mode takes ~2-3 min for 10 staff
```
