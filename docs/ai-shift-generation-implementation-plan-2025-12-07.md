# AIシフト生成 実装計画書

**作成日**: 2025-12-07
**ステータス**: 承認待ち
**前提ドキュメント**:
- [プロジェクト会議議事録](./ai-shift-generation-project-meeting-2025-12-07.md)
- [技術仕様書](./ai-shift-generation-technical-spec-2025-12-07.md)

---

## 1. 実装方針

### 1.1 段階的アプローチ

大規模な書き換えではなく、**既存コードへの段階的改善**を採用します。

```
Step 1: クイックウィン（即時効果）
  ↓
Step 2: 週単位処理への移行
  ↓
Step 3: 5段階パイプラインの完成
```

### 1.2 リスク最小化

- 既存の`phased-generation.ts`は維持
- 新実装は`pipeline/`ディレクトリに分離
- フィーチャーフラグで切り替え可能に

---

## 2. Step 1: クイックウィン（本日実施）

### 2.1 目的

最小限の変更で、人員配置の不均等問題を改善する。

### 2.2 変更内容

#### 変更1: `buildDetailedPrompt`の改善

**ファイル**: `functions/src/phased-generation.ts`

**変更前**:
```typescript
# 制約
- 骨子で指定された休日は変更しないこと
- 休日以外の日は、${shiftTypeNames.join('・')}のいずれかを割り当てる
- 各日の必要人員を満たすよう調整する
```

**変更後**:
```typescript
# 【絶対条件】各日の必要人員
| シフト | 必要人数 | 資格要件 |
|--------|----------|----------|
${Object.entries(requirements.requirements).map(([name, req]) =>
  `| ${name} | ${req.totalStaff}名 | ${formatQualifications(req)} |`
).join('\n')}

# 制約
- 骨子で指定された休日は変更しないこと
- 休日以外の日は、上記の必要人員を**必ず満たすよう**シフトを割り当てる
- 特に日勤には看護師を1名以上配置すること
- 1日の合計勤務者数: ${totalStaffPerDay}名
```

#### 変更2: 資格要件のフォーマット関数追加

```typescript
function formatQualifications(req: DailyRequirement): string {
  if (!req.requiredQualifications || req.requiredQualifications.length === 0) {
    return 'なし';
  }
  return req.requiredQualifications
    .map(q => `${q.qualification}${q.count}名以上`)
    .join('、');
}
```

### 2.3 期待効果

- AIが具体的な人員数を認識
- 資格要件（看護師配置）の明確化
- 成功確率の向上

### 2.4 テスト手順

1. ローカルでCloud Functions起動
2. デモデータでシフト生成実行
3. 人員充足率を確認

---

## 3. Step 2: 週単位処理への移行

### 3.1 目的

バッチ処理の単位を「スタッフ5名×31日」から「1週間×全スタッフ」に変更し、日単位の人員配置を最適化する。

### 3.2 変更内容

#### 新規ファイル: `functions/src/pipeline/phase3-weekly.ts`

```typescript
/**
 * Phase 3: 週別配置
 *
 * 1週間単位で全スタッフのシフトを生成
 * 各日の人員要件を確実に満たす
 */

import { VertexAI } from '@google-cloud/vertexai';

interface WeeklyGenerationInput {
  week: {
    weekNumber: number;
    startDate: string;
    endDate: string;
    businessDays: string[];
  };
  availableStaff: StaffWithConstraints[];
  skeleton: SkeletonSchedule;
  requirements: ShiftRequirement;
}

export async function generateWeeklyShifts(
  input: WeeklyGenerationInput,
  projectId: string
): Promise<WeeklyShifts> {

  const prompt = buildWeeklyPrompt(input);

  const vertexAI = new VertexAI({
    project: projectId,
    location: 'asia-northeast1',
  });

  const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: getWeeklySchema(input.week.businessDays),
      temperature: 0.3,  // 低めで安定性重視
      maxOutputTokens: 8192,  // 1週間分なら十分
    },
  });

  const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseWeeklyResponse(responseText, input.week);
}

function buildWeeklyPrompt(input: WeeklyGenerationInput): string {
  const { week, availableStaff, skeleton, requirements } = input;

  // 各スタッフのこの週の休日を取得
  const staffRestDays = getStaffRestDaysForWeek(skeleton, week);

  // この週に勤務可能なスタッフ（毎日確認）
  const staffAvailability = week.businessDays.map(date => ({
    date,
    available: availableStaff.filter(s => !staffRestDays[s.id]?.includes(date)),
  }));

  return `
あなたはデイサービスのシフト管理AIです。
以下の条件に基づいて、1週間分の最適なシフトを作成してください。

# 対象期間
第${week.weekNumber}週: ${week.startDate} 〜 ${week.endDate}

# 営業日（${week.businessDays.length}日間）
${week.businessDays.map(d => `- ${d}（${getDayOfWeekJapanese(d)}）`).join('\n')}

# スタッフ情報（${availableStaff.length}名）
${availableStaff.map(s => formatStaffForPrompt(s, staffRestDays[s.id] || [])).join('\n')}

