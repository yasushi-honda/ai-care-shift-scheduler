# 段階的シフト生成 データ契約

**最終更新**: 2025-12-31
**バージョン**: 1.2.0

---

## 概要

シフト生成は3段階で行われる:
1. **Phase 1**: 骨子生成（休日・夜勤パターン決定）
2. **Phase 2**: 詳細生成（日勤シフト配分）
3. **Phase 3**: リバランス（日別人員配置最適化）← BUG-025で追加

このドキュメントはPhase間のデータ受け渡し契約を定義し、BUG-023のようなデータ欠落を防止する。

---

## Phase 1: 骨子生成

### 入力

| フィールド | 型 | 必須 | 説明 |
|-----------|----|----|------|
| staffList | Staff[] | ✅ | 全スタッフリスト |
| requirements | ShiftRequirement | ✅ | シフト要件 |
| leaveRequests | LeaveRequest | ✅ | 休暇希望 |
| projectId | string | ✅ | GCPプロジェクトID |

### 出力: ScheduleSkeleton

```typescript
interface ScheduleSkeleton {
  staffSchedules: StaffScheduleSkeleton[];
}

interface StaffScheduleSkeleton {
  staffId: string;           // 必須
  staffName: string;         // 必須
  restDays: number[];        // 必須: 休日の日付リスト (1-31)
  nightShiftDays: number[];  // 夜勤施設のみ: 夜勤日リスト
  nightShiftFollowupDays: number[];  // 夜勤施設のみ: 明け休み+公休リスト
}
```

### 🔴 重要: 夜勤後休息ルール

夜勤日がX日の場合:
- `nightShiftFollowupDays` には **X+1（明け休み）** と **X+2（公休）** の両方を含めること

例:
```json
{
  "nightShiftDays": [3, 10],
  "nightShiftFollowupDays": [4, 5, 11, 12]
}
```

---

## Phase 2: 詳細生成

### 入力

| フィールド | 型 | 必須 | 説明 |
|-----------|----|----|------|
| staffList | Staff[] | ✅ | 全スタッフリスト |
| skeleton | ScheduleSkeleton | ✅ | Phase 1の出力 |
| requirements | ShiftRequirement | ✅ | シフト要件 |
| projectId | string | ✅ | GCPプロジェクトID |

### Phase 2で使用すべきskeletonフィールド

| フィールド | 用途 |
|-----------|------|
| restDays | 「休」を割り当て |
| nightShiftDays | 「夜勤」を割り当て |
| **nightShiftFollowupDays** | 「明け休み」を割り当て ← **BUG-023の原因** |

### 出力: StaffSchedule[]

```typescript
interface StaffSchedule {
  staffId: string;
  staffName: string;
  monthlyShifts: DailyShift[];
}

interface DailyShift {
  date: string;       // "YYYY-MM-DD"
  shiftType: string;  // "早番", "日勤", "遅番", "夜勤", "休", "明け休み"
}
```

---

## Phase 3: リバランス（BUG-025で追加）

### 目的

Phase 2のバッチ処理独立性により発生するシフト配分の偏りを後処理で修正する。

### 入力

| フィールド | 型 | 必須 | 説明 |
|-----------|----|----|------|
| schedules | StaffSchedule[] | ✅ | Phase 2の出力 |
| requirements | ShiftRequirement | ✅ | シフト要件 |
| staffList | Staff[] | ✅ | 全スタッフリスト |

### 処理内容

1. 日別シフトカウントを集計
2. 各シフトタイプの過不足を特定
3. 過剰シフト → 不足シフトへスワップ
4. スタッフ希望（timeSlotPreference）を考慮

### 出力: RebalanceResult

```typescript
interface RebalanceResult {
  schedules: StaffSchedule[];  // リバランス後のスケジュール
  swapsPerformed: number;       // スワップ実行回数
  improvements: {
    before: { violations: number; score: number };
    after: { violations: number; score: number };
  };
  swapLog: SwapLogEntry[];      // 詳細ログ
}
```

### 実装ファイル

- `functions/src/shift-rebalance.ts`: リバランスモジュール
- `functions/src/shift-generation.ts` (line 266-281): 統合箇所

---

## バリデーション

### Phase 1完了時

`validateSkeletonOutput(skeleton, staffList, hasNightShift, daysInMonth)` で以下を検証:

| パラメータ | 型 | 必須 | 説明 |
|-----------|----|----|------|
| skeleton | ScheduleSkeleton | ✅ | Phase 1出力 |
| staffList | Staff[] | ✅ | 全スタッフリスト |
| hasNightShift | boolean | ✅ | 夜勤施設か否か |
| daysInMonth | number | ✅ | 対象月の日数（28-31） |

検証項目:
1. ✅ 全スタッフが含まれているか
2. ✅ 必須フィールド（restDays等）が存在するか
3. ✅ 夜勤施設の場合、nightShiftFollowupDaysが正しく設定されているか
4. ✅ 月末境界を考慮（例: 2月28日夜勤なら29日チェックはスキップ）

### Phase 2開始時

`validatePhase2Input()` で以下を検証:

1. ✅ 各スタッフのskeleton データが存在するか
2. ✅ 夜勤があるスタッフに nightShiftFollowupDays が存在するか

### 🔴 重要: daysInMonth

月末境界で誤検出を防ぐため、`daysInMonth`は必ず正しい値を渡すこと:

| 月 | daysInMonth |
|----|-------------|
| 1月, 3月, 5月, 7月, 8月, 10月, 12月 | 31 |
| 4月, 6月, 9月, 11月 | 30 |
| 2月（通常年） | 28 |
| 2月（閏年） | 29 |

---

## 自動修正

`autoFixSkeleton()`:

- nightShiftFollowupDays が欠落している場合
- nightShiftDays から自動生成（X+1, X+2を追加）

---

## 監視

### AIレスポンス健全性チェック

`checkResponseHealth()` で以下を検出:

| パターン | 検出条件 | 対処 |
|---------|---------|------|
| BUG-022 | 思考トークン > 90% | maxOutputTokens増加検討 |
| 空レスポンス | text.length === 0 | フォールバック |
| MAX_TOKENS | finishReason | maxOutputTokens増加 |

---

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| `functions/src/phased-generation.ts` | 段階的生成メインロジック |
| `functions/src/shift-rebalance.ts` | Phase 3: リバランスモジュール |
| `functions/src/phase-validation.ts` | バリデーションモジュール |
| `functions/src/ai-response-monitor.ts` | AIレスポンス監視 |
| `functions/src/types.ts` | 型定義 |

---

## バグ履歴

| バグID | 問題 | 原因 | 修正日 |
|--------|------|------|--------|
| BUG-022 | thinkingBudget無視 | Gemini 2.5 Flashのバグ | 2025-12-30 |
| BUG-023 | 夜勤後休息違反 | Phase 2にnightShiftFollowupDays未送信 | 2025-12-30 |
| BUG-025 | AI生成スコア不安定 | バッチ処理の協調問題 → Phase 3リバランスで解決 | 2025-12-30 |
