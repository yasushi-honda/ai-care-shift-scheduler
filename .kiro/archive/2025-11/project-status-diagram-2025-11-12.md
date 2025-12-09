# プロジェクト全体進捗状況 - 視覚化ドキュメント

**更新日**: 2025-11-12
**対象読者**: 将来のAIセッション、新規メンバー、プロジェクトマネージャー
**目的**: プロジェクトの全体像を一目で理解する

---

## ガントチャート: Phase実装進捗状況

```mermaid
gantt
    title AIケアシフトスケジューラー - Phase実装進捗状況
    dateFormat YYYY-MM-DD

    section Phase 0-12.5
    Phase 0: デモ環境整備                :done, p0, 2025-10-23, 2025-10-31
    Phase 1-6: 基本機能実装              :done, p1, 2025-10-23, 2025-10-28
    Phase 7-12.5: シフト管理・E2E        :done, p7, 2025-10-28, 2025-10-31

    section Phase 13-14
    Phase 13: 監査ログ・セキュリティ      :done, p13, 2025-11-01, 1d
    Phase 14: E2Eテスト拡充              :done, p14, 2025-11-02, 1d

    section Phase 15-16
    Phase 15: Gemini JSONパースエラー修正 :done, p15, 2025-11-04, 1d
    Phase 16: CodeRabbit提案対応         :done, p16, 2025-11-05, 7d

    section Phase 17-18
    Phase 17: Permission error修正（5件） :done, p17, 2025-11-12, 10h
    Phase 18: ドキュメント作成            :done, p18, 2025-11-12, 5h
    Phase 18.1: E2Eテスト実装（未着手）  :active, p18_1, 2025-11-13, 4h
    Phase 18.2: 監視設定（未着手）        :p18_2, 2025-11-13, 2h
```

---

## システムアーキテクチャ図（2025-11-12時点）

```mermaid
graph TB
    subgraph "クライアント層"
        A[React SPA<br/>TypeScript + Vite]
        A1[Material-UI]
        A2[Recharts]
        A3[React Router]
    end

    subgraph "Firebase層"
        B[Firebase Authentication<br/>Google認証]
        C[Firestore<br/>10 Collections]
        D[Firebase Hosting<br/>CDN配信]
        E[Cloud Functions<br/>generateShift, onUserDelete]
    end

    subgraph "AI層"
        F[Gemini 2.0 Flash<br/>AIシフト生成]
    end

    subgraph "監視・CI/CD層"
        G[Google Cloud Monitoring<br/>アラート・ログ]
        H[GitHub Actions<br/>CI/CD Pipeline]
        I[CodeRabbit CLI<br/>コードレビュー]
    end

    A --> B
    A --> C
    A --> D
    B --> C
    C --> E
    E --> F
    G --> C
    G --> E
    H --> D
    H --> E
    I --> H

    A -.->|Playwright| A
    H -.->|自動デプロイ| D
    H -.->|自動デプロイ| E
```

---

## データモデル（ER図）

```mermaid
erDiagram
    USERS ||--o{ FACILITIES : "facilities[]"
    USERS {
        string uid PK
        string email
        string displayName
        string role "super-admin/admin/editor/viewer"
        array facilities "facilityId[]"
        timestamp createdAt
    }

    FACILITIES ||--o{ STAFF : "staff subcollection"
    FACILITIES ||--o{ SHIFTS : "shifts subcollection"
    FACILITIES {
        string facilityId PK
        string facilityName
        object settings
        timestamp createdAt
    }

    STAFF {
        string staffId PK
        string name
        array qualifications
        object preferences
        timestamp createdAt
    }

    SHIFTS ||--o{ VERSIONS : "versions subcollection"
    SHIFTS {
        string shiftId PK
        string status "draft/published/archived"
        object data
        timestamp createdAt
    }

    VERSIONS {
        string versionId PK
        number versionNumber
        object data
        timestamp createdAt
    }

    AUDIT_LOGS {
        string logId PK
        string userId
        string action
        string resource
        timestamp createdAt
    }

    SECURITY_ALERTS {
        string alertId PK
        string type
        string severity
        string status
        timestamp createdAt
    }
```

---

## Phase 17: Permission error修正フロー

