# Phase 25: 介護報酬対応 - 予実管理機能 技術設計書

**作成日**: 2025-11-20
**仕様ID**: care-staff-schedule-compliance
**ステータス**: 承認済み
**前提**: [要件定義書](./requirements.md)を事前に確認すること

---

## 1. アーキテクチャ概要

### 1.1 システム構成

```
┌──────────────────────────────────────────────────────────┐
│                    クライアント層                           │
│  React 19 + TypeScript + Vite + Tailwind CSS              │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ ShiftTable   │  │ShiftEdit     │  │Compliance    │   │
│  │(予実2段書き)  │  │ConfirmModal  │  │Checker       │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │ExportMenu    │  │TimePicker    │                      │
│  │(Excel/PDF)   │  │(HH:mm入力)   │                      │
│  └──────────────┘  └──────────────┘                      │
└──────────────────────────────────────────────────────────┘
                            │
                            │ Firebase SDK
                            ▼
┌──────────────────────────────────────────────────────────┐
│                  Firebase/GCP層                           │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │Firestore     │  │Cloud         │  │Vertex AI     │   │
│  │(データ保存)   │  │Functions     │  │Gemini API    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 1.2 主要コンポーネント

| コンポーネント | 役割 | Phase |
|--------------|------|-------|
| **ShiftTable.tsx** | 予実2段書き表示、シングルクリック編集 | 25.2 |
| **ShiftEditConfirmModal.tsx** | シフト編集・確認モーダル | 25.2 |
| **TimePicker.tsx** | HH:mm形式時刻入力 | 25.2 |
| **ComplianceChecker.tsx** | コンプライアンスチェック結果表示 | 25.4 |
| **exportStandardExcel.ts** | 標準様式Excel出力 | 25.3 |
| **scheduleService.ts** | Firestore CRUD操作 | 25.1, 25.2 |
| **complianceService.ts** | コンプライアンスチェックロジック | 25.4 |
| **generateShift (Cloud Function)** | AIシフト生成 | 25.5 |

---

## 2. データモデル設計

### 2.1 GeneratedShift インターフェース拡張

**ファイル**: `src/types.ts`

**変更前**（現在）:
```typescript
export interface GeneratedShift {
  date: string;         // YYYY-MM-DD
  shiftType: string;    // '早番', '日勤', '遅番', '夜勤', '休', '明け休み'
}
```

**変更後**（Phase 25.1）:
```typescript
export interface GeneratedShift {
  date: string;                    // YYYY-MM-DD

  // 予定シフト（必須）
  plannedShiftType: string;        // '早番', '日勤', '遅番', '夜勤', '休', '明け休み'
  plannedStartTime?: string;       // HH:mm（例: "08:30"）
  plannedEndTime?: string;         // HH:mm（例: "17:30"）

  // 実績シフト（任意）
  actualShiftType?: string;        // 実績のシフトタイプ
  actualStartTime?: string;        // HH:mm
  actualEndTime?: string;          // HH:mm
  breakMinutes?: number;           // 休憩時間（分）

