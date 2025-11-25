# Phase 33: リドゥ機能 - 図表ドキュメント

**作成日**: 2025-11-25
**仕様ID**: redo-functionality
**Phase**: 33

---

## WBS（作業分解図）

```mermaid
graph TD
    A[Phase 33: リドゥ機能] --> B[33.1 計画・設計]
    A --> C[33.2 リドゥスタック]
    A --> D[33.3 アンドゥ連携]
    A --> E[33.4 キーボードショートカット]
    A --> F[33.5 E2Eテスト]
    A --> G[33.6 ドキュメント整備]

    B --> B1[現状分析]
    B --> B2[技術設計]

    C --> C1[redoStack state追加]
    C --> C2[スタッククリア処理]

    D --> D1[アンドゥ時リドゥ追加]
    D --> D2[リドゥ時アンドゥ追加]

    E --> E1[Ctrl+Shift+Z処理]
    E --> E2[useEffect統合]

    F --> F1[リドゥテスト3件]

    G --> G1[完了記録]
    G --> G2[図表ドキュメント]

    style A fill:#4CAF50,color:white
    style B fill:#2196F3,color:white
    style C fill:#2196F3,color:white
    style D fill:#2196F3,color:white
    style E fill:#2196F3,color:white
    style F fill:#2196F3,color:white
    style G fill:#2196F3,color:white
```

---

## ガントチャート

```mermaid
gantt
    title Phase 33 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 計画・設計
    現状分析           :done, a1, 00:00, 5m
    技術設計           :done, a2, after a1, 10m

    section リドゥスタック
    redoStack追加      :done, b1, after a2, 5m
    スタッククリア     :done, b2, after b1, 5m

    section アンドゥ連携
    アンドゥ修正       :done, c1, after b2, 10m
    リドゥ実装         :done, c2, after c1, 15m

    section キーボード
    Ctrl+Shift+Z処理   :done, d1, after c2, 10m

    section E2Eテスト
    リドゥテスト       :done, e1, after d1, 15m

    section 完了処理
    ドキュメント整備   :done, f1, after e1, 10m
    Git push           :active, f2, after f1, 5m
```

---

## アンドゥ/リドゥ状態遷移図

```mermaid
stateDiagram-v2
    [*] --> Initial: 初期状態

    Initial --> Changed: 変更操作
    Changed --> Changed: 変更操作
    Changed --> Undone: Ctrl+Z

    Undone --> Changed: 変更操作
    Undone --> Undone: Ctrl+Z
    Undone --> Redone: Ctrl+Shift+Z

    Redone --> Changed: 変更操作
    Redone --> Undone: Ctrl+Z
    Redone --> Redone: Ctrl+Shift+Z

    note right of Changed
        undoStack: 履歴追加
        redoStack: クリア
    end note

    note right of Undone
        undoStack: pop
        redoStack: 追加
    end note

    note right of Redone
        undoStack: 追加
        redoStack: pop
    end note
```

---

## スタック動作シーケンス

```mermaid
sequenceDiagram
    participant U as User
    participant App as App.tsx
    participant US as undoStack
    participant RS as redoStack

    Note over U,RS: 初期状態: 両スタック空

    U->>App: シフト変更（A→B）
    App->>US: push(A)
    App->>RS: clear()
    Note over US,RS: undo:[A], redo:[]

    U->>App: Ctrl+Z（アンドゥ）
    App->>US: pop() → A
    App->>RS: push(B)
    App->>App: 復元(A)
    Note over US,RS: undo:[], redo:[B]

    U->>App: Ctrl+Shift+Z（リドゥ）
    App->>RS: pop() → B
    App->>US: push(A)
    App->>App: 復元(B)
    Note over US,RS: undo:[A], redo:[]

    U->>App: 新規変更（B→C）
    App->>US: push(B)
    App->>RS: clear()
    Note over US,RS: undo:[A,B], redo:[]
```

---

## キーボード操作フローチャート

```mermaid
flowchart TD
    A[キー入力] --> B{Ctrl/Cmd + Z?}
    B -->|No| Z[他の処理]
    B -->|Yes| C{入力フィールドにフォーカス?}
    C -->|Yes| Z
    C -->|No| D{Shift押下?}

    D -->|Yes| E[リドゥ処理]
    D -->|No| F[アンドゥ処理]

    E --> E1{redoStack空?}
    E1 -->|Yes| Z
    E1 -->|No| E2[現在値をundoStackに追加]
    E2 --> E3[redoStackからpop]
    E3 --> E4[スケジュール復元]
    E4 --> E5[トースト表示]

    F --> F1{undoStack空?}
    F1 -->|Yes| Z
    F1 -->|No| F2[現在値をredoStackに追加]
    F2 --> F3[undoStackからpop]
    F3 --> F4[スケジュール復元]
    F4 --> F5[トースト表示]

    style A fill:#4CAF50,color:white
    style E fill:#FF9800,color:white
    style F fill:#2196F3,color:white
```

---

## キーボードアクセシビリティ累計

```mermaid
graph LR
    subgraph "Phase 30"
        Tab[Tab] --> Focus[フォーカス移動]
        Enter[Enter] --> Modal[モーダル表示]
        Space[Space] --> Cycle[シフトサイクル]
    end

    subgraph "Phase 31"
        CtrlZ[Ctrl+Z] --> Undo[アンドゥ]
    end

    subgraph "Phase 32"
        Up[↑] --> MoveUp[上へ移動]
        Down[↓] --> MoveDown[下へ移動]
        Left[←] --> MoveLeft[左へ移動]
        Right[→] --> MoveRight[右へ移動]
    end

    subgraph "Phase 33"
        CtrlShiftZ[Ctrl+Shift+Z] --> Redo[リドゥ]
    end

    style Tab fill:#4CAF50,color:white
    style Enter fill:#4CAF50,color:white
    style Space fill:#4CAF50,color:white
    style CtrlZ fill:#2196F3,color:white
    style Up fill:#FF9800,color:white
    style Down fill:#FF9800,color:white
    style Left fill:#FF9800,color:white
    style Right fill:#FF9800,color:white
    style CtrlShiftZ fill:#9C27B0,color:white
```

---

## Phase 28-33 実装進捗

```mermaid
timeline
    title キーボードアクセシビリティ機能追加

    section Phase 28
    2025-11-25 : ダブルクリック : シフトサイクル

    section Phase 29
    2025-11-25 : モバイルタッチ : ダブルタップ対応

    section Phase 30
    2025-11-25 : キーボード基本 : Tab/Enter/Space

    section Phase 31
    2025-11-25 : アンドゥ機能 : Ctrl+Z

    section Phase 32
    2025-11-25 : 矢印ナビ : ↑↓←→移動

    section Phase 33
    2025-11-25 : リドゥ機能 : Ctrl+Shift+Z
```

---

## テストカバレッジ

```mermaid
pie title E2Eテストケース分布（Phase 28-33）
    "ダブルクリック" : 4
    "モバイルタッチ" : 3
    "キーボード基本" : 4
    "アンドゥ機能" : 4
    "矢印ナビ" : 7
    "リドゥ機能" : 3
```

---

## 関連ドキュメント

- [Phase 33完了記録](./phase33-completion-2025-11-25.md)
- [Phase 33計画](./phase33-plan-2025-11-25.md)
- [Phase 31図表](../undo-functionality/phase31-diagrams-2025-11-25.md)
- [Phase 32図表](../arrow-key-navigation/phase32-diagrams-2025-11-25.md)
