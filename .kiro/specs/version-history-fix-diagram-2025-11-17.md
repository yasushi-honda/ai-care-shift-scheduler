# バージョン履歴修正 - 視覚的ドキュメント

**更新日**: 2025-11-17
**種類**: 技術設計図・フローチャート
**関連**: [version-history-fix-2025-11-17.md](./version-history-fix-2025-11-17.md)

---

## 📊 システムアーキテクチャ図

### Firestoreデータ構造（修正後）

```mermaid
graph TB
    subgraph "Firestore - /facilities/{facilityId}"
        S[schedules/]

        subgraph "2025-01のスケジュール"
            S1["{scheduleId_2025-01}"]
            S1 --> S1_TM["targetMonth: '2025-01'"]
            S1 --> S1_V["version: 3"]
            S1 --> S1_ST["status: 'confirmed'"]
            S1 --> S1_SS["staffSchedules: [...]"]

            S1 --> V1[versions/]
            V1 --> V1_1["1: version 1の履歴"]
            V1 --> V1_2["2: version 2の履歴"]
        end

        subgraph "2025-02のスケジュール"
            S2["{scheduleId_2025-02}"]
            S2 --> S2_TM["targetMonth: '2025-02'"]
            S2 --> S2_V["version: 2"]
            S2 --> S2_ST["status: 'draft'"]
            S2 --> S2_SS["staffSchedules: [...]"]

            S2 --> V2[versions/]
            V2 --> V2_1["1: version 1の履歴"]
        end
    end

    style S1 fill:#d4f1d4
    style S2 fill:#d4e9f7
    style V1_1 fill:#fff9c4
    style V1_2 fill:#fff9c4
    style V2_1 fill:#fff9c4
```

---

## 🔄 修正前後の処理フロー比較

### 修正前（問題のあるフロー）

```mermaid
sequenceDiagram
    participant User
    participant UI as App.tsx
    participant API as ScheduleService
    participant DB as Firestore

    Note over User,DB: 1回目のAI生成
    User->>UI: シフト作成実行ボタン押下
    UI->>API: saveSchedule()
    API->>DB: addDoc() → scheduleId_A作成
    DB-->>API: scheduleId_A
    API-->>UI: 成功
    UI->>UI: currentScheduleId = scheduleId_A

    Note over User,DB: 確定
    User->>UI: 確定ボタン押下
    UI->>API: confirmSchedule(scheduleId_A)
    API->>DB: /schedules/scheduleId_A/versions/1 作成
    API->>DB: scheduleId_A: version=2, status=confirmed
    DB-->>API: 成功

    Note over User,DB: 2回目のAI生成 ← 問題箇所
    User->>UI: シフト作成実行ボタン再押下
    UI->>API: saveSchedule() ❌ 常に新規作成
    API->>DB: addDoc() → scheduleId_B作成 ❌
    DB-->>API: scheduleId_B
    API-->>UI: 成功
    UI->>UI: currentScheduleId = scheduleId_B ❌

    Note over User,DB: 結果：履歴が見えなくなる
    User->>UI: バージョン履歴ボタン押下
    UI->>API: getVersionHistory(scheduleId_B)
    API->>DB: /schedules/scheduleId_B/versions/ 取得
    DB-->>API: 空配列 ❌（scheduleId_Bには履歴なし）
    API-->>UI: []
    UI-->>User: 履歴なしと表示 ❌

    rect rgb(255, 200, 200)
        Note over User,DB: scheduleId_A/versions/1 は残っているが<br/>UIからアクセス不可
    end
```

### 修正後（正しいフロー）