# 【絶対条件】各日の必要人員
${formatRequirementsTable(requirements)}

**重要**: 各日、上記の人員配置を**必ず**満たしてください。

# 資格要件
- 日勤には看護師（${getNurseNames(availableStaff)}）を1名以上配置すること

# 日別の勤務可能スタッフ
${staffAvailability.map(({ date, available }) =>
  `${date}: ${available.map(s => s.name).join('、')}（${available.length}名）`
).join('\n')}

# 出力形式
以下のJSON形式で、全${week.businessDays.length}日分を出力してください:

{
  "dailyAssignments": [
    {
      "date": "${week.businessDays[0]}",
      "早番": ["staff-id-1", "staff-id-2"],
      "日勤": ["staff-id-3", "staff-id-4"],
      "遅番": ["staff-id-5"],
      "休": ["staff-id-6", "staff-id-7", "staff-id-8"]
    },
    ...
  ]
}

# チェックリスト（出力前に確認）
□ 各日の早番が${requirements.requirements['早番'].totalStaff}名いるか
□ 各日の日勤が${requirements.requirements['日勤'].totalStaff}名いるか（看護師1名含む）
□ 各日の遅番が${requirements.requirements['遅番'].totalStaff}名いるか
□ 休日のスタッフは「休」に入っているか
□ 1人のスタッフが1日に複数シフトに入っていないか
`;
}
```

### 3.3 統合方法

`shift-generation.ts`の`generateShift`関数内で、新しい週単位処理を呼び出す:

```typescript
// 6名以上の場合
if (staffList.length > 5) {
  // 新: 週単位パイプライン
  if (process.env.USE_WEEKLY_PIPELINE === 'true') {
    scheduleData = await generateWithWeeklyPipeline(
      staffList, requirements, leaveRequests, projectId
    );
  } else {
    // 旧: 既存の段階生成
    scheduleData = await generateScheduleInPhasedMode(...);
  }
}
```

### 3.4 テスト計画

1. 環境変数`USE_WEEKLY_PIPELINE=true`で新実装を有効化
2. デモデータで動作確認
3. 成功したら旧実装を削除

---

## 4. Step 3: 5段階パイプラインの完成

### 4.1 ファイル構成

```
functions/src/pipeline/
├── index.ts              # パイプライン統合・エクスポート
├── types.ts              # 型定義
├── phase1-analyze.ts     # 要件分析
├── phase2-skeleton.ts    # 骨子設計
├── phase3-weekly.ts      # 週別配置
├── phase4-validate.ts    # 整合性検証
├── phase4-1-adjust.ts    # 調整
└── phase5-output.ts      # 最終出力
```

### 4.2 Phase 1: 要件分析（ローカル処理）

```typescript
// pipeline/phase1-analyze.ts

export function analyzeConstraints(
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest
): ConstraintMatrix {

  const [year, month] = requirements.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 営業日を抽出（デイサービス: 日曜除外）
  const businessDays: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${requirements.targetMonth}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek !== 0) {  // 日曜以外
      businessDays.push(date);
    }
  }

  // スタッフ別制約を構築
  const staffConstraints: Record<string, StaffConstraint> = {};
  for (const staff of staffList) {
    const unavailableDays = new Set<string>();

    // 勤務不可日
    (staff.unavailableDates || []).forEach(d => unavailableDays.add(d));

    // 休暇希望
    const staffLeaves = leaveRequests[staff.id] || {};
    Object.keys(staffLeaves).forEach(d => unavailableDays.add(d));

    // 勤務可能曜日から除外
    const availableDays = businessDays.filter(date => {
      const dayOfWeek = new Date(date).getDay();
      return (staff.availableWeekdays || []).includes(dayOfWeek)
        && !unavailableDays.has(date);
    });

    staffConstraints[staff.id] = {
      availableDays,
      unavailableDays: Array.from(unavailableDays),
      preferredShifts: getPreferredShifts(staff.timeSlotPreference),
      qualifications: staff.qualifications || [],
      weeklyWorkCount: staff.weeklyWorkCount || { hope: 5, must: 4 },
      maxConsecutiveDays: staff.maxConsecutiveWorkDays || 5,
    };
  }

  // 実現可能性判定
  const totalRequired = businessDays.length * getTotalStaffPerDay(requirements);
  const totalAvailable = Object.values(staffConstraints).reduce(
    (sum, c) => sum + Math.min(c.availableDays.length, c.weeklyWorkCount.hope * 4),
    0
  );

  return {
    businessDays,
    dailyRequirements: requirements.requirements,
    staffConstraints,
    feasibility: {
      isPossible: totalAvailable >= totalRequired,
      totalRequired,
      totalAvailable,
      marginRate: Math.round((totalAvailable / totalRequired - 1) * 100),
    },
  };
}
```

### 4.3 Phase 4: 整合性検証

