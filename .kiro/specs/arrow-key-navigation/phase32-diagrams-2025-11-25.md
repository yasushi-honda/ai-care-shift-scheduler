# Phase 32: 矢印キーナビゲーション - 図表ドキュメント

**作成日**: 2025-11-25
**仕様ID**: arrow-key-navigation
**Phase**: 32

---

## WBS（作業分解図）

```mermaid
graph TD
    A[Phase 32: 矢印キーナビゲーション] --> B[32.1 計画・設計]
    A --> C[32.2 セル参照管理]
    A --> D[32.3 矢印キーイベント]
    A --> E[32.4 境界処理]
    A --> F[32.5 E2Eテスト]
    A --> G[32.6 ドキュメント整備]

    B --> B1[現状分析]
    B --> B2[技術設計]

    C --> C1[cellRefs実装]
    C --> C2[setCellRef関数]

    D --> D1[handleArrowNavigation実装]
    D --> D2[handleKeyDown拡張]

    E --> E1[境界チェック]
    E --> E2[フォーカス維持]

    F --> F1[矢印キーテスト7件]

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
    title Phase 32 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 計画・設計
    現状分析           :done, a1, 00:00, 5m
    技術設計           :done, a2, after a1, 10m

    section セル参照管理
    cellRefs実装       :done, b1, after a2, 10m
    setCellRef関数     :done, b2, after b1, 5m

    section 矢印キーイベント
    handleArrowNavigation :done, c1, after b2, 15m
    handleKeyDown拡張     :done, c2, after c1, 10m

    section 境界処理
    境界チェック       :done, d1, after c2, 10m

    section E2Eテスト
    矢印キーテスト7件  :done, e1, after d1, 15m

    section 完了処理
    ドキュメント整備   :done, f1, after e1, 10m
    Git push           :active, f2, after f1, 5m
```

---

## グリッドナビゲーション構造

```mermaid
graph TB
    subgraph "スタッフ0"
        P00[予定0-0] --> P01[予定0-1] --> P02[予定0-2] --> P03[...]
        A00[実績0-0] --> A01[実績0-1] --> A02[実績0-2] --> A03[...]
        P00 --> A00
        P01 --> A01
        P02 --> A02
    end

    subgraph "スタッフ1"
        P10[予定1-0] --> P11[予定1-1] --> P12[予定1-2] --> P13[...]
        A10[実績1-0] --> A11[実績1-1] --> A12[実績1-2] --> A13[...]
        P10 --> A10
        P11 --> A11
        P12 --> A12
    end

    A00 --> P10
    A01 --> P11
    A02 --> P12

    style P00 fill:#E3F2FD
    style P01 fill:#E3F2FD
    style P02 fill:#E3F2FD
    style A00 fill:#FFF3E0
    style A01 fill:#FFF3E0
    style A02 fill:#FFF3E0
    style P10 fill:#E3F2FD
    style P11 fill:#E3F2FD
    style P12 fill:#E3F2FD
    style A10 fill:#FFF3E0
    style A11 fill:#FFF3E0
    style A12 fill:#FFF3E0
```

---

## 矢印キー動作フローチャート

```mermaid
flowchart TD
    A[キー入力検出] --> B{矢印キー?}
    B -->|No| C[既存処理へ<br>Enter/Space]
    B -->|Yes| D{どのキー?}

    D -->|ArrowUp| E{type = actual?}
    E -->|Yes| F[planned に変更]
    E -->|No| G{staffIndex > 0?}
    G -->|Yes| H[staffIndex - 1<br>type = actual]
    G -->|No| I[移動なし]

    D -->|ArrowDown| J{type = planned?}
    J -->|Yes| K[actual に変更]
    J -->|No| L{staffIndex < max?}
    L -->|Yes| M[staffIndex + 1<br>type = planned]
    L -->|No| N[移動なし]

    D -->|ArrowLeft| O{dateIndex > 0?}
    O -->|Yes| P[dateIndex - 1]
    O -->|No| Q[移動なし]

    D -->|ArrowRight| R{dateIndex < max?}
    R -->|Yes| S[dateIndex + 1]
    R -->|No| T[移動なし]

    F --> U[新しいキー生成]
    H --> U
    K --> U
    M --> U
    P --> U
    S --> U

    U --> V{セル存在?}
    V -->|Yes| W[フォーカス移動]
    V -->|No| X[移動なし]

    style A fill:#4CAF50,color:white
    style W fill:#2196F3,color:white
```

---

## セル参照管理シーケンス

```mermaid
sequenceDiagram
    participant R as React Render
    participant C as cellRefs Map
    participant D as DOM

    R->>D: <td ref={el => setCellRef(key, el)}>
    D->>C: setCellRef("0-0-planned", element)
    C->>C: Map.set("0-0-planned", element)

    Note over R,D: ユーザーがArrowRightを押す

    R->>C: cellRefs.current.get("0-1-planned")
    C-->>R: HTMLTableCellElement
    R->>D: element.focus()

    Note over R,D: コンポーネントアンマウント時

    R->>D: ref callback with null
    D->>C: setCellRef("0-0-planned", null)
    C->>C: Map.delete("0-0-planned")
```

---

## キーボード操作マトリックス

```mermaid
graph LR
    subgraph "Phase 30: 既存"
        Tab[Tab] --> Focus[フォーカス移動]
        Enter[Enter] --> Modal[モーダル表示]
        Space[Space] --> Cycle[シフトサイクル]
    end

    subgraph "Phase 31: 追加"
        CtrlZ[Ctrl+Z] --> Undo[アンドゥ]
    end

    subgraph "Phase 32: 追加"
        Up[↑] --> MoveUp[上へ移動]
        Down[↓] --> MoveDown[下へ移動]
        Left[←] --> MoveLeft[左へ移動]
        Right[→] --> MoveRight[右へ移動]
    end

    style Tab fill:#4CAF50,color:white
    style Enter fill:#4CAF50,color:white
    style Space fill:#4CAF50,color:white
    style CtrlZ fill:#2196F3,color:white
    style Up fill:#FF9800,color:white
    style Down fill:#FF9800,color:white
    style Left fill:#FF9800,color:white
    style Right fill:#FF9800,color:white
```

---

## Phase 28-32 キーボードアクセシビリティ進捗

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
```

---

## テストカバレッジ

```mermaid
pie title E2Eテストケース分布（Phase 28-32）
    "ダブルクリック" : 4
    "モバイルタッチ" : 3
    "キーボード基本" : 4
    "アンドゥ機能" : 4
    "矢印ナビ" : 7
```

---

## 関連ドキュメント

- [Phase 32完了記録](./phase32-completion-2025-11-25.md)
- [Phase 32計画](./phase32-plan-2025-11-25.md)
- [Phase 31図表](../undo-functionality/phase31-diagrams-2025-11-25.md)
