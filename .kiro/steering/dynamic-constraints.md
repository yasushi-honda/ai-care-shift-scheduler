# Dynamic Constraints - 動的制約生成パターン

**最終更新**: 2025-12-29
**関連Phase**: Phase 44-49

---

## 概要

静的な制約記述ではAIが無視しやすいため、スタッフデータから動的に具体的な制約を生成する。

---

## 設計原則（4項目）

| 原則 | 説明 |
|-----|------|
| データ駆動型 | ハードコードせずスタッフデータから抽出 |
| 条件付き生成 | 該当者がいなければ空文字を返す |
| 明示的な警告 | 「この制約に違反したシフトは無効」 |
| 可読性重視 | 具体的なスタッフ名をリスト化 |

---

## 実装テンプレート

```typescript
function buildDynamic[ConstraintName]Constraints(staffList: Staff[]): string {
  const targetStaff = staffList.filter(s => /* 条件 */);

  let constraints = `
## 【制約名】（厳守）
基本ルール...

**重要**: この制約に違反したシフトは無効です。
`;

  if (targetStaff.length === 0) {
    return constraints;
  }

  constraints += `
### 個別制限
${targetStaff.map(s => `- ${s.name}: ...`).join('\n')}
`;

  return constraints;
}
```

---

## 実装済み動的制約

| 関数名 | 役割 |
|-------|------|
| `buildDynamicTimeSlotConstraints` | 時間帯希望（日勤のみ/夜勤のみ） |
| `buildDynamicNurseConstraints` | 看護師配置要件 |
| `buildDynamicPartTimeConstraints` | パート職員の曜日・日数制限 |
| `buildDynamicConsecutiveConstraints` | 連続勤務制限 |
| `buildDynamicStaffingConstraints` | 日別必要勤務人数 |

実装ファイル: `functions/src/phased-generation.ts`

---

## 新規制約追加チェックリスト

1. [ ] 4つの設計原則を満たしているか
2. [ ] `buildSkeletonPrompt`に組み込んでいるか
3. [ ] 対応する評価チェックが`EvaluationService`に存在するか
4. [ ] 論理的整合性チェック完了か

---

## プロンプト設計時の必須チェック（BUG-017教訓）

```
Step 1: 最悪ケースのパラメータを特定
  - 最小バッチサイズ（例: 2名）
  - 最小勤務可能人数

Step 2: AIの立場で要件を読む
  - 「2名で5名/日を配置せよ」→ 不可能と判断されないか？

Step 3: 論理的矛盾を洗い出す
  - 要件を相対化（「目安」「比例配分」）
```

詳細: [AIプロンプト設計チェックリスト](../ai-prompt-design-checklist.md)

---

## SLA目標

| 指標 | 目標値 |
|-----|-------|
| 充足率 | 95%以上 |
| 制約違反 | 10件以下 |
| 生成時間 | 5分以内（15名以下） |

---

## 参考資料

- [AI品質改善ガイド](../ai-quality-improvement-guide.md)
- [AI品質レビュー](../ai-production-quality-review-2025-12-08.md)