```mermaid
sequenceDiagram
    participant User
    participant UI as App.tsx
    participant API as ScheduleService
    participant DB as Firestore

    Note over User,DB: 1回目のAI生成
    User->>UI: シフト作成実行ボタン押下
    UI->>UI: currentScheduleId === null?
    UI->>API: saveSchedule() ✅ 初回は新規作成
    API->>DB: addDoc() → scheduleId_A作成
    DB-->>API: scheduleId_A
    API-->>UI: 成功
    UI->>UI: currentScheduleId = scheduleId_A

    Note over User,DB: 確定
    User->>UI: 確定ボタン押下
    UI->>API: confirmSchedule(scheduleId_A)
    API->>DB: /schedules/scheduleId_A/versions/1 作成
    API->>DB: scheduleId_A: version=2, status=confirmed
    DB-->>API: 成功

    Note over User,DB: 2回目のAI生成 ← 修正箇所
    User->>UI: シフト作成実行ボタン再押下
    UI->>UI: currentScheduleId === scheduleId_A? ✅
    UI->>API: updateSchedule(scheduleId_A) ✅ 更新を使用
    API->>DB: updateDoc(scheduleId_A) ✅ 既存ドキュメント更新
    DB-->>API: 成功
    API-->>UI: 成功
    UI->>UI: currentScheduleId = scheduleId_A ✅ 維持

    Note over User,DB: 結果：履歴が保持される
    User->>UI: バージョン履歴ボタン押下
    UI->>API: getVersionHistory(scheduleId_A)
    API->>DB: /schedules/scheduleId_A/versions/ 取得
    DB-->>API: [version 1] ✅ 履歴が保持されている
    API-->>UI: [version 1]
    UI-->>User: version 1を表示 ✅

    rect rgb(200, 255, 200)
        Note over User,DB: scheduleId_A を維持することで<br/>バージョン履歴が保持される
    end
```

---

## 🔀 条件分岐フロー（修正後）

```mermaid
flowchart TD
    Start([AIシフト生成ボタン押下]) --> CheckSchedule{currentScheduleId<br/>が存在する?}

    CheckSchedule -->|No<br/>初回生成| SaveNew[saveSchedule<br/>新規スケジュール作成]
    SaveNew --> SetId1[currentScheduleId = 新しいID]
    SetId1 --> Success1[成功メッセージ:<br/>生成し、保存しました]

    CheckSchedule -->|Yes<br/>既存あり| UpdateExisting[updateSchedule<br/>既存スケジュール更新]
    UpdateExisting --> KeepId[currentScheduleId 維持]
    KeepId --> Success2[成功メッセージ:<br/>生成し、更新しました]

    Success1 --> ShowShift[シフト表を表示]
    Success2 --> ShowShift

    ShowShift --> End([完了])

    style CheckSchedule fill:#fff3cd
    style SaveNew fill:#d4f1d4
    style UpdateExisting fill:#d4e9f7
    style KeepId fill:#d4e9f7,stroke:#0066cc,stroke-width:3px

    Note1[修正のポイント:<br/>既存スケジュールがある場合は<br/>updateSchedule を使用]
    style Note1 fill:#ffe6e6
```

---

## 📅 バージョン履歴のライフサイクル

```mermaid
stateDiagram-v2
    [*] --> Draft1: 初回AI生成<br/>(saveSchedule)

    state "version: 1<br/>status: draft" as Draft1
    state "version: 2<br/>status: confirmed" as Confirmed2
    state "version: 2<br/>status: draft" as Draft2
    state "version: 3<br/>status: confirmed" as Confirmed3

    Draft1 --> Confirmed2: 確定ボタン押下<br/>(confirmSchedule)<br/>→ versions/1 作成

    Confirmed2 --> Draft2: 2回目AI生成<br/>(updateSchedule) ✅

    note right of Draft2
        修正のポイント:
        updateSchedule を使用することで
        version: 2 を維持
        versions/1 も保持
    end note

    Draft2 --> Confirmed3: 再度確定<br/>(confirmSchedule)<br/>→ versions/2 作成

    Confirmed3 --> [*]

    state "versions サブコレクション" as Versions {
        V1: version 1<br/>(初回確定時の内容)
        V2: version 2<br/>(2回目確定時の内容)
    }

    Confirmed2 --> V1: 作成
    Confirmed3 --> V2: 作成
```

---

## 🔄 対象月切り替え時の動作

