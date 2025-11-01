# Phase 13構造図：監査ログとコンプライアンス機能

**更新日**: 2025年11月1日
**仕様ID**: auth-data-persistence
**関連**: [phase13-completion-summary-2025-11-01.md](./phase13-completion-summary-2025-11-01.md)

---

## Phase 13実装進捗状況

```mermaid
gantt
    title Phase 13実装進捗状況
    dateFormat YYYY-MM-DD

    section Phase 13.1
    監査ログ記録機能 :done, p13-1, 2025-10-31, 1d

    section Phase 13.2
    監査ログビューアUI :done, p13-2, 2025-11-01, 1d

    section Phase 13.3
    セキュリティアラート・異常検知 :done, p13-3, 2025-11-01, 1d

    section Phase 13.4
    既存テスト環境整備 :done, p13-4, 2025-11-01, 1d
```

---

## Phase 13アーキテクチャ図

```mermaid
graph TB
    subgraph "クライアント層"
        UI_AuditLogs[監査ログビューアUI<br/>AuditLogs.tsx]
        UI_SecurityAlerts[セキュリティアラートUI<br/>SecurityAlerts.tsx]
    end

    subgraph "サービス層"
        SVC_AuditLog[AuditLogService<br/>auditLogService.ts]
        SVC_SecurityAlert[SecurityAlertService<br/>securityAlertService.ts]
        SVC_AnomalyDetection[AnomalyDetectionService<br/>anomalyDetectionService.ts]
    end

    subgraph "データ層 (Firestore)"
        COL_AuditLogs[(auditLogs<br/>コレクション)]
        COL_SecurityAlerts[(securityAlerts<br/>コレクション)]
    end

    subgraph "テスト層"
        TEST_AuditLog[auditLogService.test.ts<br/>8テスト]
        TEST_SecurityAlert[securityAlertService.test.ts<br/>10テスト]
        TEST_AnomalyDetection[anomalyDetectionService.test.ts<br/>11テスト]
        TEST_Staff[staffService.test.ts<br/>10テスト]
        TEST_Schedule[scheduleService.test.ts<br/>9テスト]
    end

    UI_AuditLogs --> SVC_AuditLog
    UI_SecurityAlerts --> SVC_SecurityAlert
    UI_SecurityAlerts --> SVC_AnomalyDetection

    SVC_AuditLog --> COL_AuditLogs
    SVC_SecurityAlert --> COL_SecurityAlerts
    SVC_AnomalyDetection --> SVC_AuditLog
    SVC_AnomalyDetection --> SVC_SecurityAlert

    TEST_AuditLog -.テスト.-> SVC_AuditLog
    TEST_SecurityAlert -.テスト.-> SVC_SecurityAlert
    TEST_AnomalyDetection -.テスト.-> SVC_AnomalyDetection

    style UI_AuditLogs fill:#e1f5ff
    style UI_SecurityAlerts fill:#e1f5ff
    style SVC_AuditLog fill:#fff4e6
    style SVC_SecurityAlert fill:#fff4e6
    style SVC_AnomalyDetection fill:#fff4e6
    style COL_AuditLogs fill:#e8f5e9
    style COL_SecurityAlerts fill:#e8f5e9
    style TEST_AuditLog fill:#f3e5f5
    style TEST_SecurityAlert fill:#f3e5f5
    style TEST_AnomalyDetection fill:#f3e5f5
    style TEST_Staff fill:#f3e5f5
    style TEST_Schedule fill:#f3e5f5
```

---

## 監査ログ記録フロー（Phase 13.1）

```mermaid
sequenceDiagram
    actor User
    participant UI as React Component
    participant Service as AuditLogService
    participant Firestore as Firestore<br/>(auditLogs)
    participant Auth as Firebase Auth

    User->>UI: CRUD操作実行
    UI->>Service: logAction(params)

    Service->>Auth: auth.currentUser取得
    Auth-->>Service: currentUser

    alt 未認証
        Service-->>UI: PERMISSION_DENIED
    else 認証済み
        Service->>Service: バリデーション<br/>(userId, resourceType)

        alt バリデーション失敗
            Service-->>UI: VALIDATION_ERROR
        else バリデーション成功
            Service->>Firestore: addDoc(auditLogs, logData)
            Firestore-->>Service: docRef.id
            Service-->>UI: success: true, data: logId
        end
    end

    UI->>User: 結果表示
```

---

## 異常検知フロー（Phase 13.3）

