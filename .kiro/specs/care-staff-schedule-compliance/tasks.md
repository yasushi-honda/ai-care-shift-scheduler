# Phase 25: 介護報酬対応 - 予実管理機能 実装タスク一覧

**作成日**: 2025-11-20
**仕様ID**: care-staff-schedule-compliance
**総推定工数**: 30-46時間
**前提**: [要件定義書](./requirements.md)、[技術設計書](./design.md)を事前に確認すること

---

## Phase 25.1: WorkLogs削除 + データモデル拡張（4-6時間）

### 目的
不要なWorkLogs機能を完全に削除し、GeneratedShiftインターフェースを予実管理対応に拡張する。

### タスク一覧

#### Task 25.1.1: WorkLogModal.tsx 削除（30分）

**説明**: WorkLogModalコンポーネントを完全に削除する。

**実装内容**:
```bash
# ファイル削除
rm src/components/WorkLogModal.tsx
```

**影響範囲**:
- App.tsx
- ShiftTable.tsx

**完了条件**:
- [ ] WorkLogModal.tsxが削除される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.1.2: App.tsx からworkLogs関連コード削除（1時間）

**説明**: App.tsxからworkLogs関連のstate、handler、propsを削除する。

**削除対象箇所**:
- Line 78-85: workLogsのハードコーディングされたサンプルデータ
- Line 513-524: handleUpdateWorkLog関数
- ShiftTableコンポーネントへのworkLogs、onUpdateWorkLog props

**実装内容**:
```typescript
// 削除前
const [workLogs, setWorkLogs] = useState<WorkLogs>({
  '2025-11-01': {
    'staff_1': {
      workDetails: 'バイタルチェック、配薬、記録',
      notes: '特になし'
    }
  }
});

function handleUpdateWorkLog(date: string, staffId: string, details: WorkLogDetails) {
  // ...
}

// 削除後（完全に削除）
```

**完了条件**:
- [ ] workLogs関連のstate、handler、propsがすべて削除される
- [ ] TypeScriptエラーがゼロ
- [ ] npm run devが正常に起動する

---

#### Task 25.1.3: ShiftTable.tsx からworkLogs関連コード削除（1時間）

**説明**: ShiftTable.tsxからworkLogs関連のprops、ツールチップ、モーダル呼び出しを削除する。

**削除対象箇所**:
- Line 10-11: workLogs、onUpdateWorkLog props
- Line 103: workLogsからデータ取得
- Line 109-121: ホバーツールチップ表示
- Line 162-170: WorkLogModal呼び出し

**実装内容**:
```typescript
// 削除前
interface ShiftTableProps {
  // ...
  workLogs: WorkLogs;
  onUpdateWorkLog: (date: string, staffId: string, details: WorkLogDetails) => void;
}

// 削除後
interface ShiftTableProps {
  // ...
  // workLogs関連のpropsを完全に削除
}
```

**完了条件**:
- [ ] workLogs関連のprops、コードがすべて削除される
- [ ] シングルクリックイベントハンドラのみ残る（次のTaskで実装）
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.1.4: types.ts のWorkLogs関連インターフェース削除（15分）

**説明**: types.tsからWorkLogDetails、WorkLogsインターフェースを削除する。

**削除対象箇所**:
- Line 117-126: WorkLogDetails、WorkLogsインターフェース

**実装内容**:
```typescript
// 削除前
export interface WorkLogDetails {
  workDetails: string;
  notes: string;
}

export interface WorkLogs {
  [date: string]: {
    [staffId: string]: WorkLogDetails;
  };
}

// 削除後（完全に削除）
```

**完了条件**:
- [ ] WorkLogDetails、WorkLogsインターフェースが削除される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.1.5: GeneratedShift インターフェース拡張（1時間）

**説明**: types.tsのGeneratedShiftインターフェースを予実管理対応に拡張する。

**実装内容**:
```typescript
// src/types.ts

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

**完了条件**:
- [ ] GeneratedShiftインターフェースが拡張される
- [ ] TypeScriptエラーがゼロ
- [ ] 既存のScheduleデータ型と互換性がある

---

#### Task 25.1.6: scheduleService.ts の後方互換性実装（1.5時間）

**説明**: scheduleServiceに、既存データ（shiftTypeのみ）を新しいデータモデル（plannedShiftType等）に自動変換する機能を追加する。

**実装内容**:
```typescript
// src/services/scheduleService.ts