```mermaid
graph LR
    subgraph "ユーザー操作"
        U1[対象月: 2025-01 選択]
        U2[対象月: 2025-02 に変更]
        U3[対象月: 2025-01 に戻す]
    end

    subgraph "App.tsx - useEffect"
        E1[subscribeToSchedules<br/>targetMonth='2025-01']
        E2[subscribeToSchedules<br/>targetMonth='2025-02']
        E3[subscribeToSchedules<br/>targetMonth='2025-01']
    end

    subgraph "Firestore"
        F1[scheduleId_2025-01<br/>取得]
        F2[scheduleId_2025-02<br/>取得]
        F3[scheduleId_2025-01<br/>取得]
    end

    subgraph "State更新"
        S1[currentScheduleId<br/>= scheduleId_2025-01]
        S2[currentScheduleId<br/>= scheduleId_2025-02]
        S3[currentScheduleId<br/>= scheduleId_2025-01]
    end

    U1 --> E1 --> F1 --> S1
    U2 --> E2 --> F2 --> S2
    U3 --> E3 --> F3 --> S3

    S1 -.-> VH1[バージョン履歴:<br/>2025-01の履歴のみ]
    S2 -.-> VH2[バージョン履歴:<br/>2025-02の履歴のみ]
    S3 -.-> VH3[バージョン履歴:<br/>2025-01の履歴のみ]

    style S1 fill:#d4f1d4
    style S2 fill:#d4e9f7
    style S3 fill:#d4f1d4
```

---

## 🧪 テストシナリオフロー

```mermaid
graph TD
    Start([テスト開始]) --> T1[Step 1: 初回AI生成]
    T1 --> T1V{スケジュール作成?}
    T1V -->|Yes| T2[Step 2: 確定ボタン押下]
    T1V -->|No| Fail1[❌ テスト失敗]

    T2 --> T2V{version 1作成?}
    T2V -->|Yes| T3[Step 3: 2回目AI生成<br/>同じ月]
    T2V -->|No| Fail2[❌ テスト失敗]

    T3 --> T3V{version 1保持?}
    T3V -->|Yes| Pass1[✅ 重要チェック通過]
    T3V -->|No| Fail3[❌ テスト失敗<br/>これが今回修正した問題]

    Pass1 --> T4[Step 4: 再度確定]
    T4 --> T4V{version 1 & 2<br/>両方存在?}
    T4V -->|Yes| T5[Step 5: version 1に復元]
    T4V -->|No| Fail4[❌ テスト失敗]

    T5 --> T5V{復元成功?<br/>version 3作成?}
    T5V -->|Yes| Success[✅ 全テスト成功]
    T5V -->|No| Fail5[❌ テスト失敗]

    Success --> End([テスト完了])
    Fail1 --> End
    Fail2 --> End
    Fail3 --> End
    Fail4 --> End
    Fail5 --> End

    style T3V fill:#fff3cd,stroke:#ff9800,stroke-width:3px
    style Pass1 fill:#d4f1d4,stroke:#4caf50,stroke-width:3px
    style Fail3 fill:#ffcccc,stroke:#f44336,stroke-width:3px
    style Success fill:#c8e6c9
```

---

## 🔑 コード修正の核心部分

### 修正箇所の詳細フロー

```mermaid
flowchart TD
    subgraph "handleGenerateClick (修正後)"
        A1[AI生成実行] --> A2{currentScheduleId?}

        A2 -->|null| B1[saveSchedule 実行]
        B1 --> B2[version: 1<br/>status: draft<br/>で新規作成]

        A2 -->|存在| C1[updateSchedule 実行]
        C1 --> C2[staffSchedules 更新<br/>status: draft に戻す<br/>version 維持]

        B2 --> D1[成功メッセージ]
        C2 --> D2[成功メッセージ]

        D1 --> E[シフト表表示]
        D2 --> E
    end

    subgraph "依存配列の更新"
        Deps["[staffList, requirements, ...,<br/>currentScheduleId, ...]"]
    end

    style A2 fill:#fff3cd
    style C1 fill:#d4e9f7,stroke:#0066cc,stroke-width:3px
    style C2 fill:#d4e9f7
```

