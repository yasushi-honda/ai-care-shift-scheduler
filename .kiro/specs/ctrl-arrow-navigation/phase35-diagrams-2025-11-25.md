# Phase 35: Ctrl+矢印キーナビゲーション - 図表ドキュメント

**作成日**: 2025-11-25
**仕様ID**: ctrl-arrow-navigation
**Phase**: 35

---

## WBS（作業分解図）

```mermaid
graph TD
    A[Phase 35: Ctrl+矢印ナビゲーション] --> B[35.1 計画・設計]
    A --> C[35.2 Ctrl修飾キー実装]
    A --> D[35.3 E2Eテスト]
    A --> E[35.4 ドキュメント整備]

    B --> B1[現状分析]
    B --> B2[技術設計]

    C --> C1[Ctrl+矢印判定追加]
    C --> C2[ジャンプ処理実装]

    D --> D1[Ctrl+矢印テスト4件]

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
    title Phase 35 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 計画・設計
    現状分析           :done, a1, 00:00, 5m
    技術設計           :done, a2, after a1, 5m

    section 実装
    Ctrl修飾キー判定   :done, b1, after a2, 10m
    ジャンプ処理       :done, b2, after b1, 10m

    section E2Eテスト
    Ctrl+矢印テスト4件 :done, c1, after b2, 15m

    section 完了処理
    ドキュメント整備   :done, d1, after c1, 10m
    Git push           :active, d2, after d1, 5m
```

---

## Ctrl+矢印ナビゲーション動作フロー

```mermaid
flowchart TD
    A[キー入力検出] --> B{Ctrl押下?}
    B -->|No| C[通常矢印処理<br>Phase 32]
    B -->|Yes| D{矢印キー?}

    D -->|ArrowUp| E[staffIndex = 0<br>type = planned]
    D -->|ArrowDown| F[staffIndex = max<br>type = actual]
    D -->|ArrowLeft| G[dateIndex = 0]
    D -->|ArrowRight| H[dateIndex = max]

    E --> I[新しいキー生成]
    F --> I
    G --> I
    H --> I

    I --> J{セル存在?}
    J -->|Yes| K[フォーカス移動]
    J -->|No| L[移動なし]

    style A fill:#4CAF50,color:white
    style K fill:#2196F3,color:white
    style E fill:#9C27B0,color:white
    style F fill:#9C27B0,color:white
    style G fill:#9C27B0,color:white
    style H fill:#9C27B0,color:white
```

---

## キーボード操作マトリックス（Phase 28-35）

```mermaid
graph LR
    subgraph "Phase 30: 基本操作"
        Tab[Tab] --> Focus[フォーカス移動]
        Enter[Enter] --> Modal[モーダル表示]
        Space[Space] --> Cycle[シフトサイクル]
    end

    subgraph "Phase 31-33: 履歴操作"
        CtrlZ[Ctrl+Z] --> Undo[アンドゥ]
        CtrlShiftZ[Ctrl+Shift+Z] --> Redo[リドゥ]
    end

    subgraph "Phase 32: 矢印ナビ"
        Up[↑] --> MoveUp[上へ移動]
        Down[↓] --> MoveDown[下へ移動]
        Left[←] --> MoveLeft[左へ移動]
        Right[→] --> MoveRight[右へ移動]
    end

    subgraph "Phase 34: 行端移動"
        Home[Home] --> MoveStart[1日目へ]
        End[End] --> MoveEnd[月末へ]
    end

    subgraph "Phase 35: ジャンプ移動"
        CtrlUp[Ctrl+↑] --> JumpTop[最初のスタッフへ]
        CtrlDown[Ctrl+↓] --> JumpBottom[最後のスタッフへ]
        CtrlLeft[Ctrl+←] --> JumpStart[1日目へ]
        CtrlRight[Ctrl+→] --> JumpEnd[月末へ]
    end

    style Tab fill:#4CAF50,color:white
    style CtrlZ fill:#2196F3,color:white
    style CtrlShiftZ fill:#2196F3,color:white
    style Up fill:#FF9800,color:white
    style Home fill:#E91E63,color:white
    style End fill:#E91E63,color:white
    style CtrlUp fill:#9C27B0,color:white
    style CtrlDown fill:#9C27B0,color:white
    style CtrlLeft fill:#9C27B0,color:white
    style CtrlRight fill:#9C27B0,color:white
```

---

## グリッドナビゲーション全体像

```mermaid
graph TB
    subgraph "ジャンプ移動範囲"
        direction TB
        CU[Ctrl+↑] -.-> S0[スタッフ0<br>予定行]
        S0 --> S1[スタッフ1]
        S1 --> S2[...]
        S2 --> SN[スタッフN<br>実績行]
        SN -.-> CD[Ctrl+↓]
    end

    subgraph "水平ジャンプ"
        direction LR
        CL[Ctrl+←] -.-> D0[1日目]
        D0 --> D1[2日目]
        D1 --> D2[...]
        D2 --> DN[月末]
        DN -.-> CR[Ctrl+→]
    end

    style CU fill:#9C27B0,color:white
    style CD fill:#9C27B0,color:white
    style CL fill:#9C27B0,color:white
    style CR fill:#9C27B0,color:white
    style S0 fill:#E3F2FD
    style SN fill:#FFF3E0
    style D0 fill:#E3F2FD
    style DN fill:#FFF3E0
```

---

## Phase 28-35 キーボードアクセシビリティ進捗

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

    section Phase 35
    2025-11-25 : ジャンプナビ : Ctrl+矢印
```

---

## テストカバレッジ

```mermaid
pie title E2Eテストケース分布（Phase 28-35）
    "ダブルクリック" : 4
    "モバイルタッチ" : 3
    "キーボード基本" : 4
    "アンドゥ機能" : 4
    "矢印ナビ" : 7
    "リドゥ機能" : 3
    "Home/End" : 3
    "Ctrl+矢印" : 4
```

---

## シーケンス図：Ctrl+矢印操作

```mermaid
sequenceDiagram
    participant U as User
    participant K as KeyboardEvent
    participant H as handleKeyDown
    participant N as handleArrowNavigation
    participant R as cellRefs
    participant D as DOM

    U->>K: Ctrl+ArrowUp押下
    K->>H: onKeyDown(event)
    H->>H: key in arrow keys?
    H->>N: handleArrowNavigation()
    N->>N: ctrlKey = true?
    N->>N: staffIndex = 0
    N->>N: type = 'planned'
    N->>N: newKey = "0-X-planned"
    N->>R: cellRefs.get(newKey)
    R-->>N: HTMLTableCellElement
    N->>D: element.focus()
    D-->>U: 最初のスタッフにフォーカス
```

---

## 関連ドキュメント

- [Phase 35完了記録](./phase35-completion-2025-11-25.md)
- [Phase 35計画](./phase35-plan-2025-11-25.md)
- [Phase 32図表](../arrow-key-navigation/phase32-diagrams-2025-11-25.md)
- [Phase 34図表](../home-end-navigation/phase34-diagrams-2025-11-25.md)
