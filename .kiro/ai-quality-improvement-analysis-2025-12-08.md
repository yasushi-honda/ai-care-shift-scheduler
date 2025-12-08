# AI生成品質改善分析レポート

**作成日**: 2025-12-08
**関連Issue**: AI生成シフトの充足率低下（73-93%）
**分析者**: Claude Opus 4.5

---

## 1. エグゼクティブサマリー

### 問題の概要
Phase 46でパート職員4名を追加後、AI生成シフトの品質が低下した。

| 指標 | Phase 44実績 | 現在（Phase 46後） | 差異 |
|------|-------------|-------------------|------|
| 充足率 | 98% | 73-93% | -5〜25% |
| 制約違反 | 3件 | 19-33件 | +16〜30件 |
| スタッフ数 | 8名 | 12名 | +4名 |

### 根本原因
**プロンプトにパート職員の勤務日制限（availableWeekdays）が含まれていない**

---

## 2. 詳細分析

### 2.1 Phase 44との差異

#### Phase 44で達成されていた品質
- 充足率: 98%
- 制約違反: 3件（軽微な人員不足のみ）
- スタッフ数: 8名（全員フルタイム相当）

#### Phase 46での変更点
1. パート職員4名を追加（計12名）
2. 各パート職員の勤務日数制限を設定
3. `加藤明子`は月・水・金のみ勤務可

### 2.2 プロンプト分析

#### buildSkeletonPrompt（骨子生成）の問題

現在のスタッフ情報出力:
```typescript
`- ${s.name}(ID:${s.id}): 週${s.weeklyWorkCount.hope}回希望（必須${s.weeklyWorkCount.must}回）`
```

**欠落している情報**:
- `availableWeekdays`: 勤務可能曜日（パート職員で重要）
- `maxConsecutiveDays`: 連続勤務上限
- `unavailableDates`: 勤務不可日

#### buildShiftPrompt（一括生成）との比較

一括生成では含まれている:
```typescript
`- 勤務可能曜日: ${formatWeekdays(staff.availableWeekdays || [])}`
`- 勤務不可日: ${unavailableDatesStr}`
```

**問題**: 2段階生成では骨子プロンプトにこれらが含まれていない

### 2.3 数学的検証

#### 供給可能人日の再計算

**常勤8名**:
| スタッフ | 週希望 | 月間可能日数 |
|----------|--------|-------------|
| 田中太郎 | 5日 | 21日 |
| 佐藤花子 | 5日 | 21日 |
| 鈴木美咲 | 4日 | 17日 |
| 高橋健太 | 5日 | 21日 |
| 伊藤真理 | 5日 | 21日 |
| 渡辺翔太 | 5日 | 21日 |
| 山本さくら | 4日 | 17日 |
| 近藤理恵 | 5日 | 21日 |
| **小計** | | **160日** |

**パート4名**:
| スタッフ | 週希望 | 可能曜日 | 月間可能日数 |
|----------|--------|---------|-------------|
| 中村由美 | 3日 | 月〜土 | 12日 |
| 小林誠 | 3日 | 月〜土 | 12日 |
| 加藤明子 | 2日 | **月・水・金のみ** | **8日** |
| 吉田雅也 | 3日 | 月〜土 | 12日 |
| **小計** | | | **44日** |

**合計供給**: 160 + 44 = **204人日**
**必要人日**: 26営業日 × 5名 = **130人日**
**余裕率**: 57%（十分）

#### 問題の本質

数学的には余裕があるが、**AIが`availableWeekdays`制限を認識していない**ため、
火曜・木曜・土曜に`加藤明子`を配置しようとして破綻する。

---

## 3. 改善方針

### 3.1 即時対応（推奨）

**Option A: buildSkeletonPromptにavailableWeekdays情報を追加**

```typescript
// 現在
`- ${s.name}(ID:${s.id}): 週${s.weeklyWorkCount.hope}回希望（必須${s.weeklyWorkCount.must}回）`

// 改善案
const weekdayInfo = formatWeekdays(s.availableWeekdays || [0,1,2,3,4,5,6]);
const isPartTime = s.weeklyWorkCount.hope <= 3;
`- ${s.name}(ID:${s.id}): 週${s.weeklyWorkCount.hope}回希望（必須${s.weeklyWorkCount.must}回）${isPartTime ? `【パート・勤務可能: ${weekdayInfo}】` : ''}`
```

**工数**: 小（1-2時間）
**効果**: 高（根本原因の解決）