/**
 * 旧データモデル（shiftType）を新データモデル（plannedShiftType）に変換
 */
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

// getSchedule関数内で使用
export async function getSchedule(
  facilityId: string,
  scheduleId: string
): Promise<Schedule | null> {
  const docRef = doc(db, `facilities/${facilityId}/schedules/${scheduleId}`);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();

  // staffSchedulesの各シフトを変換
  const migratedStaffSchedules = data.staffSchedules.map((staffSchedule: any) => ({
    ...staffSchedule,
    monthlyShifts: staffSchedule.monthlyShifts.map(migrateGeneratedShift)
  }));

  return {
    ...data,
    staffSchedules: migratedStaffSchedules
  } as Schedule;
}
```

**完了条件**:
- [ ] migrateGeneratedShift関数が実装される
- [ ] 既存のScheduleデータが正常に読み込める
- [ ] TypeScriptエラーがゼロ
- [ ] ユニットテスト実装（成功）

---

#### Task 25.1.7: E2Eテスト更新（workLogs関連テスト削除）（30分）

**説明**: E2EテストからworkLogs関連のテストケースを削除する。

**削除対象**:
- WorkLogModal表示テスト
- WorkLog入力テスト

**完了条件**:
- [ ] workLogs関連のE2Eテストが削除される
- [ ] 既存のE2Eテストがすべて成功する

---

### Phase 25.1 完了条件

- [ ] すべてのタスク（25.1.1 ~ 25.1.7）が完了
- [ ] TypeScriptエラーがゼロ（`npx tsc --noEmit`）
- [ ] ユニットテストが100%成功（`npm test`）
- [ ] E2Eテストが100%成功（Phase 22の6テストは維持）
- [ ] 開発サーバーが正常に起動（`npm run dev`）
- [ ] 既存のScheduleデータが正常に表示される

---

## Phase 25.2: 予実2段書きUI実装（8-12時間）

### 目的
ShiftTableコンポーネントを改修し、予実2段書き表示、シングルクリック編集、確認モーダルを実装する。

### タスク一覧

#### Task 25.2.1: TimePicker.tsx コンポーネント実装（1時間）

**説明**: HH:mm形式の時刻入力コンポーネントを実装する。

**実装内容**:
```typescript
// src/components/TimePicker.tsx

interface TimePickerProps {
  value: string;          // "08:30"
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export function TimePicker({ value, onChange, label, required, disabled }: TimePickerProps) {
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
        disabled={disabled}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      />
    </div>
  );
}
```

**完了条件**:
- [ ] TimePickerコンポーネントが実装される
- [ ] HH:mm形式で入力可能
- [ ] TypeScriptエラーがゼロ
- [ ] Storybookまたは手動テストで動作確認

---

#### Task 25.2.2: ShiftEditConfirmModal.tsx コンポーネント実装（3-4時間）

**説明**: シフト編集・確認モーダルを実装する。

**実装内容**:
```typescript
// src/components/ShiftEditConfirmModal.tsx

interface ShiftEditConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  staffId: string;
  staffName: string;
  type: 'planned' | 'actual';
  currentShift: GeneratedShift | null;
  onSave: (shift: Partial<GeneratedShift>) => void;
}

