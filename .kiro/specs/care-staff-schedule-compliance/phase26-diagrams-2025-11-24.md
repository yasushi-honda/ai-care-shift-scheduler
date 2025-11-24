# Phase 26 ダイアグラム集

**作成日**: 2025-11-24
**仕様ID**: care-staff-schedule-compliance
**Phase**: 26 - E2Eテスト追加とモバイル最適化

## 目的

Phase 26の全体像、システム構成、データフロー、テスト設計を視覚化し、GitHub Pagesで共有可能な形式で整備する。

---

## 1. Phase 26 WBS（作業分解図）

```mermaid
graph TB
    Phase26[Phase 26: E2Eテスト追加・モバイル最適化]

    Phase26 --> Task1[Task 1: E2Eテスト設計]
    Phase26 --> Task2[Task 2: E2Eテスト実装]
    Phase26 --> Task3[Task 3: モバイル最適化]
    Phase26 --> Task4[Task 4: ドキュメント更新]

    Task1 --> Task1_1[1.1 テストケース洗い出し]
    Task1 --> Task1_2[1.2 テストデータ設計]
    Task1 --> Task1_3[1.3 既存E2Eパターン調査]

    Task2 --> Task2_1[2.1 改善1テスト実装<br/>予定と同じボタン]
    Task2 --> Task2_2[2.2 改善2テスト実装<br/>一括コピー機能]
    Task2 --> Task2_3[2.3 テスト実行・検証]

    Task3 --> Task3_1[3.1 レスポンシブデザイン改善<br/>375px-767px対応]
    Task3 --> Task3_2[3.2 タッチ操作最適化<br/>スワイプ・ロングタップ]
    Task3 --> Task3_3[3.3 モバイルブラウザ検証<br/>iOS/Android]

    Task4 --> Task4_1[4.1 Phase 26完了記録作成]
    Task4 --> Task4_2[4.2 GitHub Pages更新]
    Task4 --> Task4_3[4.3 メモリファイル更新]

    style Phase26 fill:#e1f5ff
    style Task1 fill:#fff4e6
    style Task2 fill:#fff4e6
    style Task3 fill:#fff4e6
    style Task4 fill:#fff4e6
    style Task2_1 fill:#e8f5e9
    style Task2_2 fill:#e8f5e9
    style Task2_3 fill:#e8f5e9
    style Task3_1 fill:#f3e5f5
    style Task3_2 fill:#f3e5f5
    style Task3_3 fill:#f3e5f5
```

---

## 2. Phase 26 ガントチャート（実装スケジュール）

```mermaid
gantt
    title Phase 26 実装スケジュール
    dateFormat YYYY-MM-DD

    section Phase 26.1: E2Eテスト
    Task 1: E2Eテスト設計          :t1, 2025-11-24, 1h
    Task 2.1: 改善1テスト実装      :t2_1, after t1, 1.5h
    Task 2.2: 改善2テスト実装      :t2_2, after t2_1, 1.5h
    Task 2.3: テスト実行・検証     :t2_3, after t2_2, 1h

    section Phase 26.2: モバイル最適化
    Task 3.1: レスポンシブ改善     :t3_1, 2025-11-25, 2d
    Task 3.2: タッチ操作最適化     :t3_2, after t3_1, 2d
    Task 3.3: モバイル検証         :t3_3, after t3_2, 1d

    section ドキュメント
    Task 4: ドキュメント更新       :t4, after t2_3, 1h

    section Git & Deploy
    Git commit & push              :milestone, after t4, 0h
```

---

## 3. E2Eテストアーキテクチャ

```mermaid
graph TB
    subgraph "テスト環境"
        Playwright[Playwright Test Runner]
        Browser1[Chromium]
        Browser2[Firefox]
        Browser3[WebKit]
    end

    subgraph "アプリケーション"
        DevServer[Development Server<br/>localhost:5173]
        React[React SPA]
        Firebase[Firebase Emulator<br/>Auth + Firestore]
    end

    subgraph "テストスイート"
        TC1[TC1: 予定と同じボタン<br/>copy-scheduled-button.spec.ts]
        TC2[TC2: 一括コピー機能<br/>bulk-copy-scheduled-to-actual.spec.ts]
    end

    Playwright --> Browser1
    Playwright --> Browser2
    Playwright --> Browser3

    Browser1 --> DevServer
    Browser2 --> DevServer
    Browser3 --> DevServer

    DevServer --> React
    React --> Firebase

    TC1 --> Playwright
    TC2 --> Playwright

    style Playwright fill:#e1f5ff
    style DevServer fill:#fff4e6
    style TC1 fill:#e8f5e9
    style TC2 fill:#e8f5e9
```

---

## 4. E2Eテストフロー（改善1: 予定と同じボタン）

