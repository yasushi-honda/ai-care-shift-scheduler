# 予実管理ユーザビリティ向上提案

**作成日**: 2025-11-23
**仕様ID**: care-staff-schedule-compliance
**対象**: Phase 25.2完了後の追加改善

---

## 概要

Phase 25.2で実装した予実2段書きUI機能に対して、「予定通りに実績を入力する」操作を効率化するユーザビリティ向上案を提案します。

---

## 背景・課題

### 現状の課題

- **実績入力の頻度**: 月30日 × スタッフ5名 = 150シフト/月
- **予定通りの割合**: 推定70-90%（変更は10-30%程度）
- **1シフトの入力時間**: 約20秒（モーダル開く → 各項目入力 → 確認）
- **月間作業時間**: 約50分

### 改善の必要性

実績の大半が「予定通り」である場合、毎回手入力するのは非効率的です。
一括コピー機能や「予定と同じ」ボタンにより、**作業時間を86-90%削減**できます。

---

## 提案機能一覧

### 🥇 最優先提案

#### 提案1: 個別「予定と同じ」ボタン

**概要**: ShiftEditConfirmModal（実績編集時）に「予定と同じ内容を入力」ボタンを追加

**UI設計**:
```
┌──────────────────────────────────────┐
│ シフト編集 - 実績                     │
│                                      │
│ 日付: 2025-11-01 (金)                │
│ スタッフ: 田中太郎                    │
│                                      │
│ [📋 予定と同じ内容を入力]  ← 新規ボタン │
│                                      │
│ シフトタイプ: [日勤 ▼]               │
│ 開始時刻: [08:30]                    │
│ 終了時刻: [17:30]                    │
│ 休憩時間: [60] 分                    │
│                                      │
│ 特記事項: [           ]              │
│                                      │
│ [確認] [キャンセル]                   │
└──────────────────────────────────────┘
```

**実装詳細**:
```typescript
// src/components/ShiftEditConfirmModal.tsx に追加

function handleCopyFromPlanned() {
  if (!currentShift) return;

  if (type === 'actual') {
    setShiftType(currentShift.plannedShiftType || currentShift.shiftType || '');
    setStartTime(currentShift.plannedStartTime || '');
    setEndTime(currentShift.plannedEndTime || '');
    // breakMinutesとnotesはコピーしない（手動入力を促す）

    // ユーザーにフィードバック（オプション）
    // toast.success('予定の内容をコピーしました');
  }
}

// JSX部分
{type === 'actual' && currentShift && (
  <button
    type="button"
    onClick={handleCopyFromPlanned}
    className="w-full mb-4 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
    予定と同じ内容を入力
  </button>
)}
```

**効果**:
- ✅ 使用頻度: 非常に高い（実績入力の70%）
- ✅ 時間削減: 20秒 → 10秒（**50%削減**）
- ✅ 学習コスト: 低い（ボタンが目立つ位置に配置）
- ✅ 柔軟性: コピー後に微調整可能

**実装難易度**: ⭐☆☆☆☆（簡単）
**推定工数**: 1-2時間
**成功確率**: 98%

---

#### 提案2: 一括「予定→実績コピー」機能

**概要**: 実績未入力のシフトに対して、予定を一括で実績にコピー

**UI設計**:
```
┌─────────────────────────────────────┐
│ シフト表                             │
│ [シフト表] [休暇希望入力]            │
│                                     │
│ [📋 予定を実績にコピー] ← 新規ボタン │
├─────────────────────────────────────┤
│ [スタッフ] [1日][2日][3日]...       │
│  田中 愛   日勤  早番  休            │
│            (未) (未) (未)  ← 実績未入力 │
└─────────────────────────────────────┘

モーダル:
┌─────────────────────────────────────┐
│ 予定を実績にコピー                   │
├─────────────────────────────────────┤
│ □ 全スタッフ                         │
│ ☑ 田中 愛 (5日分)                    │
│ ☑ 佐藤 健 (3日分)                    │
│ □ 鈴木 美咲 (実績入力済み)           │
├─────────────────────────────────────┤
│ 対象期間:                            │
│ [2025-11-01] ～ [2025-11-30]        │
│                                     │
│ ☐ 既存の実績を上書きする             │
│                                     │
│ [実行] [キャンセル]                  │
└─────────────────────────────────────┘
```

