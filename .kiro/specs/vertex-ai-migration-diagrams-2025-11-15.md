# Vertex AI Region Migration - Mermaid図版集

**作成日**: 2025年11月15日
**目的**: セッション全体像の視覚化
**関連**: [セッションサマリー](./vertex-ai-migration-session-summary-2025-11-15.md)

このドキュメントは、Vertex AI Region Migrationの全体像をMermaid図で表現します。

詳細なテキスト情報は[セッションサマリー](./vertex-ai-migration-session-summary-2025-11-15.md)を参照してください。

---

## 1. セッション全体フロー（ガントチャート）

```mermaid
gantt
    title Vertex AI Region Migration セッション進行状況
    dateFormat HH:mm
    axisFormat %H:%M

    section Phase 1: 現状確認
    現状確認・調査           :done, p1, 09:00, 10m

    section Phase 2: 移行計画
    Web調査（地域対応確認）  :done, p2, 09:10, 15m
    移行計画策定             :done, p2-2, 09:25, 5m

    section Phase 3: コード変更
    shift-generation.ts修正   :done, p3, 09:30, 10m
    phased-generation.ts修正  :done, p3-2, 09:40, 10m
    動作確認                  :done, p3-3, 09:50, 10m

    section Phase 4: ドキュメント
    Serenaメモリ更新         :done, p4, 10:00, 10m
    README.md更新            :done, p4-2, 10:10, 15m
    移行ドキュメント作成      :done, p4-3, 10:25, 15m

    section Phase 5: CI/CD
    コミット・プッシュ        :done, p5, 10:40, 5m
    GitHub Actions実行       :done, p5-2, 10:45, 10m

    section Phase 6: 課題対応
    Cloud Scheduler調査      :done, p6, 10:55, 15m
    完了手順書作成           :done, p6-2, 11:10, 15m

    section Phase 7: 引き継ぎ
    セッションサマリー作成    :active, p7, 11:25, 15m
    Mermaid図版作成          :active, p7-2, 11:40, 10m
```

---

## 2. セッション進行状況（円グラフ）

```mermaid
pie title セッション時間配分
    "コード変更" : 30
    "ドキュメント作成" : 40
    "調査・計画" : 25
    "CI/CD・課題対応" : 30
    "引き継ぎ記録" : 25
```

---

## 3. アーキテクチャ変更（Before/After）

### Before: Flash-Lite @ us-central1

```mermaid
graph TB
    subgraph "Before（2025年11月14日まで）"
        A[React SPA<br/>Firebase Hosting]
        B[Cloud Functions<br/>us-central1]
        C[Vertex AI<br/>gemini-2.5-flash-lite<br/>us-central1]
        D[Firestore<br/>asia-northeast1]
    end

    A -->|HTTPS| B
    B -->|API Call| C
    B -->|Read/Write| D

    style C fill:#f99,stroke:#333
    style D fill:#9f9,stroke:#333
```

### After: Flash @ asia-northeast1

```mermaid
graph TB
    subgraph "After（2025年11月15日以降）"
        A[React SPA<br/>Firebase Hosting]
        B[Cloud Functions<br/>us-central1]
        C[Vertex AI<br/>gemini-2.5-flash<br/>asia-northeast1]
        D[Firestore<br/>asia-northeast1]
    end

    A -->|HTTPS| B
    B -->|API Call<br/>130-160ms削減| C
    B -->|Read/Write<br/>同一リージョン| D

    style C fill:#9f9,stroke:#333
    style D fill:#9f9,stroke:#333
```

---

## 4. 意思決定フロー

```mermaid
flowchart TD
    A[ユーザー質問:<br/>Vertex AI使用確認] --> B{調査結果}
    B -->|✅ 既に使用中| C[Flash-Lite @ us-central1]
    C --> D[ユーザー要望:<br/>asia-northeast1対応可能？]
    D --> E[Web調査:<br/>2025/11/15時点]

    E --> F{Flash-Lite対応？}
    F -->|❌ 非対応| G[代替案検討]
    F -->|✅ 対応| H[そのまま移行]

    G --> I{Flash対応？}
    I -->|✅ 対応| J[Flash採用決定]
    I -->|❌ 非対応| K[他のリージョン検討]

    J --> L{コスト確認}
    L -->|同額| M[移行承認]
    L -->|増額| N[費用対効果検討]

    M --> O[コード変更実施]
    O --> P[ドキュメント作成]
    P --> Q[GitHub Actions CI/CD]

    Q --> R{Cloud Scheduler API}
    R -->|❌ 権限エラー| S[完了手順書作成]
    R -->|✅ 有効| T[完全デプロイ完了]

    S --> U[次回セッションへ引き継ぎ]

    style M fill:#9f9
    style O fill:#9f9
    style P fill:#9f9
    style S fill:#ff9
```