export function ShiftEditConfirmModal({
  isOpen,
  onClose,
  date,
  staffId,
  staffName,
  type,
  currentShift,
  onSave
}: ShiftEditConfirmModalProps) {
  const [shiftType, setShiftType] = useState(
    type === 'planned' ? currentShift?.plannedShiftType : currentShift?.actualShiftType
  );
  const [startTime, setStartTime] = useState(
    type === 'planned' ? currentShift?.plannedStartTime : currentShift?.actualStartTime
  );
  const [endTime, setEndTime] = useState(
    type === 'planned' ? currentShift?.plannedEndTime : currentShift?.actualEndTime
  );
  const [breakMinutes, setBreakMinutes] = useState(currentShift?.breakMinutes || 0);
  const [notes, setNotes] = useState(currentShift?.notes || '');
  const [errors, setErrors] = useState<string[]>([]);

  function handleConfirm() {
    // バリデーション
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // 確認ダイアログ
    const confirmMessage = `
      ${type === 'planned' ? '予定' : '実績'}シフトを更新します。

      日付: ${date}
      スタッフ: ${staffName}
      シフトタイプ: ${shiftType}
      時刻: ${startTime} - ${endTime}
      休憩: ${breakMinutes}分

      よろしいですか？
    `;

    if (window.confirm(confirmMessage)) {
      // 保存
      const updatedShift: Partial<GeneratedShift> = type === 'planned'
        ? {
            plannedShiftType: shiftType,
            plannedStartTime: startTime,
            plannedEndTime: endTime,
            breakMinutes,
            notes
          }
        : {
            actualShiftType: shiftType,
            actualStartTime: startTime,
            actualEndTime: endTime,
            breakMinutes,
            notes
          };

      onSave(updatedShift);
      onClose();
    }
  }

  function validate(): string[] {
    const errors: string[] = [];

    if (!shiftType) {
      errors.push('シフトタイプを選択してください');
    }

    if (startTime && endTime && startTime >= endTime) {
      errors.push('終了時刻は開始時刻より後である必要があります');
    }

    // 労基法チェック
    if (startTime && endTime && breakMinutes !== undefined) {
      const workHours = calculateWorkHours(startTime, endTime, breakMinutes);

      if (workHours > 8 && breakMinutes < 60) {
        errors.push('8時間超の勤務には60分以上の休憩が必要です');
      } else if (workHours > 6 && breakMinutes < 45) {
        errors.push('6時間超の勤務には45分以上の休憩が必要です');
      }
    }

    return errors;
  }

  // ... UI実装
}
```

**完了条件**:
- [ ] ShiftEditConfirmModalコンポーネントが実装される
- [ ] バリデーション機能が動作する
- [ ] 確認ダイアログが表示される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.2.3: ShiftTable.tsx の2段書き表示改修（3-4時間）

**説明**: ShiftTableコンポーネントを改修し、予実2段書き表示を実装する。

**実装内容**:
```typescript
// src/components/ShiftTable.tsx

