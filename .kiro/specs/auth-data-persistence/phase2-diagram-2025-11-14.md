# Phase 2ダイアグラム: Firestoreクエリ最適化

**更新日**: 2025-11-14
**Phase**: 技術的負債解消 Phase 2
**関連ドキュメント**: phase2-completion-summary-2025-11-14.md

---

## 1. Phase 2実装進捗状況

```mermaid
gantt
    title Phase 2実装進捗状況
    dateFormat YYYY-MM-DD

    section Phase 2-1
    Firestoreインデックス作成 :done, p21, 2025-11-14, 1h

    section Phase 2-2
    AuditLogsページネーション実装 :done, p22, 2025-11-14, 2h

    section Phase 2-3
    SecurityAlertsページネーション実装 :done, p23, 2025-11-14, 2h

    section Phase 2-4
    UsageReportsクエリ最適化 :done, p24, 2025-11-14, 3h
    CodeRabbitレビュー対応 :done, p24r, 2025-11-14, 1h

    section デプロイ
    本番環境デプロイ :done, deploy, 2025-11-14, 1h
```

---

## 2. ページネーション実装フロー

### 2.1 AuditLogs/SecurityAlertsページネーション

```mermaid
sequenceDiagram
    actor User
    participant UI as AuditLogs.tsx<br/>SecurityAlerts.tsx
    participant Service as auditLogService.ts<br/>securityAlertService.ts
    participant Firestore

    Note over User,Firestore: 初期ロード
    User->>UI: ページを開く
    UI->>Service: getAuditLogs({ limit: 50 })
    Service->>Firestore: query + orderBy + limit(50)
    Firestore-->>Service: 50件のドキュメント
    Service-->>UI: logs[]（firstId, lastId含む）
    UI-->>User: 1ページ目を表示

    Note over User,Firestore: 次のページへ
    User->>UI: 「次へ」ボタンクリック
    UI->>Service: getAuditLogs({ startAfterId: lastId, limit: 50 })
    Service->>Firestore: getDoc(lastId) → startAfter(doc) → limit(50)
    Firestore-->>Service: 次の50件
    Service-->>UI: logs[]
    UI-->>User: 2ページ目を表示

    Note over User,Firestore: 前のページへ
    User->>UI: 「前へ」ボタンクリック
    UI->>Service: getAuditLogs({ startBeforeId: firstId, limit: 50 })
    Service->>Firestore: getDoc(firstId) → endBefore(doc) → limitToLast(50)
    Firestore-->>Service: 前の50件
    Service-->>UI: logs[]
    UI-->>User: 1ページ目に戻る
```

---

## 3. UsageReportsキャッシュ戦略

### 3.1 キャッシュフロー

```mermaid
sequenceDiagram
    actor User
    participant UI as UsageReports.tsx
    participant Cache as reportCache<br/>(Map)
    participant Service as auditLogService.ts
    participant Firestore

    Note over User,Firestore: 初回ロード（キャッシュミス）
    User->>UI: ページを開く（period: last3Months）
    UI->>UI: generateCacheKey("2025-08-14", "2025-11-14")
    UI->>Cache: get("2025-08-14-2025-11-14")
    Cache-->>UI: null（キャッシュなし）
    UI->>Service: getAuditLogs({ startDate, endDate })
    Service->>Firestore: query + where + orderBy
    Firestore-->>Service: logs[]
    Service-->>UI: logs[]
    UI->>UI: calculateStats(logs)
    UI->>Cache: set("2025-08-14-2025-11-14", { data, timestamp })
    UI-->>User: レポート表示

    Note over User,Firestore: 2回目ロード（キャッシュヒット）
    User->>UI: 期間を変更せず更新ボタン
    UI->>UI: generateCacheKey("2025-08-14", "2025-11-14")
    UI->>Cache: get("2025-08-14-2025-11-14")
    Cache-->>UI: { data, timestamp }（5分以内）
    UI->>UI: isValid(timestamp)
    UI-->>User: キャッシュからレポート表示（Firestoreクエリなし）

    Note over User,Firestore: キャッシュ期限切れ
    User->>UI: 6分後に更新ボタン
    UI->>Cache: get("2025-08-14-2025-11-14")
    Cache-->>UI: { data, timestamp }（5分超過）
    UI->>UI: isExpired(timestamp)
    UI->>Service: getAuditLogs({ startDate, endDate })
    Service->>Firestore: query + where + orderBy
    Firestore-->>Service: logs[]
    Service-->>UI: logs[]
    UI->>UI: calculateStats(logs) + cleanupCache()
    UI->>Cache: update("2025-08-14-2025-11-14", { data, newTimestamp })
    UI-->>User: 更新されたレポート表示
```