---

## 5. 変更ファイルマップ

```mermaid
graph LR
    subgraph "コード変更"
        A1[shift-generation.ts<br/>2箇所]
        A2[phased-generation.ts<br/>3箇所]
    end

    subgraph "ドキュメント更新"
        B1[README.md<br/>4箇所]
        B2[gemini_region_critical_rule<br/>全面更新]
    end

    subgraph "新規ドキュメント"
        C1[vertex-ai-region-migration<br/>移行計画書]
        C2[vertex-ai-deployment-completion<br/>完了手順書]
        C3[vertex-ai-migration-session-summary<br/>セッションサマリー]
        C4[vertex-ai-migration-diagrams<br/>Mermaid図版集]
    end

    subgraph "Git"
        D1[Commit: d7336ef<br/>feat: Migrate]
        D2[Commit: 3445b01<br/>docs: 完了手順書]
        D3[Commit: 473aa55<br/>docs: Cloud Scheduler]
    end

    A1 --> D1
    A2 --> D1
    B1 --> D1
    B2 --> D1
    C1 --> D1

    C2 --> D2
    C2 --> D3

    C3 --> D_NEXT[次回コミット]
    C4 --> D_NEXT

    style D1 fill:#9f9
    style D2 fill:#9f9
    style D3 fill:#9f9
```

---

## 6. デプロイ状況（ステートマシン）

```mermaid
stateDiagram-v2
    [*] --> CodeChanged: コード変更完了
    CodeChanged --> DocumentUpdated: ドキュメント更新
    DocumentUpdated --> Committed: Git commit
    Committed --> GitHubActions: git push

    GitHubActions --> BuildTest: ビルド・テスト
    BuildTest --> FirebaseHosting: ✅ 成功
    FirebaseHosting --> FirestoreRules: ✅ デプロイ成功
    FirestoreRules --> CloudFunctions: ✅ デプロイ成功

    CloudFunctions --> CloudSchedulerCheck: Cloud Scheduler API確認
    CloudSchedulerCheck --> CloudSchedulerError: ❌ 権限エラー
    CloudSchedulerError --> DocumentationCreated: 完了手順書作成

    CloudSchedulerCheck --> CloudFunctionsDeployed: ✅ API有効化済み
    CloudFunctionsDeployed --> [*]: 完全デプロイ完了

    DocumentationCreated --> Handover: 次回セッションへ引き継ぎ
    Handover --> [*]

    note right of CloudSchedulerError
        プロジェクトオーナー権限で
        GCP Consoleから有効化必要
    end note
```

---

## 7. Before/After 性能比較

```mermaid
graph LR
    subgraph "Before: us-central1"
        A1[日本ユーザー] -->|RTT: 150-200ms| B1[us-central1<br/>Cloud Functions]
        B1 -->|Vertex AI呼び出し<br/>2,000-3,000ms| C1[gemini-2.5-flash-lite]
        C1 -->|レスポンス| B1
        B1 -->|RTT: 150-200ms| A1

        D1[合計レイテンシ:<br/>約2,300-3,400ms]
    end

    subgraph "After: asia-northeast1"
        A2[日本ユーザー] -->|RTT: 150-200ms| B2[us-central1<br/>Cloud Functions]
        B2 -->|Vertex AI呼び出し<br/>1,800-2,800ms| C2[gemini-2.5-flash<br/>asia-northeast1]
        C2 -->|レスポンス| B2
        B2 -->|RTT: 150-200ms| A2

        D2[合計レイテンシ:<br/>約2,100-3,200ms<br/>✅ 130-160ms削減]
    end

    D1 -.比較.-> D2

    style C1 fill:#f99
    style C2 fill:#9f9
    style D2 fill:#9f9
```

---

## 8. Cloud Scheduler API 必要性

