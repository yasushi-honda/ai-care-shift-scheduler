# Phase 25: コンポーネント構成図

**作成日**: 2025-11-20
**目的**: React コンポーネントの構成とデータフローを視覚化する

---

## コンポーネント階層

```mermaid
graph TB
    subgraph "ルート"
        A[App.tsx]
    end

    subgraph "レイアウト"
        B[Header.tsx]
        C[Navigation.tsx]
    end

    subgraph "シフト表示"
        D[ShiftTable.tsx]
        E[MonthNavigator.tsx]
        F[VersionHistoryModal.tsx]
    end

    subgraph "編集コンポーネント"
        G[ShiftEditConfirmModal.tsx]
        H[TimePicker.tsx]
    end

    subgraph "エクスポート"
        I[ExportMenu.tsx]
    end

    subgraph "コンプライアンス"
        J[ComplianceChecker.tsx]
        K[ComplianceDetailModal.tsx]
    end

    subgraph "サービス層"
        L[scheduleService.ts]
        M[complianceService.ts]
        N[auditLogService.ts]
    end

    subgraph "ユーティリティ"
        O[exportStandardExcel.ts]
        P[exportActualExcel.ts]
        Q[exportPDF.ts]
        R[exportCSV.ts]
    end

    A --> B
    A --> C
    A --> D
    A --> E
    A --> J

    D --> G
    D --> F
    G --> H

    A --> I
    I --> O
    I --> P
    I --> Q
    I --> R

    J --> K

    D --> L
    G --> L
    L --> N

    J --> M
    M --> L

    style A fill:#ffe6e6
    style D fill:#e6f3ff
    style G fill:#e6ffe6
    style I fill:#fff9e6
    style J fill:#f3e6ff
```

**凡例**:
- 🔴 赤: ルート・レイアウト
- 🔵 青: シフト表示層
- 🟢 緑: 編集層
- 🟡 黄: エクスポート層
- 🟣 紫: コンプライアンス層

---

## ShiftTable.tsx 詳細構成

```mermaid
graph TB
    A[ShiftTable.tsx] --> B[useState: editModalData]
    A --> C[useState: showEditModal]
    A --> D[handleCellClick]
    A --> E[handleSaveShift]
    A --> F[getCellClassName]

    A --> G[ShiftEditConfirmModal]
    G --> H[TimePicker x2<br/>開始時刻・終了時刻]
    G --> I[シフトタイプドロップダウン]
    G --> J[休憩時間入力]
    G --> K[特記事項textarea]

    D --> |セルクリック| B
    B --> |モーダルデータ設定| C
    C --> |表示制御| G
    G --> |onSave| E
    E --> |scheduleService| L[updateShiftPartial]

    F --> M{差異チェック}
    M -->|差異あり| N[オレンジ色ring]
    M -->|差異なし| O[通常表示]
    M -->|実績未入力| P[グレーアウト]

    style A fill:#e6f3ff
    style G fill:#e6ffe6
    style H fill:#ffe6f3
    style L fill:#fff9e6
```

---

## ShiftEditConfirmModal.tsx 詳細構成

```mermaid
graph TB
    A[ShiftEditConfirmModal.tsx] --> B[Props]
    B --> C[isOpen: boolean]
    B --> D[date: string]
    B --> E[staffId: string]
    B --> F[type: 'planned' | 'actual']
    B --> G[currentShift: GeneratedShift]

    A --> H[State]
    H --> I[shiftType: string]
    H --> J[startTime: string]
    H --> K[endTime: string]
    H --> L[breakMinutes: number]
    H --> M[notes: string]
    H --> N[errors: string[]]

    A --> O[validate関数]
    O --> P{シフトタイプ選択済み?}
    P -->|NO| Q[エラー追加]
    P -->|YES| R{時刻範囲正しい?}
    R -->|NO| Q
    R -->|YES| S{労基法チェック}
    S -->|違反| Q
    S -->|OK| T[バリデーション成功]

    A --> U[handleConfirm関数]
    U --> V[validate実行]
    V --> W{エラーあり?}
    W -->|YES| X[エラーメッセージ表示]
    W -->|NO| Y[確認ダイアログ表示]
    Y --> Z{ユーザー確定?}
    Z -->|YES| AA[onSave実行]
    Z -->|NO| AB[キャンセル]

    style A fill:#e6ffe6
    style O fill:#fff9e6
    style U fill:#ffe6f3
```

---

## ComplianceChecker.tsx 詳細構成

```mermaid
graph TB
    A[ComplianceChecker.tsx] --> B[Props]
    B --> C[schedule: Schedule]
    B --> D[facility: Facility]

    A --> E[useEffect: チェック実行]
    E --> F[complianceService.checkStaffingStandard]
    E --> G[complianceService.calculateFullTimeEquivalent]
    E --> H[complianceService.checkLaborLaw]

    F --> I[staffingResults]
    G --> J[fteResults]
    H --> K[laborLawResults]

    A --> L[結果サマリー表示]
    I --> M{基準未達成日あり?}
    M -->|YES| N[🔴 人員配置基準: 未達成]
    M -->|NO| O[🟢 人員配置基準: 達成]

    J --> P{常勤換算基準達成?}
    P -->|YES| Q[🟢 常勤換算: 基準達成]
    P -->|NO| R[🔴 常勤換算: 基準未達成]

    K --> S{労基法違反あり?}
    S -->|YES| T[🟡 労基法: 警告あり]
    S -->|NO| U[🟢 労基法: 問題なし]

    A --> V[詳細ボタンクリック]
    V --> W[ComplianceDetailModal]
    W --> X[違反日リスト表示]
    W --> Y[改善提案表示]

    style A fill:#f3e6ff
    style E fill:#fff9e6
    style W fill:#e6f3ff
```