  // 備考
  notes?: string;                  // 特記事項（欠勤理由、変更理由など）
}
```

### 2.2 後方互換性の実装

**目的**: 既存のScheduleデータ（`shiftType`フィールドのみ）を新しいデータモデルで読み込めるようにする。

**実装方法** (`scheduleService.ts`):
```typescript
// スケジュール読み込み時の変換ロジック
function migrateGeneratedShift(shift: any): GeneratedShift {
  // 旧データ（shiftTypeのみ）の場合
  if (shift.shiftType && !shift.plannedShiftType) {
    return {
      date: shift.date,
      plannedShiftType: shift.shiftType,
      plannedStartTime: undefined,
      plannedEndTime: undefined,
      actualShiftType: undefined,
      actualStartTime: undefined,
      actualEndTime: undefined,
      breakMinutes: undefined,
      notes: undefined
    };
  }

  // 新データの場合
  return shift as GeneratedShift;
}
```

### 2.3 Firestore スキーマ

**コレクションパス**: `/facilities/{facilityId}/schedules/{scheduleId}`

**ドキュメント構造**:
```json
{
  "id": "schedule_202511",
  "targetMonth": "2025-11",
  "staffSchedules": [
    {
      "staffId": "staff_001",
      "staffName": "田中太郎",
      "monthlyShifts": [
        {
          "date": "2025-11-01",
          "plannedShiftType": "早番",
          "plannedStartTime": "08:00",
          "plannedEndTime": "16:00",
          "actualShiftType": "早番",
          "actualStartTime": "08:05",
          "actualEndTime": "16:10",
          "breakMinutes": 60,
          "notes": "5分遅刻"
        },
        {
          "date": "2025-11-02",
          "plannedShiftType": "日勤",
          "plannedStartTime": "09:00",
          "plannedEndTime": "18:00",
          "actualShiftType": null,
          "actualStartTime": null,
          "actualEndTime": null,
          "breakMinutes": null,
          "notes": null
        }
      ]
    }
  ],
  "createdAt": "2025-11-01T00:00:00Z",
  "createdBy": "uid_xxx",
  "updatedAt": "2025-11-15T10:30:00Z",
  "updatedBy": "uid_yyy",
  "version": 3,
  "status": "confirmed"
}
```

---

## 3. UI/UX設計

### 3.1 ShiftTable.tsx（予実2段書き）

#### 3.1.1 レイアウト設計

**HTML構造**:
```html
<div class="overflow-x-auto">
  <table>
    <thead>
      <tr>
        <th class="sticky left-0">スタッフ</th>
        <th>1日(金)</th>
        <th>2日(土)</th>
        <!-- ... 31日まで -->
      </tr>
    </thead>
    <tbody>
      <!-- スタッフ1名あたり2行 -->
      <tr class="staff-row">
        <td class="sticky left-0" rowspan="2">田中太郎</td>
        <td class="planned-cell" onclick="handleCellClick('2025-11-01', 'staff_001', 'planned')">
          早番
        </td>
        <!-- ... -->
      </tr>
      <tr class="staff-row">
        <td class="actual-cell" onclick="handleCellClick('2025-11-01', 'staff_001', 'actual')">
          早番
        </td>
        <!-- ... -->
      </tr>
    </tbody>
  </table>
</div>
```

#### 3.1.2 スタイリング

**Tailwind CSS クラス**:
```typescript
// 予定セル
const plannedCellStyle = "bg-white border-b border-gray-300 px-2 py-1 cursor-pointer hover:bg-blue-50";

// 実績セル
const actualCellStyle = "bg-gray-50 border-b border-gray-400 px-2 py-1 cursor-pointer hover:bg-blue-100";

// 差異ありセル
const diffCellStyle = "ring-2 ring-orange-400 bg-orange-50";

// 実績未入力セル
const emptyActualStyle = "bg-gray-100 text-gray-400";
```

#### 3.1.3 イベントハンドリング

**シングルクリック処理**:
```typescript
interface CellClickEvent {
  date: string;           // "2025-11-01"
  staffId: string;        // "staff_001"
  type: 'planned' | 'actual';
}

function handleCellClick(event: CellClickEvent) {
  const shift = findShift(event.date, event.staffId);

  setEditModalData({
    date: event.date,
    staffId: event.staffId,
    staffName: shift.staffName,
    type: event.type,
    currentShift: event.type === 'planned' ? shift.planned : shift.actual
  });

  setShowEditModal(true);
}
```

### 3.2 ShiftEditConfirmModal.tsx

#### 3.2.1 モーダルUI設計

**レイアウト**:
```
┌──────────────────────────────────────┐
│ シフト編集 - [予定]/[実績]            │
│                                      │
│ 日付: 2025-11-01 (金)                │
│ スタッフ: 田中太郎                    │
│                                      │
│ シフトタイプ:                         │
│ [ドロップダウン: 早番 ▼]               │
│                                      │
│ 開始時刻:                            │
│ [TimePicker: 08:00]                  │
│                                      │
│ 終了時刻:                            │
│ [TimePicker: 16:00]                  │
│                                      │
│ 休憩時間（分）:                       │
│ [数値入力: 60]                        │
│                                      │
│ 特記事項:                            │
│ [textarea: 任意]                     │
│                                      │
│ [確認] [キャンセル]                   │
└──────────────────────────────────────┘
```

#### 3.2.2 バリデーション

**クライアントサイドバリデーション**:
```typescript
interface ValidationRule {
  field: string;
  rule: (value: any) => boolean;
  message: string;
}

