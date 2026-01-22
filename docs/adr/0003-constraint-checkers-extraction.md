# ADR-0003: 制約チェッカーの責務分離

**日付**: 2025-01-23
**ステータス**: 採用
**関連PR**: #34

## コンテキスト

`EvaluationService`クラス（`evaluationLogic.ts`）が1185行に肥大化し、以下の問題があった：

1. 単一ファイルに複数の責務が混在
2. テストの保守性が低下
3. 変更影響範囲の把握が困難

### 責務の分析

| カテゴリ | メソッド数 | 責務 |
|---------|----------|------|
| 制約チェック | 7 | 制約違反の検出 |
| スコア計算 | 5 | 評価スコアの算出 |
| コメント生成 | 3 | AI/人間向けコメント |
| オーケストレーション | 4 | 全体の調整 |

## 決定

**制約チェック関数を`constraintCheckers.ts`に抽出**し、委譲パターンで後方互換性を維持。

### 抽出した関数

```typescript
// constraintCheckers.ts（新規、404行）
export function isBusinessDay(...): boolean;
export function checkStaffShortage(...): ConstraintViolation[];
export function checkConsecutiveWorkViolation(...): ConstraintViolation[];
export function checkNightRestViolation(...): ConstraintViolation[];
export function checkQualificationMissing(...): ConstraintViolation[];
export function checkLeaveRequestIgnored(...): ConstraintViolation[];
export function checkTimeSlotPreferenceViolation(...): ConstraintViolation[];
```

### 委譲パターン

```typescript
// evaluationLogic.ts（既存）
import { checkStaffShortage as checkStaffShortageFn } from './constraintCheckers';

class EvaluationService {
  checkStaffShortage(...): ConstraintViolation[] {
    return checkStaffShortageFn(...);  // 委譲
  }
}
```

## 影響

- **正**:
  - ファイルサイズ 24%削減（1185行→898行）
  - 制約チェックの単体テストが容易に
  - 責務が明確化
- **負**:
  - ファイル数が増加（+1）
  - import文の増加

## 検証

- 135件のユニットテスト全パス
- E2Eテスト全パス
- 型チェック成功

## 今後の拡張

スコア計算、コメント生成も同様に分離可能（必要に応じて実施）。
