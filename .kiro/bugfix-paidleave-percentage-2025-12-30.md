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

### パーセンテージ値の扱い

バックエンドとフロントエンドでパーセンテージ変換の責任を明確にする：

- **ルール**: バックエンドが0-100の範囲で返す場合、フロントエンドは変換不要
- **確認方法**: 型定義のコメントを参照（`// 0-100` など）

### 型定義の重要性

`functions/src/types.ts:152`:

```typescript
paidLeaveUsageRate: number;       // 有給消化率予測 (0-100)
```

コメントで値の範囲を明記することで、このようなバグを防げる。

## コミット予定

```
fix(evaluation): remove duplicate percentage conversion for paidLeaveUsageRate

- Fixed BUG-021: 有休消化率が10000%と表示されるバグ
- Root cause: Frontend multiplied by 100 when backend already returns 0-100
- Location: EvaluationPanel.tsx:610
```