---

## 📊 影響範囲マップ

```mermaid
graph TB
    subgraph "修正したファイル"
        F1[App.tsx<br/>handleGenerateClick]
        F2[App.tsx<br/>handleGenerateDemo]
    end

    subgraph "影響を受ける機能"
        U1[AIシフト生成]
        U2[デモシフト生成]
        U3[バージョン履歴表示]
    end

    subgraph "影響を受けない機能"
        N1[スタッフ管理]
        N2[休暇希望管理]
        N3[認証・アクセス制御]
        N4[CSV/PDFエクスポート]
    end

    subgraph "使用するAPI"
        API1[ScheduleService.saveSchedule]
        API2[ScheduleService.updateSchedule]
        API3[ScheduleService.confirmSchedule]
        API4[ScheduleService.getVersionHistory]
    end

    F1 --> U1
    F2 --> U2
    U1 --> U3
    U2 --> U3

    F1 -.既存.-> API1
    F1 -.新規使用.-> API2
    F2 -.既存.-> API1
    F2 -.新規使用.-> API2

    U3 --> API4

    style F1 fill:#ffe6e6
    style F2 fill:#ffe6e6
    style API2 fill:#d4e9f7,stroke:#0066cc,stroke-width:3px
    style U3 fill:#d4f1d4
```

---

## 🎯 修正のビフォーアフター比較

### データフロー比較

```mermaid
graph LR
    subgraph "修正前"
        A1[AI生成1] --> A2[scheduleId_A作成]
        A2 --> A3[確定]
        A3 --> A4[versions/1作成]
        A4 --> A5[AI生成2]
        A5 --> A6[scheduleId_B作成 ❌]
        A6 --> A7[versions/ 空 ❌]
    end

    subgraph "修正後"
        B1[AI生成1] --> B2[scheduleId_A作成]
        B2 --> B3[確定]
        B3 --> B4[versions/1作成]
        B4 --> B5[AI生成2]
        B5 --> B6[scheduleId_A更新 ✅]
        B6 --> B7[versions/1保持 ✅]
        B7 --> B8[再確定]
        B8 --> B9[versions/2作成 ✅]
    end

    style A6 fill:#ffcccc
    style A7 fill:#ffcccc
    style B6 fill:#d4f1d4
    style B7 fill:#d4f1d4
    style B9 fill:#d4f1d4
```

---

## 📈 タイムライン：修正作業の流れ

```mermaid
timeline
    title バージョン履歴修正作業タイムライン（2025-11-17）

    section 調査
    問題特定 : 根本原因分析
            : saveSchedule が常に新規作成していることを発見

    section 設計
    修正方針決定 : currentScheduleId で条件分岐
               : updateSchedule 使用を決定

    section 実装
    App.tsx修正 : handleGenerateClick 修正
              : handleGenerateDemo 修正

    section テスト
    型チェック : TypeScript型チェック成功
    ユニットテスト : scheduleService 40/40成功
    専用テスト : version-history-preservation 7/7成功

    section ドキュメント
    テストガイド作成 : 手動テストガイド作成
    修正サマリー作成 : 技術ドキュメント作成
    Mermaid図作成 : 視覚的ドキュメント作成
```

---

## 🔗 関連ドキュメントリンク

| ドキュメント | 用途 | パス |
|------------|------|------|
| **修正サマリー** | 詳細な説明 | [version-history-fix-2025-11-17.md](./version-history-fix-2025-11-17.md) |
| **手動テストガイド** | テスト手順 | [version-history-manual-test-guide.md](./../testing/version-history-manual-test-guide.md) |
| **自動テスト** | テストコード | [version-history-preservation.test.ts](../../src/__tests__/version-history-preservation.test.ts) |
| **ScheduleService** | API実装 | [scheduleService.ts](../../src/services/scheduleService.ts) |
| **型定義** | データ構造 | [types.ts](../../types.ts) |

---

**作成日**: 2025-11-17
**目的**: 将来のAIセッション・新規メンバーが即座に理解できるよう視覚化