```mermaid
sequenceDiagram
    actor Tester as E2Eテスト
    participant Browser as ブラウザ
    participant UI as ScheduleView
    participant Button as CopyScheduledButton
    participant Firestore as Firestore

    Tester->>Browser: テスト開始
    Browser->>UI: /schedule ページを開く
    UI->>Firestore: 予定シフトを取得
    Firestore-->>UI: 予定シフトデータ
    UI->>UI: シフト表を表示

    Tester->>Button: 「予定と同じ」ボタンをクリック
    Button->>Firestore: 実績シフトを作成<br/>(copiedFrom: 'scheduled')
    Firestore-->>Button: 作成成功

    Button->>UI: 成功トースト表示
    UI-->>Browser: 「コピーが完了しました」

    Tester->>Browser: トースト表示を確認
    Browser-->>Tester: ✅ テストパス
```

---

## 5. E2Eテストフロー（改善2: 一括コピー機能）

```mermaid
sequenceDiagram
    actor Tester as E2Eテスト
    participant Browser as ブラウザ
    participant UI as ScheduleView
    participant Modal as BulkCopyModal
    participant Service as actualShifts.ts
    participant Firestore as Firestore

    Tester->>Browser: テスト開始
    Browser->>UI: /schedule ページを開く
    Tester->>UI: 「一括コピー」ボタンをクリック
    UI->>Modal: モーダルを開く

    Tester->>Modal: スタッフ選択（staff-001, staff-002）
    Tester->>Modal: 日付範囲入力（2025-11-01 ~ 2025-11-07）
    Tester->>Modal: 「実行」ボタンをクリック

    Modal->>Service: bulkCopyScheduledToActual()
    Service->>Firestore: 予定シフトを取得（staff-001, 2025-11-01~07）
    Firestore-->>Service: 予定シフトデータ
    Service->>Firestore: WriteBatch実行（実績シフト作成）
    Firestore-->>Service: 作成成功

    Service->>Firestore: 予定シフトを取得（staff-002, 2025-11-01~07）
    Firestore-->>Service: 予定シフトデータ
    Service->>Firestore: WriteBatch実行（実績シフト作成）
    Firestore-->>Service: 作成成功

    Service-->>Modal: 完了
    Modal->>UI: 成功トースト表示
    UI-->>Browser: 「コピーが完了しました」

    Tester->>Browser: トースト表示を確認
    Browser-->>Tester: ✅ テストパス
```

---

## 6. モバイル最適化の対象デバイス

```mermaid
graph LR
    subgraph "スマートフォン（375px-767px）"
        iPhone["iPhone SE<br/>375 x 667"]
        Android["Android (小)<br/>360 x 640"]
    end

    subgraph "タブレット（768px-1023px）"
        iPad["iPad<br/>768 x 1024"]
        AndroidTab["Android Tablet<br/>800 x 1280"]
    end

    subgraph "デスクトップ（1024px-）"
        Desktop["Desktop<br/>1920 x 1080"]
    end

    iPhone --> Responsive[レスポンシブデザイン]
    Android --> Responsive
    iPad --> Responsive
    AndroidTab --> Responsive
    Desktop --> Responsive

    Responsive --> Touch[タッチ操作最適化]
    Responsive --> Layout[レイアウト最適化]
    Responsive --> Font[フォントサイズ最適化]

    style iPhone fill:#e8f5e9
    style Android fill:#e8f5e9
    style iPad fill:#fff4e6
    style AndroidTab fill:#fff4e6
    style Desktop fill:#e1f5ff
```

---

## 7. レスポンシブデザインのブレークポイント

```mermaid
graph TB
    subgraph "モバイルファースト設計"
        Mobile["モバイル<br/>375px - 767px"]
        Tablet["タブレット<br/>768px - 1023px"]
        Desktop["デスクトップ<br/>1024px -"]
    end

    Mobile --> Mobile_1["1列レイアウト"]
    Mobile --> Mobile_2["縦スクロール"]
    Mobile --> Mobile_3["44x44px タッチターゲット"]

    Tablet --> Tablet_1["2列レイアウト"]
    Tablet --> Tablet_2["サイドバー表示"]
    Tablet --> Tablet_3["40x40px タッチターゲット"]

    Desktop --> Desktop_1["3列レイアウト"]
    Desktop --> Desktop_2["フルナビゲーション"]
    Desktop --> Desktop_3["マウス操作最適化"]

    style Mobile fill:#e8f5e9
    style Tablet fill:#fff4e6
    style Desktop fill:#e1f5ff
```

---

## 8. CI/CDパイプライン（Phase 26対応）

```mermaid
graph LR
    subgraph "開発フロー"
        Dev[コード変更]
        Commit[git commit]
        Review[CodeRabbit Review]
        Push[git push]
    end

    subgraph "GitHub Actions"
        Trigger[Push トリガー]
        Lint[Lint & Type Check]
        UnitTest[Unit Test]
        E2ETest[E2E Test<br/>NEW!]
        Lighthouse[Lighthouse CI]
        Build[Build]
        Deploy[Firebase Deploy]
        GHPages[GitHub Pages Deploy]
    end

    Dev --> Commit
    Commit --> Review
    Review --> Push
    Push --> Trigger

    Trigger --> Lint
    Lint --> UnitTest
    UnitTest --> E2ETest
    E2ETest --> Lighthouse
    Lighthouse --> Build
    Build --> Deploy
    Deploy --> GHPages

    E2ETest --> Success{成功?}
    Success -->|Yes| Lighthouse
    Success -->|No| Fail[Deploy中止]

    style E2ETest fill:#e8f5e9
    style Fail fill:#ffebee
    style Deploy fill:#e1f5ff
    style GHPages fill:#fff4e6
```

