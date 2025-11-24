# Phase 25 成果物ダイアグラム集

**作成日**: 2025-11-24
**Phase**: 25（ユーザビリティ改善）
**形式**: Mermaid/PlantUML（静的サイト対応）

---

## 目次

1. [WBS（作業分解構造）](#1-wbs作業分解構造)
2. [ガントチャート（実装スケジュール）](#2-ガントチャート実装スケジュール)
3. [システム構成図](#3-システム構成図)
4. [データフロー図](#4-データフロー図)
5. [コンポーネント関係図](#5-コンポーネント関係図)
6. [ユーザーインタラクションフロー](#6-ユーザーインタラクションフロー)

---

## 1. WBS（作業分解構造）

### Phase 25.2.5 ユーザビリティ改善 WBS

```mermaid
graph TB
    A[Phase 25.2.5<br/>ユーザビリティ改善]

    A --> B[Task 1<br/>個別「予定と同じ」ボタン]
    A --> C[Task 2<br/>一括予定→実績コピー]
    A --> D[Task 3<br/>ダブルクリック即時コピー<br/>未実装]

    B --> B1[設計・仕様確認]
    B --> B2[copyPlannedToActual実装]
    B --> B3[CopyPlannedToActualButton実装]
    B --> B4[ActualShiftInputModal統合]
    B --> B5[TypeScript型チェック]
    B --> B6[ユニットテスト]
    B --> B7[CodeRabbitレビュー]
    B --> B8[Git管理]

    C --> C1[設計・仕様確認]
    C --> C2[bulkCopyPlannedToActual実装]
    C --> C3[BulkCopyPlannedToActualModal実装]
    C --> C4[App.tsx統合]
    C --> C5[ShiftTable.tsxボタン追加]
    C --> C6[TypeScript型チェック]
    C --> C7[ユニットテスト]
    C --> C8[CodeRabbitレビュー<br/>4回・9件対応]
    C --> C9[Git管理・CI/CD]

    D --> D1[UI設計]
    D --> D2[イベントハンドラ実装]
    D --> D3[モーダル改修]
    D --> D4[E2Eテスト]

    style B fill:#90EE90
    style C fill:#90EE90
    style D fill:#FFE4B5
```

---

## 2. ガントチャート（実装スケジュール）

### Phase 25 実装タイムライン

```mermaid
gantt
    title Phase 25 ユーザビリティ改善 実装スケジュール
    dateFormat YYYY-MM-DD

    section 企画・提案
    ユーザビリティ改善提案作成 : done, proposal, 2025-11-23, 1d

    section Phase 25.2.5 Task 1
    設計・仕様確認 : done, task1-design, 2025-11-23, 2h
    copyPlannedToActual実装 : done, task1-util, after task1-design, 1h
    CopyPlannedToActualButton実装 : done, task1-comp, after task1-util, 1h
    ActualShiftInputModal統合 : done, task1-modal, after task1-comp, 1h
    TypeScript型チェック : done, task1-ts, after task1-modal, 30m
    ユニットテスト : done, task1-test, after task1-ts, 30m
    CodeRabbitレビュー : done, task1-review, after task1-test, 30m
    Git管理・デプロイ : done, task1-deploy, after task1-review, 30m

    section Phase 25.2.5 Task 2
    設計・仕様確認 : done, task2-design, 2025-11-24, 1h
    bulkCopyPlannedToActual実装 : done, task2-util, after task2-design, 1h
    BulkCopyPlannedToActualModal実装 : done, task2-modal, after task2-util, 2h
    App.tsx統合 : done, task2-app, after task2-modal, 1h
    ShiftTable.tsxボタン追加 : done, task2-table, after task2-app, 30m
    TypeScript型チェック : done, task2-ts, after task2-table, 30m
    ユニットテスト : done, task2-test, after task2-ts, 30m
    CodeRabbitレビュー1 : done, task2-review1, after task2-test, 30m
    修正・レビュー2-4 : done, task2-review2, after task2-review1, 2h
    Git管理・CI/CD : done, task2-deploy, after task2-review2, 30m

    section Phase 25.2.5 Task 3（未実装）
    設計・仕様確認 : task3-design, 2025-11-25, 1h
    イベントハンドラ実装 : task3-handler, after task3-design, 1h
    モーダル改修 : task3-modal, after task3-handler, 1h
    E2Eテスト : task3-test, after task3-modal, 1h
    デプロイ : task3-deploy, after task3-test, 30m
```

---

## 3. システム構成図

### Phase 25 アーキテクチャ概要

```mermaid
graph TB
    subgraph "ユーザー層"
        U[ユーザー<br/>施設管理者・スタッフ]
    end

    subgraph "プレゼンテーション層"
        ST[ShiftTable<br/>シフト表示]
        ASIM[ActualShiftInputModal<br/>個別実績入力]
        BCPAM[BulkCopyPlannedToActualModal<br/>一括コピー]
        CPTAB[CopyPlannedToActualButton<br/>「予定と同じ」ボタン]
    end

    subgraph "アプリケーション層"
        APP[App.tsx<br/>状態管理・ハンドラ]
    end

    subgraph "ビジネスロジック層"
        CPTAUtil[copyPlannedToActual<br/>個別コピーロジック]
        BCPTAUtil[bulkCopyPlannedToActual<br/>一括コピーロジック]
        GUACUtil[getUnfilledActualCount<br/>未入力件数計算]
    end

    subgraph "データアクセス層"
        SS[ScheduleService<br/>Firestore操作]
    end

    subgraph "データベース層"
        FS[(Cloud Firestore<br/>スケジュールデータ)]
    end

    U -->|操作| ST
    U -->|クリック| CPTAB
    U -->|クリック| BCPAM

    ST -->|モーダル表示| ASIM
    ST -->|ボタン表示| CPTAB
    ST -->|モーダル表示| BCPAM

    ASIM -->|コピー実行| APP
    CPTAB -->|コピー実行| CPTAUtil
    BCPAM -->|一括コピー実行| APP

    APP -->|個別コピー| CPTAUtil
    APP -->|一括コピー| BCPTAUtil
    APP -->|保存| SS

    BCPAM -->|未入力件数取得| GUACUtil

    CPTAUtil -->|シフトデータ変換| APP
    BCPTAUtil -->|シフトデータ変換| APP
    GUACUtil -->|件数計算| BCPAM

    SS -->|CRUD操作| FS

    style U fill:#E6F3FF
    style ST fill:#FFE6F0
    style ASIM fill:#FFE6F0
    style BCPAM fill:#FFE6F0
    style CPTAB fill:#FFE6F0
    style APP fill:#FFF4E6
    style CPTAUtil fill:#F0FFE6
    style BCPTAUtil fill:#F0FFE6
    style GUACUtil fill:#F0FFE6
    style SS fill:#E6F0FF
    style FS fill:#F0E6FF
```

---

## 4. データフロー図

### Phase 25.2.5 Task 2: 一括コピー機能のデータフロー

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant ST as ShiftTable
    participant BCPAM as BulkCopyPlannedToActualModal
    participant APP as App.tsx
    participant BCPTAUtil as bulkCopyPlannedToActual
    participant GUACUtil as getUnfilledActualCount
    participant SS as ScheduleService
    participant FS as Cloud Firestore

    User->>ST: 「予定を実績にコピー」ボタンクリック
    ST->>APP: onBulkCopyClick()
    APP->>BCPAM: モーダル表示（isOpen=true）

    BCPAM->>GUACUtil: 未入力件数計算（全スタッフ）
    GUACUtil-->>BCPAM: 未入力件数リスト
    BCPAM->>BCPAM: 未入力スタッフを自動選択

    BCPAM-->>User: モーダル表示（スタッフ選択・期間指定）

    User->>BCPAM: スタッフ選択・期間指定
    User->>BCPAM: 「実行」ボタンクリック

    BCPAM->>BCPAM: バリデーション（選択数、日付範囲）
    BCPAM->>BCPAM: 確認ダイアログ表示
    User->>BCPAM: 確認「OK」

    BCPAM->>APP: onExecute(options)

    APP->>APP: isLoadingチェック（並行実行防止）
    APP->>APP: previousSchedule = schedule（ロールバック用）
    APP->>APP: setIsLoading(true)

    APP->>BCPTAUtil: bulkCopyPlannedToActual(schedule, options)

    BCPTAUtil->>BCPTAUtil: スタッフIDフィルタリング
    BCPTAUtil->>BCPTAUtil: 日付範囲フィルタリング
    BCPTAUtil->>BCPTAUtil: 予定データ存在チェック
    BCPTAUtil->>BCPTAUtil: 実績シフトにコピー

    BCPTAUtil-->>APP: updatedSchedule

    APP->>APP: setSchedule(updatedSchedule)（楽観的UI更新）

    APP->>SS: updateSchedule(facilityId, scheduleId, userId, data)
    SS->>FS: Firestoreに保存
    FS-->>SS: 保存成功
    SS-->>APP: { success: true }

    APP->>APP: showSuccess('予定を実績にコピーし、保存しました')
    APP->>APP: setBulkCopyModalOpen(false)
    APP->>APP: setIsLoading(false)

    APP-->>User: 成功メッセージ表示、モーダル閉じる

    Note over APP,FS: エラー時のロールバック
    alt 保存失敗
        SS-->>APP: { success: false, error }
        APP->>APP: setSchedule(previousSchedule)（ロールバック）
        APP->>APP: showError(errorMessage)
        APP->>APP: setIsLoading(false)
        APP-->>User: エラーメッセージ表示
    end
```

---

## 5. コンポーネント関係図

### Phase 25 コンポーネント依存関係

```mermaid
graph LR
    subgraph "App.tsx（状態管理）"
        APP[App Component<br/>- schedule: StaffSchedule[]<br/>- bulkCopyModalOpen: boolean<br/>- handleBulkCopyExecute()]
    end

    subgraph "ShiftTable.tsx"
        ST[ShiftTable<br/>- schedules: StaffSchedule[]<br/>- onBulkCopyClick: function]
        STButton[一括コピーボタン]
    end

    subgraph "BulkCopyPlannedToActualModal.tsx"
        BCPAM[BulkCopyPlannedToActualModal<br/>- schedules: StaffSchedule[]<br/>- targetMonth: string<br/>- isOpen: boolean<br/>- onClose: function<br/>- onExecute: function]
        BCPAMStaffList[スタッフ選択リスト]
        BCPAMDateRange[日付範囲選択]
        BCPAMOverwrite[上書きオプション]
        BCPAMToggleAll[すべて選択/解除]
        BCPAMExecute[実行ボタン]
    end

    subgraph "ActualShiftInputModal.tsx"
        ASIM[ActualShiftInputModal<br/>- shiftData: GeneratedShift<br/>- onSave: function]
        ASIMButton[CopyPlannedToActualButton]
    end

    subgraph "Utilities"
        BCPTAUtil[bulkCopyPlannedToActual<br/>- options.staffIds<br/>- options.dateRange<br/>- options.overwrite]
        CPTAUtil[copyPlannedToActual<br/>- shift: GeneratedShift]
        GUACUtil[getUnfilledActualCount<br/>- staff: StaffSchedule<br/>- dateRange?: object]
    end

    APP -->|props| ST
    ST -->|render| STButton
    STButton -->|onClick| APP

    APP -->|props| BCPAM
    BCPAM -->|render| BCPAMStaffList
    BCPAM -->|render| BCPAMDateRange
    BCPAM -->|render| BCPAMOverwrite
    BCPAM -->|render| BCPAMToggleAll
    BCPAM -->|render| BCPAMExecute
    BCPAMExecute -->|onExecute| APP

    APP -->|props| ASIM
    ASIM -->|render| ASIMButton
    ASIMButton -->|onClick| CPTAUtil

    BCPAM -->|import| GUACUtil
    BCPAM -->|import| BCPTAUtil
    APP -->|import| BCPTAUtil
    APP -->|import| CPTAUtil
    BCPTAUtil -->|import| CPTAUtil

    style APP fill:#FFF4E6
    style ST fill:#FFE6F0
    style BCPAM fill:#FFE6F0
    style ASIM fill:#FFE6F0
    style BCPTAUtil fill:#F0FFE6
    style CPTAUtil fill:#F0FFE6
    style GUACUtil fill:#F0FFE6
```

---

## 6. ユーザーインタラクションフロー

### Phase 25.2.5 Task 2: ユーザー操作フロー

```mermaid
flowchart TD
    Start([ユーザーがシフト表を表示])

    Start --> CheckMonth{対象月のシフト<br/>予定あり？}
    CheckMonth -->|いいえ| EndNoData([終了: 予定なし])
    CheckMonth -->|はい| ShowButton[「予定を実績にコピー」<br/>ボタン表示]

    ShowButton --> ClickButton{ボタンクリック}
    ClickButton -->|クリック| OpenModal[モーダル表示]

    OpenModal --> AutoSelect[未入力スタッフを<br/>自動選択]
    AutoSelect --> ShowStaffList[スタッフ選択リスト表示<br/>- チェックボックス<br/>- 未入力件数表示]

    ShowStaffList --> UserSelect{ユーザーが選択調整}
    UserSelect -->|個別選択/解除| UpdateSelection[選択状態更新]
    UserSelect -->|すべて選択/解除| ToggleAll[全選択/全解除]
    UpdateSelection --> ShowStaffList
    ToggleAll --> ShowStaffList

    UserSelect -->|期間変更| ChangeDateRange[開始日・終了日変更]
    ChangeDateRange --> ValidateDate{日付範囲<br/>有効？}
    ValidateDate -->|無効| ShowDateError[エラーメッセージ表示]
    ShowDateError --> ChangeDateRange
    ValidateDate -->|有効| UpdateStaffList[選択可能スタッフを<br/>再計算・同期]
    UpdateStaffList --> ShowStaffList

    UserSelect -->|上書き設定| ToggleOverwrite[上書きオプション<br/>ON/OFF]
    ToggleOverwrite --> ShowStaffList

    UserSelect -->|実行クリック| ValidateSelection{選択スタッフ<br/>1名以上？}
    ValidateSelection -->|いいえ| ShowSelectionError[エラーメッセージ<br/>「1名以上選択」]
    ShowSelectionError --> ShowStaffList

    ValidateSelection -->|はい| ShowConfirm[確認ダイアログ表示<br/>- 対象スタッフ数<br/>- 対象シフト数<br/>- 期間<br/>- 上書き有無]

    ShowConfirm --> UserConfirm{ユーザー確認}
    UserConfirm -->|キャンセル| ShowStaffList
    UserConfirm -->|OK| CheckLoading{別の保存処理<br/>実行中？}

    CheckLoading -->|はい| EndLoading([並行実行防止<br/>処理中断])
    CheckLoading -->|いいえ| StartLoading[ローディング表示]

    StartLoading --> BackupState[現在の状態を<br/>バックアップ]
    BackupState --> ExecuteCopy[bulkCopyPlannedToActual<br/>実行]

    ExecuteCopy --> CheckPlannedData{予定データ<br/>存在？}
    CheckPlannedData -->|なし| SkipCopy[コピーせず<br/>次のシフトへ]
    CheckPlannedData -->|あり| CheckActual{実績既存？}

    CheckActual -->|はい・上書きOFF| SkipCopy
    CheckActual -->|いいえ・または上書きON| CopyData[予定→実績コピー]

    CopyData --> NextShift{次のシフト<br/>あり？}
    SkipCopy --> NextShift
    NextShift -->|はい| ExecuteCopy
    NextShift -->|いいえ| UpdateUI[UI状態更新<br/>楽観的更新]

    UpdateUI --> SaveFirestore[Firestoreに保存]
    SaveFirestore --> CheckSaveResult{保存成功？}

    CheckSaveResult -->|はい| ShowSuccess[成功メッセージ表示]
    ShowSuccess --> CloseModal[モーダル閉じる]
    CloseModal --> StopLoading[ローディング停止]
    StopLoading --> EndSuccess([完了: 実績反映])

    CheckSaveResult -->|いいえ| Rollback[状態をロールバック<br/>バックアップから復元]
    Rollback --> ShowError[エラーメッセージ表示]
    ShowError --> StopLoadingError[ローディング停止]
    StopLoadingError --> EndError([終了: エラー])

    ClickButton -->|キャンセル| CloseModalCancel[モーダル閉じる]
    CloseModalCancel --> EndCancel([終了: キャンセル])

    style Start fill:#E6F3FF
    style EndSuccess fill:#90EE90
    style EndError fill:#FFB6C1
    style EndCancel fill:#FFE4B5
    style EndNoData fill:#D3D3D3
    style EndLoading fill:#FFE4B5
    style CheckLoading fill:#FFF4E6
    style BackupState fill:#FFF4E6
    style Rollback fill:#FFB6C1
```

---

## 使用方法

### GitHub Pagesでの表示

これらのMermaid図は、GitHub Pagesで自動的にレンダリングされます。

1. **GitHubリポジトリで表示**: MarkdownファイルをGitHubで開くと、Mermaid図が自動的にレンダリングされます
2. **ローカルでプレビュー**: VSCodeのMarkdownプレビュー拡張機能（Markdown Preview Mermaid Support）を使用
3. **HTMLエクスポート**: Mermaid Live Editor (https://mermaid.live/) でSVG/PNG形式にエクスポート可能

---

## ダイアグラム更新履歴

| 日付 | 更新内容 | 担当 |
|------|----------|------|
| 2025-11-24 | Phase 25.2.5完了時の初版作成 | Claude Code |

---

## 関連ドキュメント

- [Phase 25.2.5 Task 1完了記録](./phase25-2.5-task1-completion-2025-11-23.md)
- [Phase 25.2.5 Task 2完了記録](./phase25-2.5-task2-completion-2025-11-24.md)
- [ユーザビリティ改善提案](./usability-improvements-proposal.md)
- [HANDOFF_PROMPT.md](./HANDOFF_PROMPT.md)

---

**作成日**: 2025-11-24 11:40 JST
**Phase 25.2.5 Task 2完了**: 100%
