# AIシフト生成 技術仕様書 v2.0

**作成日**: 2025-12-07
**ステータス**: Draft
**前提ドキュメント**: [プロジェクト会議議事録](./ai-shift-generation-project-meeting-2025-12-07.md)

---

## 1. 概要

### 1.1 目的

Gemini 2.5 Flashを使用したAIシフト自動生成において、人員配置の不均等問題を解決し、100%の制約充足を達成する。

### 1.2 スコープ

- 対象施設: デイサービス（通所介護）
- スタッフ規模: 5〜20名
- シフト区分: 早番・日勤・遅番（夜勤なし）

### 1.3 成功基準

| 指標 | 目標値 |
|------|--------|
| 人員充足率 | 100% |
| 制約違反件数 | 0件 |
| 処理時間 | 5分以内 |
| API呼び出しコスト | 現行比150%以内 |

---

## 2. アーキテクチャ設計

### 2.1 5段階パイプライン

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Shift Generation Pipeline                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ Phase 1  │──▶│ Phase 2  │──▶│ Phase 3  │──▶│ Phase 4  │     │
│  │ 要件分析 │   │ 骨子設計 │   │ 週別配置 │   │ 整合検証 │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│  ConstraintMatrix  RestDays     WeeklyShifts   Violations      │
│                                                    │            │
│                                          ┌────────┴────────┐   │
│                                          │                 │   │
│                                          ▼                 ▼   │
│                                   ┌──────────┐      ┌──────────┐│
│                                   │Phase 4.1 │      │ Phase 5  ││
│                                   │   調整   │      │ 最終出力 ││
│                                   └──────────┘      └──────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 各Phaseの責務

#### Phase 1: 要件分析（ローカル処理）

**入力**: staffList, requirements, leaveRequests
**出力**: ConstraintMatrix

```typescript
interface ConstraintMatrix {
  // 営業日リスト
  businessDays: string[];  // ['2026-01-05', '2026-01-06', ...]

  // 日別必要人員
  dailyRequirements: {
    [shiftType: string]: {
      totalStaff: number;
      qualifications: { name: string; count: number }[];
    };
  };

  // スタッフ別制約
  staffConstraints: {
    [staffId: string]: {
      availableDays: string[];      // 勤務可能日
      unavailableDays: string[];    // 勤務不可日（休暇希望含む）
      preferredShifts: string[];    // 希望シフト
      qualifications: string[];     // 保有資格
      weeklyWorkCount: { hope: number; must: number };
      maxConsecutiveDays: number;
    };
  };

  // 実現可能性判定
  feasibility: {
    isPossible: boolean;
    totalRequired: number;    // 必要人日数
    totalAvailable: number;   // 可能人日数
    marginRate: number;       // 余裕率
  };
}
```

**処理内容**:
1. 対象月の営業日を抽出（デイサービス: 日曜除外）
2. スタッフごとの勤務可能日を計算
3. 実現可能性を事前検証
4. 不可能な場合は早期エラー返却

#### Phase 2: 骨子設計（AI処理）

**入力**: ConstraintMatrix
**出力**: SkeletonSchedule

```typescript
interface SkeletonSchedule {
  staffSchedules: {
    staffId: string;
    staffName: string;
    restDays: number[];        // 休日（日付のみ）
    workDays: number[];        // 勤務日
    weeklyWorkCounts: number[]; // 週ごとの勤務日数
  }[];
}
```

**AIプロンプト戦略**:
- 週ごとの勤務回数を決定
- 連勤制約を考慮した休日配置
- 休暇希望の反映

#### Phase 3: 週別配置（AI処理 × 週数）

**入力**: ConstraintMatrix, SkeletonSchedule, 対象週
**出力**: WeeklyShifts

```typescript
interface WeeklyShifts {
  weekNumber: number;  // 1〜5
  startDate: string;
  endDate: string;
  dailyAssignments: {
    date: string;
    assignments: {
      shiftType: string;  // '早番' | '日勤' | '遅番'
      staffIds: string[];
    }[];
  }[];
}
```

**AIプロンプト戦略**:
- 1週間（最大6営業日）× 全スタッフを一括処理
- 各日の人員要件を明示的に記載
- 資格要件（看護師配置など）を必須条件として指定

#### Phase 4: 整合性検証（ローカル処理）

**入力**: 全WeeklyShifts, ConstraintMatrix
**出力**: ValidationResult

```typescript
interface ValidationResult {
  isValid: boolean;
  violations: {
    type: 'staffShortage' | 'consecutiveWork' | 'qualificationMissing' | 'leaveIgnored';
    severity: 'error' | 'warning';
    date: string;
    shiftType?: string;
    staffId?: string;
    message: string;
  }[];
  score: number;
  fulfillmentRate: number;
}
```