```mermaid
sequenceDiagram
    participant Scheduler as 定期実行/手動実行
    participant AnomalyDetection as AnomalyDetectionService
    participant AuditLog as AuditLogService
    participant SecurityAlert as SecurityAlertService
    participant Firestore as Firestore

    Scheduler->>AnomalyDetection: runAllDetections()

    par 並列検知
        AnomalyDetection->>AuditLog: getDocs(過去5分のREAD操作)
        AuditLog-->>AnomalyDetection: ログリスト
        AnomalyDetection->>AnomalyDetection: 大量エクスポート検知<br/>(10件以上)

        AnomalyDetection->>AuditLog: getDocs(過去24時間)
        AuditLog-->>AnomalyDetection: ログリスト
        AnomalyDetection->>AnomalyDetection: 深夜アクセス検知<br/>(22時〜6時)

        AnomalyDetection->>AuditLog: getDocs(過去15分のLOGIN失敗)
        AuditLog-->>AnomalyDetection: ログリスト
        AnomalyDetection->>AnomalyDetection: 複数回認証失敗検知<br/>(5回以上)

        AnomalyDetection->>AuditLog: getDocs(過去15分のPERMISSION_DENIED)
        AuditLog-->>AnomalyDetection: ログリスト
        AnomalyDetection->>AnomalyDetection: 権限なしアクセス試行検知<br/>(3回以上)

        AnomalyDetection->>Firestore: count(auditLogs)
        Firestore-->>AnomalyDetection: ログ件数
        AnomalyDetection->>AnomalyDetection: ストレージ閾値検知<br/>(10,000件以上)
    end

    loop 各異常検知結果
        alt 異常検出
            AnomalyDetection->>SecurityAlert: createAlert(alertData)
            SecurityAlert->>Firestore: addDoc(securityAlerts, alertData)
        end
    end

    AnomalyDetection-->>Scheduler: 完了
```

---

## テスト構造図

```mermaid
graph TB
    subgraph "テスト環境"
        VITEST[Vitest Test Runner<br/>happy-dom環境]
        SETUP[src/test/setup.ts<br/>グローバルモック]
    end

    subgraph "Phase 13テスト"
        TEST_AUDIT[auditLogService.test.ts<br/>8テスト]
        TEST_SECURITY[securityAlertService.test.ts<br/>10テスト]
        TEST_ANOMALY[anomalyDetectionService.test.ts<br/>11テスト]
    end

    subgraph "既存サービステスト"
        TEST_STAFF[staffService.test.ts<br/>10テスト]
        TEST_SCHEDULE[scheduleService.test.ts<br/>9テスト]
    end

    subgraph "モック層"
        MOCK_FIRESTORE[Firestore モック<br/>addDoc, getDocs, etc.]
        MOCK_AUTH[Auth モック<br/>currentUser]
    end

    VITEST --> SETUP
    SETUP --> MOCK_FIRESTORE
    SETUP --> MOCK_AUTH

    VITEST --> TEST_AUDIT
    VITEST --> TEST_SECURITY
    VITEST --> TEST_ANOMALY
    VITEST --> TEST_STAFF
    VITEST --> TEST_SCHEDULE

    TEST_AUDIT --> MOCK_FIRESTORE
    TEST_AUDIT --> MOCK_AUTH
    TEST_SECURITY --> MOCK_FIRESTORE
    TEST_SECURITY --> MOCK_AUTH
    TEST_ANOMALY --> MOCK_FIRESTORE
    TEST_STAFF --> MOCK_FIRESTORE
    TEST_SCHEDULE --> MOCK_FIRESTORE

    style VITEST fill:#e3f2fd
    style SETUP fill:#fff3e0
    style TEST_AUDIT fill:#c8e6c9
    style TEST_SECURITY fill:#c8e6c9
    style TEST_ANOMALY fill:#c8e6c9
    style TEST_STAFF fill:#f0f4c3
    style TEST_SCHEDULE fill:#f0f4c3
    style MOCK_FIRESTORE fill:#ffccbc
    style MOCK_AUTH fill:#ffccbc
```

---

## カバレッジ状況（Phase 13サービス）

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#4caf50','primaryTextColor':'#fff','primaryBorderColor':'#388e3c','lineColor':'#388e3c','secondaryColor':'#ff9800','tertiaryColor':'#f44336'}}}%%
graph LR
    subgraph "カバレッジ Status"
        direction TB
        ANOMALY["AnomalyDetectionService<br/>92.53% Statements<br/>100% Functions"]
        AUDIT["AuditLogService<br/>81.08% Statements<br/>100% Functions"]
        SECURITY["SecurityAlertService<br/>79.41% Statements<br/>100% Functions"]
        STAFF["StaffService<br/>66.07% Statements<br/>87.5% Functions"]
        SCHEDULE["ScheduleService<br/>17.6% Statements<br/>28.57% Functions"]
    end

    style ANOMALY fill:#4caf50,color:#fff
    style AUDIT fill:#8bc34a,color:#000
    style SECURITY fill:#8bc34a,color:#000
    style STAFF fill:#ff9800,color:#fff
    style SCHEDULE fill:#f44336,color:#fff
