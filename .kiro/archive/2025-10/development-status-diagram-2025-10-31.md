# 開発状況ダイアグラム

**更新日**: 2025年10月31日
**プロジェクト**: AIシフト自動作成システム (ai-care-shift-scheduler)

---

## 📊 Phase実装状況（ガントチャート）

```mermaid
gantt
    title Phase実装進捗状況
    dateFormat YYYY-MM-DD
    section Phase 0-6
    Phase 0: デモ環境整備           :done, p0, 2025-10-23, 2025-10-31
    Phase 1: 認証基盤               :done, p1, 2025-10-23, 2025-10-24
    Phase 2: ユーザー登録           :done, p2, 2025-10-24, 2025-10-25
    Phase 3: RBAC                   :done, p3, 2025-10-25, 2025-10-26
    Phase 4: スタッフ永続化         :done, p4, 2025-10-26, 2025-10-26
    Phase 5: シフト永続化           :done, p5, 2025-10-26, 2025-10-27
    Phase 6: バージョン管理         :done, p6, 2025-10-27, 2025-10-27

    section Phase 7-12
    Phase 7: 休暇・要件永続化       :done, p7, 2025-10-27, 2025-10-27
    Phase 8: Security Rules         :done, p8, 2025-10-27, 2025-10-27
    Phase 9: データ復元             :done, p9, 2025-10-27, 2025-10-28
    Phase 10: 管理画面              :done, p10, 2025-10-28, 2025-10-28
    Phase 11: ユーザー招待          :done, p11, 2025-10-28, 2025-10-28
    Phase 12: エラーハンドリング    :done, p12, 2025-10-28, 2025-10-28
    Phase 12.5: リファクタリング    :done, p125, 2025-10-28, 2025-10-28

    section 今後の予定
    Phase 13: 監査ログ              :active, p13, 2025-11-01, 5d
    Phase 14: E2Eテスト             :p14, after p13, 7d
    Phase 15: メール通知            :p15, after p14, 3d
    Phase 16: データ分析            :p16, after p15, 5d
```

---

## 🏗️ システムアーキテクチャ

```mermaid
graph TB
    subgraph "クライアント層"
        A[React SPA<br/>TypeScript + Vite]
        A1[認証UI<br/>Google OAuth]
        A2[シフト管理UI<br/>カレンダー・編集]
        A3[管理画面UI<br/>super-admin専用]
        A --> A1
        A --> A2
        A --> A3
    end

    subgraph "Firebase層"
        B[Firebase Authentication<br/>Google OAuth 2.0]
        C[Cloud Firestore<br/>asia-northeast1]
        D[Cloud Functions<br/>us-central1, Node.js 20]
        E[Firebase Hosting<br/>CDN配信]
        F[Security Rules<br/>RBAC制御]
    end

    subgraph "AI層"
        G[Vertex AI<br/>Gemini 2.5 Flash-Lite<br/>asia-northeast1]
    end

    subgraph "Data Collections"
        C1[(users)]
        C2[(facilities)]
        C3[(staff)]
        C4[(schedules)]
        C5[(leaveRequests)]
        C6[(requirements)]
        C7[(auditLogs<br/>Phase 13)]
    end

    A1 -->|認証| B
    A2 -->|CRUD操作| C
    A3 -->|管理操作| C
    A -->|デプロイ| E

    B -->|認証トークン| D
    D -->|データ検証| C
    D -->|AI呼び出し| G

    C --> C1
    C --> C2
    C2 --> C3
    C2 --> C4
    C2 --> C5
    C2 --> C6
    C --> C7

    F -.->|アクセス制御| C

    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#e8f5e9
    style D fill:#f3e5f5
    style G fill:#fce4ec
    style C7 fill:#ffebee,stroke-dasharray: 5 5
```

---