**実装詳細**:
```typescript
// src/utils/bulkCopyPlannedToActual.ts

export interface BulkCopyOptions {
  staffIds?: string[];  // 対象スタッフ（未指定=全員）
  dateRange?: { start: string; end: string };  // 対象期間
  overwrite?: boolean;  // 既存実績を上書きするか（デフォルト: false）
}

export function bulkCopyPlannedToActual(
  schedules: StaffSchedule[],
  options: BulkCopyOptions = {}
): StaffSchedule[] {
  return schedules.map(staff => {
    // 対象スタッフでない場合はスキップ
    if (options.staffIds && !options.staffIds.includes(staff.staffId)) {
      return staff;
    }

    return {
      ...staff,
      monthlyShifts: staff.monthlyShifts.map(shift => {
        // 対象期間外はスキップ
        if (options.dateRange) {
          if (shift.date < options.dateRange.start || shift.date > options.dateRange.end) {
            return shift;
          }
        }

        // 実績が既にある場合
        if (shift.actualShiftType && !options.overwrite) {
          return shift;
        }

        // 予定を実績にコピー
        return {
          ...shift,
          actualShiftType: shift.plannedShiftType || shift.shiftType,
          actualStartTime: shift.plannedStartTime,
          actualEndTime: shift.plannedEndTime,
          // breakMinutesとnotesは空のまま（手動入力推奨）
        };
      })
    };
  });
}
```

**新規コンポーネント**:
```typescript
// src/components/BulkCopyPlannedToActualModal.tsx

interface BulkCopyPlannedToActualModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: StaffSchedule[];
  targetMonth: string;
  onExecute: (options: BulkCopyOptions) => void;
}

export function BulkCopyPlannedToActualModal({
  isOpen,
  onClose,
  schedules,
  targetMonth,
  onExecute
}: BulkCopyPlannedToActualModalProps) {
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [overwrite, setOverwrite] = useState(false);

  // 実績未入力件数を計算
  const getUnfilledCount = (staff: StaffSchedule): number => {
    return staff.monthlyShifts.filter(shift => !shift.actualShiftType).length;
  };

  // ... UI実装
}
```

**効果**:
- ✅ 使用頻度: 高い（月末の実績入力時）
- ✅ 時間削減: 50分 → 5分（**90%削減**）
- ✅ エラー削減: 手入力ミス防止
- ⚠️ 学習コスト: 中（新機能の説明が必要）

**実装難易度**: ⭐⭐☆☆☆（中）
**推定工数**: 4-6時間
**成功確率**: 95%

---

### 🥈 追加提案

#### 提案3: セルダブルクリックで「予定→実績コピー」

**概要**: 実績セル（未入力）をダブルクリックすると、予定をコピーして確認ダイアログ表示

**UI動作**:
```
1. 実績セル（未入力）をダブルクリック
   ↓
2. 確認ダイアログ表示
   「予定（日勤 08:30-17:30）を実績に反映しますか？」
   [はい] [いいえ、編集する]
   ↓
3. [はい] → 即座に予定をコピー
   [いいえ、編集する] → 通常の編集モーダル表示
```

**実装詳細**:
```typescript
// components/ShiftTable.tsx に追加

const handleActualCellDoubleClick = (
  shift: GeneratedShift,
  staffId: string,
  staffName: string
) => {
  if (shift.actualShiftType) {
    // 既に実績がある場合は通常編集
    handleCellClick(shift.date, staffId, staffName, 'actual', shift);
    return;
  }

  // 実績未入力の場合、予定コピーを提案
  const plannedType = shift.plannedShiftType || shift.shiftType || '休';
  const timeInfo = shift.plannedStartTime && shift.plannedEndTime
    ? ` ${shift.plannedStartTime}-${shift.plannedEndTime}`
    : '';

  const confirmed = window.confirm(
    `予定（${plannedType}${timeInfo}）を実績に反映しますか？\n\n` +
    `「キャンセル」で編集モーダルを開きます。`
  );

  if (confirmed) {
    // 予定を実績にコピー
    onShiftUpdate(staffId, shift.date, {
      actualShiftType: plannedType,
      actualStartTime: shift.plannedStartTime,
      actualEndTime: shift.plannedEndTime,
    });
  } else {
    // 編集モーダルを開く
    handleCellClick(shift.date, staffId, staffName, 'actual', shift);
  }
};

// JSX部分（実績セル）
<td
  onClick={() => handleCellClick(shift.date, staffSchedule.staffId, staffSchedule.staffName, 'actual', shift)}
  onDoubleClick={() => handleActualCellDoubleClick(shift, staffSchedule.staffId, staffSchedule.staffName)}
  // ...
>
```

**効果**:
- ✅ 使用頻度: 高い（日常的な実績入力）
- ✅ 時間削減: クリック2回 → ダブルクリック1回（**75%削減**）
- ✅ 学習コスト: 低い（ダブルクリックは一般的）
- ⚠️ 発見性: 中（説明がないと気づかれない可能性）