```mermaid
graph TB
    subgraph "Firebase Functions v2"
        A[onSchedule関数]
        B[onCall関数]
        C[onRequest関数]
    end

    subgraph "generateMonthlyReport.ts"
        D[月次レポート自動生成<br/>Phase 19.3.3実装済み]
        E[cron: 0 9 1 * *<br/>毎月1日 午前9時JST]
    end

    subgraph "Cloud Scheduler"
        F[Cloud Scheduler API]
        G[Cronジョブ作成]
    end

    A --> D
    D --> E
    A -->|内部的に使用| F
    F --> G

    H[Firebase Functions デプロイ] --> I{onSchedule使用？}
    I -->|✅ Yes| F
    I -->|❌ No| J[API不要]

    F --> K{API有効化済み？}
    K -->|✅ Yes| L[デプロイ成功]
    K -->|❌ No| M[❌ 権限エラー]

    M --> N[プロジェクトオーナーが<br/>GCP Consoleで有効化]

    style A fill:#9cf
    style D fill:#9f9
    style F fill:#ff9
    style M fill:#f99
    style L fill:#9f9
```

---

## 9. 完了チェックリスト（進行状況）

```mermaid
graph TB
    subgraph "Phase 1-7: 実施完了"
        A1[✅ コード変更]
        A2[✅ Serenaメモリ更新]
        A3[✅ README.md更新]
        A4[✅ 移行計画書作成]
        A5[✅ 完了手順書作成]
        A6[✅ セッションサマリー]
        A7[✅ Mermaid図版作成]
        A8[✅ GitHub Actions CI/CD]
        A9[✅ Firebase Hosting/Rules]
    end

    subgraph "次回セッション: 未完了"
        B1[⏳ Cloud Scheduler API有効化]
        B2[⏳ Cloud Functions デプロイ]
        B3[⏳ 本番環境テスト]
        B4[⏳ レイテンシ測定]
    end

    A1 --> A2
    A2 --> A3
    A3 --> A4
    A4 --> A5
    A5 --> A6
    A6 --> A7
    A7 --> A8
    A8 --> A9

    A9 -.次回.-> B1
    B1 --> B2
    B2 --> B3
    B3 --> B4

    style A1 fill:#9f9
    style A2 fill:#9f9
    style A3 fill:#9f9
    style A4 fill:#9f9
    style A5 fill:#9f9
    style A6 fill:#9f9
    style A7 fill:#9f9
    style A8 fill:#9f9
    style A9 fill:#9f9

    style B1 fill:#ff9
    style B2 fill:#ff9
    style B3 fill:#ccc
    style B4 fill:#ccc
```

---

## 10. 引き継ぎフロー（次のセッション）

```mermaid
sequenceDiagram
    actor Owner as プロジェクトオーナー
    participant GCP as GCP Console
    participant Git as GitHub
    participant Actions as GitHub Actions
    participant CF as Cloud Functions
    participant VA as Vertex AI

    Owner->>GCP: Cloud Scheduler API有効化
    Note over Owner,GCP: URL: console.cloud.google.com/apis/library/cloudscheduler.googleapis.com
    GCP-->>Owner: ✅ API有効化完了

    Owner->>Git: 空コミット・プッシュ
    Note over Owner,Git: git commit --allow-empty<br/>git push origin main

    Git->>Actions: GitHub Actionsトリガー
    Actions->>Actions: ビルド・テスト
    Actions->>CF: Cloud Functions デプロイ

    CF->>CF: 新しいコード反映
    Note over CF: gemini-2.5-flash<br/>asia-northeast1

    Owner->>CF: シフト生成テスト
    CF->>VA: Vertex AI呼び出し
    Note over CF,VA: asia-northeast1エンドポイント
    VA-->>CF: シフトデータ返却
    CF-->>Owner: ✅ テスト成功

    Owner->>Owner: レイテンシ測定（オプション）
    Note over Owner: Cloud Logsで<br/>改善効果確認
```

---

## 関連ドキュメント

- **テキスト版**: [セッションサマリー](./vertex-ai-migration-session-summary-2025-11-15.md)
- **完了手順書**: [デプロイ完了手順](./vertex-ai-deployment-completion-2025-11-15.md)
- **移行計画書**: [移行計画](./vertex-ai-region-migration-2025-11-15.md)

---

**記録者**: Claude Code
**作成日**: 2025年11月15日 11:40 JST
