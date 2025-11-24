---
layout: default
title: 技術ドキュメント - 開発者向け
---

# 技術ドキュメント（開発者向け）

Phase 25 ユーザビリティ改善の技術詳細とダイアグラム集です。

---

## WBS（作業分解構造）

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

## ガントチャート（実装スケジュール）

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
```

---

## システム構成図

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

## データフロー図

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant ST as ShiftTable
    participant BCPAM as BulkCopyModal
    participant APP as App.tsx
    participant Util as bulkCopyUtil
    participant SS as ScheduleService
    participant FS as Firestore

    User->>ST: 「予定を実績にコピー」クリック
    ST->>APP: onBulkCopyClick()
    APP->>BCPAM: モーダル表示

    BCPAM->>BCPAM: 未入力スタッフ自動選択
    BCPAM-->>User: モーダル表示

    User->>BCPAM: スタッフ選択・実行
    BCPAM->>APP: onExecute(options)

    APP->>Util: bulkCopyPlannedToActual()
    Util-->>APP: updatedSchedule

    APP->>APP: setSchedule(楽観的UI更新)

    APP->>SS: updateSchedule()
    SS->>FS: Firestoreに保存
    FS-->>SS: 保存成功
    SS-->>APP: success

    APP->>APP: showSuccess()
    APP->>APP: モーダル閉じる
    APP-->>User: 成功メッセージ

    Note over APP,FS: エラー時はrollback
```

---

## コンポーネント関係図

```mermaid
graph LR
    subgraph "App.tsx（状態管理）"
        APP[App Component<br/>- schedule<br/>- bulkCopyModalOpen<br/>- handleBulkCopyExecute]
    end

    subgraph "ShiftTable.tsx"
        ST[ShiftTable<br/>- onBulkCopyClick]
        STButton[一括コピーボタン]
    end

    subgraph "BulkCopyModal"
        BCPAM[BulkCopyPlannedToActualModal<br/>- schedules<br/>- targetMonth<br/>- onExecute]
    end

    subgraph "ActualShiftInputModal"
        ASIM[ActualShiftInputModal]
        ASIMButton[CopyPlannedToActualButton]
    end

    subgraph "Utilities"
        BCPTAUtil[bulkCopyPlannedToActual]
        CPTAUtil[copyPlannedToActual]
        GUACUtil[getUnfilledActualCount]
    end

    APP -->|props| ST
    ST -->|render| STButton
    STButton -->|onClick| APP

    APP -->|props| BCPAM
    BCPAM -->|onExecute| APP

    APP -->|props| ASIM
    ASIM -->|render| ASIMButton

    BCPAM -->|import| GUACUtil
    BCPAM -->|import| BCPTAUtil
    APP -->|import| BCPTAUtil
    APP -->|import| CPTAUtil

    style APP fill:#FFF4E6
    style ST fill:#FFE6F0
    style BCPAM fill:#FFE6F0
    style ASIM fill:#FFE6F0
    style BCPTAUtil fill:#F0FFE6
    style CPTAUtil fill:#F0FFE6
    style GUACUtil fill:#F0FFE6
```

---

## ユーザーインタラクションフロー

```mermaid
flowchart TD
    Start([ユーザーがシフト表を表示])

    Start --> ShowButton[「予定を実績にコピー」<br/>ボタン表示]
    ShowButton --> ClickButton{ボタンクリック}
    ClickButton -->|クリック| OpenModal[モーダル表示]

    OpenModal --> AutoSelect[未入力スタッフを<br/>自動選択]
    AutoSelect --> ShowStaffList[スタッフ選択リスト表示]

    ShowStaffList --> UserSelect{ユーザーが選択}
    UserSelect -->|個別選択| UpdateSelection[選択状態更新]
    UserSelect -->|すべて選択| ToggleAll[全選択/全解除]
    UpdateSelection --> ShowStaffList
    ToggleAll --> ShowStaffList

    UserSelect -->|実行クリック| ValidateSelection{選択スタッフ<br/>1名以上？}
    ValidateSelection -->|いいえ| ShowError[エラーメッセージ]
    ShowError --> ShowStaffList

    ValidateSelection -->|はい| ShowConfirm[確認ダイアログ]
    ShowConfirm --> UserConfirm{ユーザー確認}
    UserConfirm -->|キャンセル| ShowStaffList
    UserConfirm -->|OK| ExecuteCopy[一括コピー実行]

    ExecuteCopy --> UpdateUI[UI状態更新]
    UpdateUI --> SaveFirestore[Firestoreに保存]
    SaveFirestore --> CheckResult{保存成功？}

    CheckResult -->|はい| ShowSuccess[成功メッセージ]
    ShowSuccess --> CloseModal[モーダル閉じる]
    CloseModal --> End([完了])

    CheckResult -->|いいえ| Rollback[状態をロールバック]
    Rollback --> ShowSaveError[エラーメッセージ]
    ShowSaveError --> EndError([終了: エラー])

    style Start fill:#E6F3FF
    style End fill:#90EE90
    style EndError fill:#FFB6C1
```

---

[トップページに戻る](index.html)

**最終更新**: 2025年11月24日
