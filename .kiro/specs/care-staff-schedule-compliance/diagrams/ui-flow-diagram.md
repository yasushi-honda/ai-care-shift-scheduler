# Phase 25: UIフロー図

**作成日**: 2025-11-20
**目的**: 予実編集フローとコンポーネント間のやり取りを視覚化する

---

## シングルクリック編集フロー（シーケンス図）

```mermaid
sequenceDiagram
    actor User
    participant ShiftTable
    participant ShiftEditConfirmModal
    participant scheduleService
    participant Firestore
    participant auditLogService

    User->>ShiftTable: シングルクリック（予定行 or 実績行のセル）
    ShiftTable->>ShiftTable: handleCellClick()
    ShiftTable->>ShiftEditConfirmModal: モーダル表示<br/>(date, staffId, type, currentShift)

    User->>ShiftEditConfirmModal: シフト情報入力<br/>(shiftType, startTime, endTime, breakMinutes)
    ShiftEditConfirmModal->>ShiftEditConfirmModal: validate()

    alt バリデーションエラー
        ShiftEditConfirmModal->>User: エラーメッセージ表示
    else バリデーションOK
        User->>ShiftEditConfirmModal: 確認ボタンクリック
        ShiftEditConfirmModal->>User: 確認ダイアログ表示<br/>「予定シフトを更新します。よろしいですか？」

        alt ユーザーがキャンセル
            User->>ShiftEditConfirmModal: キャンセル
            ShiftEditConfirmModal->>User: モーダルクローズ
        else ユーザーが確定
            User->>ShiftEditConfirmModal: 確定
            ShiftEditConfirmModal->>scheduleService: updateShiftPartial(updatedFields)
            scheduleService->>Firestore: updateDoc()<br/>(staffSchedules, updatedAt, version)
            Firestore-->>scheduleService: 成功
            scheduleService->>auditLogService: logAuditEvent('shift_updated')
            auditLogService->>Firestore: 監査ログ保存
            scheduleService-->>ShiftEditConfirmModal: 更新完了
            ShiftEditConfirmModal->>ShiftTable: onSave()
            ShiftTable->>ShiftTable: シフト表を再レンダリング
            ShiftTable->>User: 更新されたシフトを表示
            ShiftEditConfirmModal->>User: モーダルクローズ
        end
    end
```

---

## 差異ハイライト判定フロー

```mermaid
flowchart TD
    A[シフトデータ取得] --> B{actualShiftType存在?}
    B -->|NO| C[実績未入力]
    C --> D[グレーアウト表示]

    B -->|YES| E{plannedShiftType == actualShiftType?}
    E -->|YES| F{時刻も一致?}
    F -->|YES| G[差異なし]
    G --> H[通常表示<br/>緑: OK]

    F -->|NO| I[時刻に差異あり]
    I --> J[オレンジ色のring表示<br/>ツールチップで詳細表示]

    E -->|NO| K[シフトタイプに差異あり]
    K --> J
```

---

## コンポーネント間のデータフロー

```mermaid
graph TB
    subgraph "親コンポーネント"
        A[App.tsx]
    end

    subgraph "シフト表示層"
        B[ShiftTable.tsx]
        C[MonthNavigator.tsx]
    end

    subgraph "編集層"
        D[ShiftEditConfirmModal.tsx]
        E[TimePicker.tsx]
    end

    subgraph "データ層"
        F[scheduleService.ts]
        G[auditLogService.ts]
    end

    subgraph "Firebase"
        H[Firestore]
    end

    A -->|schedule, onUpdateShift| B
    A -->|targetMonth, onMonthChange| C

    B -->|onClick| D
    D -->|value, onChange| E

    D -->|updateShiftPartial| F
    F -->|updateDoc| H
    F -->|logAuditEvent| G
    G -->|addDoc| H

    H -.->|リアルタイム更新| F
    F -.->|データ取得| B
```

---

## 予定編集と実績編集の違い

### 予定編集フロー