**検証項目**:
1. 日別人員充足
2. 資格要件充足
3. 連勤制約
4. 休暇希望反映

#### Phase 4.1: 調整（AI処理、条件付き）

**トリガー条件**: ValidationResult.isValid === false かつ violations.severity === 'error'

**処理**:
- 違反箇所のみをAIに渡して修正案を生成
- 最大3回までリトライ
- 3回失敗した場合は手動調整を促すメッセージと共に返却

#### Phase 5: 最終出力（ローカル処理）

**入力**: 検証済みWeeklyShifts
**出力**: FinalSchedule

```typescript
interface FinalSchedule {
  schedule: {
    staffId: string;
    staffName: string;
    monthlyShifts: {
      date: string;
      shiftType: string;
    }[];
  }[];
}
```

---

## 3. 詳細設計

### 3.1 Phase 3 プロンプト設計（最重要）

```typescript
function buildWeeklyAssignmentPrompt(
  week: { startDate: string; endDate: string; businessDays: string[] },
  availableStaff: StaffWithConstraints[],
  requirements: DailyRequirements,
  previousWeekEnd?: { lastWorkDay: Record<string, string> }
): string {
  return `
あなたはデイサービスのシフト管理AIです。
以下の条件に基づいて、1週間分のシフトを作成してください。

# 対象期間
${week.startDate} 〜 ${week.endDate}（${week.businessDays.length}営業日）

# 営業日
${week.businessDays.map(d => `- ${d}（${getDayOfWeekJapanese(d)}）`).join('\n')}

# 勤務可能スタッフ（${availableStaff.length}名）
${availableStaff.map(s => formatStaffInfo(s)).join('\n')}

# 【絶対条件】各日の必要人員
| シフト | 必要人数 | 資格要件 |
|--------|----------|----------|
| 早番   | ${requirements.早番.totalStaff}名 | ${formatQualifications(requirements.早番)} |
| 日勤   | ${requirements.日勤.totalStaff}名 | ${formatQualifications(requirements.日勤)} |
| 遅番   | ${requirements.遅番.totalStaff}名 | ${formatQualifications(requirements.遅番)} |

# 制約条件
1. 各日、上記の必要人員を**必ず**満たすこと
2. 日勤には看護師（${getNurseNames(availableStaff)}）を1名以上配置すること
3. 休日に設定されたスタッフは「休」とすること
4. 「日勤のみ希望」のスタッフは日勤に優先配置
5. 連勤${MAX_CONSECUTIVE}日を超えないこと

# 休日設定（骨子より）
${formatRestDays(availableStaff, week)}

# 出力形式
以下のJSON形式で出力してください:
{
  "dailyAssignments": [
    {
      "date": "2026-01-06",
      "早番": ["staff-takahashi", "staff-ito"],
      "日勤": ["staff-sato", "staff-tanaka"],
      "遅番": ["staff-watanabe"],
      "休": ["staff-suzuki", "staff-yamamoto", "staff-kondo"]
    },
    ...
  ]
}

重要: 全${week.businessDays.length}日分を出力し、各日の人員配置を必ず満たしてください。
`;
}
```

### 3.2 処理フロー

```typescript
async function generateShiftWithPipeline(
  staffList: Staff[],
  requirements: ShiftRequirement,
  leaveRequests: LeaveRequest
): Promise<GenerationResult> {

  // Phase 1: 要件分析（ローカル）
  console.log('📊 Phase 1: 要件分析');
  const constraintMatrix = analyzeConstraints(staffList, requirements, leaveRequests);

  if (!constraintMatrix.feasibility.isPossible) {
    return {
      success: false,
      error: `人員不足: 必要${constraintMatrix.feasibility.totalRequired}人日、可能${constraintMatrix.feasibility.totalAvailable}人日`,
    };
  }

  // Phase 2: 骨子設計（AI）
  console.log('🦴 Phase 2: 骨子設計');
  const skeleton = await generateSkeleton(constraintMatrix);

  // Phase 3: 週別配置（AI × 週数）
  console.log('📅 Phase 3: 週別配置');
  const weeks = splitIntoWeeks(constraintMatrix.businessDays);
  const weeklyShifts: WeeklyShifts[] = [];

  for (const week of weeks) {
    console.log(`  - Week ${week.weekNumber}: ${week.startDate}〜${week.endDate}`);
    const shifts = await generateWeeklyShifts(week, skeleton, constraintMatrix);
    weeklyShifts.push(shifts);
  }

  // Phase 4: 整合性検証（ローカル）
  console.log('✅ Phase 4: 整合性検証');
  let validation = validateSchedule(weeklyShifts, constraintMatrix);

  // Phase 4.1: 調整（必要な場合のみ）
  let retryCount = 0;
  while (!validation.isValid && validation.hasErrors && retryCount < 3) {
    console.log(`🔄 Phase 4.1: 調整（リトライ ${retryCount + 1}/3）`);
    const adjustedShifts = await adjustViolations(weeklyShifts, validation.violations);
    weeklyShifts = mergeAdjustments(weeklyShifts, adjustedShifts);
    validation = validateSchedule(weeklyShifts, constraintMatrix);
    retryCount++;
  }

  // Phase 5: 最終出力
  console.log('📤 Phase 5: 最終出力');
  const finalSchedule = convertToFinalFormat(weeklyShifts, staffList);

  return {
    success: true,
    schedule: finalSchedule,
    validation: validation,
  };
}
```

