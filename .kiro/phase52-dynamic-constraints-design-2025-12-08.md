# Phase 52: 動的制約強化とトレーサビリティログ設計

**作成日**: 2025-12-08
**目的**: AI生成品質を91%→100%に改善するための動的制約強化

---

## 1. 問題分析

### 現状
- **充足率**: 91%（11人日不足）
- **エラー数**: 17件（人員不足）
- **スコア**: 0点

### 根本原因

| 原因 | 説明 | 影響度 |
|-----|------|-------|
| Phase 1骨子で休日が偏る | AIが「週平均」で計算せず、一部の日に休日が集中 | 高 |
| Phase 2で日勤に偏る | 早番・遅番より日勤を優先してしまう | 高 |
| 日別勤務可能人数の可視化不足 | パート職員の曜日制限を考慮した日別分析がない | 高 |

---

## 2. 設計原則

### 2.1 動的制約生成の4原則（CLAUDE.mdより）

| # | 原則 | 説明 |
|---|------|------|
| 1 | **データ駆動型** | ハードコードせずスタッフデータから動的に抽出 |
| 2 | **条件付き生成** | 該当者がいなければ空文字を返す |
| 3 | **明示的な警告** | 「違反したシフトは無効」と明記 |
| 4 | **可読性重視** | 具体的なスタッフ名をリスト化 |

### 2.2 トレーサビリティの原則

| # | 原則 | 説明 |
|---|------|------|
| 1 | **入力ログ** | プロンプトに渡したデータを構造化ログで記録 |
| 2 | **出力ログ** | AIレスポンスの要約（トークン数、finishReason）を記録 |
| 3 | **中間結果ログ** | Phase 1骨子の要約、Phase 2各バッチの要約を記録 |
| 4 | **問題検出ログ** | 日別人員不足リスク、制約違反を事前に検出して記録 |

---

## 3. 新規関数設計

### 3.1 `buildDailyAvailabilityAnalysis`

**目的**: 日別の勤務可能人数を計算し、不足リスクのある日を特定する

**入力**:
- `staffList: Staff[]` - スタッフ一覧
- `requirements: ShiftRequirement` - シフト要件
- `daysInMonth: number` - 月の日数

**出力**:
- `DailyAvailabilityAnalysis` - 日別分析結果

```typescript
interface DailyAvailabilityAnalysis {
  dailyStats: Array<{
    day: number;
    weekday: string;
    availableCount: number;
    requiredCount: number;
    margin: number;  // 余裕（availableCount - requiredCount）
    isRisk: boolean; // margin < 2 の場合 true
    availableStaff: string[];  // 勤務可能スタッフ名
  }>;
  riskDays: number[];  // 不足リスクのある日
  summary: string;     // プロンプト用のサマリー文字列
}
```

**設計ポイント**:
- パート職員の`availableWeekdays`を考慮
- 休暇申請を考慮
- 日曜日は除外

### 3.2 `buildShiftDistributionGuide`

**目的**: 各シフト（早番・日勤・遅番）に配置すべきスタッフを動的に提案

**入力**:
- `staffList: Staff[]` - スタッフ一覧
- `requirements: ShiftRequirement` - シフト要件

**出力**:
- `string` - プロンプト用の配置ガイド

**設計ポイント**:
- `timeSlotPreference`を考慮して配置候補を分類
- 看護師要件を考慮
- 具体的なスタッフ名をリスト化

### 3.3 トレーサビリティログ関数群

```typescript
// Phase 1開始時のログ
function logPhase1Start(context: GenerationContext): void;

// Phase 1完了時のログ（骨子サマリー）
function logPhase1Complete(skeleton: ScheduleSkeleton, dailyAnalysis: DailyAvailabilityAnalysis): void;

// Phase 2バッチ開始時のログ
function logPhase2BatchStart(batchIndex: number, staffBatch: Staff[]): void;

// Phase 2バッチ完了時のログ
function logPhase2BatchComplete(batchIndex: number, result: BatchResult): void;

// 最終結果のログ
function logGenerationComplete(finalResult: GenerationResult): void;
```

---

## 4. 既存関数の改善

### 4.1 `buildDynamicStaffingConstraints`の改善

**現状の問題**:
- 「毎日5名」と指示するだけで、日別の勤務可能人数を計算していない

**改善内容**:
1. `buildDailyAvailabilityAnalysis`を呼び出して日別分析を実施
2. 不足リスクのある日を警告として追加
3. 具体的な勤務可能スタッフ名をリスト化

### 4.2 `buildSkeletonPrompt`の改善

**現状の問題**:
- 休日を適切に分散させる指示が不明確

**改善内容**:
1. 日別分析結果をプロンプトに追加
2. 「この日は全員勤務が必要」という警告を追加
3. 出力前チェックリストを強化

### 4.3 `buildDetailedPrompt`の改善

**現状の問題**:
- バッチ内で「早番2名・日勤2名・遅番1名」を満たすのが困難

**改善内容**:
1. `buildShiftDistributionGuide`を呼び出して配置ガイドを追加
2. バッチごとの「期待する配置」を明示
3. 日別の合計勤務者数チェックを強化

---

## 5. ログ出力設計

### 5.1 ログレベル

| レベル | 用途 | 例 |
|-------|------|-----|
| INFO | 正常処理の記録 | `📊 Phase 1 complete: 12 staff, 26 business days` |
| WARN | 潜在的な問題 | `⚠️ Risk day detected: 15th (only 5 available)` |
| ERROR | 致命的な問題 | `❌ Skeleton parse failed: invalid JSON` |

### 5.2 構造化ログフォーマット

```typescript
interface GenerationLog {
  timestamp: string;
  phase: 'phase1' | 'phase2' | 'complete';
  facilityId: string;
  targetMonth: string;
  data: {
    // Phase 1
    staffCount?: number;
    businessDays?: number;
    riskDays?: number[];
    skeletonSummary?: {
      [staffId: string]: {
        restDayCount: number;
        workDayCount: number;
      };
    };
    // Phase 2
    batchIndex?: number;
    batchStaffCount?: number;
    shiftDistribution?: {
      early: number;
      day: number;
      late: number;
    };
    // Complete
    totalScore?: number;
    fulfillmentRate?: number;
    violations?: number;
  };
  aiMetrics?: {
    promptTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    finishReason: string;
    processingTimeMs: number;
  };
}
```

---

## 6. 実装順序

1. **トレーサビリティログ基盤**（`logGeneration*`関数群）
2. **日別分析関数**（`buildDailyAvailabilityAnalysis`）
3. **配置ガイド関数**（`buildShiftDistributionGuide`）
4. **既存関数の改善**（`buildDynamicStaffingConstraints`, `buildSkeletonPrompt`, `buildDetailedPrompt`）
5. **テスト・検証**

---

## 7. 成功指標

| 指標 | 現状 | 目標 |
|-----|------|------|
| 充足率 | 91% | 100% |
| エラー数 | 17件 | 0件 |
| スコア | 0点 | 90点以上 |

---

## 8. 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md) - 動的制約生成パターン
- [ai-quality-improvement-guide.md](./ai-quality-improvement-guide.md) - 品質改善履歴
- [phased-generation.ts](../functions/src/phased-generation.ts) - 実装コード

---

**作成者**: Claude Opus 4.5
**レビュー待ち**: -
