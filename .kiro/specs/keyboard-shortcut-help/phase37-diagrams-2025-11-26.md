# Phase 37: キーボードショートカットヘルプ - 図表

**作成日**: 2025-11-26
**仕様ID**: keyboard-shortcut-help
**Phase**: 37

---

## WBS（作業分解図）

```mermaid
graph TD
    A[Phase 37: キーボードショートカットヘルプ] --> B[37.1 計画・設計]
    A --> C[37.2 コンポーネント実装]
    A --> D[37.3 App.tsx統合]
    A --> E[37.4 E2Eテスト]
    A --> F[37.5 ドキュメント整備]

    B --> B1[現状分析]
    B --> B2[技術設計]
    B --> B3[計画書作成]

    C --> C1[KeyboardHelpModal作成]
    C --> C2[ショートカット一覧定義]
    C --> C3[Escキーで閉じる]

    D --> D1[showKeyboardHelp state追加]
    D --> D2[?キー検出追加]
    D --> D3[モーダルレンダリング]

    E --> E1[?キー表示テスト]
    E --> E2[Escキー閉じるテスト]
    E --> E3[閉じるボタンテスト]
    E --> E4[一覧表示テスト]

    F --> F1[完了記録作成]
    F --> F2[図表作成]
```

---

## ガントチャート

```mermaid
gantt
    title Phase 37 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 計画・設計
    現状分析           :done, a1, 00:00, 5m
    技術設計           :done, a2, after a1, 5m
    計画書作成         :done, a3, after a2, 10m

    section コンポーネント実装
    KeyboardHelpModal  :done, b1, after a3, 15m
    ショートカット定義  :done, b2, after b1, 5m

    section App.tsx統合
    state追加          :done, c1, after b2, 5m
    ?キー検出          :done, c2, after c1, 10m
    モーダルレンダリング :done, c3, after c2, 5m

    section E2Eテスト
    テストケース追加    :done, d1, after c3, 15m

    section ドキュメント
    完了記録・図表     :done, e1, after d1, 15m
    Git push           :active, e2, after e1, 5m
```

---

## コンポーネント構成図

```mermaid
graph TB
    subgraph "App.tsx"
        State[showKeyboardHelp state]
        KeyHandler[グローバルキーイベント]
        Render[JSXレンダリング]
    end

    subgraph "KeyboardHelpModal.tsx"
        Modal[モーダルコンポーネント]
        EscHandler[Escキーハンドラー]
        ShortcutList[ショートカット一覧]
    end

    State --> Render
    KeyHandler -->|"?キー"| State
    Render --> Modal
    Modal --> EscHandler
    Modal --> ShortcutList
    EscHandler -->|"閉じる"| State
```

---

## ユーザーインタラクションフロー

```mermaid
sequenceDiagram
    actor User
    participant App
    participant KeyboardHelpModal
    participant DOM

    Note over User,DOM: ?キーでヘルプ表示
    User->>App: ?キー押下
    App->>App: 入力フィールド確認
    alt フィールド外
        App->>App: setShowKeyboardHelp(true)
        App->>KeyboardHelpModal: isOpen=true
        KeyboardHelpModal->>DOM: モーダル表示
    else 入力フィールド内
        App-->>User: 無視（通常の?入力）
    end

    Note over User,DOM: Escキーで閉じる
    User->>KeyboardHelpModal: Escキー押下
    KeyboardHelpModal->>App: onClose()
    App->>App: setShowKeyboardHelp(false)
    KeyboardHelpModal->>DOM: モーダル非表示
```

---

## ショートカットカテゴリ構成

```mermaid
graph LR
    subgraph "基本操作"
        A1[Tab: フォーカス移動]
        A2[Enter: モーダル表示]
        A3[Space: シフトサイクル]
    end

    subgraph "履歴操作"
        B1[Ctrl+Z: アンドゥ]
        B2[Ctrl+Shift+Z: リドゥ]
    end

    subgraph "セル移動"
        C1[↑↓←→: 1セル移動]
        C2[Home: 1日目へ]
        C3[End: 月末へ]
    end

    subgraph "ジャンプ移動"
        D1[Ctrl+↑: 最初のスタッフ]
        D2[Ctrl+↓: 最後のスタッフ]
        D3[Ctrl+←: 1日目へ]
        D4[Ctrl+→: 月末へ]
    end

    subgraph "週単位移動"
        E1[PageUp: 7日前]
        E2[PageDown: 7日後]
    end

    subgraph "その他"
        F1[?: ヘルプ表示]
        F2[Esc: モーダルを閉じる]
    end
```

---

## Phase 32-37 キーボードナビゲーション実装タイムライン

```mermaid
timeline
    title キーボードナビゲーション実装履歴
    section Phase 32
        2025-11-25 : 矢印キーナビゲーション
                   : ↑↓←→で1セル移動
                   : 計画行/実績行間の移動
    section Phase 34
        2025-11-25 : Home/Endナビゲーション
                   : Homeで1日目へ
                   : Endで月末へ
    section Phase 35
        2025-11-25 : Ctrl+矢印ジャンプ
                   : Ctrl+↑↓でスタッフ移動
                   : Ctrl+←→で日付端へ
    section Phase 36
        2025-11-26 : PageUp/PageDown
                   : PageUpで7日前
                   : PageDownで7日後
    section Phase 37
        2025-11-26 : ショートカットヘルプ
                   : ?キーでヘルプ表示
                   : 全ショートカット一覧
```

---

## E2Eテストカバレッジ

```mermaid
pie title Phase 37 E2Eテストカバレッジ
    "?キー表示" : 1
    "Escキー閉じる" : 1
    "閉じるボタン" : 1
    "一覧表示確認" : 1
```

---

## 関連ドキュメント

- [Phase 37計画](./phase37-plan-2025-11-26.md)
- [Phase 37完了記録](./phase37-completion-2025-11-26.md)
- [Phase 36図表](../pageup-pagedown-navigation/phase36-diagrams-2025-11-26.md)