---

## データフロー（Props & State）

### ShiftTable.tsx のProps

```typescript
interface ShiftTableProps {
  schedule: Schedule;                    // 親から受け取る
  onUpdateShift: (                       // 親に通知
    staffId: string,
    date: string,
    updatedFields: Partial<GeneratedShift>
  ) => Promise<void>;
}
```

### ShiftEditConfirmModal.tsx のProps

```typescript
interface ShiftEditConfirmModalProps {
  isOpen: boolean;                       // ShiftTableから受け取る
  onClose: () => void;                   // ShiftTableに通知
  date: string;                          // ShiftTableから受け取る
  staffId: string;                       // ShiftTableから受け取る
  staffName: string;                     // ShiftTableから受け取る
  type: 'planned' | 'actual';            // ShiftTableから受け取る
  currentShift: GeneratedShift | null;   // ShiftTableから受け取る
  onSave: (shift: Partial<GeneratedShift>) => void;  // ShiftTableに通知
}
```

### TimePicker.tsx のProps

```typescript
interface TimePickerProps {
  value: string;                         // 親から受け取る（例: "08:30"）
  onChange: (value: string) => void;     // 親に通知
  label?: string;                        // 親から受け取る
  required?: boolean;                    // 親から受け取る
  disabled?: boolean;                    // 親から受け取る
}
```

---

## State管理戦略

### ローカルState（useState）

以下のコンポーネントはローカルStateで管理:
- `ShiftTable.tsx`: `editModalData`, `showEditModal`
- `ShiftEditConfirmModal.tsx`: `shiftType`, `startTime`, `endTime`, `breakMinutes`, `notes`, `errors`
- `ComplianceChecker.tsx`: `showDetailModal`, `selectedViolation`

### グローバルState（Context）

既存のContext（Phase 25で変更なし）:
- `AuthContext`: ユーザー認証情報
- `ToastContext`: トースト通知
- `LoadingContext`: ローディング状態

### Firestore State（リアルタイム同期）

Firestoreとの同期（`scheduleService.ts`経由）:
- `schedules` コレクション: シフトデータ（予実含む）
- `auditLogs` コレクション: 監査ログ

---

## イベントフロー

```mermaid
sequenceDiagram
    participant User
    participant ShiftTable
    participant Modal
    participant Service
    participant Firestore

    User->>ShiftTable: セルクリック
    ShiftTable->>ShiftTable: setState(editModalData)
    ShiftTable->>Modal: Props渡す（isOpen=true）
    Modal->>User: モーダル表示

    User->>Modal: 入力
    Modal->>Modal: setState(shiftType, startTime, ...)

    User->>Modal: 確認ボタンクリック
    Modal->>Modal: validate()
    Modal->>User: 確認ダイアログ表示

    User->>Modal: 確定
    Modal->>ShiftTable: onSave()
    ShiftTable->>Service: updateShiftPartial()
    Service->>Firestore: updateDoc()
    Firestore-->>Service: 成功
    Service-->>ShiftTable: 完了
    ShiftTable->>ShiftTable: setState（再レンダリング）
    ShiftTable->>User: 更新されたシフト表示

    Modal->>User: モーダルクローズ
```

---

## ファイル構成

```
src/
├── components/
│   ├── ShiftTable.tsx                 # 予実2段書き表示
│   ├── ShiftEditConfirmModal.tsx      # シフト編集モーダル
│   ├── TimePicker.tsx                 # 時刻入力コンポーネント
│   ├── ComplianceChecker.tsx          # コンプライアンスチェック結果
│   ├── ComplianceDetailModal.tsx      # 詳細モーダル
│   ├── ExportMenu.tsx                 # エクスポートメニュー
│   ├── MonthNavigator.tsx             # 月切り替え（既存）
│   └── VersionHistoryModal.tsx        # バージョン履歴（既存）
│
├── services/
│   ├── scheduleService.ts             # スケジュールCRUD
│   ├── complianceService.ts           # コンプライアンスチェック
│   └── auditLogService.ts             # 監査ログ（既存）
│
├── utils/
│   ├── exportStandardExcel.ts         # 標準様式Excel出力
│   ├── exportActualExcel.ts           # 予実2段書きExcel出力
│   ├── exportPDF.ts                   # PDF出力（既存・予定のみ）
│   └── exportCSV.ts                   # CSV出力（既存）
│
└── types.ts                           # 型定義（GeneratedShift拡張）
```

---

## 関連ドキュメント

- [要件定義書](../requirements.md)
- [技術設計書](../design.md)
- [実装タスク一覧](../tasks.md)
- [データモデル図](./data-model-diagram.md)
- [UIフロー図](./ui-flow-diagram.md)