```mermaid
graph TB
    Start[Phase 17開始<br/>2025-11-12 08:00] --> P17_5[Phase 17.5<br/>versionsサブコレクション<br/>Permission error]
    P17_5 --> Fix1[firestore.rules修正<br/>versionsサブコレクション追加]
    Fix1 --> Deploy1[デプロイ1]

    Deploy1 --> P17_8[Phase 17.8<br/>User Fetch Permission Error]
    P17_8 --> Fix2[firestore.rules修正<br/>users allow get追加]
    Fix2 --> Deploy2[デプロイ2]

    Deploy2 --> P17_9[Phase 17.9<br/>Admin User Detail<br/>Permission Error]
    P17_9 --> Fix3[firestore.rules修正<br/>allow get設計矛盾解消]
    Fix3 --> Deploy3[デプロイ3-5<br/>3回試行]

    Deploy3 --> P17_10[Phase 17.10<br/>onUserDelete<br/>TypeScript error]
    P17_10 --> Fix4[functions/src/onUserDelete.ts修正<br/>nullチェック追加]
    Fix4 --> Deploy4[デプロイ6]

    Deploy4 --> P17_11[Phase 17.11<br/>Security Alerts<br/>Permission Error]
    P17_11 --> Fix5[firestore.rules修正<br/>securityAlertsコレクション追加]
    Fix5 --> Deploy5[デプロイ7]

    Deploy5 --> End[Phase 17完了<br/>2025-11-12 22:00<br/>総工数: 9時間15分]

    style Start fill:#90EE90
    style End fill:#90EE90
    style P17_5 fill:#FFB6C1
    style P17_8 fill:#FFB6C1
    style P17_9 fill:#FFB6C1
    style P17_10 fill:#FFB6C1
    style P17_11 fill:#FFB6C1
```

---

## Phase 18: ドキュメント作成フロー

```mermaid
graph TB
    Start[Phase 18開始<br/>2025-11-12 13:00] --> Context[phase17-18-context.md作成<br/>Phase 17経緯まとめ]
    Context --> Req[phase18-requirements.md作成<br/>要件定義]
    Req --> Design[phase18-design.md作成<br/>技術設計]
    Design --> Diagram[phase18-implementation-plan-diagram.md作成<br/>8 Mermaid図]

    Diagram --> Guide[phase18-implementation-guide.md作成<br/>実装ガイド]
    Guide --> Manual[phase18-test-manual.md作成<br/>テストマニュアル]
    Manual --> Monitor[phase18-monitoring-setup-guide.md作成<br/>監視設定ガイド]
    Monitor --> Trouble[phase18-troubleshooting.md作成<br/>トラブルシューティング]
    Trouble --> README[phase18-README.md作成<br/>ドキュメント索引]

    README --> Commit1[コミット1<br/>Phase 18ドキュメントセット]
    Commit1 --> CodeRabbit[CodeRabbitレビュー<br/>5件指摘]
    CodeRabbit --> Fix[5件すべて修正]
    Fix --> Commit2[コミット2<br/>品質改善]

    Commit2 --> Completion[phase18-documentation-completion作成<br/>振り返りレポート]
    Completion --> Handover[handover-to-next-session作成<br/>引き継ぎメモ]
    Handover --> Status[project-status-diagram作成<br/>全体進捗図]

    Status --> End[Phase 18ドキュメント完了<br/>2025-11-12 18:00<br/>総工数: 5時間]

    style Start fill:#90EE90
    style End fill:#90EE90
    style CodeRabbit fill:#FFD700
    style Fix fill:#87CEEB
```

---

## RBAC権限マトリックス

```mermaid
graph TB
    subgraph "ロール階層"
        SuperAdmin[super-admin<br/>最高権限]
        Admin[admin<br/>施設管理者]
        Editor[editor<br/>編集者]
        Viewer[viewer<br/>閲覧者]
    end

    SuperAdmin --> Admin
    Admin --> Editor
    Editor --> Viewer

    subgraph "権限"
        SuperAdmin -.-> P1[全施設アクセス]
        SuperAdmin -.-> P2[ユーザー管理]
        SuperAdmin -.-> P3[セキュリティアラート]
        SuperAdmin -.-> P4[監査ログ]

        Admin -.-> P5[自施設管理]
        Admin -.-> P6[スタッフ管理]
        Admin -.-> P7[シフト管理]

        Editor -.-> P8[シフト編集]
        Editor -.-> P9[AIシフト生成]

        Viewer -.-> P10[シフト閲覧]
    end

    style SuperAdmin fill:#FF6B6B
    style Admin fill:#FFA07A
    style Editor fill:#FFD700
    style Viewer fill:#87CEEB
```

---

## AIシフト生成フロー