## 🔐 認証・アクセス制御フロー

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant Auth as Firebase Auth
    participant DB as Firestore
    participant CF as Cloud Function
    participant Rules as Security Rules

    User->>UI: アクセス
    UI->>Auth: 認証状態確認

    alt 未認証
        Auth-->>UI: 未認証
        UI->>User: ログイン画面表示
        User->>UI: Googleログインボタンクリック
        UI->>Auth: signInWithGoogle()
        Auth->>Auth: Google OAuth認証
        Auth-->>UI: 認証成功（UID, Token）

        UI->>DB: ユーザー情報確認
        alt 初回ユーザー（システム1人目）
            CF->>DB: super-admin権限付与
            DB-->>UI: super-admin権限
        else 2人目以降
            DB-->>UI: 権限なし（facilities: []）
            UI->>User: アクセス権限なし画面表示
        end
    else 認証済み
        Auth-->>UI: 認証済み（UID, Token）
        UI->>DB: 施設一覧取得

        DB->>Rules: アクセス権限チェック
        Rules->>Rules: hasRole(facilityId, 'viewer')
        Rules-->>DB: 許可
        DB-->>UI: 施設データ返却

        UI->>User: 施設選択画面表示
        User->>UI: 施設選択

        UI->>DB: シフトデータ取得
        DB->>Rules: アクセス権限チェック
        Rules->>Rules: hasRole(facilityId, role)<br/>checkRolePermission()

        alt editor以上
            Rules-->>DB: 読み書き許可
            DB-->>UI: シフトデータ返却
            UI->>User: シフト編集画面表示
        else viewer
            Rules-->>DB: 読み取りのみ許可
            DB-->>UI: シフトデータ返却
            UI->>User: シフト閲覧画面表示
        else 権限なし
            Rules-->>DB: 拒否
            DB-->>UI: PERMISSION_DENIED
            UI->>User: エラー表示
        end
    end
```

---

## 🤖 AIシフト生成フロー

```mermaid
sequenceDiagram
    actor User
    participant UI as React UI
    participant CF as Cloud Functions
    participant VTX as Vertex AI<br/>(Gemini 2.5 Flash-Lite)
    participant DB as Firestore
    participant Storage as LocalStorage

    User->>UI: シフト生成ボタンクリック
    UI->>UI: スタッフ・要件データ収集

    UI->>CF: generateShift()<br/>POST /generateShift
    Note over CF: us-central1

    CF->>CF: リクエスト検証<br/>認証トークン確認
    CF->>DB: スタッフ・要件データ取得
    DB-->>CF: データ返却

    CF->>VTX: プロンプト送信<br/>region: asia-northeast1
    Note over VTX: 制約条件考慮：<br/>- 必要人員体制<br/>- 資格要件<br/>- 連続勤務制限<br/>- 夜勤後休息<br/>- 勤務間インターバル

    VTX->>VTX: シフト最適化計算
    VTX-->>CF: JSON形式シフトデータ

    CF->>CF: JSONパース<br/>データ検証

    alt パース成功
        CF->>DB: シフト保存<br/>(draft status)
        DB-->>CF: scheduleId
        CF-->>UI: シフトデータ + scheduleId
        UI->>Storage: LocalStorage保存<br/>(3秒debounce)
        UI->>User: シフト表示
    else パース失敗
        CF->>CF: fallback JSONパーサー<br/>(トレーリングカンマ対応)
        alt fallback成功
            CF->>DB: シフト保存
            CF-->>UI: シフトデータ
        else fallback失敗
            CF-->>UI: エラー返却
            UI->>User: エラー表示
        end
    end
