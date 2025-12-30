# 段階的シフト生成 データ契約

**最終更新**: 2025-12-30
**バージョン**: 1.0.0

---

## 概要

シフト生成は2段階（Phase 1: 骨子生成、Phase 2: 詳細生成）で行われる。
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

## バリデーション

### Phase 1完了時

`validateSkeletonOutput()` で以下を検証:

1. ✅ 全スタッフが含まれているか
2. ✅ 必須フィールド（restDays等）が存在するか
3. ✅ 夜勤施設の場合、nightShiftFollowupDaysが正しく設定されているか

### Phase 2開始時

`validatePhase2Input()` で以下を検証:

1. ✅ 各スタッフのskeleton データが存在するか
2. ✅ 夜勤があるスタッフに nightShiftFollowupDays が存在するか

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
| `functions/src/phase-validation.ts` | バリデーションモジュール |
| `functions/src/ai-response-monitor.ts` | AIレスポンス監視 |
| `functions/src/types.ts` | 型定義 |

---

## バグ履歴

| バグID | 問題 | 原因 | 修正日 |
|--------|------|------|--------|
| BUG-022 | thinkingBudget無視 | Gemini 2.5 Flashのバグ | 2025-12-30 |
| BUG-023 | 夜勤後休息違反 | Phase 2にnightShiftFollowupDays未送信 | 2025-12-30 |