---

## 4. API設計

### 4.1 エンドポイント

既存エンドポイント `/generateShift` を維持し、内部実装を変更。

### 4.2 レスポンス形式

```typescript
interface GenerateShiftResponse {
  success: boolean;
  schedule?: StaffSchedule[];
  evaluation?: AIEvaluationResult;
  metadata?: {
    generatedAt: string;
    model: string;
    pipeline: {
      phase1: { duration: number };
      phase2: { duration: number; tokensUsed: number };
      phase3: { duration: number; tokensUsed: number; weekCount: number };
      phase4: { duration: number; violations: number };
      phase5: { duration: number };
      totalDuration: number;
      totalTokensUsed: number;
    };
  };
  error?: string;
}
```

---

## 5. 実装計画

### 5.1 ファイル構成

```
functions/src/
├── shift-generation.ts          # エントリポイント（既存）
├── pipeline/
│   ├── index.ts                 # パイプライン統合
│   ├── phase1-analyze.ts        # 要件分析
│   ├── phase2-skeleton.ts       # 骨子設計
│   ├── phase3-weekly.ts         # 週別配置
│   ├── phase4-validate.ts       # 整合性検証
│   ├── phase4-1-adjust.ts       # 調整
│   └── phase5-output.ts         # 最終出力
├── phased-generation.ts         # 旧実装（互換性のため維持）
└── evaluation/
    └── evaluationLogic.ts       # 評価ロジック（既存）
```

### 5.2 マイルストーン

| # | タスク | 優先度 | 見積もり |
|---|--------|--------|----------|
| 1 | Phase 1（要件分析）実装 | 高 | 2時間 |
| 2 | Phase 3（週別配置）プロンプト改善 | 最高 | 1時間 |
| 3 | Phase 4（整合性検証）強化 | 高 | 1時間 |
| 4 | 統合テスト | 高 | 2時間 |
| 5 | Phase 4.1（調整）実装 | 中 | 2時間 |
| 6 | パフォーマンス最適化 | 低 | 後日 |

### 5.3 即時実装（クイックウィン）

現行コードへの最小変更で効果を得る方法:

1. `buildDetailedPrompt`に必要人員の具体的数値を追加
2. バッチサイズを「1週間分」に変更
3. 各バッチに前バッチの結果を参照させる

---

## 6. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| API呼び出し増加によるコスト増 | 中 | 週単位処理で抑制（日単位より効率的） |
| 週間をまたぐ連勤制約の見落とし | 高 | Phase 2で事前に休日を確定 |
| AI出力のJSONパースエラー | 中 | 小さい出力単位で安定性向上 |
| タイムアウト | 低 | 現行5分で十分（週4回呼び出し程度） |

---

## 7. 検証計画

### 7.1 テストケース

| # | ケース | 期待結果 |
|---|--------|----------|
| 1 | 8名スタッフ、26営業日 | 人員充足率100% |
| 2 | 看護師2名、日勤に1名必須 | 毎日看護師配置 |
| 3 | 休暇希望4件 | 全件反映 |
| 4 | 連勤上限5日 | 6連勤なし |

### 7.2 成功判定

```typescript
function isSuccess(result: GenerationResult): boolean {
  return (
    result.success &&
    result.evaluation.fulfillmentRate === 100 &&
    result.evaluation.constraintViolations.filter(v => v.severity === 'error').length === 0
  );
}
```

---

## 付録A: 用語集

| 用語 | 定義 |
|------|------|
| 骨子（Skeleton） | 休日パターンのみを決定した大枠のスケジュール |
| 人員充足率 | 必要人員に対する実配置人員の割合 |
| 制約充足問題（CSP） | 変数に値を割り当て、すべての制約を満たす解を求める問題 |

---

## 付録B: 参照ドキュメント

- [プロジェクト会議議事録](./ai-shift-generation-project-meeting-2025-12-07.md)
- [Gemini 2.5 Flash API リファレンス](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [既存実装: phased-generation.ts](../functions/src/phased-generation.ts)
