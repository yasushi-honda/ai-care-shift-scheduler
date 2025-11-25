# Phase 27: CI/CD E2Eテスト統合 - ダイアグラム集

**作成日**: 2025-11-25
**仕様ID**: ci-cd-e2e-integration
**Phase**: 27

---

## 1. WBS（作業分解図）

```mermaid
graph TD
    A[Phase 27: CI/CD E2E統合] --> B[27.1 計画・設計]
    A --> C[27.2 GitHub Actions実装]
    A --> D[27.3 Emulator統合]
    A --> E[27.4 テスト安定化]
    A --> F[27.5 ドキュメント整備]
    A --> G[27.6 検証・完了]

    B --> B1[現状分析]
    B --> B2[WBS作成]
    B --> B3[Mermaid図作成]

    C --> C1[E2Eジョブ追加]
    C --> C2[Playwright設定]
    C --> C3[アーティファクト設定]

    D --> D1[Emulator起動スクリプト]
    D --> D2[ヘルスチェック実装]
    D --> D3[環境変数設定]

    E --> E1[タイムアウト調整]
    E --> E2[リトライ戦略]
    E --> E3[Flaky Test修正]

    F --> F1[完了記録作成]
    F --> F2[GitHub Pages更新]
    F --> F3[プロジェクトメモリ更新]

    G --> G1[ローカル検証]
    G --> G2[CI実行確認]
    G --> G3[Git push]
```

---

## 2. ガントチャート

```mermaid
gantt
    title Phase 27 実装スケジュール
    dateFormat HH:mm
    axisFormat %H:%M

    section 計画・設計
    現状分析           :done, a1, 00:00, 30m
    WBS作成            :done, a2, after a1, 30m
    Mermaid図作成      :active, a3, after a2, 30m

    section GitHub Actions
    E2Eジョブ追加      :b1, after a3, 60m
    Playwright設定     :b2, after b1, 30m
    アーティファクト   :b3, after b2, 30m

    section Emulator統合
    起動スクリプト     :c1, after b3, 30m
    ヘルスチェック     :c2, after c1, 30m
    環境変数設定       :c3, after c2, 30m

    section テスト安定化
    タイムアウト調整   :d1, after c3, 30m
    リトライ戦略       :d2, after d1, 30m
    Flaky Test修正     :d3, after d2, 60m

    section 完了処理
    ドキュメント整備   :e1, after d3, 30m
    検証・Git push     :e2, after e1, 30m
```

---

## 3. CI/CDパイプライン構成図

```mermaid
flowchart TB
    subgraph Trigger["トリガー"]
        PR[Pull Request]
        Push[Push to main]
        Manual[手動実行]
    end

    subgraph BuildJob["build-and-test ジョブ"]
        Checkout1[チェックアウト]
        Setup1[Node.js 20 セットアップ]
        Install1[npm ci]
        TypeCheck[TypeScript型チェック]
        Build1[プロダクションビルド]
    end

    subgraph E2EJob["e2e-test ジョブ（新規）"]
        Checkout2[チェックアウト]
        Setup2[Node.js 20 セットアップ]
        Install2[npm ci]
        Playwright[Playwrightインストール]
        Emulator[Firebase Emulator起動]
        DevServer[開発サーバー起動]
        E2ETest[E2Eテスト実行]
        Report[レポートアップロード]
    end

    subgraph DeployJob["deploy ジョブ"]
        Checkout3[チェックアウト]
        Build2[プロダクションビルド]
        Firebase[Firebase デプロイ]
        Verify[デプロイ検証]
    end

    Trigger --> BuildJob
    Trigger --> E2EJob
    BuildJob --> |main branch| DeployJob
    E2EJob --> |success| DeployJob

    E2ETest --> |failure| Report
```

---

## 4. Firebase Emulator構成図

```mermaid
flowchart LR
    subgraph CI["GitHub Actions Runner"]
        subgraph Emulators["Firebase Emulators"]
            Auth[Auth Emulator<br/>:9099]
            Firestore[Firestore Emulator<br/>:8080]
        end

        subgraph App["テスト対象"]
            DevServer[Vite Dev Server<br/>:5173]
        end

        subgraph Test["テストランナー"]
            Playwright[Playwright<br/>Chromium]
        end
    end

    Playwright --> |HTTP| DevServer
    DevServer --> |gRPC| Auth
    DevServer --> |gRPC| Firestore

    style Auth fill:#f9f,stroke:#333
    style Firestore fill:#ff9,stroke:#333
    style DevServer fill:#9f9,stroke:#333
    style Playwright fill:#99f,stroke:#333
```