```typescript
// pipeline/phase4-validate.ts

export function validateSchedule(
  weeklyShifts: WeeklyShifts[],
  constraintMatrix: ConstraintMatrix
): ValidationResult {

  const violations: Violation[] = [];

  // すべての日別割り当てを集約
  const allAssignments = weeklyShifts.flatMap(w => w.dailyAssignments);

  for (const assignment of allAssignments) {
    // 人員充足チェック
    for (const [shiftType, req] of Object.entries(constraintMatrix.dailyRequirements)) {
      const assigned = assignment[shiftType] || [];
      if (assigned.length < req.totalStaff) {
        violations.push({
          type: 'staffShortage',
          severity: 'error',
          date: assignment.date,
          shiftType,
          message: `${assignment.date}の${shiftType}で${req.totalStaff - assigned.length}名不足`,
        });
      }

      // 資格要件チェック
      for (const qualReq of req.requiredQualifications || []) {
        const qualifiedCount = assigned.filter(staffId =>
          constraintMatrix.staffConstraints[staffId]?.qualifications.includes(qualReq.qualification)
        ).length;

        if (qualifiedCount < qualReq.count) {
          violations.push({
            type: 'qualificationMissing',
            severity: 'error',
            date: assignment.date,
            shiftType,
            message: `${assignment.date}の${shiftType}で${qualReq.qualification}が${qualReq.count - qualifiedCount}名不足`,
          });
        }
      }
    }
  }

  // 連勤チェック（スタッフごと）
  violations.push(...checkConsecutiveWork(allAssignments, constraintMatrix));

  const errorCount = violations.filter(v => v.severity === 'error').length;

  return {
    isValid: errorCount === 0,
    hasErrors: errorCount > 0,
    violations,
    score: Math.max(0, 100 - errorCount * 10 - (violations.length - errorCount) * 5),
    fulfillmentRate: calculateFulfillmentRate(allAssignments, constraintMatrix),
  };
}
```

---

## 5. 実施スケジュール

| 日程 | タスク | 担当 | 成果物 |
|------|--------|------|--------|
| 12/7 PM | Step 1: クイックウィン実装 | BE | `phased-generation.ts`修正 |
| 12/7 PM | Step 1: テスト・検証 | BE | テスト結果ログ |
| 12/8 | Step 2: 週単位処理実装 | BE | `pipeline/phase3-weekly.ts` |
| 12/8 | Step 2: 統合・テスト | BE | 動作確認 |
| 12/9 | Step 3: 残りのPhase実装 | BE | `pipeline/*.ts` |
| 12/9 | 最終検証・本番デプロイ | BE | 本番環境 |

---

## 6. 承認事項

### 6.1 即時実施の承認

**Step 1（クイックウィン）**を本日中に実施してよいか？

- [x] プロンプト改善（必要人員の明示）
- [x] 資格要件のフォーマット改善

### 6.2 週単位処理の方針確認

**Step 2（週単位処理）**の方針について:

- 処理単位: 1週間（最大6営業日）× 全スタッフ（8名）
- API呼び出し: 骨子1回 + 週4〜5回 + 検証調整（条件付き）
- 見積もりコスト: 現行比 約150%

---

## 7. 次のステップ

1. **本ドキュメントの承認**
2. **Step 1の実施**
3. **テスト結果の確認**
4. **Step 2以降の実施判断**

---

## 付録: クイックウィン実装のdiff

```diff
// functions/src/phased-generation.ts

function buildDetailedPrompt(...) {
  // ...

+  // 必要人員テーブルを作成
+  const requirementsTable = Object.entries(requirements.requirements)
+    .map(([name, req]) => {
+      const quals = (req.requiredQualifications || [])
+        .map(q => `${q.qualification}${q.count}名以上`)
+        .join('、') || 'なし';
+      return `| ${name} | ${req.totalStaff}名 | ${quals} |`;
+    })
+    .join('\n');
+
+  const totalStaffPerDay = Object.values(requirements.requirements)
+    .reduce((sum, req) => sum + req.totalStaff, 0);

  if (hasNightShift) {
    return `...`;  // 夜勤ありの場合は既存のまま
  } else {
    return `
以下のスタッフの${requirements.targetMonth}の詳細シフトを生成してください。
**骨子（休日）は既に決定済み**なので、それに従って詳細シフト区分を割り当ててください。

**重要**: この施設はデイサービスのため、**夜勤はありません**。

# 対象スタッフ（${staffBatch.length}名）
${staffInfo}

# シフト区分（日中のみ）
${shiftDescription}

+# 【絶対条件】各日の必要人員
+| シフト | 必要人数 | 資格要件 |
+|--------|----------|----------|
+${requirementsTable}
+
+**重要**: 各営業日、上記の人員配置を**必ず**満たしてください。
+1日の合計勤務者数: ${totalStaffPerDay}名

# 制約
- 骨子で指定された休日は変更しないこと
-- 休日以外の日は、${shiftTypeNames.join('・')}のいずれかを割り当てる
-- 各日の必要人員を満たすよう調整する
+- 休日以外の日は、必要人員を満たすようシフトを割り当てる
+- 日勤には看護師を**必ず1名以上**配置すること
- **夜勤や明け休みは絶対に使用しないこと**

# 出力
...
`;
  }
}
```