export function ShiftTable({ schedule, onUpdateShift }: ShiftTableProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalData, setEditModalData] = useState<EditModalData | null>(null);

  // セルクリックハンドラ
  function handleCellClick(
    date: string,
    staffId: string,
    staffName: string,
    type: 'planned' | 'actual',
    currentShift: GeneratedShift | null
  ) {
    setEditModalData({
      date,
      staffId,
      staffName,
      type,
      currentShift
    });
    setShowEditModal(true);
  }

  // シフト保存ハンドラ
  async function handleSaveShift(updatedShift: Partial<GeneratedShift>) {
    if (!editModalData) return;

    await onUpdateShift(
      editModalData.staffId,
      editModalData.date,
      updatedShift
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white z-10 border-b-2 border-gray-300 px-4 py-2">
              スタッフ
            </th>
            {daysInMonth.map((day) => (
              <th key={day} className="border-b-2 border-gray-300 px-2 py-2 text-xs">
                {day}日<br />
                {getDayOfWeek(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.staffSchedules.map((staffSchedule) => (
            <React.Fragment key={staffSchedule.staffId}>
              {/* 予定行 */}
              <tr className="border-b border-gray-300">
                <td className="sticky left-0 bg-white z-10 px-4 py-2" rowSpan={2}>
                  {staffSchedule.staffName}
                </td>
                {staffSchedule.monthlyShifts.map((shift) => (
                  <td
                    key={`planned-${shift.date}`}
                    className={getCellClassName(shift, 'planned')}
                    onClick={() => handleCellClick(
                      shift.date,
                      staffSchedule.staffId,
                      staffSchedule.staffName,
                      'planned',
                      shift
                    )}
                    data-testid={`planned-cell-${shift.date}-${staffSchedule.staffId}`}
                  >
                    {shift.plannedShiftType}
                  </td>
                ))}
              </tr>
              {/* 実績行 */}
              <tr className="border-b border-gray-400">
                {staffSchedule.monthlyShifts.map((shift) => (
                  <td
                    key={`actual-${shift.date}`}
                    className={getCellClassName(shift, 'actual')}
                    onClick={() => handleCellClick(
                      shift.date,
                      staffSchedule.staffId,
                      staffSchedule.staffName,
                      'actual',
                      shift
                    )}
                    data-testid={`actual-cell-${shift.date}-${staffSchedule.staffId}`}
                  >
                    {shift.actualShiftType || '-'}
                  </td>
                ))}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {showEditModal && editModalData && (
        <ShiftEditConfirmModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          {...editModalData}
          onSave={handleSaveShift}
        />
      )}
    </div>
  );
}

// セルのスタイル決定
function getCellClassName(shift: GeneratedShift, type: 'planned' | 'actual'): string {
  const baseClass = 'px-2 py-1 cursor-pointer text-xs';
  const plannedClass = 'bg-white hover:bg-blue-50';
  const actualClass = 'bg-gray-50 hover:bg-blue-100';

  // 差異ハイライト
  const hasDifference =
    shift.actualShiftType &&
    shift.plannedShiftType !== shift.actualShiftType;
  const diffClass = hasDifference ? 'ring-2 ring-orange-400 bg-orange-50' : '';

  // 実績未入力
  const emptyActualClass = type === 'actual' && !shift.actualShiftType
    ? 'bg-gray-100 text-gray-400'
    : '';

  return [
    baseClass,
    type === 'planned' ? plannedClass : actualClass,
    diffClass,
    emptyActualClass
  ].filter(Boolean).join(' ');
}
```

**完了条件**:
- [ ] 予実2段書き表示が実装される
- [ ] シングルクリックで編集モーダルが表示される
- [ ] 差異ハイライトが動作する
- [ ] 実績未入力のセルがグレーアウト表示される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.2.4: scheduleService.ts のupdateShift関数拡張（1時間）

**説明**: scheduleServiceに、予実データを部分更新する関数を追加する。

**実装内容**:
```typescript
// src/services/scheduleService.ts

/**
 * スケジュールの特定日のシフトを部分更新
 */
export async function updateShiftPartial(
  facilityId: string,
  scheduleId: string,
  staffId: string,
  date: string,
  updatedFields: Partial<GeneratedShift>
): Promise<void> {
  const docRef = doc(db, `facilities/${facilityId}/schedules/${scheduleId}`);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Schedule not found');
  }

  const schedule = docSnap.data() as Schedule;

  // 対象のstaffScheduleを検索
  const staffScheduleIndex = schedule.staffSchedules.findIndex(
    (ss) => ss.staffId === staffId
  );

  if (staffScheduleIndex === -1) {
    throw new Error('Staff not found in schedule');
  }

  // 対象のshiftを検索
  const shiftIndex = schedule.staffSchedules[staffScheduleIndex].monthlyShifts.findIndex(
    (shift) => shift.date === date
  );

  if (shiftIndex === -1) {
    throw new Error('Shift not found');
  }

  // シフトを部分更新
  const currentShift = schedule.staffSchedules[staffScheduleIndex].monthlyShifts[shiftIndex];
  const updatedShift = {
    ...currentShift,
    ...updatedFields
  };

  schedule.staffSchedules[staffScheduleIndex].monthlyShifts[shiftIndex] = updatedShift;

  // Firestoreに保存
  await updateDoc(docRef, {
    staffSchedules: schedule.staffSchedules,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid,
    version: increment(1)
  });

  // 監査ログ記録
  await logAuditEvent(facilityId, {
    action: 'shift_updated',
    resourceType: 'schedule',
    resourceId: scheduleId,
    details: {
      staffId,
      date,
      updatedFields
    }
  });
}
```

**完了条件**:
- [ ] updateShiftPartial関数が実装される
- [ ] 部分更新が正常に動作する
- [ ] 監査ログが記録される
- [ ] TypeScriptエラーがゼロ
- [ ] ユニットテスト実装（成功）

---

#### Task 25.2.5: 既存PDF出力の維持（予定のみ）（30分）

**説明**: 既存のPDF出力機能（exportPDF.ts）が、新しいデータモデルでも動作するように修正する。

**実装内容**:
```typescript
// src/utils/exportPDF.ts

// 変更前
const shiftType = shift.shiftType;

// 変更後
const shiftType = shift.plannedShiftType;  // 予定のみを出力
```

**完了条件**:
- [ ] 既存のPDF出力が正常に動作する
- [ ] 予定シフトのみが出力される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.2.6: E2Eテスト実装（予実編集フロー）（2時間）

**説明**: 予実編集フローのE2Eテストを実装する。

**テストケース**:
1. 予定シフトの編集（シングルクリック → モーダル → 確認 → 保存）
2. 実績シフトの入力（シングルクリック → モーダル → 確認 → 保存）
3. 差異ハイライトの表示

**実装内容**:
```typescript
// e2e/tests/shift-actual-entry.spec.ts

test('予定シフトを編集できる', async ({ page }) => {
  await loginAsEditor(page);
  await page.goto('/schedules/2025-11');

  // 予定行のセルをクリック
  await page.click('[data-testid="planned-cell-2025-11-01-staff_001"]');

  // モーダルが表示される
  await expect(page.locator('[data-testid="shift-edit-modal"]')).toBeVisible();
  await expect(page.locator('text=予定シフト')).toBeVisible();

  // シフト情報を入力
  await page.selectOption('[data-testid="shift-type"]', '日勤');
  await page.fill('[data-testid="start-time"]', '09:00');
  await page.fill('[data-testid="end-time"]', '18:00');
  await page.fill('[data-testid="break-minutes"]', '60');

  // 確認ボタンをクリック
  await page.click('[data-testid="confirm-button"]');

  // 確認ダイアログを承認
  page.on('dialog', dialog => dialog.accept());

  // シフト表に反映される
  await expect(page.locator('[data-testid="planned-cell-2025-11-01-staff_001"]')).toHaveText('日勤');
});

test('実績シフトを入力できる', async ({ page }) => {
  await loginAsEditor(page);
  await page.goto('/schedules/2025-11');

  // 実績行のセルをクリック
  await page.click('[data-testid="actual-cell-2025-11-01-staff_001"]');

  // モーダルが表示される
  await expect(page.locator('[data-testid="shift-edit-modal"]')).toBeVisible();
  await expect(page.locator('text=実績シフト')).toBeVisible();

  // シフト情報を入力
  await page.selectOption('[data-testid="shift-type"]', '早番');
  await page.fill('[data-testid="start-time"]', '08:00');
  await page.fill('[data-testid="end-time"]', '16:00');
  await page.fill('[data-testid="break-minutes"]', '60');

  // 確認ボタンをクリック
  await page.click('[data-testid="confirm-button"]');

  // 確認ダイアログを承認
  page.on('dialog', dialog => dialog.accept());

  // シフト表に反映される
  await expect(page.locator('[data-testid="actual-cell-2025-11-01-staff_001"]')).toHaveText('早番');
});

test('予定と実績が異なる場合、差異ハイライトが表示される', async ({ page }) => {
  await loginAsEditor(page);
  await page.goto('/schedules/2025-11');

  // 予定と実績が異なるセルを確認
  const plannedCell = page.locator('[data-testid="planned-cell-2025-11-02-staff_001"]');
  const actualCell = page.locator('[data-testid="actual-cell-2025-11-02-staff_001"]');

  // 差異ハイライト（オレンジ色のring）が表示される
  await expect(plannedCell).toHaveClass(/ring-2 ring-orange-400/);
  await expect(actualCell).toHaveClass(/ring-2 ring-orange-400/);
});
```

**完了条件**:
- [ ] 3つのE2Eテストが実装される
- [ ] すべてのテストが成功する

---

### Phase 25.2 完了条件

- [ ] すべてのタスク（25.2.1 ~ 25.2.6）が完了
- [ ] TypeScriptエラーがゼロ
- [ ] ユニットテストが100%成功
- [ ] E2Eテストが100%成功（新規3テスト + 既存6テスト = 計9テスト）
- [ ] 予実2段書き表示が正常に動作する
- [ ] シングルクリック編集が正常に動作する
- [ ] 差異ハイライトが正常に動作する

---

## Phase 25.3: 標準様式第1号Excel出力（6-10時間）

### 目的
厚生労働省標準様式第1号に準拠したExcelファイルを出力する機能を実装する。

### タスク一覧

#### Task 25.3.1: 標準様式第1号のダウンロード・配置（30分）

**説明**: 厚生労働省の標準様式第1号をダウンロードし、プロジェクト内に配置する。

**実装内容**:
```bash
# ディレクトリ作成
mkdir -p public/reference

# WebFetchでダウンロード（Claude Code内で実行）
# URL: https://www.mhlw.go.jp/content/001269336.xlsx
# 保存先: public/reference/standard-form-1.xlsx
```

**完了条件**:
- [ ] standard-form-1.xlsxが配置される
- [ ] ファイルが正常に開ける

---

#### Task 25.3.2: 標準様式の分析・仕様書作成（1-2時間）

**説明**: 標準様式第1号を分析し、項目・フォーマット仕様書を作成する。

**分析項目**:
- ヘッダー構成（施設名、対象月など）
- スタッフ情報項目（氏名、役職、資格など）
- シフトデータ項目（日付ごとのシフトタイプ）
- セル結合パターン
- 罫線スタイル
- フォント設定

**成果物**: `.kiro/specs/care-staff-schedule-compliance/standard-form-spec.md`

**完了条件**:
- [ ] 仕様書が作成される
- [ ] 実装に必要な情報がすべて記載される

---

#### Task 25.3.3: ExcelJSのインストール・設定（15分）

**説明**: ExcelJSをインストールし、TypeScript設定を行う。

**実装内容**:
```bash
npm install exceljs
npm install --save-dev @types/exceljs
```

**完了条件**:
- [ ] ExcelJSがインストールされる
- [ ] TypeScript型定義が利用可能

---

#### Task 25.3.4: exportStandardExcel.ts 実装（3-4時間）

**説明**: 標準様式第1号Excel出力機能を実装する。

**実装内容**:
```typescript
// src/utils/exportStandardExcel.ts

import ExcelJS from 'exceljs';

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
  downloadFile(buffer, `勤務形態一覧表_${schedule.targetMonth.replace('-', '')}.xlsx`);
}

function setHeader(
  worksheet: ExcelJS.Worksheet,
  facility: Facility,
  targetMonth: string
) {
  // 実装（design.mdの4.2.3を参照）
}

function setStaffInfo(worksheet: ExcelJS.Worksheet, staff: Staff[]) {
  // 実装
}

function setPlannedShifts(worksheet: ExcelJS.Worksheet, schedule: Schedule) {
  // 実装
}

function applyBordersAndStyles(worksheet: ExcelJS.Worksheet) {
  // 実装
}

function downloadFile(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**完了条件**:
- [ ] exportStandardFormExcel関数が実装される
- [ ] 標準様式第1号と同じフォーマットで出力される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.3.5: exportActualExcel.ts 実装（内部管理用、予実2段書き）（2-3時間）

**説明**: 予実2段書きExcel出力機能を実装する。

**実装内容**:
```typescript
// src/utils/exportActualExcel.ts

export async function exportActualExcel(
  schedule: Schedule,
  facility: Facility,
  staff: Staff[]
): Promise<void> {
  // 実装（design.mdの4.3を参照）
}

function highlightDifferences(
  worksheet: ExcelJS.Worksheet,
  schedule: Schedule
) {
  // 実装（design.mdの4.3.1を参照）
}
```

**完了条件**:
- [ ] exportActualExcel関数が実装される
- [ ] 予実2段書きで出力される
- [ ] 差異がハイライト表示される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.3.6: ExportMenu.tsx の更新（Excel形式追加）（1時間）

**説明**: ExportMenuコンポーネントにExcel出力オプションを追加する。

**実装内容**:
```typescript
// src/components/ExportMenu.tsx

export function ExportMenu() {
  // 既存のCSV/PDF出力に加えて、Excel出力を追加

  async function handleExcelStandardExport() {
    await exportStandardFormExcel(schedule, facility, staff);
    logAuditEvent(facilityId, {
      action: 'excel_standard_exported',
      resourceType: 'schedule',
      resourceId: schedule.id
    });
  }

  async function handleExcelActualExport() {
    await exportActualExcel(schedule, facility, staff);
    logAuditEvent(facilityId, {
      action: 'excel_actual_exported',
      resourceType: 'schedule',
      resourceId: schedule.id
    });
  }

  return (
    <div>
      {/* 既存のCSV/PDF出力 */}
      <button onClick={handleCSVExport}>CSV出力</button>
      <button onClick={handlePDFExport}>PDF出力（予定のみ）</button>

      {/* 新規Excel出力 */}
      <button onClick={handleExcelStandardExport}>
        Excel出力（標準様式第1号）
      </button>
      <button onClick={handleExcelActualExport}>
        Excel出力（予実2段書き）
      </button>
    </div>
  );
}
```

**完了条件**:
- [ ] Excel出力ボタンが追加される
- [ ] 標準様式と予実2段書きの2種類が出力可能
- [ ] 監査ログが記録される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.3.7: E2Eテスト実装（Excel出力）（1時間）

**説明**: Excel出力のE2Eテストを実装する。

**テストケース**:
1. 標準様式第1号Excel出力
2. 予実2段書きExcel出力

**実装内容**:
```typescript
// e2e/tests/excel-export.spec.ts

test('標準様式第1号をExcel出力できる', async ({ page }) => {
  await loginAsEditor(page);
  await page.goto('/schedules/2025-11');

  // Excel出力ボタンをクリック
  await page.click('[data-testid="excel-standard-export-button"]');

  // ダウンロードが開始される
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toMatch(/勤務形態一覧表_202511\.xlsx/);
});

test('予実2段書きをExcel出力できる', async ({ page }) => {
  await loginAsEditor(page);
  await page.goto('/schedules/2025-11');

  // Excel出力ボタンをクリック
  await page.click('[data-testid="excel-actual-export-button"]');

  // ダウンロードが開始される
  const download = await page.waitForEvent('download');
  expect(download.suggestedFilename()).toMatch(/勤務形態一覧表_予実_202511\.xlsx/);
});
```

**完了条件**:
- [ ] 2つのE2Eテストが実装される
- [ ] すべてのテストが成功する

---

### Phase 25.3 完了条件

- [ ] すべてのタスク（25.3.1 ~ 25.3.7）が完了
- [ ] TypeScriptエラーがゼロ
- [ ] E2Eテストが100%成功（新規2テスト + 既存9テスト = 計11テスト）
- [ ] 標準様式第1号Excel出力が正常に動作する
- [ ] 予実2段書きExcel出力が正常に動作する
- [ ] 差異ハイライトが正常に動作する

---

## Phase 25.4: コンプライアンスチェック機能（8-12時間）

### 目的
人員配置基準、常勤換算、労基法のコンプライアンスチェック機能を実装する。

### タスク一覧

#### Task 25.4.1: complianceService.ts 実装（4-6時間）

**説明**: コンプライアンスチェックロジックを実装する。

**実装内容**:
- `checkStaffingStandard`: 人員配置基準チェック
- `calculateFullTimeEquivalent`: 常勤換算計算
- `checkLaborLaw`: 労基法チェック

詳細は[design.md の 5.2](./design.md#52-complianceservicets)を参照。

**完了条件**:
- [ ] complianceService.tsが実装される
- [ ] TypeScriptエラーがゼロ
- [ ] ユニットテスト実装（成功率100%）

---

#### Task 25.4.2: ComplianceChecker.tsx コンポーネント実装（2-3時間）

**説明**: コンプライアンスチェック結果を表示するコンポーネントを実装する。

詳細は[design.md の 5.1](./design.md#51-compliancecheckertsx)を参照。

**完了条件**:
- [ ] ComplianceChecker.tsxが実装される
- [ ] 結果サマリー、詳細モーダルが表示される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.4.3: 事業所設定UIの拡張（1-2時間）

**説明**: Facilityモデルに配置基準、週所定労働時間の設定項目を追加する。

**実装内容**:
```typescript
// src/types.ts

export interface Facility {
  // 既存フィールド
  id: string;
  name: string;
  // ...

  // 新規フィールド
  staffingStandard?: {
    type: '3:1' | '2:1' | 'fixed';
    value: number;
  };
  standardWeeklyHours?: number;  // 週所定労働時間（デフォルト: 40）
}
```

**完了条件**:
- [ ] Facilityモデルが拡張される
- [ ] 設定UIが実装される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.4.4: ダッシュボードへの統合（1時間）

**説明**: ダッシュボードにComplianceCheckerコンポーネントを統合する。

**完了条件**:
- [ ] ダッシュボードにコンプライアンスチェック結果が表示される
- [ ] 警告バッジが表示される

---

#### Task 25.4.5: E2Eテスト実装（コンプライアンスチェック）（1時間）

**テストケース**:
1. 人員配置基準未達成の場合、警告が表示される
2. 労基法違反がある場合、警告が表示される

**完了条件**:
- [ ] 2つのE2Eテストが実装される
- [ ] すべてのテストが成功する

---

### Phase 25.4 完了条件

- [ ] すべてのタスク（25.4.1 ~ 25.4.5）が完了
- [ ] TypeScriptエラーがゼロ
- [ ] ユニットテストが100%成功
- [ ] E2Eテストが100%成功（新規2テスト + 既存11テスト = 計13テスト）
- [ ] コンプライアンスチェックが正常に動作する

---

## Phase 25.5: AIシフト生成統合（4-6時間）

### 目的
AIシフト生成機能にコンプライアンス要件を統合し、生成後の自動バリデーションを実装する。

### タスク一覧

#### Task 25.5.1: generateShift Cloud Function の更新（2-3時間）

**説明**: Cloud Functionのプロンプトにコンプライアンス要件を追加する。

詳細は[design.md の 6.1](./design.md#61-cloud-function-generateshift-の更新)を参照。

**完了条件**:
- [ ] プロンプトが拡張される
- [ ] 出力スキーマが拡張される
- [ ] TypeScriptエラーがゼロ

---

#### Task 25.5.2: 生成後バリデーション実装（1-2時間）

**説明**: AIシフト生成後、自動的にコンプライアンスチェックを実行する。

詳細は[design.md の 6.2](./design.md#62-生成後バリデーション)を参照。

**完了条件**:
- [ ] 生成後バリデーションが実装される
- [ ] 違反がある場合、再生成提案UIが表示される

---

#### Task 25.5.3: E2Eテスト実装（AIシフト生成）（1時間）

**テストケース**:
1. AIシフト生成 → コンプライアンスチェック成功
2. AIシフト生成 → コンプライアンスチェック失敗 → 再生成提案

**完了条件**:
- [ ] 2つのE2Eテストが実装される
- [ ] すべてのテストが成功する

---

### Phase 25.5 完了条件

- [ ] すべてのタスク（25.5.1 ~ 25.5.3）が完了
- [ ] TypeScriptエラーがゼロ
- [ ] E2Eテストが100%成功（新規2テスト + 既存13テスト = 計15テスト）
- [ ] AIシフト生成がコンプライアンス要件を考慮する

---

## 全体の完了条件（Phase 25.1 ~ 25.5）

- [ ] すべてのPhaseが完了
- [ ] TypeScriptエラーがゼロ（`npx tsc --noEmit`）
- [ ] ユニットテストが100%成功（`npm test`）
- [ ] E2Eテストが100%成功（計15テスト、Phase 22の6テスト含む）
- [ ] コードレビュー完了（CodeRabbit）
- [ ] ドキュメント整備完了（完了サマリー、Mermaid図）
- [ ] メモリファイル更新

---

## 次のステップ

Phase 25完了後:
1. [完了サマリー作成](../../記録予定/phase25-completion-summary-YYYY-MM-DD.md)
2. [Mermaid図作成](./diagrams/)
3. [メモリファイル更新](../../memory/phase25_completion_2025-11-20.md)
4. Phase 26計画（機能拡張候補）

---

**実装開始**: Phase 25.1から順番に進めてください。