const validationRules: ValidationRule[] = [
  {
    field: 'shiftType',
    rule: (value) => value && value.trim() !== '',
    message: 'シフトタイプを選択してください'
  },
  {
    field: 'startTime',
    rule: (value) => !value || /^([01]\d|2[0-3]):([0-5]\d)$/.test(value),
    message: '開始時刻はHH:mm形式で入力してください'
  },
  {
    field: 'endTime',
    rule: (value) => !value || /^([01]\d|2[0-3]):([0-5]\d)$/.test(value),
    message: '終了時刻はHH:mm形式で入力してください'
  },
  {
    field: 'timeRange',
    rule: (start, end) => !start || !end || start < end,
    message: '終了時刻は開始時刻より後である必要があります'
  },
  {
    field: 'breakMinutes',
    rule: (value, workHours) => {
      if (!value) return true;
      if (workHours > 8 && value < 60) return false;  // 8時間超 → 60分必須
      if (workHours > 6 && value < 45) return false;  // 6時間超 → 45分必須
      return true;
    },
    message: '休憩時間が労働基準法の要件を満たしていません'
  }
];
```

#### 3.2.3 確認ダイアログ

**確認ボタン押下時の処理**:
```typescript
function handleConfirmClick() {
  // バリデーション
  const errors = validate(formData);
  if (errors.length > 0) {
    setErrors(errors);
    return;
  }

  // 確認ダイアログ表示
  const confirmMessage = `
    ${formData.type === 'planned' ? '予定' : '実績'}シフトを更新します。

    日付: ${formData.date}
    スタッフ: ${formData.staffName}
    シフトタイプ: ${formData.shiftType}
    時刻: ${formData.startTime} - ${formData.endTime}
    休憩: ${formData.breakMinutes}分

    よろしいですか？
  `;

  if (window.confirm(confirmMessage)) {
    saveShift(formData);
  }
}
```

### 3.3 TimePicker.tsx

#### 3.3.1 入力UI

**実装方針**: HTMLの`<input type="time">`を使用（ブラウザネイティブ）

**理由**:
- ブラウザネイティブのUIで統一感がある
- モバイル対応が自動的に行われる
- バリデーションが組み込み

**実装例**:
```typescript
interface TimePickerProps {
  value: string;          // "08:30"
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}

