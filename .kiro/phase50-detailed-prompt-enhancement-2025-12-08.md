# Phase 50: Phase 2詳細プロンプトの日別配置要件強化

**作成日**: 2025-12-08
**コミット**: 8194f48
**問題ID**: AI品質改善（充足率21%→95%目標）

## 問題

AI生成が以下の結果を出力していた：
- 総合スコア: 0点
- 充足率: 21%
- 制約違反: 110件
- 早番27日、日勤27日、遅番23日の不足

## 原因分析

### ドキュメントドリブン分析

過去の改善記録（ai-quality-improvement-guide.md、Phase 44-49の動的制約パターン）を分析した結果、以下の問題を特定：

1. **Phase 2のプロンプトに日別配置要件が不十分**
   - Phase 1（骨子生成）では`buildDynamicStaffingConstraints`を組み込んでいた
   - Phase 2（詳細生成）では「骨子で指定された休日」のみを参照
   - AIは休日を守ることに集中し、「休日以外の日でも休を出力」していた可能性

2. **デバッグ情報の不足**
   - 生成されたシフトの内訳（早番/日勤/遅番/休の数）が確認できなかった
   - 問題の切り分けが困難だった

## 修正内容

### 1. buildDetailedPrompt（デイサービス）の改善

```typescript
// Phase 50: 日別配置要件を明示的に計算
const [year, month] = requirements.targetMonth.split('-').map(Number);
const sundays: number[] = [];
for (let day = 1; day <= daysInMonth; day++) {
  const date = new Date(year, month - 1, day);
  if (date.getDay() === 0) sundays.push(day);
}
const businessDays = daysInMonth - sundays.length;

// 各スタッフの休日数を計算
const staffRestInfo = staffBatch.map(s => {
  const skel = skeleton.staffSchedules.find(sk => sk.staffId === s.id);
  const restDays = skel?.restDays || [];
  const nonSundayRest = restDays.filter(d => !sundays.includes(d)).length;
  const workDays = businessDays - nonSundayRest;
  return `- ${s.name}: 休日${restDays.length}日（日曜${sundays.filter(d => restDays.includes(d)).length}日＋平日${nonSundayRest}日）→ **勤務${workDays}日**`;
}).join('\n');
```

### 2. プロンプト文の改善点

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| 最重要ルール | なし | 「各営業日に合計N名を配置」を冒頭に明記 |
| 勤務予定表示 | なし | 各スタッフの休日数・勤務日数を計算して表示 |
| 休日ルール | 「休日以外の日は...」 | 「休日以外の日に休を入れてはいけない！」 |
| チェックリスト | 基本項目のみ | 営業日数・合計勤務者数チェックを追加 |

### 3. デバッグログ追加

```typescript
// Phase 50: デバッグログ追加 - シフト配分の確認
const shiftCounts: Record<string, number> = {};
for (const schedule of allSchedules as any[]) {
  for (const shiftType of Object.values(schedule.shifts || {})) {
    shiftCounts[shiftType as string] = (shiftCounts[shiftType as string] || 0) + 1;
  }
}
console.log('📊 シフト配分:', shiftCounts);
```

## 動的制約生成パターンの適用

Phase 44-48で確立した設計パターンに従い：

| 原則 | 適用 |
|------|------|
| データ駆動型 | スケルトンから各スタッフの休日数を計算 |
| 条件付き生成 | 日曜日の数、平日休みの数を動的計算 |
| 明示的な警告 | 「休日以外の日に休を入れてはいけません！」 |
| 可読性重視 | スタッフごとの休日/勤務日数を一覧表示 |

## 期待される改善

| 指標 | 修正前 | 目標 |
|------|--------|------|
| 総合スコア | 0点 | 70点以上 |
| 充足率 | 21% | 95%以上 |
| 制約違反 | 110件 | 10件以下 |

## 検証方法

1. デプロイ後、デモログインでシフト管理→AI自動生成を実行
2. Cloud Functionsログで`📊 シフト配分:`を確認
3. 評価パネルで充足率・違反数を確認

## 関連ドキュメント

- [ai-quality-improvement-guide.md](.kiro/ai-quality-improvement-guide.md) - 品質改善ガイド
- [Phase 49: 日別人員配置制約](docs/phase49-staffing-constraints.html)
- [BUG-015: 形式変換修正](.kiro/bugfix-schedule-format-conversion-2025-12-08.md)

## 教訓

1. **Phase間の制約の一貫性**: Phase 1とPhase 2で同じ制約を明示する
2. **AIの解釈は保守的**: 「〜しないこと」よりも「〜すること」で明示
3. **デバッグログは必須**: 問題発生時に内訳を確認できるログを残す
