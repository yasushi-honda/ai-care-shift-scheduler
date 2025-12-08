# Phase 47: パート職員制約の明示化 - 実装記録

**作成日**: 2025-12-08
**実装者**: Claude Opus 4.5
**関連Issue**: AI生成シフトの充足率低下（73-93%）

---

## 1. 概要

### 問題
Phase 46でパート職員4名を追加後、AI生成シフトの品質が低下した。
- 充足率: 98% → 73-93%
- 制約違反: 3件 → 19-33件

### 根本原因
`buildSkeletonPrompt`（骨子生成プロンプト）に`availableWeekdays`（勤務可能曜日）が含まれていなかった。

特に問題のケース:
- `加藤明子`: `availableWeekdays: [1, 3, 5]`（月・水・金のみ）
- AIはこの制限を認識できず、火曜・木曜・土曜にも配置しようとして破綻

### 解決策
1. `buildSkeletonPrompt`のスタッフ情報に`availableWeekdays`を含める
2. `buildDynamicPartTimeConstraints`関数を追加してパート職員制約を明示

---

## 2. 実装内容

### 2.1 formatWeekdays関数の追加

**ファイル**: `functions/src/phased-generation.ts:117-123`

```typescript
function formatWeekdays(weekdays: number[]): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  if (!weekdays || weekdays.length === 0) return '指定なし';
  if (weekdays.length === 7) return '全日';
  if (weekdays.length === 6 && !weekdays.includes(0)) return '月〜土';
  return weekdays.map(d => dayNames[d]).join('・');
}
```

### 2.2 buildDynamicPartTimeConstraints関数の追加

**ファイル**: `functions/src/phased-generation.ts:136-163`

パート職員を抽出し、プロンプトに制約を追加:

```typescript
function buildDynamicPartTimeConstraints(staffList: Staff[]): string {
  const partTimeStaff = staffList.filter(s => {
    const availableWeekdays = s.availableWeekdays || [0, 1, 2, 3, 4, 5, 6];
    const isWeekdayRestricted = availableWeekdays.length < 6 ||
      (availableWeekdays.length === 6 && availableWeekdays.includes(0));
    const isPartTime = s.weeklyWorkCount.hope <= 3;
    return isPartTime || isWeekdayRestricted;
  });

  // ... 制約文字列を生成
}
```

### 2.3 buildSkeletonPromptのスタッフ情報強化

**ファイル**: `functions/src/phased-generation.ts:204-226`

変更前:
```typescript
`- ${s.name}(ID:${s.id}): 週${s.weeklyWorkCount.hope}回希望（必須${s.weeklyWorkCount.must}回）`
```

変更後:
```typescript
// 勤務可能曜日の制限チェック
const availableWeekdays = s.availableWeekdays || [0, 1, 2, 3, 4, 5, 6];
const isRestricted = availableWeekdays.length < 6 || ...;
const weekdayRestriction = isRestricted
  ? ` ⚠️ 【${formatWeekdays(availableWeekdays)}のみ勤務可】`
  : '';

// パート職員ラベル
const isPartTime = s.weeklyWorkCount.hope <= 3;
const partTimeLabel = isPartTime ? ' [パート]' : '';

`- ${s.name}(ID:${s.id}): 週${s.weeklyWorkCount.hope}回希望${partTimeLabel}${weekdayRestriction}`
```

### 2.4 骨子プロンプトの制約条件強化

**ファイル**: `functions/src/phased-generation.ts:349-350`

制約条件セクションにパート職員制約を追加:
```
5. **パート職員は指定された曜日のみ勤務可能**（詳細は下記参照）
${buildDynamicPartTimeConstraints(staffList)}
```

### 2.5 出力前チェックリストの強化

**ファイル**: `functions/src/phased-generation.ts:372`

```
□ パート職員が制限外の曜日に勤務していないか
```

---

## 3. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `functions/src/phased-generation.ts` | formatWeekdays関数追加、buildDynamicPartTimeConstraints関数追加、buildSkeletonPrompt強化 |

---

## 4. 期待される効果