---

## 9. Phase 26完了の定義（DoD）

```mermaid
graph TB
    DoD[Phase 26 完了の定義]

    DoD --> Test[テスト]
    DoD --> Mobile[モバイル最適化]
    DoD --> Doc[ドキュメント]
    DoD --> Git[Git & Deploy]

    Test --> Test1[✅ TC1-1~TC1-5パス]
    Test --> Test2[✅ TC2-1~TC2-8パス]
    Test --> Test3[✅ CI/CD組み込み]
    Test --> Test4[✅ テスト時間 < 5分]

    Mobile --> Mobile1[✅ iPhone SE対応]
    Mobile --> Mobile2[✅ iPad対応]
    Mobile --> Mobile3[✅ Lighthouse > 90点]
    Mobile --> Mobile4[✅ 実機検証完了]

    Doc --> Doc1[✅ Phase 26完了記録]
    Doc --> Doc2[✅ GitHub Pages更新]
    Doc --> Doc3[✅ メモリファイル更新]

    Git --> Git1[✅ コミット規約準拠]
    Git --> Git2[✅ CodeRabbitレビュー]
    Git --> Git3[✅ CI/CD成功]
    Git --> Git4[✅ mainマージ]

    style DoD fill:#e1f5ff
    style Test fill:#e8f5e9
    style Mobile fill:#fff4e6
    style Doc fill:#f3e5f5
    style Git fill:#ffe0b2
```

---

## 10. プロジェクトロードマップ（Phase 25-27）

```mermaid
timeline
    title プロジェクトロードマップ（Phase 25-27）

    section 完了済み（2025年11月）
    Phase 25.1: 改善1「予定と同じ」ボタン
              : 2025-11-23完了
              : 50%削減（50分→25分）

    Phase 25.2: 改善2 一括コピー機能
              : 2025-11-24完了
              : 86%削減（50分→7分）

    Phase 25.3: GitHub Pagesドキュメント
              : 2025-11-24完了
              : Mermaid図12個、ズーム機能

    section 進行中（2025年11月）
    Phase 26.1: E2Eテスト追加
              : 2025-11-24開始
              : 改善1・2の自動テスト

    Phase 26.2: モバイル最適化
              : 2025-11-25開始予定
              : レスポンシブ・タッチ操作

    section 計画中（2025年12月）
    Phase 27: 改善3 ダブルクリック
            : セルダブルクリックでコピー
            : パフォーマンス改善
```

---

## 11. テストカバレッジ目標

```mermaid
graph TB
    Coverage[テストカバレッジ目標]

    Coverage --> Current[現状: Phase 25]
    Coverage --> Target[目標: Phase 26]

    Current --> Current1[E2Eテスト: 0%<br/>改善1・2テストなし]
    Current --> Current2[ユニットテスト: 30%<br/>基本機能のみ]

    Target --> Target1[E2Eテスト: 80%<br/>改善1・2・3カバー]
    Target --> Target2[ユニットテスト: 50%<br/>主要コンポーネント]

    Target1 --> E2E1[改善1: 5テストケース]
    Target1 --> E2E2[改善2: 8テストケース]
    Target1 --> E2E3[改善3: 3テストケース<br/>Phase 27]

    style Current1 fill:#ffebee
    style Target1 fill:#e8f5e9
    style E2E1 fill:#e8f5e9
    style E2E2 fill:#e8f5e9
```

---

## 使用方法

### GitHub Pagesへの追加

1. **technical.htmlに追加**:
   ```html
   <h2>Phase 26: E2Eテスト追加・モバイル最適化</h2>
   <h3>WBS（作業分解図）</h3>
   <div class="mermaid">
   <!-- 上記のWBS図をコピー -->
   </div>
   ```

2. **index.htmlに追加**:
   ```html
   <h3>Phase 26の進捗</h3>
   <div class="mermaid">
   <!-- 上記のガントチャート図をコピー -->
   </div>
   ```

### ローカルでのプレビュー

```bash
# Mermaid CLIでプレビュー
npx @mermaid-js/mermaid-cli -i phase26-diagrams-2025-11-24.md -o phase26-diagrams.html
```

---

## 関連ドキュメント

- [Phase 26実装計画](./phase26-plan-2025-11-24.md)
- [Phase 25完了記録](./phase25-2.5-completion-2025-11-24.md)
- [GitHub Pages](https://yasushi-honda.github.io/ai-care-shift-scheduler/)