```

**凡例**:
- 🟢 緑: 80%以上（優秀）
- 🟡 オレンジ: 60-79%（良好）
- 🔴 赤: 60%未満（要改善）

---

## テスト実行結果タイムライン

```mermaid
timeline
    title Phase 13テスト実装・実行タイムライン

    section 2025年10月31日
        Phase 13.1実装 : auditLogService.ts実装
                      : auditLogService.test.ts作成（8テスト）
                      : TDDアプローチ採用

    section 2025年11月1日 午前
        Phase 13.2実装 : AuditLogs.tsx UI実装
        Phase 13.3実装 : securityAlertService.ts実装
                      : anomalyDetectionService.ts実装
                      : SecurityAlerts.tsx UI実装
                      : securityAlertService.test.ts作成（10テスト）
                      : anomalyDetectionService.test.ts作成（11テスト）

    section 2025年11月1日 午後
        Phase 13.4実装 : Vitest環境セットアップ
                      : src/test/setup.ts作成
                      : auditLogService.test.ts修正
                      : staffService.test.ts修正
                      : scheduleService.test.ts修正
                      : 全48テスト100%合格達成
```

---

## Phase 13データモデル（ER図）

```mermaid
erDiagram
    AUDIT_LOGS {
        string id PK
        timestamp timestamp
        string userId FK
        string facilityId FK "nullable"
        string action "enum: CREATE, UPDATE, DELETE, READ, LOGIN, LOGOUT, etc."
        string resourceType
        string resourceId "nullable"
        object details
        object deviceInfo "ipAddress, userAgent"
        string result "success | failure"
        string errorMessage "nullable"
    }

    SECURITY_ALERTS {
        string id PK
        string type "enum: BULK_EXPORT, UNUSUAL_TIME_ACCESS, etc."
        string severity "enum: LOW, MEDIUM, HIGH, CRITICAL"
        string status "enum: pending, investigating, resolved, false_positive"
        timestamp detectedAt
        string userId "nullable"
        string facilityId "nullable"
        object details
        string notes "nullable"
        string resolvedBy "nullable"
        timestamp resolvedAt "nullable"
    }

    USERS ||--o{ AUDIT_LOGS : "creates"
    USERS ||--o{ SECURITY_ALERTS : "may trigger"
    FACILITIES ||--o{ AUDIT_LOGS : "contains"
    FACILITIES ||--o{ SECURITY_ALERTS : "contains"
```

---

## 今後の開発ロードマップ

```mermaid
timeline
    title 今後の開発ロードマップ

    section 完了済み（2025年10月-11月）
        Phase 0-12.5 : 認証、RBAC、データ永続化<br/>管理画面、エラーハンドリング
        Phase 13 : 監査ログ、セキュリティアラート<br/>テスト環境整備（48テスト100%合格）

    section 推奨（2025年11月）
        Phase 15 : TypeScriptエラー修正<br/>Result型の型ガード<br/>ButtonProps型定義修正

    section 次期（2025年12月）
        Phase 16 : 統合とデプロイ<br/>Phase 13機能の本番環境デプロイ<br/>監査ログアーカイブ機能
        Phase 14 : E2Eテスト<br/>Playwright統合テスト<br/>認証フロー、CRUD、RBAC
```

---

## 技術スタック構成図（Phase 13追加分）

```mermaid
graph TB
    subgraph "Phase 13追加技術"
        TEST_ENV[Vitest + happy-dom<br/>高速ユニットテスト環境]
        MOCK[vi.mock()<br/>Firebaseモック]
        COVERAGE[V8 Coverage Provider<br/>90.2% Statements]
    end

    subgraph "既存技術"
        REACT[React 19.2.0]
        FIREBASE[Firebase 12.4.0]
        TYPESCRIPT[TypeScript 5.8.2]
        VITE[Vite 6.2.0]
    end

    TEST_ENV --> VITE
    MOCK --> FIREBASE
    COVERAGE --> TEST_ENV

    REACT --> VITE
    FIREBASE --> REACT
    TYPESCRIPT --> REACT

    style TEST_ENV fill:#4caf50,color:#fff
    style MOCK fill:#4caf50,color:#fff
    style COVERAGE fill:#4caf50,color:#fff
```

---

**Phase 13構造図作成日**: 2025年11月1日
**作成者**: Claude Code AI
**詳細サマリー**: [phase13-completion-summary-2025-11-01.md](./phase13-completion-summary-2025-11-01.md)