---

## 4. キャッシュクリーンアップ戦略

### 4.1 定期クリーンアップ

```mermaid
graph TB
    A[useEffect: 60秒タイマー] --> B{reportCache Map}
    B --> C[Entry 1<br/>2025-11-14 11:00:00<br/>EXPIRED]
    B --> D[Entry 2<br/>2025-11-14 11:25:00<br/>VALID]
    B --> E[Entry 3<br/>2025-11-14 11:20:00<br/>VALID]

    C -->|削除| F[cleanupCache実行]
    D -->|保持| F
    E -->|保持| F

    F --> G[cleaned Map]
    G --> H[Entry 2<br/>2025-11-14 11:25:00]
    G --> I[Entry 3<br/>2025-11-14 11:20:00]

    style C fill:#ffcccc
    style D fill:#ccffcc
    style E fill:#ccffcc
    style H fill:#ccffcc
    style I fill:#ccffcc
```

### 4.2 新規エントリ追加時のクリーンアップ

```mermaid
graph LR
    A[新しいレポート取得] --> B[setReportCache]
    B --> C{単一操作内で実行}
    C --> D[1. 期限切れエントリを削除]
    C --> E[2. 新しいエントリを追加]

    D --> F[cleanedMap]
    E --> F

    F --> G[setReportCache完了<br/>Race condition回避]

    style G fill:#ccffff
```

---

## 5. Race Condition対策

### 5.1 期間変更時の競合対策（isActiveフラグ）

```mermaid
sequenceDiagram
    actor User
    participant Effect1 as useEffect 1<br/>(period: thisMonth)
    participant Effect2 as useEffect 2<br/>(period: lastMonth)
    participant Firestore
    participant UI as UsageReports.tsx

    Note over User,UI: ユーザーが期間を素早く変更
    User->>Effect1: period変更: thisMonth
    Effect1->>Effect1: isActive = true
    Effect1->>Firestore: クエリ開始（今月データ）

    Note over User,UI: すぐに別の期間に変更
    User->>Effect2: period変更: lastMonth
    Effect2->>Effect2: isActive = true
    Effect2->>Effect1: cleanup実行 → isActive = false

    Note over User,UI: Effect1のクエリが完了
    Firestore-->>Effect1: 今月データ
    Effect1->>Effect1: if (!isActive) return
    Effect1->>UI: ステート更新をスキップ

    Note over User,UI: Effect2のクエリが完了
    Effect2->>Firestore: クエリ開始（先月データ）
    Firestore-->>Effect2: 先月データ
    Effect2->>Effect2: if (isActive) {...}
    Effect2->>UI: ステート更新（先月データ表示）
    UI-->>User: 正しいデータ表示

    style Effect1 fill:#ffcccc
    style Effect2 fill:#ccffcc
```

---

## 6. システムアーキテクチャ（Phase 2後）

### 6.1 Firestore最適化レイヤー

