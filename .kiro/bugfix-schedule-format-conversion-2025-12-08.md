# BUG-015: generateDetailedShiftsの出力形式変換不備

**更新日**: 2025-12-08
**コミット**: d5ef5a8
**重要度**: Critical

## 問題

BUG-014修正後、AI生成は成功するようになったが「Invalid schedule format in response」エラーが発生。

### エラーログ

```
⚠️ 評価エラー（フォールバック使用）: TypeError: Cannot read properties of undefined (reading 'find')
    at EvaluationService.checkStaffShortage (/workspace/lib/evaluation/evaluationLogic.js:346:59)
```

### 根本原因

`generateDetailedShifts`の出力形式と`EvaluationService.checkStaffShortage`の期待形式が不一致。

**generateDetailedShiftsの出力**:
```json
{
  "staffId": "xxx",
  "staffName": "田中太郎",
  "shifts": { "1": "日勤", "2": "休", "3": "早番", ... }
}
```

**checkStaffShortageの期待**:
```json
{
  "staffId": "xxx",
  "staffName": "田中太郎",
  "monthlyShifts": [
    { "date": "2025-01-01", "shiftType": "日勤" },
    { "date": "2025-01-02", "shiftType": "休" },
    ...
  ]
}
```

## 修正内容

`generateDetailedShifts`関数の末尾で形式変換ロジックを追加：

```typescript
// 形式変換: { shifts: { "1": "日勤", ... } } → { monthlyShifts: [{ date: "2025-01-01", shiftType: "日勤" }, ...] }
const convertedSchedules: StaffSchedule[] = allSchedules.map((schedule: any) => {
  const monthlyShifts = Object.entries(schedule.shifts || {}).map(([day, shiftType]) => ({
    date: `${requirements.targetMonth}-${String(day).padStart(2, '0')}`,
    shiftType: shiftType as string,
  }));

  return {
    staffId: schedule.staffId,
    staffName: schedule.staffName,
    monthlyShifts,
  };
});
```

## 期待される動作

| 項目 | 修正前 | 修正後 |
|------|--------|--------|
| 出力形式 | `{ shifts: {...} }` | `{ monthlyShifts: [...] }` |
| 評価ロジック | 例外発生 | 正常動作 |
| API結果 | フォールバック評価 | 正確な評価 |

## バグ連鎖の構造

```
BUG-012: @google-cloud/vertexai → @google/genai 移行
    ↓
BUG-013: responseSchema削除（thinkingBudget非互換）
    ↓
BUG-014: responseMimeType削除（thinkingBudget非互換）
    ↓
BUG-015: 形式変換不備（評価ロジック例外）← 今回
    ↓
✅ 正常動作（検証中）
```

## 教訓

1. APIのレスポンス形式変更時は、消費者（評価ロジック）の期待形式も確認する
2. 段階的生成（phased-generation）と一括生成（shift-generation）で出力形式を統一する
3. 評価ロジックのエラーハンドリングがフォールバックを返すため、本当の問題が隠れていた

## 関連バグ

| BUG ID | 問題 | 修正内容 |
|--------|------|---------|
| BUG-012 | @google-cloud/vertexai SDKがthinkingConfigをサポートしない | @google/genai SDKに移行 |
| BUG-013 | responseSchemaがthinkingBudgetを無視 | responseSchema削除 |
| BUG-014 | responseMimeTypeもthinkingBudgetを無視 | responseMimeType削除 |
| **BUG-015** | generateDetailedShiftsの出力形式が評価ロジックと不一致 | 形式変換ロジック追加 |