```mermaid
flowchart LR
    A[予定行セルクリック] --> B[ShiftEditConfirmModal表示]
    B --> C[type='planned'を渡す]
    C --> D[plannedShiftType, plannedStartTime, plannedEndTime を編集]
    D --> E[確認ダイアログ: '予定シフトを更新します']
    E --> F[Firestore更新]
    F --> G[予定行のセルが更新される]
```

### 実績編集フロー

```mermaid
flowchart LR
    A[実績行セルクリック] --> B[ShiftEditConfirmModal表示]
    B --> C[type='actual'を渡す]
    C --> D[actualShiftType, actualStartTime, actualEndTime を編集]
    D --> E[確認ダイアログ: '実績シフトを更新します']
    E --> F[Firestore更新]
    F --> G[実績行のセルが更新される]
    G --> H[差異チェック実行]
    H --> I[差異があればハイライト表示]
```

---

## バリデーションフロー

```mermaid
flowchart TD
    A[ユーザーが確認ボタンクリック] --> B{shiftType選択済み?}
    B -->|NO| C[エラー: 'シフトタイプを選択してください']
    C --> Z[エラーメッセージ表示]

    B -->|YES| D{startTime, endTime両方入力済み?}
    D -->|NO| E[OK: 時刻はオプション]
    E --> F[確認ダイアログ表示]

    D -->|YES| G{startTime < endTime?}
    G -->|NO| H[エラー: '終了時刻は開始時刻より後']
    H --> Z

    G -->|YES| I[勤務時間を計算]
    I --> J{勤務時間 > 8時間?}
    J -->|YES| K{breakMinutes >= 60?}
    K -->|NO| L[エラー: '8時間超は60分休憩必要']
    L --> Z
    K -->|YES| F

    J -->|NO| M{勤務時間 > 6時間?}
    M -->|YES| N{breakMinutes >= 45?}
    N -->|NO| O[エラー: '6時間超は45分休憩必要']
    O --> Z
    N -->|YES| F

    M -->|NO| F
    F --> P[確認ダイアログOK]
    P --> Q[Firestore更新]
```

---

## Excel出力フロー

```mermaid
sequenceDiagram
    actor User
    participant ExportMenu
    participant exportStandardExcel
    participant exportActualExcel
    participant ExcelJS
    participant auditLogService

    User->>ExportMenu: Excel出力ボタンクリック

    alt 標準様式第1号
        ExportMenu->>exportStandardExcel: exportStandardFormExcel(schedule, facility, staff)
        exportStandardExcel->>ExcelJS: 新規ワークブック作成
        exportStandardExcel->>ExcelJS: ヘッダー設定
        exportStandardExcel->>ExcelJS: スタッフ情報設定
        exportStandardExcel->>ExcelJS: シフトデータ設定（予定のみ）
        exportStandardExcel->>ExcelJS: 罫線・スタイル設定
        ExcelJS-->>exportStandardExcel: Excelバッファ
        exportStandardExcel->>User: ファイルダウンロード<br/>勤務形態一覧表_202511.xlsx
        exportStandardExcel->>auditLogService: logAuditEvent('excel_standard_exported')
    else 予実2段書き
        ExportMenu->>exportActualExcel: exportActualExcel(schedule, facility, staff)
        exportActualExcel->>ExcelJS: 新規ワークブック作成
        exportActualExcel->>ExcelJS: ヘッダー設定
        exportActualExcel->>ExcelJS: スタッフ情報設定（2行/名）
        exportActualExcel->>ExcelJS: シフトデータ設定（予定 & 実績）
        exportActualExcel->>ExcelJS: 差異ハイライト設定
        ExcelJS-->>exportActualExcel: Excelバッファ
        exportActualExcel->>User: ファイルダウンロード<br/>勤務形態一覧表_予実_202511.xlsx
        exportActualExcel->>auditLogService: logAuditEvent('excel_actual_exported')
    end
```

---

## 関連ドキュメント

- [要件定義書](../requirements.md)
- [技術設計書](../design.md)
- [実装タスク一覧](../tasks.md)
- [データモデル図](./data-model-diagram.md)
- [コンポーネント構成図](./component-architecture.md)
