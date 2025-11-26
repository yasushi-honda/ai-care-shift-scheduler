# Phase 38: シフトタイプ設定UI - 図表

**作成日**: 2025-11-26
**仕様ID**: shift-type-settings
**Phase**: 38

---

## WBS（作業分解図）

```mermaid
graph TD
    A[Phase 38: シフトタイプ設定UI] --> B[38.1 型定義]
    A --> C[38.2 Service層]
    A --> D[38.3 UI実装]
    A --> E[38.4 統合]
    A --> F[38.5 テスト]

    B --> B1[ShiftColor型]
    B --> B2[ShiftTypeConfig型]
    B --> B3[FacilityShiftSettings型]
    B --> B4[constants定数追加]

    C --> C1[getSettings]
    C --> C2[saveSettings]
    C --> C3[subscribeToSettings]

    D --> D1[ShiftTypeSettings]
    D --> D2[シフト一覧表示]
    D --> D3[編集モーダル]
    D --> D4[色選択]
    D --> D5[サイクル順序]

    E --> E1[ShiftTable統合]
    E --> E2[App.tsx統合]
    E --> E3[Firestoreルール]

    F --> F1[E2Eテスト]
```

---

## ガントチャート

```mermaid
gantt
    title Phase 38 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 基盤
    型定義追加           :done, a1, 00:00, 30m
    constants追加        :done, a2, after a1, 15m

    section Service
    ShiftTypeService     :b1, after a2, 2h

    section UI
    ShiftTypeSettings    :c1, after b1, 2h
    編集モーダル         :c2, after c1, 1h

    section 統合
    ShiftTable統合       :d1, after c2, 1h30m
    App.tsx統合          :d2, after d1, 30m

    section 完了処理
    Firestoreルール      :e1, after d2, 30m
    E2Eテスト            :e2, after e1, 1h
    Git commit           :milestone, m1, after e2, 0m
```

---

## データフロー図

```mermaid
sequenceDiagram
    actor User
    participant UI as ShiftTypeSettings
    participant Service as ShiftTypeService
    participant Firestore

    Note over User,Firestore: 初期化フロー
    UI->>Service: getSettings(facilityId)
    Service->>Firestore: getDoc(shiftSettings/default)
    alt 設定あり
        Firestore-->>Service: FacilityShiftSettings
    else 設定なし
        Service->>Firestore: setDoc(DEFAULT_SHIFT_TYPES)
        Firestore-->>Service: 作成完了
    end
    Service-->>UI: FacilityShiftSettings

    Note over User,Firestore: 編集フロー
    User->>UI: シフト種別を編集
    UI->>UI: 編集モーダル表示
    User->>UI: 保存ボタン
    UI->>Service: saveSettings(settings, userId)
    Service->>Firestore: setDoc(merge: true)
    Firestore-->>Service: 保存完了
    Service-->>UI: Result<void>

    Note over User,Firestore: リアルタイム更新
    Firestore->>Service: onSnapshot
    Service->>UI: callback(settings)
    UI->>UI: 再レンダリング
```

---

## コンポーネント構成図

```mermaid
graph TB
    subgraph "App.tsx"
        AppState[shiftSettings state]
        Subscribe[ShiftTypeService.subscribe]
    end

    subgraph "ShiftTypeSettings.tsx"
        List[シフト種別一覧]
        AddBtn[追加ボタン]
        Editor[編集モーダル]
        CycleEditor[サイクル順序]
    end

    subgraph "ShiftTable.tsx"
        DynamicCycle[動的SHIFT_CYCLE]
        DynamicColor[動的getShiftColor]
    end

    subgraph "Firestore"
        ShiftSettings[shiftSettings/default]
    end

    AppState --> List
    AppState --> DynamicCycle
    AppState --> DynamicColor
    Subscribe --> ShiftSettings
    ShiftSettings --> Subscribe
    List --> Editor
    AddBtn --> Editor
    Editor --> AppState
```

---

## ER図（データモデル）

```mermaid
erDiagram
    FACILITY ||--o{ SHIFT_SETTINGS : has
    SHIFT_SETTINGS ||--|{ SHIFT_TYPE_CONFIG : contains

    FACILITY {
        string id PK
        string name
    }

    SHIFT_SETTINGS {
        string facilityId FK
        array shiftTypes
        array defaultShiftCycle
        timestamp updatedAt
        string updatedBy
    }

    SHIFT_TYPE_CONFIG {
        string id PK
        string name
        string start
        string end
        number restHours
        object color
        boolean isActive
        number sortOrder
    }
```

---

## UIモックアップ

```
┌─────────────────────────────────────────────────────────────┐
│ ▼ シフト種別設定                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [■] 早番    07:00 - 16:00   休憩 1h        [編集] ✓  │  │
│  │ [■] 日勤    09:00 - 18:00   休憩 1h        [編集] ✓  │  │
│  │ [■] 遅番    11:00 - 20:00   休憩 1h        [編集] ✓  │  │
│  │ [■] 夜勤    16:00 - 09:00   休憩 2h        [編集] ✓  │  │
│  │ [■] 休      --:-- - --:--   休憩 0h        [編集] ✓  │  │
│  │ [■] 明け休み --:-- - --:--   休憩 0h        [編集] ✓  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [+ 新しいシフト種別を追加]                                  │
│                                                             │
│  ───────────────────────────────────────────────────────── │
│                                                             │
│  シフトサイクル順序（ダブルクリック時）:                      │
│  [早番] → [日勤] → [遅番] → [夜勤] → [休] → [明け休み]       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

編集モーダル:
┌─────────────────────────────────────────┐
│ シフト種別を編集                 [×]    │
├─────────────────────────────────────────┤
│                                         │
│ シフト名                                │
│ ┌─────────────────────────────────────┐ │
│ │ 早番                                │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 開始時間          終了時間              │
│ ┌──────────┐      ┌──────────┐         │
│ │ 07:00    │      │ 16:00    │         │
│ └──────────┘      └──────────┘         │
│                                         │
│ 休憩時間                                │
│ ┌──────────┐ 時間                       │
│ │ 1        │                           │
│ └──────────┘                           │
│                                         │
│ 表示色                                  │
│ ○ sky  ● emerald  ○ amber  ○ indigo   │
│ ○ slate  ○ rose  ○ violet              │
│                                         │
│ プレビュー: [早番]                       │
│                                         │
│ ☑ 有効にする                            │
│                                         │
├─────────────────────────────────────────┤
│ [削除]              [キャンセル] [保存]  │
└─────────────────────────────────────────┘
```

---

## 関連ドキュメント

- [要件定義書](./requirements.md)
- [設計書](./design.md)
- [タスク一覧](./tasks.md)
