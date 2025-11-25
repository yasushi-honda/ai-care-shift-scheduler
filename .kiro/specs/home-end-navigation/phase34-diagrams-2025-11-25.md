# Phase 34: Home/Endキーナビゲーション - 図表ドキュメント

**作成日**: 2025-11-25
**仕様ID**: home-end-navigation
**Phase**: 34

---

## WBS（作業分解図）

```mermaid
graph TD
    A[Phase 34: Home/Endナビゲーション] --> B[34.1 計画・設計]
    A --> C[34.2 Home/End実装]
    A --> D[34.3 E2Eテスト]
    A --> E[34.4 ドキュメント整備]

    B --> B1[現状分析]
    B --> B2[技術設計]

    C --> C1[handleArrowNavigation拡張]
    C --> C2[handleKeyDown拡張]

    D --> D1[Home/Endテスト3件]

    E --> E1[完了記録]
    E --> E2[図表ドキュメント]

    style A fill:#4CAF50,color:white
    style B fill:#2196F3,color:white
    style C fill:#2196F3,color:white
    style D fill:#2196F3,color:white
    style E fill:#2196F3,color:white
```

---

## ガントチャート

```mermaid
gantt
    title Phase 34 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 計画・設計
    現状分析           :done, a1, 00:00, 5m
    技術設計           :done, a2, after a1, 5m

    section 実装
    handleArrowNavigation拡張 :done, b1, after a2, 10m
    handleKeyDown拡張         :done, b2, after b1, 5m

    section E2Eテスト
    Home/Endテスト3件  :done, c1, after b2, 10m

    section 完了処理
    ドキュメント整備   :done, d1, after c1, 10m
    Git push           :active, d2, after d1, 5m
```

---

## Home/Endナビゲーション動作フロー

```mermaid
flowchart TD
    A[キー入力検出] --> B{Home/Endキー?}
    B -->|No| C[既存処理へ<br>矢印キー/Enter/Space]
    B -->|Yes| D{どのキー?}

    D -->|Home| E[newDateIndex = 0]
    D -->|End| F[newDateIndex = totalDates - 1]

    E --> G[新しいキー生成]
    F --> G

    G --> H{セル存在?}
    H -->|Yes| I[フォーカス移動]
    H -->|No| J[移動なし]

    style A fill:#4CAF50,color:white
    style I fill:#2196F3,color:white
    style E fill:#FF9800,color:white
    style F fill:#FF9800,color:white
```

---

## キーボード操作マトリックス（Phase 28-34）

```mermaid
graph LR
    subgraph "Phase 30: 基本操作"
        Tab[Tab] --> Focus[フォーカス移動]
        Enter[Enter] --> Modal[モーダル表示]
        Space[Space] --> Cycle[シフトサイクル]
    end

    subgraph "Phase 31: 履歴操作"
        CtrlZ[Ctrl+Z] --> Undo[アンドゥ]
    end

    subgraph "Phase 32: 矢印ナビ"
        Up[↑] --> MoveUp[上へ移動]
        Down[↓] --> MoveDown[下へ移動]
        Left[←] --> MoveLeft[左へ移動]
        Right[→] --> MoveRight[右へ移動]
    end

    subgraph "Phase 33: リドゥ"
        CtrlShiftZ[Ctrl+Shift+Z] --> Redo[リドゥ]
    end

    subgraph "Phase 34: 行端移動"
        Home[Home] --> MoveStart[1日目へ]
        End[End] --> MoveEnd[月末へ]
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
    style Home fill:#E91E63,color:white
    style End fill:#E91E63,color:white
```

---

## グリッドナビゲーション全体像

```mermaid
graph TB
    subgraph "スタッフ0の行"
        direction LR
        H0[Home] -.-> P00[予定0-0<br>1日目]
        P00 --> P01[予定0-1] --> P02[...] --> P0N[予定0-N<br>月末]
        P0N -.-> E0[End]

        A00[実績0-0<br>1日目] --> A01[実績0-1] --> A02[...] --> A0N[実績0-N<br>月末]
    end

    subgraph "縦移動"
        P00 --> A00
        A00 --> P10[次スタッフ予定]
    end

    style H0 fill:#E91E63,color:white
    style E0 fill:#E91E63,color:white
    style P00 fill:#E3F2FD
    style P0N fill:#E3F2FD
    style A00 fill:#FFF3E0
    style A0N fill:#FFF3E0
```

---

## Phase 28-34 キーボードアクセシビリティ進捗

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

    section Phase 34
    2025-11-25 : 行端ナビ : Home/End移動
```

---

## テストカバレッジ

```mermaid
pie title E2Eテストケース分布（Phase 28-34）
    "ダブルクリック" : 4
    "モバイルタッチ" : 3
    "キーボード基本" : 4
    "アンドゥ機能" : 4
    "矢印ナビ" : 7
    "リドゥ機能" : 3
    "Home/End" : 3
```

---

## シーケンス図：Home/End操作

```mermaid
sequenceDiagram
    participant U as User
    participant K as KeyboardEvent
    participant H as handleKeyDown
    participant N as handleArrowNavigation
    participant R as cellRefs
    participant D as DOM

    U->>K: Homeキー押下
    K->>H: onKeyDown(event)
    H->>H: key === 'Home'?
    H->>N: handleArrowNavigation()
    N->>N: newDateIndex = 0
    N->>N: newKey = "0-0-planned"
    N->>R: cellRefs.get(newKey)
    R-->>N: HTMLTableCellElement
    N->>D: element.focus()
    D-->>U: 1日目セルにフォーカス
```

---

## 関連ドキュメント

- [Phase 34完了記録](./phase34-completion-2025-11-25.md)
- [Phase 34計画](./phase34-plan-2025-11-25.md)
- [Phase 32図表](../arrow-key-navigation/phase32-diagrams-2025-11-25.md)
- [Phase 33図表](../redo-functionality/phase33-diagrams-2025-11-25.md)