```mermaid
sequenceDiagram
    actor User as 管理者
    participant UI as React UI
    participant CF as Cloud Functions<br/>generateShift
    participant Gemini as Gemini 2.0 Flash
    participant Firestore as Firestore

    User->>UI: シフト生成リクエスト
    UI->>CF: HTTP POST<br/>(スタッフ情報、設定)
    CF->>Gemini: プロンプト生成<br/>+ JSON Schema指定
    Gemini->>Gemini: AIシフト生成<br/>(最適化)
    Gemini-->>CF: JSON形式シフト返却

    alt JSONパース成功
        CF->>Firestore: シフトデータ保存<br/>(/shifts/{id})
        Firestore-->>CF: 保存成功
        CF-->>UI: ✅ シフトデータ返却
        UI->>User: シフト表示
    else JSONパースエラー
        CF->>CF: JSONクリーンアップ処理<br/>(Phase 15で実装)
        CF->>Gemini: リトライ（最大3回）
        Gemini-->>CF: 再生成JSON
        CF->>Firestore: シフトデータ保存
        CF-->>UI: ✅ シフトデータ返却
    end
```

---

## Phase 18実装後の期待される効果

```mermaid
graph LR
    subgraph "Phase 17（現状）"
        A1[Permission error発生] --> A2[ユーザー報告]
        A2 --> A3[バグ調査<br/>1-2時間]
        A3 --> A4[修正実装<br/>1時間]
        A4 --> A5[デプロイ<br/>0.5時間]
        A5 --> A6[検証<br/>0.5時間]
        A6 --> A7{再発？}
        A7 -->|Yes| A1
        A7 -->|No| A8[完了<br/>平均3時間/バグ]
    end

    subgraph "Phase 18実装後（目標）"
        B1[E2Eテスト実行] --> B2{Permission error検出？}
        B2 -->|Yes<br/>80-90%| B3[デプロイ前に修正<br/>1時間以内]
        B3 --> B4[再テスト]
        B4 --> B5[完了]

        B2 -->|No<br/>10-20%| B6[デプロイ]
        B6 --> B7[本番環境]
        B7 --> B8{エラー発生？}
        B8 -->|Yes| B9[監視アラート<br/>即座に通知]
        B9 --> B10[迅速修正<br/>0.5時間]
        B10 --> B5
        B8 -->|No| B5
    end

    style A8 fill:#FFB6C1
    style B5 fill:#90EE90
```

---

## デプロイ回数・成功率

```mermaid
pie title デプロイ成功率（2025-10-23 - 2025-11-12）
    "成功" : 42
    "失敗" : 0
```

---

## Phase別工数分析

```mermaid
graph TB
    subgraph "Phase別工数（時間）"
        P0[Phase 0-12.5<br/>約80時間]
        P13[Phase 13<br/>約8時間]
        P14[Phase 14<br/>約12時間]
        P15[Phase 15<br/>約6時間]
        P16[Phase 16<br/>約20時間]
        P17[Phase 17<br/>約9.25時間]
        P18[Phase 18<br/>約5時間]
    end

    Total[総工数<br/>約140時間]

    P0 --> Total
    P13 --> Total
    P14 --> Total
    P15 --> Total
    P16 --> Total
    P17 --> Total
    P18 --> Total

    style Total fill:#FFD700
```

---

## 開発ワークフロー（GitHub Flow）

```mermaid
graph TB
    Start[開発開始] --> Branch[featureブランチ作成<br/>git checkout -b feature/xxx]
    Branch --> Dev[コード変更]
    Dev --> Commit[git commit]
    Commit --> Review[CodeRabbitレビュー<br/>coderabbit review]
    Review --> Fix{指摘あり？}
    Fix -->|Yes| Dev
    Fix -->|No| Push[git push]
    Push --> PR[Pull Request作成<br/>gh pr create]
    PR --> CI[GitHub Actions CI/CD]
    CI --> Check{CI成功？}
    Check -->|No| Dev
    Check -->|Yes| Merge[mainにマージ<br/>gh pr merge]
    Merge --> Deploy[自動デプロイ<br/>Firebase Hosting + Functions]
    Deploy --> Verify[デプロイ検証]
    Verify --> End[開発完了]

    style Start fill:#90EE90
    style End fill:#90EE90
    style Review fill:#FFD700
    style Deploy fill:#87CEEB
```

---

## 次のセッションの選択肢