export function TimePicker({ value, onChange, label, required }: TimePickerProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type="time"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
```

#### 3.3.2 代替案: カスタムTimePicker

**条件**: ブラウザネイティブUIがユーザビリティの要件を満たさない場合

**実装**:
- ドロップダウンで時/分を選択
- 15分刻みの候補表示（例: 08:00, 08:15, 08:30, 08:45）
- キーボード入力も可能

**ライブラリ候補**: react-time-picker

---

## 4. Excel出力設計

### 4.1 ExcelJS の導入

**インストール**:
```bash
npm install exceljs
```

**型定義**:
```bash
npm install --save-dev @types/exceljs
```

### 4.2 標準様式第1号出力（Phase 25.3）

#### 4.2.1 参考資料

**厚生労働省標準様式**: `/public/reference/standard-form-1.xlsx`

**分析項目**:
- セル結合パターン
- 罫線スタイル
- フォント設定（サイズ、太字）
- ヘッダー項目
- データ行フォーマット

#### 4.2.2 実装方針

**ファイル**: `src/utils/exportStandardExcel.ts`

**主要関数**:
```typescript
export async function exportStandardFormExcel(
  schedule: Schedule,
  facility: Facility,
  staff: Staff[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('勤務形態一覧表');

  // 1. ヘッダー設定
  setHeader(worksheet, facility, schedule.targetMonth);

  // 2. スタッフ情報設定
  setStaffInfo(worksheet, staff);

  // 3. シフトデータ設定（予定のみ）
  setPlannedShifts(worksheet, schedule);

  // 4. 罫線・スタイル設定
  applyBordersAndStyles(worksheet);

  // 5. ファイル保存
  const buffer = await workbook.xlsx.writeBuffer();
  downloadFile(buffer, `勤務形態一覧表_${schedule.targetMonth}.xlsx`);
}
```

#### 4.2.3 セル結合・罫線の実装例

```typescript
function setHeader(
  worksheet: ExcelJS.Worksheet,
  facility: Facility,
  targetMonth: string
) {
  // A1セル: タイトル
  worksheet.getCell('A1').value = '従業者の勤務の体制及び勤務形態一覧表';
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.mergeCells('A1:G1');

  // A2セル: 施設名
  worksheet.getCell('A2').value = `施設名: ${facility.name}`;
  worksheet.mergeCells('A2:C2');

  // D2セル: 対象月
  worksheet.getCell('D2').value = `対象月: ${targetMonth}`;
  worksheet.mergeCells('D2:G2');

  // 罫線
  worksheet.getCell('A1').border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
}
```

### 4.3 内部管理用（予実2段書き）Excel出力

**ファイル**: `src/utils/exportActualExcel.ts`

**主要関数**:
```typescript
export async function exportActualExcel(
  schedule: Schedule,
  facility: Facility,
  staff: Staff[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('勤務形態一覧表（予実）');

  // 1. ヘッダー設定
  setHeader(worksheet, facility, schedule.targetMonth);

  // 2. スタッフ情報設定（2行で1名）
  staff.forEach((s, index) => {
    const rowIndex = 4 + (index * 2);  // 2行ずつ使用

    // 予定行
    worksheet.getCell(`A${rowIndex}`).value = s.name;
    worksheet.getCell(`B${rowIndex}`).value = '[予定]';
    worksheet.mergeCells(`A${rowIndex}:A${rowIndex + 1}`);  // 名前を2行結合

    // 実績行
    worksheet.getCell(`B${rowIndex + 1}`).value = '[実績]';
  });

  // 3. シフトデータ設定（予実両方）
  setShiftsWithActual(worksheet, schedule);

  // 4. 差異ハイライト
  highlightDifferences(worksheet, schedule);

  // 5. ファイル保存
  const buffer = await workbook.xlsx.writeBuffer();
  downloadFile(buffer, `勤務形態一覧表_予実_${schedule.targetMonth}.xlsx`);
}
```

#### 4.3.1 差異ハイライトの実装

```typescript
function highlightDifferences(
  worksheet: ExcelJS.Worksheet,
  schedule: Schedule
) {
  schedule.staffSchedules.forEach((staffSchedule, staffIndex) => {
    staffSchedule.monthlyShifts.forEach((shift, dayIndex) => {
      // 予定と実績が異なる場合
      if (shift.plannedShiftType !== shift.actualShiftType) {
        const rowIndex = 4 + (staffIndex * 2);
        const colIndex = 3 + dayIndex;  // C列から開始

        // 予定セル（オレンジ背景）
        worksheet.getCell(rowIndex, colIndex).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA500' }  // オレンジ色
        };

        // 実績セル（オレンジ背景）
        worksheet.getCell(rowIndex + 1, colIndex).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA500' }
        };
      }
    });
  });
}
```

---

## 5. コンプライアンスチェック設計

### 5.1 ComplianceChecker.tsx

#### 5.1.1 UI設計

**レイアウト**:
```
┌──────────────────────────────────────┐
│ コンプライアンスチェック結果          │
│                                      │
│ 🔴 人員配置基準: 未達成 (3日間)       │
│ 🟢 常勤換算: 基準達成                │
│ 🟡 労基法: 警告あり (2件)            │
│                                      │
│ [詳細を表示]                         │
└──────────────────────────────────────┘
```

**状態アイコン**:
- 🔴 赤: 基準未達成、違反あり
- 🟡 黄: 警告あり
- 🟢 緑: すべて問題なし

#### 5.1.2 詳細モーダル

**人員配置基準未達成の詳細**:
```
┌──────────────────────────────────────┐
│ 人員配置基準チェック詳細              │
│                                      │
│ 基準: 介護職員 3:1（利用者3人に1人）  │
│                                      │
│ 未達成日:                            │
│ - 2025-11-05 (日): 充足率 90%        │
│ - 2025-11-12 (日): 充足率 85%        │
│ - 2025-11-19 (日): 充足率 88%        │
│                                      │
│ [閉じる]                             │
└──────────────────────────────────────┘
```

### 5.2 complianceService.ts

#### 5.2.1 人員配置基準チェック

```typescript
interface StaffingStandard {
  type: '3:1' | '2:1' | 'fixed';  // 配置基準タイプ
  value: number;                   // 必要人数（fixedの場合）または比率
}

interface StaffingCheckResult {
  date: string;
  requiredStaff: number;    // 必要人員数
  actualStaff: number;      // 実際の人員数
  fulfillmentRate: number;  // 充足率（%）
  passed: boolean;          // 基準達成フラグ
}

export function checkStaffingStandard(
  schedule: Schedule,
  facility: Facility,
  standard: StaffingStandard
): StaffingCheckResult[] {
  const results: StaffingCheckResult[] = [];

  // 日付ごとにチェック
  for (let day = 1; day <= 31; day++) {
    const date = `${schedule.targetMonth}-${String(day).padStart(2, '0')}`;

    // その日の勤務スタッフ数を計算
    const actualStaff = countWorkingStaff(schedule, date);

    // 必要人員数を計算
    const requiredStaff = calculateRequiredStaff(facility, standard);

    // 充足率を計算
    const fulfillmentRate = (actualStaff / requiredStaff) * 100;

    results.push({
      date,
      requiredStaff,
      actualStaff,
      fulfillmentRate,
      passed: actualStaff >= requiredStaff
    });
  }

  return results;
}

function countWorkingStaff(schedule: Schedule, date: string): number {
  let count = 0;

  schedule.staffSchedules.forEach((staffSchedule) => {
    const shift = staffSchedule.monthlyShifts.find(s => s.date === date);

    // 実績がある場合は実績を、なければ予定を使用
    const shiftType = shift?.actualShiftType || shift?.plannedShiftType;

    // 休みでなければカウント
    if (shiftType && shiftType !== '休') {
      count++;
    }
  });

  return count;
}
```

#### 5.2.2 常勤換算計算

```typescript
interface FullTimeEquivalentResult {
  staffId: string;
  staffName: string;
  totalWorkHours: number;         // 月間実績勤務時間
  standardWeeklyHours: number;    // 週所定労働時間
  fte: number;                    // 常勤換算値
}

export function calculateFullTimeEquivalent(
  schedule: Schedule,
  facility: Facility
): FullTimeEquivalentResult[] {
  const standardWeeklyHours = facility.standardWeeklyHours || 40;  // デフォルト40時間

  return schedule.staffSchedules.map((staffSchedule) => {
    // 月間実績勤務時間を計算
    const totalWorkHours = staffSchedule.monthlyShifts.reduce((sum, shift) => {
      if (!shift.actualStartTime || !shift.actualEndTime) {
        return sum;
      }

      // 勤務時間を計算（分単位）
      const startMinutes = timeToMinutes(shift.actualStartTime);
      const endMinutes = timeToMinutes(shift.actualEndTime);
      const breakMinutes = shift.breakMinutes || 0;
      const workMinutes = endMinutes - startMinutes - breakMinutes;

      return sum + (workMinutes / 60);  // 時間単位に変換
    }, 0);

    // 常勤換算値を計算
    const fte = totalWorkHours / (standardWeeklyHours * 4.33);  // 1ヶ月 ≈ 4.33週

    return {
      staffId: staffSchedule.staffId,
      staffName: staffSchedule.staffName,
      totalWorkHours,
      standardWeeklyHours,
      fte
    };
  });
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
```

#### 5.2.3 労基法チェック

```typescript
interface LaborLawCheckResult {
  staffId: string;
  staffName: string;
  date: string;
  violationType: 'break' | 'consecutive' | 'interval';
  message: string;
}

export function checkLaborLaw(
  schedule: Schedule
): LaborLawCheckResult[] {
  const violations: LaborLawCheckResult[] = [];

  schedule.staffSchedules.forEach((staffSchedule) => {
    staffSchedule.monthlyShifts.forEach((shift) => {
      // 休憩時間チェック
      if (shift.actualStartTime && shift.actualEndTime) {
        const workHours = calculateWorkHours(
          shift.actualStartTime,
          shift.actualEndTime,
          shift.breakMinutes || 0
        );

        // 6時間超 → 45分休憩必須
        if (workHours > 6 && (shift.breakMinutes || 0) < 45) {
          violations.push({
            staffId: staffSchedule.staffId,
            staffName: staffSchedule.staffName,
            date: shift.date,
            violationType: 'break',
            message: `6時間超の勤務には45分以上の休憩が必要です（現在: ${shift.breakMinutes || 0}分）`
          });
        }

        // 8時間超 → 60分休憩必須
        if (workHours > 8 && (shift.breakMinutes || 0) < 60) {
          violations.push({
            staffId: staffSchedule.staffId,
            staffName: staffSchedule.staffName,
            date: shift.date,
            violationType: 'break',
            message: `8時間超の勤務には60分以上の休憩が必要です（現在: ${shift.breakMinutes || 0}分）`
          });
        }
      }
    });

    // 連続勤務制限チェック（既存機能を活用）
    // 勤務間インターバルチェック（既存機能を活用）
  });

  return violations;
}

function calculateWorkHours(
  startTime: string,
  endTime: string,
  breakMinutes: number
): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const workMinutes = endMinutes - startMinutes - breakMinutes;
  return workMinutes / 60;
}
```

---

## 6. AIシフト生成統合設計

### 6.1 Cloud Function: generateShift の更新

**ファイル**: `functions/src/index.ts`

#### 6.1.1 プロンプト拡張

**変更前**（現在）:
```typescript
const prompt = `
以下の条件でシフトを生成してください。

スタッフ一覧:
${JSON.stringify(staff)}

シフト要件:
${JSON.stringify(requirements)}

...
`;
```

**変更後**（Phase 25.5）:
```typescript
const prompt = `
以下の条件でシフトを生成してください。

スタッフ一覧:
${JSON.stringify(staff)}

シフト要件:
${JSON.stringify(requirements)}

## コンプライアンス要件（必須）

1. 人員配置基準:
   - タイプ: ${facility.staffingStandard.type}
   - 必要人員: ${facility.staffingStandard.value}
   - すべての日で基準を満たすこと

2. 常勤換算:
   - 週所定労働時間: ${facility.standardWeeklyHours}時間
   - スタッフごとの勤務時間を適切に配分すること

3. 労働基準法:
   - 6時間超の勤務: 45分以上の休憩を設定
   - 8時間超の勤務: 60分以上の休憩を設定
   - 連続勤務: ${maxConsecutiveDays}日以内
   - 勤務間インターバル: 最低8時間

...
`;
```

#### 6.1.2 出力スキーマ拡張

**変更前**（現在）:
```json
{
  "date": "2025-11-01",
  "shiftType": "早番"
}
```

**変更後**（Phase 25.5）:
```json
{
  "date": "2025-11-01",
  "plannedShiftType": "早番",
  "plannedStartTime": "08:00",
  "plannedEndTime": "16:00",
  "breakMinutes": 60
}
```

### 6.2 生成後バリデーション

**フロー**:
```
AIシフト生成
    ↓
Cloud Function
    ↓
Firestoreに保存
    ↓
クライアント側で取得
    ↓
complianceService.checkAll()  ← ここで自動バリデーション
    ↓
違反あり？
  YES → 再生成提案UI表示
  NO  → 正常終了
```

**実装**（クライアント側）:
```typescript
async function handleAIGenerateComplete(scheduleId: string) {
  // スケジュールを取得
  const schedule = await getSchedule(scheduleId);

  // コンプライアンスチェック
  const staffingResult = checkStaffingStandard(schedule, facility, facility.staffingStandard);
  const laborLawResult = checkLaborLaw(schedule);

  // 違反がある場合
  const hasViolations =
    staffingResult.some(r => !r.passed) ||
    laborLawResult.length > 0;

  if (hasViolations) {
    // 再生成提案UI表示
    setShowRegenerateModal(true);
    setViolations({
      staffing: staffingResult.filter(r => !r.passed),
      laborLaw: laborLawResult
    });
  } else {
    // 正常終了
    showToast('AIシフト生成が完了しました', 'success');
  }
}
```

---

## 7. Firestore Security Rules更新

### 7.1 予実データのアクセス制御

**ファイル**: `firestore.rules`

**更新箇所**: schedules コレクション

```javascript
match /facilities/{facilityId}/schedules/{scheduleId} {
  // 読み取り: viewer以上
  allow read: if isAuthenticated() && hasRole(facilityId, 'viewer');

  // 作成・更新: editor以上
  allow create, update: if isAuthenticated() && hasRole(facilityId, 'editor');

  // 削除: admin以上
  allow delete: if isAuthenticated() && hasRole(facilityId, 'admin');
}
```

**変更なし**: 既存のRBACルールをそのまま適用

---

## 8. テスト戦略

### 8.1 ユニットテスト（Vitest）

**対象ファイル**:
- `src/utils/exportStandardExcel.ts`
- `src/utils/exportActualExcel.ts`
- `src/services/complianceService.ts`

**テストケース例**（`complianceService.test.ts`）:
```typescript
describe('checkStaffingStandard', () => {
  it('人員配置基準を満たす場合、passedがtrueになる', () => {
    const schedule = createMockSchedule({
      staffCount: 10,
      targetMonth: '2025-11'
    });
    const facility = createMockFacility({
      staffingStandard: { type: '3:1', value: 3 }
    });

    const result = checkStaffingStandard(schedule, facility, facility.staffingStandard);

    expect(result.every(r => r.passed)).toBe(true);
  });

  it('人員配置基準を満たさない日がある場合、passedがfalseになる', () => {
    const schedule = createMockSchedule({
      staffCount: 2,  // 不足
      targetMonth: '2025-11'
    });
    const facility = createMockFacility({
      staffingStandard: { type: 'fixed', value: 5 }
    });

    const result = checkStaffingStandard(schedule, facility, facility.staffingStandard);

    expect(result.some(r => !r.passed)).toBe(true);
  });
});
```

### 8.2 E2Eテスト（Playwright）

**対象シナリオ**:
1. 予定シフトの編集（シングルクリック → モーダル → 確認 → 保存）
2. 実績シフトの入力（シングルクリック → モーダル → 確認 → 保存）
3. 差異ハイライトの表示
4. 標準様式Excel出力
5. 予実2段書きExcel出力
6. コンプライアンスチェック結果表示

**テストケース例**（`shift-actual-entry.spec.ts`）:
```typescript
test('実績シフトを入力できる', async ({ page }) => {
  // 1. ログイン
  await loginAsEditor(page);

  // 2. シフト表ページに移動
  await page.goto('/schedules/2025-11');

  // 3. 実績行のセルをクリック
  await page.click('[data-testid="actual-cell-2025-11-01-staff_001"]');

  // 4. モーダルが表示される
  await expect(page.locator('[data-testid="shift-edit-modal"]')).toBeVisible();
  await expect(page.locator('text=実績シフト')).toBeVisible();

  // 5. シフト情報を入力
  await page.selectOption('[data-testid="shift-type"]', '早番');
  await page.fill('[data-testid="start-time"]', '08:00');
  await page.fill('[data-testid="end-time"]', '16:00');
  await page.fill('[data-testid="break-minutes"]', '60');

  // 6. 確認ボタンをクリック
  await page.click('[data-testid="confirm-button"]');

  // 7. 確認ダイアログが表示される
  page.on('dialog', dialog => dialog.accept());

  // 8. シフト表に反映される
  await expect(page.locator('[data-testid="actual-cell-2025-11-01-staff_001"]')).toHaveText('早番');
});
```

---

## 9. パフォーマンス最適化

### 9.1 Firestoreクエリ最適化

**課題**: 予実データの追加により、scheduleドキュメントのサイズが増大

**対策**:
1. **ページネーション**: 月単位でデータを分割（既に実装済み）
2. **選択的取得**: 必要なフィールドのみ取得
3. **キャッシュ戦略**: Firestoreのクライアントキャッシュを活用

### 9.2 レンダリング最適化

**課題**: 予実2段書きにより、レンダリングする要素数が2倍

**対策**:
1. **React.memo**: ShiftTableコンポーネントをメモ化
2. **仮想スクロール**: react-virtualized の導入（必要に応じて）
3. **遅延ロード**: 初期表示時は予定のみ、スクロール時に実績を読み込む

---

## 10. 関連ドキュメント

- [要件定義書](./requirements.md)
- [実装タスク一覧](./tasks.md)
- [データモデル図](./diagrams/data-model-diagram.md)
- [UIフロー図](./diagrams/ui-flow-diagram.md)
- [コンポーネント構成図](./diagrams/component-architecture.md)
- [介護報酬算定ガイドライン](../../steering/care-compliance.md)

---

**次のステップ**: [実装タスク一覧](./tasks.md)を確認してください。
