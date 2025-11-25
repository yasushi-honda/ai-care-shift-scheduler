# Phase 28: ダブルクリックシフト編集 - ダイアグラム集

**作成日**: 2025-11-25
**仕様ID**: double-click-shift-edit
**Phase**: 28

---

## 1. WBS（作業分解図）

```mermaid
graph TD
    A[Phase 28: ダブルクリック機能] --> B[28.1 計画・設計]
    A --> C[28.2 ShiftTable実装]
    A --> D[28.3 親コンポーネント連携]
    A --> E[28.4 E2Eテスト]
    A --> F[28.5 ドキュメント整備]

    B --> B1[現状分析]
    B --> B2[技術設計]
    B --> B3[WBS作成]

    C --> C1[クリック判定ロジック]
    C --> C2[handleDoubleClick実装]
    C --> C3[シフトサイクル関数]
    C --> C4[タイマークリーンアップ]

    D --> D1[onQuickShiftChange props]
    D --> D2[App.tsx連携]

    E --> E1[ダブルクリックテスト]
    E --> E2[シングルクリックテスト]
    E --> E3[サイクル順序テスト]

    F --> F1[完了記録]
    F --> F2[Mermaid図作成]
```

---

## 2. ガントチャート

```mermaid
gantt
    title Phase 28 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 計画・設計
    現状分析           :done, a1, 00:00, 15m
    技術設計           :done, a2, after a1, 15m
    WBS作成            :done, a3, after a2, 15m

    section ShiftTable実装
    クリック判定ロジック :done, b1, after a3, 30m
    handleDoubleClick   :done, b2, after b1, 20m
    シフトサイクル関数  :done, b3, after b2, 10m
    タイマークリーンアップ :done, b4, after b3, 10m

    section 親コンポーネント連携
    props追加           :done, c1, after b4, 15m
    App.tsx連携         :done, c2, after c1, 20m

    section E2Eテスト
    テスト作成          :done, d1, after c2, 30m
    CodeRabbitレビュー対応 :done, d2, after d1, 20m

    section 完了処理
    ドキュメント整備    :done, e1, after d2, 15m
    Git push            :done, e2, after e1, 5m
```

---

## 3. クリック判定フロー

```mermaid
flowchart TD
    A[セルクリック] --> B{タイマー存在?}
    B -->|Yes| C[タイマークリア]
    C --> D[ダブルクリック処理]
    D --> E[次のシフトタイプ計算]
    E --> F[シフト更新]

    B -->|No| G[タイマーセット 250ms]
    G --> H{タイムアウト?}
    H -->|Yes| I[シングルクリック処理]
    I --> J[モーダル表示]
    H -->|No - 2回目クリック| C

    style D fill:#9f9,stroke:#333
    style J fill:#99f,stroke:#333
```

---

## 4. シフトサイクル図

```mermaid
flowchart LR
    A[早番] --> B[日勤]
    B --> C[遅番]
    C --> D[夜勤]
    D --> E[休]
    E --> F[明け休み]
    F --> A

    style A fill:#87CEEB,stroke:#333
    style B fill:#90EE90,stroke:#333
    style C fill:#FFD700,stroke:#333
    style D fill:#9370DB,stroke:#333
    style E fill:#D3D3D3,stroke:#333
    style F fill:#A9A9A9,stroke:#333
```

---

## 5. コンポーネント連携図

```mermaid
flowchart TB
    subgraph App["App.tsx"]
        A[schedule state]
        B[handleQuickShiftChange]
    end

    subgraph ShiftTable["ShiftTable.tsx"]
        C[handleCellClick]
        D[clickTimerRef]
        E[handleDoubleClick]
        F[openEditModal]
    end

    subgraph UI["UI"]
        G[シフトセル]
        H[編集モーダル]
    end

    G -->|クリック| C
    C -->|タイマー管理| D
    D -->|ダブルクリック検出| E
    D -->|シングルクリック検出| F
    E -->|onQuickShiftChange| B
    F -->|表示| H
    B -->|setState| A
    A -->|schedule props| ShiftTable

    style E fill:#9f9,stroke:#333
    style F fill:#99f,stroke:#333
```

---

## 6. シーケンス図（ダブルクリック）

```mermaid
sequenceDiagram
    participant User
    participant Cell as シフトセル
    participant Timer as clickTimerRef
    participant Handler as handleDoubleClick
    participant App as App.tsx
    participant State as schedule state

    User->>Cell: 1回目クリック
    Cell->>Timer: タイマーセット(250ms)
    User->>Cell: 2回目クリック (250ms以内)
    Cell->>Timer: タイマー存在確認
    Timer-->>Cell: タイマーあり
    Cell->>Timer: タイマークリア
    Cell->>Handler: handleDoubleClick()
    Handler->>Handler: getNextShiftType()
    Handler->>App: onQuickShiftChange(staffId, date, type, newType)
    App->>State: setSchedule()
    State-->>Cell: 再レンダリング
    Cell-->>User: 新しいシフトタイプ表示
```

---

## 7. シーケンス図（シングルクリック）

```mermaid
sequenceDiagram
    participant User
    participant Cell as シフトセル
    participant Timer as clickTimerRef
    participant Modal as ShiftEditConfirmModal

    User->>Cell: クリック
    Cell->>Timer: タイマーセット(250ms)
    Note over Timer: 250ms経過
    Timer-->>Cell: タイムアウト
    Cell->>Cell: openEditModal()
    Cell->>Modal: モーダル表示
    Modal-->>User: 編集画面
```

---

## 8. 実装完了基準（Definition of Done）

```mermaid
graph LR
    subgraph DoD["完了基準"]
        A[TypeScriptエラーなし] --> B[E2Eテスト通過]
        B --> C[CodeRabbitレビュー対応]
        C --> D[CI成功]
        D --> E[ドキュメント完備]
        E --> F[Git push完了]
    end

    style A fill:#9f9
    style B fill:#9f9
    style C fill:#9f9
    style D fill:#9f9
    style E fill:#9f9
    style F fill:#9f9
```

### チェックリスト

- [x] TypeScriptコンパイルエラーなし
- [x] E2Eテスト4件作成
- [x] CI Run #19663689079 成功
- [x] タイマークリーンアップ実装
- [x] CodeRabbitレビュー指摘対応
- [x] 完了ドキュメント作成
- [x] Git push完了

---

## 関連ドキュメント

- [Phase 28計画](./phase28-plan-2025-11-25.md)
- [Phase 28完了記録](./phase28-completion-2025-11-25.md)
- [Phase 27完了記録](../ci-cd-e2e-integration/phase27-completion-2025-11-25.md)
