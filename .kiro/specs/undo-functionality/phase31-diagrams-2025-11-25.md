# Phase 31: アンドゥ機能 - ダイアグラム集

**作成日**: 2025-11-25
**仕様ID**: undo-functionality
**Phase**: 31

---

## 1. WBS（作業分解図）

```mermaid
graph TD
    A[Phase 31: アンドゥ機能] --> B[31.1 計画・設計]
    A --> C[31.2 Toast拡張]
    A --> D[31.3 アンドゥ履歴]
    A --> E[31.4 キーボードショートカット]
    A --> F[31.5 E2Eテスト]
    A --> G[31.6 ドキュメント整備]

    B --> B1[現状分析]
    B --> B2[技術設計]
    B --> B3[計画書作成]

    C --> C1[Toast型拡張]
    C --> C2[showWithAction追加]
    C --> C3[アクションボタンUI]

    D --> D1[履歴スタック実装]
    D --> D2[handleUndo実装]
    D --> D3[handleQuickShiftChange更新]

    E --> E1[useEffect追加]
    E --> E2[Ctrl/Cmd+Z対応]
    E --> E3[入力フィールド除外]

    F --> F1[トースト表示テスト]
    F --> F2[元に戻すボタンテスト]
    F --> F3[Ctrl+Zテスト]

    G --> G1[完了記録]
    G --> G2[ダイアグラム]
```

---

## 2. ガントチャート

```mermaid
gantt
    title Phase 31 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 計画・設計
    現状分析           :done, a1, 00:00, 10m
    技術設計           :done, a2, after a1, 10m
    計画書作成         :done, a3, after a2, 10m

    section Toast拡張
    Toast型拡張        :done, b1, after a3, 10m
    showWithAction追加 :done, b2, after b1, 10m
    アクションボタンUI :done, b3, after b2, 15m

    section アンドゥ履歴
    履歴スタック実装   :done, c1, after b3, 15m
    handleUndo実装     :done, c2, after c1, 10m
    handleQuickShiftChange更新 :done, c3, after c2, 15m

    section キーボード
    useEffect追加      :done, d1, after c3, 10m
    Ctrl/Cmd+Z対応     :done, d2, after d1, 10m

    section E2Eテスト
    テスト作成         :done, e1, after d2, 20m

    section 完了処理
    ドキュメント整備   :done, f1, after e1, 15m
    Git push           :f2, after f1, 5m
```

---

## 3. アンドゥ処理フロー

```mermaid
flowchart TD
    A[シフト変更操作] --> B[現在の値を取得]
    B --> C[履歴エントリ作成]
    C --> D[履歴スタックに追加<br/>最大10件]
    D --> E[シフト値を更新]
    E --> F[アクション付きトースト表示]
    F --> G{ユーザー操作}

    G -->|元に戻すクリック| H[履歴から値を復元]
    G -->|Ctrl+Z| H
    G -->|何もしない| I[トースト自動消去]

    H --> J[シフト値を復元]
    J --> K[履歴から削除]
    K --> L[成功トースト表示]

    style A fill:#9f9,stroke:#333
    style H fill:#ff9,stroke:#333
    style L fill:#99f,stroke:#333
```

---

## 4. 履歴スタック構造

```mermaid
graph TB
    subgraph Stack[履歴スタック - LIFO]
        direction TB
        E1[Entry 10 - 最新]
        E2[Entry 9]
        E3[Entry 8]
        E4[...]
        E5[Entry 1 - 最古]
    end

    subgraph Entry[ShiftHistoryEntry]
        F1[staffId: string]
        F2[date: string]
        F3[type: planned/actual]
        F4[previousValue: Partial&lt;GeneratedShift&gt;]
        F5[timestamp: number]
    end

    E1 --> Entry

    style E1 fill:#ff9,stroke:#333
    style Entry fill:#9f9,stroke:#333
```

---

## 5. トースト拡張構造

```mermaid
graph LR
    subgraph Toast[Toast型]
        T1[id: string]
        T2[message: string]
        T3[type: success/error/...]
        T4[duration?: number]
        T5[isExiting?: boolean]
        T6[action?: ToastAction]
    end

    subgraph Action[ToastAction]
        A1[label: string]
        A2[onClick: function]
    end

    T6 --> Action

    style T6 fill:#ff9,stroke:#333
    style Action fill:#9f9,stroke:#333
```

---

## 6. キーボードショートカット処理

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant DOM as DOM
    participant App as App.tsx
    participant Stack as 履歴スタック
    participant Schedule as スケジュール

    User->>DOM: Ctrl+Z / Cmd+Z
    DOM->>App: keydown event
    App->>App: activeElement確認
    alt 入力フィールドにフォーカス
        App->>App: 処理スキップ
    else その他の要素
        App->>Stack: 最新エントリ取得
        Stack-->>App: lastEntry
        App->>Schedule: 値を復元
        App->>Stack: エントリ削除
        App->>User: 成功トースト表示
    end
```

---

## 7. E2Eテスト構成

```mermaid
graph LR
    subgraph Tests[Phase 31 テストケース]
        T1[トースト通知表示]
        T2[元に戻すボタン表示]
        T3[元に戻すボタンクリック]
        T4[Ctrl+Zアンドゥ]
    end

    T1 --> R1[✅ Pass]
    T2 --> R2[✅ Pass]
    T3 --> R3[✅ Pass]
    T4 --> R4[✅ Pass]

    style T1 fill:#9f9,stroke:#333
    style T2 fill:#9f9,stroke:#333
    style T3 fill:#9f9,stroke:#333
    style T4 fill:#9f9,stroke:#333
```

---

## 8. Phase 28-31 実装進捗

```mermaid
timeline
    title Phase 28-31 実装タイムライン
    section Phase 28
        ダブルクリック : シフトサイクル切り替え
        シングルクリック : モーダル表示
    section Phase 29
        タッチ対応 : touch-action: manipulation
        ダブルタップ : シフトサイクル
    section Phase 30
        キーボード : Tab/Enter/Space
        ARIA属性 : アクセシビリティ
    section Phase 31
        アンドゥ : 元に戻す機能
        Ctrl+Z : キーボードショートカット
```

---

## 9. 完了基準チェックリスト

```mermaid
graph LR
    subgraph DoD[完了基準]
        A[変更取り消し機能] --> B[元に戻すボタン]
        B --> C[Ctrl+Z対応]
        C --> D[複数回アンドゥ]
        D --> E[E2Eテスト追加]
        E --> F[TypeScriptエラーなし]
        F --> G[Git push完了]
    end

    style A fill:#9f9
    style B fill:#9f9
    style C fill:#9f9
    style D fill:#9f9
    style E fill:#9f9
    style F fill:#9f9
    style G fill:#ff9
```

### チェックリスト

- [x] 履歴スタック実装（最大10件）
- [x] handleUndo関数実装
- [x] showWithAction追加
- [x] トーストUIにアクションボタン追加
- [x] Ctrl+Z / Cmd+Z対応
- [x] 入力フィールドフォーカス時の除外処理
- [x] E2Eテスト4件追加
- [x] TypeScriptコンパイル成功
- [ ] Git push完了

---

## 関連ドキュメント

- [Phase 31計画](./phase31-plan-2025-11-25.md)
- [Phase 31完了記録](./phase31-completion-2025-11-25.md)
- [Phase 30ダイアグラム](../keyboard-accessibility/phase30-plan-2025-11-25.md)
