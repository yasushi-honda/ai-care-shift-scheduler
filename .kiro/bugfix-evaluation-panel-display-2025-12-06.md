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
**重要**: Firestoreリスナーは1回のwrite操作に対して複数回発火する（キャッシュ、サーバー、更新通知）。

### 処理フロー（修正前）

```
1. ユーザーがAI生成を実行
2. generateShiftSchedule() 完了
3. setEvaluation(generationResult.evaluation) ← 評価をセット ✅
4. ScheduleService.saveSchedule() でFirestoreに保存
5. Firestoreリスナーが発火（1回目: キャッシュ）
6. setEvaluation(null) ← 評価がクリアされる ❌
7. Firestoreリスナーが発火（2回目: サーバー）
8. UIでは evaluation=null のため表示されない
```

### 該当コード（App.tsx:300-305）

```typescript
// Phase 40: 既存スケジュールロード時は評価をクリア
// （評価は新規生成時のみ有効なため）
setEvaluation(null);  // ← ここが問題
```

## 修正履歴

### 試行1: generatingSchedule state使用（失敗）

```typescript
if (!generatingSchedule) {
  setEvaluation(null);
}
```

**失敗理由**:
- useEffectの依存配列に含まれ、サブスクリプションが再設定される
- `finally`ブロックでfalseにリセットされるタイミングが不確定
- 非同期処理のタイミング問題で効果がなかった

### 試行2: boolean useRef使用（失敗）

```typescript
const justGeneratedRef = useRef(false);
// 生成完了時: justGeneratedRef.current = true
// リスナー内:
if (justGeneratedRef.current) {
  justGeneratedRef.current = false;
} else {
  setEvaluation(null);
}
```

**失敗理由**:
- Firestoreリスナーは複数回発火する（キャッシュ、サーバー、更新通知）
- 1回目のコールバックでフラグがfalseにリセット
- 2回目以降のコールバックで評価がクリアされてしまう

### 試行3: カウンター useRef使用（成功）✅

```typescript
// AI生成直後のFirestoreリスナー発火時に評価がクリアされるのを防ぐためのRef
// 複数回のリスナー発火に対応するため、カウンターを使用（BUG-005修正）
const skipEvaluationClearCountRef = useRef(0);
```

## 最終修正内容

### 変更ファイル

- `App.tsx` (行97, 303-308, 1002-1006)

### 修正コード（最終版）

**修正1: カウンターRefの追加（行97）**
```typescript
// AI生成直後のFirestoreリスナー発火時に評価がクリアされるのを防ぐためのRef
// 複数回のリスナー発火に対応するため、カウンターを使用（BUG-005修正）
const skipEvaluationClearCountRef = useRef(0);
```

**修正2: 生成完了時にカウンターをセット（行1002-1006）**
```typescript
// 評価結果をstateに保存（Phase 40: AI評価・フィードバック機能）
setEvaluation(generationResult.evaluation);
// Firestoreリスナー発火時に評価がクリアされるのを防ぐ（BUG-005修正）
// 複数回のリスナー発火（キャッシュ、サーバー、更新通知）に対応するため3回スキップ
skipEvaluationClearCountRef.current = 3;
```

**修正3: リスナー内でカウンターをチェック（行303-308）**
```typescript
// Phase 40: 既存スケジュールロード時は評価をクリア
// （評価は新規生成時のみ有効なため）
// ただし、AI生成直後のリスナー発火時はクリアしない（BUG-005修正）
// 複数回のリスナー発火に対応するため、カウンターを使用
if (skipEvaluationClearCountRef.current > 0) {
  skipEvaluationClearCountRef.current -= 1;
} else {
  setEvaluation(null);
}
```

### 修正の意図

- **カウンター方式**: Firestoreリスナーの複数回発火（2-3回）に対応
- **useRef使用**: useEffectの依存配列に影響を与えない
- **値=3**: キャッシュ(1) + サーバー(1) + 余裕(1) = 3回スキップ
- カウンター消費後（月変更など）は正常に評価をクリア

### なぜカウンター=3か

デバッグログで観測したリスナー発火パターン:
```
🔄 [Firestore Listener] callback fired, skipCount=3
✅ Skipping evaluation clear (count: 3 → 2)
🔄 [Firestore Listener] callback fired, skipCount=2
✅ Skipping evaluation clear (count: 2 → 1)
[... 以降のコールバックでも1回分の余裕]
```

## 処理フロー（修正後）

```
1. ユーザーがAI生成を実行
2. generatingSchedule = true
3. generateShiftSchedule() 完了
4. setEvaluation(generationResult.evaluation) ← 評価をセット ✅
5. skipEvaluationClearCountRef.current = 3 ← カウンターセット
6. ScheduleService.saveSchedule() でFirestoreに保存
7. Firestoreリスナーが発火（1回目）
8. skipCount=3 > 0 → クリアスキップ、カウンター減算 (3→2)
9. Firestoreリスナーが発火（2回目）
10. skipCount=2 > 0 → クリアスキップ、カウンター減算 (2→1)
11. UIで評価パネルが正常に表示される ✅
```

## 検証

- TypeScript型チェック: ✅ パス
- CI/CD Pipeline: ✅ 成功
- 手動テスト: ✅ 評価パネル正常表示確認
  - 警告バナー表示
  - AI評価ヘッダー + スコアバッジ
  - AIコメントセクション
  - 制約違反リスト

## 教訓

### 1. Firestoreリスナーは複数回発火する

Firestoreのリアルタイム購読は、1回のwrite操作に対して複数回コールバックが発火する：
- キャッシュからの即時応答
- サーバーからの確認応答
- 更新通知

単純なboolean フラグでは対応できない。

### 2. デバッグログの重要性

今回の修正では以下のログが問題特定に貢献：
- `📊 AI評価結果:` - 評価取得成功の確認
- `🔄 [Firestore Listener]` - リスナー発火回数の観測
- `✅ Skipping evaluation clear` - カウンター動作の確認

### 3. 段階的なデバッグアプローチ

1. 仮説（boolean flag）→ 検証 → 失敗
2. 観測（デバッグログ追加）→ 新発見（複数回発火）
3. 新仮説（カウンター）→ 検証 → 成功

## シニアエンジニアチームレビュー結果

2025-12-06実施。以下の点を確認：

1. **カウンター=3の妥当性**: 観測結果（2回発火）+ 余裕（1回）で適切
2. **エッジケース**: 月変更時はカウンター消費後なので正常動作
3. **将来的リスク**: Firestore SDKアップデートで発火回数変更の可能性
   → コメントで理由を明記済み、問題発生時は調整可能

## 関連ドキュメント

- [Phase 40拡張仕様](.kiro/specs/ai-evaluation-feedback/enhancement-spec-2025-12-06.md)
- [Phase 40 GitHub Pages](docs/phase40-evaluation.html)
- [BUG-001〜004ポストモーテム](.kiro/postmortem-gemini-bugs-2025-12-05.md)

## コミット

```
fix(evaluation): use counter-based skip for Firestore listener callbacks

- Fixed BUG-005: evaluation panel not displayed after AI generation
- Root cause: Firestore listener fires multiple times (cache, server, update)
- Solution: Use counter (skipEvaluationClearCountRef) to skip 3 callbacks
- Boolean flag approach failed due to multiple listener callbacks
```