```mermaid
graph TB
    subgraph "フロントエンド層"
        A[AuditLogs.tsx]
        B[SecurityAlerts.tsx]
        C[UsageReports.tsx]
    end

    subgraph "サービス層"
        D[auditLogService.ts<br/>✅ ページネーション対応]
        E[securityAlertService.ts<br/>✅ ページネーション対応]
    end

    subgraph "キャッシュ層"
        F[reportCache<br/>Map<string, CachedReport><br/>✅ 5分間有効<br/>✅ 定期クリーンアップ]
    end

    subgraph "Firestore層"
        G[(auditLogs<br/>複合インデックス: 3個)]
        H[(securityAlerts<br/>複合インデックス: 1個)]
        I[(schedules<br/>複合インデックス: 1個)]
    end

    A -->|startAfterId<br/>startBeforeId| D
    B -->|startAfterId<br/>startBeforeId| E
    C -->|cacheKey| F

    D -->|query + orderBy<br/>+ startAfter/endBefore| G
    E -->|query + orderBy<br/>+ startAfter/endBefore| H
    F -->|キャッシュミス時| D
    D --> G

    style F fill:#ccffcc
    style G fill:#ffcccc
    style H fill:#ffcccc
    style I fill:#ffcccc
```

---

## 7. パフォーマンス改善効果

### 7.1 Firestore読み取り回数の比較

```mermaid
graph LR
    subgraph "Before Phase 2"
        A1[AuditLogs: 100件/回]
        A2[SecurityAlerts: 全件]
        A3[UsageReports: 毎回クエリ]
    end

    subgraph "After Phase 2"
        B1[AuditLogs: 50件/ページ]
        B2[SecurityAlerts: 25件/ページ]
        B3[UsageReports: 5分間キャッシュ]
    end

    A1 --> C1[読み取り: 100回/アクセス]
    A2 --> C2[読み取り: 全件/アクセス]
    A3 --> C3[読み取り: 全件/アクセス]

    B1 --> D1[読み取り: 50回/ページ<br/>削減率: 50%]
    B2 --> D2[読み取り: 25回/ページ<br/>削減率: 75-90%]
    B3 --> D3[読み取り: 0回/キャッシュヒット<br/>削減率: 100%]

    style C1 fill:#ffcccc
    style C2 fill:#ffcccc
    style C3 fill:#ffcccc
    style D1 fill:#ccffcc
    style D2 fill:#ccffcc
    style D3 fill:#ccffcc
```

---

## 8. 今後の開発ロードマップ

```mermaid
timeline
    title 開発ロードマップ
    section 完了済み
    Phase 13: 監査ログ・セキュリティアラート実装 : 2025-11-01完了
    Phase 2: Firestoreクエリ最適化 : 2025-11-14完了

    section 次のステップ
    Phase 15: TypeScript型エラー修正（最優先） : Result型ガード : テストモック修正 : ButtonProps型定義
    Phase 16: 本番環境検証・改善 : パフォーマンス監視 : 監査ログアーカイブ
    Phase 14: E2Eテスト（後回し推奨） : Playwright実装
```

---

## 9. Phase 2完了チェックリスト

```mermaid
graph TB
    A[Phase 2完了チェックリスト] --> B{Phase 2-1}
    A --> C{Phase 2-2}
    A --> D{Phase 2-3}
    A --> E{Phase 2-4}

    B --> B1[✅ firestore.indexes.json作成]
    B --> B2[✅ 7つの複合インデックス定義]

    C --> C1[✅ auditLogService.ts修正]
    C --> C2[✅ AuditLogs.tsx修正]
    C --> C3[✅ ページネーション動作確認]

    D --> D1[✅ securityAlertService.ts修正]
    D --> D2[✅ SecurityAlerts.tsx修正]
    D --> D3[✅ ページネーション動作確認]

    E --> E1[✅ UsageReports.tsx修正]
    E --> E2[✅ キャッシュ機能実装]
    E --> E3[✅ CodeRabbitレビュー対応]
    E --> E4[✅ Race condition対策]
    E --> E5[✅ メモリリーク対策]

    style B fill:#ccffcc
    style C fill:#ccffcc
    style D fill:#ccffcc
    style E fill:#ccffcc
```

---

## 10. 関連ドキュメント

詳細は以下を参照:
- [phase2-implementation-plan-2025-11-14.md](./phase2-implementation-plan-2025-11-14.md)
- [phase2-completion-summary-2025-11-14.md](./phase2-completion-summary-2025-11-14.md)
- [NAVIGATION.md](../../NAVIGATION.md)

---

**作成日**: 2025-11-14
**作成者**: Claude Code AI