### 3.2 追加改善（中期）

**Option B: パート職員制約の動的プロンプト生成**

Phase 44の`buildDynamicTimeSlotConstraints`パターンを適用:

```typescript
function buildDynamicPartTimeConstraints(staffList: Staff[]): string {
  const partTimeStaff = staffList.filter(
    s => s.weeklyWorkCount.hope <= 3 ||
         (s.availableWeekdays && s.availableWeekdays.length < 6)
  );

  if (partTimeStaff.length === 0) return '';

  const constraints = partTimeStaff.map(s => {
    const weekdays = formatWeekdays(s.availableWeekdays || []);
    return `- ${s.name}: 週${s.weeklyWorkCount.hope}日まで、${weekdays}のみ勤務可`;
  }).join('\n');

  return `
## 【パート職員制約】
以下のスタッフは勤務日数・曜日に制限があります：
${constraints}

⚠️ 制限外の曜日には絶対に配置しないでください。
`;
}
```

**工数**: 中（2-4時間）
**効果**: 高（明示的な制約として強調）

### 3.3 検証改善（長期）

**Option C: 生成後の自動検証・再生成ループ**

```typescript
async function generateWithValidation(params, maxRetries = 2): Promise<ShiftResult> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await generateShift(params);

    if (result.evaluation.fulfillmentRate >= 95) {
      return result;
    }

    // 不足日のフィードバックを追加して再生成
    params.feedback = buildImprovementFeedback(result.evaluation);
  }

  return result; // 最善の結果を返す
}
```

**工数**: 大（4-8時間）
**効果**: 中（AIの確率的ばらつきを軽減）

---

## 4. 推奨実装順序

| 優先度 | 改善項目 | 工数 | 期待効果 |
|--------|---------|------|---------|
| 1 | buildSkeletonPromptにavailableWeekdays追加 | 小 | 高 |
| 2 | buildDynamicPartTimeConstraints関数追加 | 中 | 高 |
| 3 | 生成後の自動検証ループ | 大 | 中 |

---

## 5. 実装コード案

### 5.1 buildSkeletonPrompt修正

```typescript
// functions/src/phased-generation.ts

function buildSkeletonPrompt(
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest,
  daysInMonth: number,
  hasNightShift: boolean
): string {
  // スタッフ情報にavailableWeekdaysを追加
  const staffInfo = staffList
    .map((s) => {
      const weekdays = formatWeekdays(s.availableWeekdays || [0,1,2,3,4,5,6]);
      const isRestricted = s.availableWeekdays && s.availableWeekdays.length < 6;
      const baseInfo = `- ${s.name}(ID:${s.id}): 週${s.weeklyWorkCount.hope}回希望（必須${s.weeklyWorkCount.must}回）`;
      const restriction = isRestricted ? ` ⚠️ **${weekdays}のみ勤務可**` : '';
      return hasNightShift
        ? `${baseInfo}${restriction}, 夜勤専従=${s.isNightShiftOnly}`
        : `${baseInfo}${restriction}`;
    })
    .join('\n');

  // ... 以降は既存のロジック
}
```

### 5.2 formatWeekdays関数（追加が必要な場合）

```typescript
function formatWeekdays(weekdays: number[]): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return weekdays.map(d => dayNames[d]).join('・');
}
```

---

## 6. テスト計画

### 6.1 単体テスト
- `buildSkeletonPrompt`が`availableWeekdays`制限を含むことを確認
- `formatWeekdays`の出力形式を確認

### 6.2 統合テスト
- 12名スタッフでのシフト生成
- `加藤明子`が月・水・金以外に配置されないことを確認
- 充足率95%以上を確認

### 6.3 手動検証
- デモ環境でAI生成を実行
- 評価パネルで制約違反を確認

---

## 7. 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| `docs/phase44-root-cause-analysis-2025-12-07.md` | Phase 44の根本原因分析 |
| `docs/phase44-handoff-summary-2025-12-07.md` | Phase 44引継ぎ |
| `.kiro/HANDOFF-2025-12-08.md` | 現在の引継ぎ状況 |
| `functions/src/phased-generation.ts` | 2段階生成ロジック |
| `functions/src/shift-generation.ts` | 一括生成ロジック |

---

## 8. 結論

**問題は明確**: buildSkeletonPromptにavailableWeekdays情報が欠落している。

**解決策は単純**: プロンプトにパート職員の勤務可能曜日を追加する。

**期待される効果**: Phase 44と同等の充足率98%回復。

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08