```

---

## 📦 データモデル（Firestore Collections）

```mermaid
erDiagram
    USERS ||--o{ FACILITIES : "facilities[]"
    FACILITIES ||--o{ STAFF : "staff subcollection"
    FACILITIES ||--o{ SCHEDULES : "schedules subcollection"
    FACILITIES ||--o{ LEAVE_REQUESTS : "leaveRequests subcollection"
    FACILITIES ||--o{ REQUIREMENTS : "requirements subcollection"
    FACILITIES ||--o{ INVITATIONS : "invitations subcollection"
    FACILITIES ||--o{ AUDIT_LOGS : "auditLogs (Phase 13)"

    USERS {
        string userId PK
        string email
        string displayName
        string photoURL
        string provider
        array facilities
        timestamp lastLoginAt
    }

    FACILITIES {
        string facilityId PK
        string name
        timestamp createdAt
        array members
    }

    STAFF {
        string staffId PK
        string name
        string role
        array qualifications
        object workConditions
        boolean isNightShiftOnly
    }

    SCHEDULES {
        string scheduleId PK
        number year
        number month
        string status
        array shiftData
        number version
        timestamp createdAt
    }

    LEAVE_REQUESTS {
        string requestId PK
        string staffId
        string date
        string leaveType
        string reason
    }

    REQUIREMENTS {
        string requirementId PK
        object shifts
        timestamp lastModified
    }

    INVITATIONS {
        string invitationId PK
        string email
        string role
        string status
        string token
        timestamp expiresAt
    }

    AUDIT_LOGS {
        string logId PK
        string userId
        string action
        string resourceType
        object details
        string ipAddress
        timestamp createdAt
    }
```

---

## 🎯 RBAC権限マトリックス

```mermaid
graph LR
    subgraph "ロール階層"
        SA[super-admin<br/>🔴 システム管理者]
        AD[admin<br/>🟠 施設管理者]
        ED[editor<br/>🟡 編集者]
        VW[viewer<br/>🟢 閲覧者]

        SA -.継承.-> AD
        AD -.継承.-> ED
        ED -.継承.-> VW
    end

    subgraph "権限範囲"
        P1[全施設管理]
        P2[ユーザー管理]
        P3[施設作成・削除]
        P4[スタッフ管理]
        P5[メンバー招待]
        P6[シフト作成・編集]
        P7[シフト閲覧]
    end

    SA --> P1
    SA --> P2
    SA --> P3

    AD --> P4
    AD --> P5
    AD --> P6
    AD --> P7

    ED --> P6
    ED --> P7

    VW --> P7

    style SA fill:#ffcdd2
    style AD fill:#ffe0b2
    style ED fill:#fff9c4
    style VW fill:#c8e6c9
```

---

## 🚀 リリース計画タイムライン

```mermaid
timeline
    title リリース計画ロードマップ
    section 完了済み
        Phase 0-12.5 : Phase 0（検証完了 2025-10-31）
                     : Phase 1-3（認証・RBAC）
                     : Phase 4-7（データ永続化）
                     : Phase 8-12（Security・管理機能）
                     : バグ修正（editor権限）

    section 次期リリース
        Phase 13 : 監査ログ記録
                 : 監査ログビューアUI
                 : セキュリティアラート
                 : 推定3-5日

        Phase 14 : E2Eテストフレームワーク
                 : 認証・CRUD統合テスト
                 : RBAC権限マトリックステスト
                 : 推定5-7日

    section ベータリリース
        Beta : Phase 13完了後
             : 限定公開（テストユーザー）
             : 監査ログ機能追加

    section 正式リリース
        v1.0 : Phase 14完了後
             : 一般公開
             : E2Eテスト100%パス

    section 将来拡張
        Phase 15+ : メール通知機能
                  : データ分析・レポート
                  : モバイルアプリ対応
                  : AI高度化
```

---

## 🔄 開発ワークフロー

```mermaid
graph TB
    A[要件定義<br/>requirements.md] --> B[技術設計<br/>design.md]
    B --> C[タスク分解<br/>tasks.md]
    C --> D{承認}
    D -->|承認| E[実装開始]
    D -->|差し戻し| A

    E --> F[Featureブランチ作成<br/>git checkout -b feature/xxx]
    F --> G[コード実装<br/>TDD方式]
    G --> H[git commit]
    H --> I[CodeRabbit CLI<br/>ローカルレビュー]

    I -->|問題あり| J[修正]
    J --> H

    I -->|レビューOK| K[git push]
    K --> L[GitHub Actions CI/CD]

    L --> M{CI/CDパス?}
    M -->|失敗| N[修正]
    N --> H

    M -->|成功| O[Pull Request作成<br/>gh pr create]
    O --> P[コードレビュー]
    P -->|修正依頼| N
    P -->|承認| Q[mainにマージ<br/>gh pr merge --squash]

    Q --> R[自動デプロイ<br/>Firebase Hosting/Functions]
    R --> S[本番環境確認<br/>ハードリロード]
    S --> T[Featureブランチ削除<br/>git branch -d feature/xxx]

    style A fill:#e1f5ff
    style E fill:#fff4e1
    style I fill:#fce4ec
    style L fill:#e8f5e9
    style R fill:#f3e5f5
    style S fill:#ffebee
```

---

## 📊 Phase 13: 監査ログ詳細設計

```mermaid
graph TB
    subgraph "監査ログ記録フロー"
        A1[ユーザー操作<br/>CRUD操作] --> A2[Cloud Function Trigger]
        A2 --> A3[監査ログエントリ生成]
        A3 --> A4[auditLogs Collection<br/>不変ログ保存]

        A3 --> A5{異常検知}
        A5 -->|通常操作| A4
        A5 -->|不審なパターン| A6[セキュリティアラート生成]
        A6 --> A7[管理者通知<br/>super-admin]
    end

    subgraph "監査ログエントリ構造"
        B1[logId: string]
        B2[timestamp: Timestamp]
        B3[userId: string]
        B4[action: string<br/>CREATE/UPDATE/DELETE/READ]
        B5[resourceType: string<br/>staff/schedule/etc]
        B6[facilityId: string]
        B7[details: object]
        B8[ipAddress: string]
        B9[userAgent: string]
    end

    subgraph "監査ログビューアUI"
        C1[フィルタリング機能] --> C2[検索実行]
        C2 --> C3[Firestore Query]
        C3 --> C4[ログ一覧表示]
        C4 --> C5[詳細表示]
        C4 --> C6[CSV/JSON<br/>エクスポート]
    end

    A4 -.-> C3

    style A6 fill:#ffcdd2
    style A7 fill:#ffcdd2
```

---

## 📊 Phase 14: E2Eテスト構成

```mermaid
graph TB
    subgraph "テストフレームワーク"
        A[Playwright<br/>E2Eテスト] --> A1[ブラウザ自動化<br/>Chromium/Firefox/WebKit]
        B[Vitest<br/>統合テスト] --> B1[Unit/Integration Tests]
        C[Firebase Emulator<br/>ローカル環境] --> C1[Auth/Firestore/Functions]
    end

    subgraph "テストスイート"
        T1[認証フローテスト] --> T1a[Google OAuthログイン]
        T1 --> T1b[super-admin自動付与]
        T1 --> T1c[権限なしユーザー処理]

        T2[データCRUDテスト] --> T2a[スタッフCRUD]
        T2 --> T2b[シフトCRUD]
        T2 --> T2c[休暇申請CRUD]

        T3[RBAC権限テスト] --> T3a[super-admin全権限]
        T3 --> T3b[admin施設管理]
        T3 --> T3c[editorシフト編集]
        T3 --> T3d[viewer閲覧のみ]
        T3 --> T3e[権限なし拒否]

        T4[バージョン管理テスト] --> T4a[draft/confirmed]
        T4 --> T4b[履歴保存]
        T4 --> T4c[復元機能]

        T5[データ復元テスト] --> T5a[リロード後復元]
        T5 --> T5b[LocalStorage復元]
    end

    A1 --> T1
    A1 --> T2
    A1 --> T3
    A1 --> T4
    A1 --> T5

    B1 --> T2
    B1 --> T3

    C1 --> T1
    C1 --> T2
    C1 --> T3

    subgraph "CI/CD統合"
        CI[GitHub Actions] --> CI1[npm test]
        CI1 --> CI2{全テストパス?}
        CI2 -->|成功| CI3[デプロイ許可]
        CI2 -->|失敗| CI4[デプロイ中止<br/>エラー通知]
    end

    T1 -.-> CI1
    T2 -.-> CI1
    T3 -.-> CI1
    T4 -.-> CI1
    T5 -.-> CI1

    style CI2 fill:#fff9c4
    style CI3 fill:#c8e6c9
    style CI4 fill:#ffcdd2
```

---

## 📈 開発メトリクス推移

```mermaid
graph LR
    subgraph "コード品質"
        M1[TypeScript<br/>型安全性] --> M1V[100%<br/>strict mode]
        M2[ESLint<br/>警告] --> M2V[0件]
        M3[統合テスト<br/>成功率] --> M3V[100%<br/>37/37件]
        M4[E2Eテスト<br/>成功率] --> M4V[100%<br/>2/2件]
    end

    subgraph "パフォーマンス"
        P1[デプロイ頻度] --> P1V[12回/月<br/>2025年10月]
        P2[CI/CD実行時間] --> P2V[平均2分40秒]
        P3[ビルド時間] --> P3V[約1分]
    end

    subgraph "コードベース"
        C1[Firestore<br/>Collections] --> C1V[6個<br/>+ auditLogs]
        C2[Security Rules] --> C2V[168行]
        C3[Cloud Functions] --> C3V[3個<br/>assignSuperAdmin<br/>sendInvitation<br/>generateShift]
    end

    style M1V fill:#c8e6c9
    style M2V fill:#c8e6c9
    style M3V fill:#c8e6c9
    style M4V fill:#c8e6c9
```

---

**作成日**: 2025年10月31日
**詳細レポート**: [development-status-2025-10-31.md](./development-status-2025-10-31.md)
