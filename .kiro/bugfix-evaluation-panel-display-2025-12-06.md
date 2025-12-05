# BUG-005: AI評価パネル非表示バグ修正記録

**発生日**: 2025-12-06
**修正日**: 2025-12-06
**重要度**: High（機能が完全に動作しない）
**影響範囲**: AI評価機能（Phase 40）

## 概要

AI生成完了後、評価パネルがUIに表示されない問題を修正。

## 症状

- AI生成は正常に完了（コンソールログで確認）
- 評価結果も正常に取得（`overallScore: 0, violationCount: 218`）
- しかし、UIに評価パネルが表示されない

## 原因分析

### 根本原因

Firestoreのリアルタイム購読コールバック内で、生成直後でも`setEvaluation(null)`が実行されていた。

### 処理フロー（修正前）

```
1. ユーザーがAI生成を実行
2. generateShiftSchedule() 完了
3. setEvaluation(generationResult.evaluation) ← 評価をセット ✅
4. ScheduleService.saveSchedule() でFirestoreに保存
5. Firestoreリスナーが発火
6. setEvaluation(null) ← 評価がクリアされる ❌
7. UIでは evaluation=null のため表示されない
```

### 該当コード（App.tsx:300-305）

```typescript
// Phase 40: 既存スケジュールロード時は評価をクリア
// （評価は新規生成時のみ有効なため）
setEvaluation(null);  // ← ここが問題
```

## 修正内容

### 変更ファイル

- `App.tsx` (行300-305)

### 修正コード

```typescript
// Phase 40: 既存スケジュールロード時は評価をクリア
// （評価は新規生成時のみ有効なため）
// ただし、AI生成直後のリスナー発火時はクリアしない
if (!generatingSchedule) {
  setEvaluation(null);
}
```

### 修正の意図

- `generatingSchedule`フラグは生成処理中にtrueになる
- 生成完了後の`finally`ブロックでfalseにリセット
- 生成中は評価をクリアしないことで、評価が保持される

## 処理フロー（修正後）

```
1. ユーザーがAI生成を実行
2. generatingSchedule = true
3. generateShiftSchedule() 完了
4. setEvaluation(generationResult.evaluation) ← 評価をセット ✅
5. ScheduleService.saveSchedule() でFirestoreに保存
6. Firestoreリスナーが発火
7. if (!generatingSchedule) → false、評価クリアをスキップ ✅
8. generatingSchedule = false (finally)
9. UIで評価パネルが正常に表示される ✅
```

## 検証

- TypeScript型チェック: ✅ パス
- CI/CD Pipeline: ✅ 成功
- Lighthouse CI: ✅ 成功

## 教訓

### 1. リアルタイム購読の副作用に注意

Firestoreのリアルタイム購読は、自身の書き込み操作でもコールバックが発火する。状態管理との組み合わせで予期しない副作用が発生しやすい。

### 2. 状態遷移の可視化が重要

複数の非同期処理が絡む場合、状態遷移を明確にドキュメント化することで問題の特定が容易になる。

### 3. コンソールログの重要性

今回は`📊 AI評価結果:`ログがあったため、評価取得自体は成功していることがすぐに判明した。

## 関連ドキュメント

- [Phase 40拡張仕様](.kiro/specs/ai-evaluation-feedback/enhancement-spec-2025-12-06.md)
- [Phase 40実装メモリ](Serena: phase40_extension_2025-12-06)

## コミット

```
fix(evaluation): Firestore listener now preserves evaluation during generation

- Fixed bug where evaluation panel was not displayed after AI generation
- Root cause: Firestore subscription callback cleared evaluation state
- Solution: Skip setEvaluation(null) when generatingSchedule is true
```
