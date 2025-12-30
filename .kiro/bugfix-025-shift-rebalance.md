# BUG-025: AI生成シフトのスコア不安定問題

## 日時
2025-12-30

## 概要
AI生成シフトのスコアが不安定（0-28の範囲でばらつき）で、staffShortage違反が頻発していた問題を後処理リバランスで解決。

## 症状
- overallScore: 0-28（不安定）
- violationCount: 6-16件
- fulfillmentRate: 88-95%
- 主な違反: staffShortage（Level 2, -12点/件）

## 根本原因分析（MoE）
| 専門家 | 診断 |
|--------|------|
| AI/ML | バッチ処理の独立性による協調問題 |
| OR | ローカル最適化のみでグローバル最適化欠如 |
| プロンプト | 「バランス」指示が曖昧 |
| SE | フィードバック機構の欠如 |
| データ | 日勤過剰（+10〜+20）、早番不足（-4〜+1）パターン |

## 解決策
**戦略A: 後処理リバランス**

```typescript
// functions/src/shift-rebalance.ts
export function rebalanceShifts(
  schedules: StaffSchedule[],
  requirements: ShiftRequirement,
  staffList: Staff[]
): RebalanceResult {
  // 日別シフト配分をチェック
  // 過剰シフト → 不足シフトへスワップ
  // スタッフ希望を考慮
}
```

### 統合箇所
`functions/src/shift-generation.ts` (line 266-281)
- Phase 2完了後、評価前にリバランス実行

## 結果
| 指標 | 修正前 | 修正後 |
|------|--------|--------|
| overallScore | 0-28 | 76 |
| violationCount | 6-16 | 2 |
| fulfillmentRate | 88-95% | 99% |
| スワップ実行 | - | 17回 |

## 教訓
1. AI生成の不安定性は後処理で補完可能
2. MoE分析で根本原因を多角的に特定
3. ドキュメント駆動開発で検証可能な戦略を維持
4. 最小リスク戦略（後処理）から段階的に実装

## 関連ドキュメント
- [ai-shift-optimization-strategy.md](.kiro/steering/ai-shift-optimization-strategy.md)
- [phased-generation-contract.md](.kiro/steering/phased-generation-contract.md)
