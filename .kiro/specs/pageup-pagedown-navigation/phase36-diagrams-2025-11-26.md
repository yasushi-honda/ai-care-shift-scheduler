# Phase 36: PageUp/PageDown週単位ナビゲーション - 図表ドキュメント

**作成日**: 2025-11-26
**仕様ID**: pageup-pagedown-navigation
**Phase**: 36

---

## WBS（作業分解図）

```mermaid
graph TD
    A[Phase 36: PageUp/PageDownナビゲーション] --> B[36.1 計画・設計]
    A --> C[36.2 PageUp/PageDown実装]
    A --> D[36.3 E2Eテスト]
    A --> E[36.4 ドキュメント整備]

    B --> B1[現状分析]
    B --> B2[技術設計]

    C --> C1[handleArrowNavigation拡張]
    C --> C2[handleKeyDown拡張]

    D --> D1[PageUp/PageDownテスト3件]

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
    title Phase 36 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 計画・設計
    現状分析           :done, a1, 00:00, 5m
    技術設計           :done, a2, after a1, 5m

    section 実装
    handleArrowNavigation拡張 :done, b1, after a2, 10m
    handleKeyDown拡張         :done, b2, after b1, 5m

    section E2Eテスト
    PageUp/PageDownテスト3件 :done, c1, after b2, 10m

    section 完了処理
    ドキュメント整備   :done, d1, after c1, 10m
    Git push           :active, d2, after d1, 5m
```

---

## PageUp/PageDown動作フロー

```mermaid
flowchart TD
    A[キー入力検出] --> B{PageUp/PageDown?}
    B -->|No| C[他のナビゲーション処理]
    B -->|Yes| D{どのキー?}

    D -->|PageUp| E[newDateIndex = max(0, dateIndex - 7)]
    D -->|PageDown| F[newDateIndex = min(totalDates-1, dateIndex + 7)]

    E --> G[新しいキー生成]
    F --> G

    G --> H{セル存在?}
    H -->|Yes| I[フォーカス移動]
    H -->|No| J[移動なし]

    style A fill:#4CAF50,color:white
    style I fill:#2196F3,color:white
    style E fill:#673AB7,color:white
    style F fill:#673AB7,color:white
```

---

## キーボード操作マトリックス（Phase 28-36）

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
    end

    subgraph "Phase 36: 週単位移動"
        PageUp[PageUp] --> Week7Back[7日前へ]
        PageDown[PageDown] --> Week7Forward[7日後へ]
    end

    style Tab fill:#4CAF50,color:white
    style CtrlZ fill:#2196F3,color:white
    style Up fill:#FF9800,color:white
    style Home fill:#E91E63,color:white
    style CtrlUp fill:#9C27B0,color:white
    style PageUp fill:#673AB7,color:white
    style PageDown fill:#673AB7,color:white
```

---

## 週単位移動イメージ

```mermaid
graph LR
    subgraph "1週目"
        D1[1日] --> D2[2日] --> D3[3日] --> D4[4日] --> D5[5日] --> D6[6日] --> D7[7日]
    end

    subgraph "2週目"
        D8[8日] --> D9[9日] --> D10[10日] --> D11[11日] --> D12[12日] --> D13[13日] --> D14[14日]
    end

    subgraph "3週目"
        D15[15日] --> D16[16日] --> D17[...] --> D21[21日]
    end

    D14 -.->|PageUp| D7
    D7 -.->|PageDown| D14
    D21 -.->|PageUp| D14

    style D7 fill:#673AB7,color:white
    style D14 fill:#673AB7,color:white
    style D21 fill:#673AB7,color:white
```

---

## Phase 28-36 キーボードアクセシビリティ進捗

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

    section Phase 36
    2025-11-26 : 週単位ナビ : PageUp/PageDown
```

---

## テストカバレッジ

```mermaid
pie title E2Eテストケース分布（Phase 28-36）
    "ダブルクリック" : 4
    "モバイルタッチ" : 3
    "キーボード基本" : 4
    "アンドゥ機能" : 4
    "矢印ナビ" : 7
    "リドゥ機能" : 3
    "Home/End" : 3
    "Ctrl+矢印" : 4
    "PageUp/Down" : 3
```

---

## 関連ドキュメント

- [Phase 36完了記録](./phase36-completion-2025-11-26.md)
- [Phase 36計画](./phase36-plan-2025-11-26.md)
- [Phase 34図表](../home-end-navigation/phase34-diagrams-2025-11-25.md)
- [Phase 35図表](../ctrl-arrow-navigation/phase35-diagrams-2025-11-25.md)