### Before（修正前）
- スタッフ情報: `- 加藤明子(ID:staff-kato): 週2回希望（必須1回）`
- AIはavailableWeekdays制限を認識できない
- 火曜・木曜・土曜にも配置しようとする
- 充足率: 73-93%

### After（修正後）
- スタッフ情報: `- 加藤明子(ID:staff-kato): 週2回希望 [パート] ⚠️ 【月・水・金のみ勤務可】`
- 制約セクションに明示的な制限
- AIは制限を認識して月・水・金のみに配置
- 期待充足率: 98%（Phase 44と同等）

---

## 5. 生成されるプロンプト例

### スタッフ情報セクション
```
# スタッフ情報（全12名）
- 田中太郎(ID:staff-tanaka): 週5回希望（必須4回）
- 佐藤花子(ID:staff-sato): 週5回希望（必須4回）
...
- 加藤明子(ID:staff-kato): 週2回希望 [パート] ⚠️ 【月・水・金のみ勤務可】
- 吉田雅也(ID:staff-yoshida): 週3回希望 [パート]
```

### 制約セクション
```
# 制約条件
## 必須条件（厳守）
1. **日曜日（5, 12, 19, 26日）は全員「休」とすること**
2. 営業日（月〜土）は毎日5名の勤務者を確保すること
3. スタッフの休暇希望を必ず反映すること
4. 連続勤務は最大5日まで
5. **パート職員は指定された曜日のみ勤務可能**（詳細は下記参照）

## ⚠️ 【パート職員制約】（厳守）
以下のスタッフは勤務日数・曜日に**厳格な制限**があります：
- 中村由美: 週3日まで、**月〜土のみ**勤務可
- 小林誠: 週3日まで、**月〜土のみ**勤務可
- 加藤明子: 週2日まで、**月・水・金のみ**勤務可
- 吉田雅也: 週3日まで、**月〜土のみ**勤務可

**重要**: 上記スタッフを制限外の曜日に配置すると、シフトが無効になります。
```

---

## 6. 検証方法

### 本番環境でのテスト
1. デモログインでアクセス
2. シフト管理 → AI自動生成を実行
3. 評価パネルで以下を確認:
   - 充足率: 95%以上を期待
   - 制約違反: 10件以下を期待
   - `加藤明子`が月・水・金のみに配置されているか

### Cloud Functionsログで確認
```bash
gcloud functions logs read generateShift --region=asia-northeast1 --limit=50
```

確認ポイント:
- プロンプトに「⚠️ 【月・水・金のみ勤務可】」が含まれているか
- finishReason: 'STOP'（正常終了）

---

## 7. 学び・振り返り

### 問題発見のプロセス
1. Phase 46でパート職員追加後に品質低下を観測
2. ドキュメント駆動で過去のPhase 44分析を参照
3. 骨子プロンプトとshift-generation.tsのプロンプトを比較
4. `availableWeekdays`が骨子プロンプトに含まれていないことを発見

### 設計原則の確認
- **2段階生成の一貫性**: 骨子生成（Phase 1）と詳細生成（Phase 2）で同じ情報を使用すべき
- **明示的な制約**: AIは明示的に伝えられた制約のみを守る
- **動的制約生成**: ハードコードではなく、スタッフデータから動的に制約を生成

### 今後の注意点
- 新しいスタッフ属性を追加する場合は、両方のプロンプトを更新すること
- 骨子生成で使用する属性は必ずプロンプトに含めること

---

## 8. 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| `.kiro/ai-quality-improvement-analysis-2025-12-08.md` | 詳細分析レポート |
| `docs/phase44-root-cause-analysis-2025-12-07.md` | Phase 44根本原因分析 |
| `docs/phase44-handoff-summary-2025-12-07.md` | Phase 44引継ぎ |
| Serenaメモリ: `ai_quality_improvement_plan_2025-12-08` | 改善計画 |

---

## 9. 次のステップ

1. **デプロイ**: GitHub Actionsでデプロイ
2. **本番検証**: デモ環境でAI生成を実行して品質確認
3. **結果記録**: 充足率・制約違反数を記録

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08