```mermaid
graph TB
    Start[次のセッション開始] --> Decision{何をする？}

    Decision -->|オプション1<br/>推奨優先度: 高| P18_1[Phase 18.1実装<br/>Permission error自動検出E2Eテスト]
    P18_1 --> Impl1[ConsoleMonitor実装]
    Impl1 --> Impl2[テスト実装]
    Impl2 --> Impl3[GitHub Actions workflow]
    Impl3 --> End1[Phase 18.1完了<br/>3-4時間]

    Decision -->|オプション2<br/>推奨優先度: 中| P18_2[Phase 18.2実装<br/>監視アラート設定]
    P18_2 --> Mon1[Permission Errorアラート]
    Mon1 --> Mon2[Cloud Functionsアラート]
    Mon2 --> Mon3[通知チャネル設定]
    Mon3 --> End2[Phase 18.2完了<br/>1-2時間]

    Decision -->|オプション3<br/>推奨優先度: 低| Other[他のタスク]
    Other --> End3[Phase 18実装は後回し]

    style Start fill:#90EE90
    style End1 fill:#90EE90
    style End2 fill:#90EE90
    style End3 fill:#FFB6C1
```

---

## タイムライン: リリース計画ロードマップ

```mermaid
timeline
    title プロジェクトリリース計画ロードマップ

    section 完了済み
    2025-10-23 - 2025-10-31 : Phase 0-12.5実装完了
                             : デモ環境整備
                             : 基本機能実装
                             : AIシフト生成
                             : 本番デプロイ

    2025-11-01 - 2025-11-02 : Phase 13-14実装完了
                             : 監査ログ・セキュリティ
                             : E2Eテスト拡充

    2025-11-04 - 2025-11-11 : Phase 15-16実装完了
                             : Gemini JSONパース改善
                             : CodeRabbit提案対応

    2025-11-12 : Phase 17-18完了
                : Permission error修正（5件）
                : ドキュメント作成（9件）

    section 次のステップ
    2025-11-13以降 : Phase 18.1実装（推奨）
                   : E2Eテスト自動化
                   : 監視アラート設定
```

---

## 統計情報サマリー

### ドキュメント統計（2025-11-12時点）

| カテゴリ | 件数 | 行数（推定） |
|---------|------|------------|
| Phase 0-12.5ドキュメント | 約20件 | 約5,000行 |
| Phase 13-16ドキュメント | 約15件 | 約3,000行 |
| Phase 17ドキュメント | 23件 | 約6,000行 |
| Phase 18ドキュメント | 9件 | 約4,194行 |
| 振り返り・引き継ぎ | 3件 | 約2,000行 |
| **合計** | **約70件** | **約20,000行** |

---

### コード統計（2025-11-12時点）

| 種類 | 件数 | 行数（推定） |
|------|------|------------|
| TypeScriptファイル | 約150ファイル | 約20,000行 |
| E2Eテスト | 約30テストケース | 約3,000行 |
| Firestore Security Rules | 1ファイル | 約400行 |
| Cloud Functions | 2関数 | 約500行 |
| **合計** | - | **約23,900行** |

---

### デプロイ統計（2025-10-23 - 2025-11-12）

| Phase | デプロイ回数 | 成功率 |
|-------|------------|--------|
| Phase 0-12.5 | 15回 | 100% |
| Phase 13-14 | 8回 | 100% |
| Phase 15-16 | 10回 | 100% |
| Phase 17-18 | 9回 | 100% |
| **合計** | **42回** | **100%** |

---

## 関連ドキュメント

### 振り返り・引き継ぎ
- `phase18-documentation-completion-2025-11-12.md` - Phase 18ドキュメント作成完了レポート
- `handover-to-next-session-2025-11-12.md` - 次のセッションへの引き継ぎメモ
- `project-status-diagram-2025-11-12.md`（このドキュメント） - 全体進捗図

### Phase 18
- `phase17-18-context.md` - Phase 17の経緯と教訓
- `phase18-README.md` - Phase 18ドキュメント索引
- `phase18-requirements.md` - 要件定義
- `phase18-design.md` - 技術設計
- `phase18-implementation-plan-diagram.md` - 実装計画
- `phase18-implementation-guide.md` - 実装ガイド
- `phase18-test-manual.md` - テスト実行マニュアル
- `phase18-monitoring-setup-guide.md` - 監視設定ガイド
- `phase18-troubleshooting.md` - トラブルシューティング

### Phase 17
- `phase17-summary-2025-11-12.md` - Phase 17総括レポート

### プロジェクト全般
- `CLAUDE.md` - 開発ガイドライン
- `.kiro/steering/` - ステアリングドキュメント
- `.kiro/specs/` - 仕様ドキュメント

---

**ドキュメント作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**最終更新**: 2025-11-12
**ステータス**: Phase 18ドキュメント完成・実装準備完了

---

**End of Project Status Diagram**