**実装難易度**: ⭐⭐☆☆☆（中）
**推定工数**: 2-3時間
**成功確率**: 85%

---

## 総合評価・推奨順位

| 順位 | 機能 | 効果 | 実装難易度 | 工数 | 成功確率 | 優先度 |
|------|------|------|-----------|------|---------|--------|
| 🥇 1 | **個別「予定と同じ」ボタン** | ⭐⭐⭐⭐⭐ | ⭐☆☆☆☆ | 1-2h | 98% | **最優先** |
| 🥈 2 | **一括コピー機能** | ⭐⭐⭐⭐⭐ | ⭐⭐☆☆☆ | 4-6h | 95% | **高** |
| 🥉 3 | **ダブルクリックコピー** | ⭐⭐⭐⭐☆ | ⭐⭐☆☆☆ | 2-3h | 85% | 中 |

---

## 費用対効果分析

### ユーザーの作業時間試算

**現状（Phase 25.2）**:
- 実績入力: 1シフトあたり平均20秒
- 月間: 30日 × 5スタッフ = 150シフト
- **合計: 50分/月**

**提案1実装後（個別ボタン）**:
- 予定通り（70%）: 10秒/シフト
- 変更あり（30%）: 20秒/シフト
- **合計: 25分/月 → 50%削減**

**提案1+2実装後（一括コピー）**:
- 一括コピー: 2分
- 例外入力（10%）: 15シフト × 20秒 = 5分
- **合計: 7分/月 → 86%削減**

### ROI（投資対効果）

- **開発工数**: 5-8時間
- **削減時間**: 43分/月 × 12ヶ月 = **8.6時間/年**
- **ROI**: 約100%（1年で回収）

---

## 推奨実装計画

### Phase 25.2.5: ユーザビリティ向上（推定工数: 7-10時間）

#### Task 25.2.5.1: 個別「予定と同じ」ボタン（1-2時間）

**実装内容**:
1. ShiftEditConfirmModal.tsxに`handleCopyFromPlanned`関数追加
2. 「予定と同じ内容を入力」ボタンをUI追加
3. `type === 'actual'`の場合のみ表示
4. TypeScriptエラー確認

**完了条件**:
- [ ] ボタンクリックで予定の値がフォームにコピーされる
- [ ] TypeScriptエラー0件
- [ ] 手動テストで動作確認

---

#### Task 25.2.5.2: 一括コピー機能（4-6時間）

**実装内容**:
1. `src/utils/bulkCopyPlannedToActual.ts`作成
2. `src/components/BulkCopyPlannedToActualModal.tsx`作成
3. App.tsxにモーダル統合
4. シフト表に「予定を実績にコピー」ボタン追加
5. E2Eテスト追加（bulk-copy-planned-to-actual.spec.ts）

**完了条件**:
- [ ] 一括コピー機能が動作する
- [ ] スタッフ選択・期間選択が可能
- [ ] 既存実績の上書き有無を選択可能
- [ ] TypeScriptエラー0件
- [ ] E2Eテスト2-3ケース追加

---

#### Task 25.2.5.3: ダブルクリックコピー（2-3時間）

**実装内容**:
1. ShiftTable.tsxに`handleActualCellDoubleClick`関数追加
2. 実績セルに`onDoubleClick`イベント追加
3. 確認ダイアログ実装
4. E2Eテスト追加

**完了条件**:
- [ ] ダブルクリックで確認ダイアログ表示
- [ ] 「はい」で即座にコピー
- [ ] 「キャンセル」でモーダル表示
- [ ] TypeScriptエラー0件
- [ ] E2Eテスト1-2ケース追加

---

## ドキュメント・検証

### ドキュメント作成

- [ ] phase25-2.5-completion-YYYY-MM-DD.md（完了記録）
- [ ] メモリファイル更新（phase25_progress_YYYY-MM-DD_updated）

### 検証

- [ ] TypeScriptエラー: 0件
- [ ] ユニットテスト: すべて成功
- [ ] E2Eテスト: 新規3-5テスト追加
- [ ] CodeRabbitレビュー: 完了

---

## まとめ

**推奨アプローチ**:
1. **最小限（1-2時間）**: Task 25.2.5.1のみ実装 → 即座に50%の効率化
2. **推奨（5-8時間）**: Task 25.2.5.1 + 25.2.5.2 → 86%の効率化
3. **完全版（7-11時間）**: 全タスク実装 → 最大限の効率化

**次のAIセッションで実装する場合**:
- このドキュメントを読む
- Task 25.2.5.1から開始
- ドキュメントドリブンで進める

---

**作成日**: 2025-11-23
**ステータス**: 提案段階（未実装）