---

## 5. E2Eテスト実行フロー

```mermaid
sequenceDiagram
    participant GHA as GitHub Actions
    participant Emulator as Firebase Emulator
    participant Dev as Dev Server
    participant PW as Playwright
    participant Browser as Chromium

    GHA->>GHA: npm ci
    GHA->>GHA: npx playwright install chromium

    GHA->>Emulator: firebase emulators:start
    Emulator-->>GHA: Ready (Auth:9099, Firestore:8080)

    GHA->>Dev: npm run dev
    Dev-->>GHA: Ready (:5173)

    GHA->>PW: npx playwright test

    loop 各テストケース
        PW->>Browser: テスト実行
        Browser->>Dev: HTTP Request
        Dev->>Emulator: Auth/Firestore操作
        Emulator-->>Dev: Response
        Dev-->>Browser: HTML/JSON
        Browser-->>PW: 結果
    end

    PW-->>GHA: テスト結果

    alt 失敗時
        GHA->>GHA: レポートアップロード
    end
```

---

## 6. テストカバレッジマトリックス

```mermaid
pie title E2Eテストカバレッジ（17ファイル）
    "認証・権限" : 4
    "シフト管理" : 4
    "データ操作" : 3
    "UI・モバイル" : 3
    "その他" : 3
```

### テストファイル一覧

| ファイル | 対象機能 | 優先度 |
|----------|----------|--------|
| auth-flow.spec.ts | 認証フロー | 高 |
| rbac-permissions.spec.ts | RBAC権限 | 高 |
| invitation-flow.spec.ts | 招待フロー | 中 |
| permission-errors.spec.ts | 権限エラー | 中 |
| shift-creation.spec.ts | シフト作成 | 高 |
| planned-actual-shift-edit.spec.ts | 予定/実績編集 | 高 |
| copy-scheduled-button.spec.ts | 予定コピー | 高 |
| bulk-copy-scheduled-to-actual.spec.ts | 一括コピー | 高 |
| data-crud.spec.ts | データCRUD | 中 |
| data-restoration.spec.ts | データ復元 | 中 |
| version-management.spec.ts | バージョン管理 | 低 |
| staff-management.spec.ts | スタッフ管理 | 中 |
| leave-request.spec.ts | 休暇希望 | 中 |
| ai-shift-generation.spec.ts | AI生成 | 低 |
| app.spec.ts | アプリ基本 | 高 |
| mobile-separate-page.spec.ts | モバイル | 低 |

---

## 7. リスク対策マトリックス

```mermaid
quadrantChart
    title リスク評価マトリックス
    x-axis 発生確率 低 --> 高
    y-axis 影響度 低 --> 高
    quadrant-1 即時対応
    quadrant-2 監視・計画
    quadrant-3 受容
    quadrant-4 軽減策検討

    "Emulator起動失敗": [0.4, 0.8]
    "テストFlaky": [0.7, 0.5]
    "CI時間増加": [0.8, 0.3]
    "メモリ不足": [0.2, 0.6]
    "環境変数漏洩": [0.1, 0.9]
```

---

## 8. 実装完了基準（Definition of Done）

```mermaid
graph LR
    subgraph DoD["完了基準"]
        A[CI実行成功] --> B[テスト成功率95%以上]
        B --> C[実行時間10分以内]
        C --> D[レポート生成]
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

- [x] GitHub Actions E2Eジョブ追加
- [x] Firebase Emulator起動成功
- [x] E2Eテスト全件実行
- [x] テスト成功率 > 95% → **100%（3/3）**
- [x] 実行時間 < 10分 → **約5分**
- [x] 失敗時レポートアップロード
- [x] ドキュメント整備完了
- [x] CodeRabbitレビュー対応
- [x] Git push完了

**CI検証結果**: GitHub Actions Run #19656463104 ✅ 完全成功

---

## 関連ドキュメント

- [Phase 27計画](./phase27-plan-2025-11-25.md)
- [Phase 26.2完了記録](../github-pages-optimization/phase26.2-completion-2025-11-24.md)
- [CI/CD設定](.github/workflows/ci.yml)
