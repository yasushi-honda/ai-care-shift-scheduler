# BUG-021: 有休消化率10000%表示バグ修正記録

**発生日**: 2025-12-30
**修正日**: 2025-12-30
**重要度**: High（表示値が100倍になっている）
**影響範囲**: EvaluationPanel（シミュレーション結果）

## 概要

AI評価のシミュレーション結果で、有休消化率が10000%と表示されるバグを修正。

## 症状

- AI生成後の評価パネルで有休消化率が「10000%」と表示
- 正しい値は「100%」であるべき

## 原因分析

### 根本原因

フロントエンド（`EvaluationPanel.tsx`）で二重にパーセンテージ変換している。

### バックエンド（正しい）

`functions/src/evaluation/evaluationLogic.ts:1105-1111`:

```typescript
paidLeaveUsageRate =
  totalLeaveRequests > 0
    ? Math.round(
        ((totalLeaveRequests - leaveIgnoredViolations.length) /
          totalLeaveRequests) *
          100   // ← 既に0-100の範囲
      )
    : 100;
```

### フロントエンド（バグ）

`src/components/EvaluationPanel.tsx:610`:

```tsx
{(simulation.paidLeaveUsageRate * 100).toFixed(0)}%
// 100 * 100 = 10000%
```

## 修正内容

### 変更ファイル

- `src/components/EvaluationPanel.tsx` (行610)

### 修正前

```tsx
{(simulation.paidLeaveUsageRate * 100).toFixed(0)}<span className="text-sm font-normal">%</span>
```

### 修正後

```tsx
{simulation.paidLeaveUsageRate.toFixed(0)}<span className="text-sm font-normal">%</span>
```

## 検証チェックリスト

- [x] TypeScript型チェック: `npx tsc --noEmit` ✅ パス
- [x] CodeRabbitレビュー ✅ パス
- [x] CI/CD Pipeline成功 ✅ (Run ID: 20589643463)
- [ ] 本番環境での手動テスト（ユーザー確認待ち）

## コミット

- Hash: `dd97648`
- Message: `fix(evaluation): remove duplicate percentage conversion for paidLeaveUsageRate`

## 関連情報

### 同時に発見した問題（別対応）

Phase 45手動テスト中に以下の問題も発見：

1. **夜勤生成問題**: デイサービス（夜勤なし）なのに夜勤30件が生成
   - **原因**: LocalStorageの古いDraft、またはFirestoreの古いシフト要件
   - **対応**: ユーザーにLocalStorageクリアを依頼

2. **対象月のズレ**: 2025-11のエラーが表示される（現在は2025-12）
   - **原因**: LocalStorageから古いDraftが読み込まれている
   - **証拠**: `Draft loaded from LocalStorage (saved at 2025-12-30T05:11:48.101Z)`

## 教訓

**パーセンテージ値の扱い**: バックエンドが0-100で返す場合、フロントエンドは変換不要。型定義のコメント（`// 0-100`）を確認すること。

## 関連ドキュメント

- [BUG-005: Firestoreリスナー修正](.kiro/bugfix-evaluation-panel-display-2025-12-06.md) - 同じEvaluationPanel関連
