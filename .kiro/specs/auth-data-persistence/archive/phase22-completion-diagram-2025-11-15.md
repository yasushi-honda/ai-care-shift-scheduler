# Phase 22 完了ドキュメント - Mermaid図版

**更新日**: 2025-11-15
**仕様ID**: auth-data-persistence
**Phase**: Phase 22 - 招待フローE2Eテスト

このドキュメントは、Phase 22の全体像を視覚的に表現したMermaid図集です。

詳細なテキスト情報は [phase22-completion-2025-11-15.md](./phase22-completion-2025-11-15.md) を参照してください。

---

## 1. Phase 22実装進捗状況（ガントチャート）

```mermaid
gantt
    title Phase 22 - 招待フローE2Eテスト実装進捗
    dateFormat YYYY-MM-DD

    section Session 1-2
    E2Eテスト環境整備           :done, s1, 2025-11-14, 1d
    招待受け入れテスト実装       :done, s2, 2025-11-14, 1d
    招待送信テスト実装           :done, s3, 2025-11-14, 1d

    section Session 3
    Phase 19-21変更整理         :done, s4, 2025-11-15, 4h
    CodeRabbitレビュー対応      :done, s5, 2025-11-15, 1h
    vite.config.ts修正          :done, s6, 2025-11-15, 30m
    統合テスト実行（3/6成功）    :done, s7, 2025-11-15, 1h

    section Session 4
    Admin SDK初期化修正         :done, s8, 2025-11-15, 1h
    統合テスト再実行（3/6成功）  :done, s9, 2025-11-15, 1h
    テスト結果分析              :done, s10, 2025-11-15, 1h
    完了ドキュメント作成         :active, s11, 2025-11-15, 1h

    section Phase 23（将来）
    Test 2修正（Cloud Function化） :crit, p23-1, 2025-11-16, 4h
    Test 5-6修正（権限設定）        :p23-2, 2025-11-16, 2h
    統合テスト完全成功（6/6）       :milestone, p23-3, 2025-11-16, 0d
```

---

## 2. テスト結果サマリー（円グラフ）

```mermaid
pie title Phase 22 E2Eテスト結果（Session 4）
    "成功 (Test 1, 3, 4)" : 50
    "失敗 - Security Rules問題 (Test 2)" : 16.7
    "失敗 - UI表示問題 (Test 5, 6)" : 33.3
```

---

## 3. 招待受け入れフロー - 正常系（シーケンス図）

```mermaid
sequenceDiagram
    actor User as 未ログインユーザー
    participant Browser
    participant InviteAccept as InviteAccept.tsx
    participant Firestore
    participant AuthContext

    User->>Browser: 招待リンクにアクセス<br/>/invite?token=xxx
    Browser->>InviteAccept: ページレンダリング
    InviteAccept->>Firestore: invitationsコレクション読み取り<br/>token=xxx
    Firestore-->>InviteAccept: 招待データ取得<br/>{email, facilityId, role}

    InviteAccept->>Browser: 招待情報表示<br/>✅ Test 1成功
    Note over InviteAccept,Browser: メールアドレス: user@example.com<br/>ロール: 編集者

    User->>Browser: 「Googleでログイン」クリック
    Browser->>AuthContext: Google認証実行
    AuthContext-->>Browser: 認証成功

    Browser->>InviteAccept: ログイン後リダイレクト<br/>/invite?token=xxx

    alt メールアドレス一致
        InviteAccept->>Firestore: facilityドキュメント読み取り
        Note over InviteAccept,Firestore: ❌ Test 2失敗<br/>Security Rules権限エラー
        Firestore-->>InviteAccept: 403 Forbidden
        InviteAccept->>User: エラー表示
    else メールアドレス不一致
        InviteAccept->>User: エラー表示<br/>✅ Test 4成功
    end
```

---

## 4. Test 2失敗の根本原因（フローチャート）

```mermaid
flowchart TD
    A[ユーザーログイン<br/>facilities: []] --> B{招待受け入れ処理開始}
    B --> C[Facilityドキュメント読み取り]
    C --> D{Security Rules評価}
    D --> E[hasAccessToFacility<br/>facilityId?]
    E --> F{user.facilities.hasAny<br/>facilityId?}
    F -->|facilities=[]| G[❌ false]
    G --> H[403 Forbidden]
    H --> I[エラー表示:<br/>アクセス権限の付与に失敗]
    I --> J[リトライ<br/>約20回]
    J --> K[10秒タイムアウト]
    K --> L[❌ Test 2失敗]

    style H fill:#f99
    style L fill:#f99
    style G fill:#f99
```

---

## 5. 残存課題と解決策オプション（グラフ）

```mermaid
graph TB
    subgraph "課題A: Test 2 - Security Rules権限問題"
        A1[❌ 招待自動受け入れ失敗]
        A1 --> A2[Option A:<br/>テストデータ修正]
        A1 --> A3[Option B:<br/>Security Rules緩和]
        A1 --> A4[Option C:<br/>Cloud Function化<br/>推奨]

        A2 --> A2a[所要時間: 30分<br/>影響範囲: テストのみ<br/>リスク: 低]
        A3 --> A3a[所要時間: 1-2時間<br/>影響範囲: 本番環境<br/>リスク: 中]
        A4 --> A4a[所要時間: 2-4時間<br/>影響範囲: 本番環境<br/>リスク: 低・推奨]
    end

    subgraph "課題B: Test 5-6 - UI表示問題"
        B1[❌ メンバー追加ボタン<br/>表示されない]
        B1 --> B2[調査項目1:<br/>テストユーザー権限]
        B1 --> B3[調査項目2:<br/>ページナビゲーション]
        B1 --> B4[調査項目3:<br/>UIロジック確認]

        B2 --> B2a[修正: super-admin<br/>権限付与]
        B3 --> B3a[修正: ルーティング<br/>確認・修正]
        B4 --> B4a[修正: FacilityDetail.tsx<br/>ロジック修正]
    end

    style A1 fill:#f99
    style B1 fill:#f99
    style A4 fill:#9f9
    style A4a fill:#9f9
```

---

## 6. Phase 22 → Phase 23 引き継ぎマップ

```mermaid
flowchart LR
    subgraph "Phase 22完了"
        P22A[✅ 基本テスト成功<br/>3/6テスト]
        P22B[✅ E2E基盤構築]
        P22C[❌ 残存課題2件]
        P22D[✅ ドキュメント整備]
    end

    subgraph "Phase 23推奨タスク"
        P23A[優先度: 高<br/>Test 2修正<br/>Cloud Function化]
        P23B[優先度: 高<br/>本番環境動作確認]
        P23C[優先度: 中<br/>Test 5-6修正<br/>権限設定]
        P23D[優先度: 低<br/>E2Eカバレッジ拡大]
    end

    P22C --> P23A
    P22C --> P23C
    P22A --> P23B
    P22B --> P23D
    P22D --> P23B

    style P22A fill:#9f9
    style P22B fill:#9f9
    style P22D fill:#9f9
    style P22C fill:#ff9
    style P23A fill:#99f
    style P23B fill:#99f
```

---

## 7. E2Eテスト環境アーキテクチャ

```mermaid
graph TB
    subgraph "Playwright Test Runner"
        PT[playwright.config.ts]
        GS[global-setup.ts<br/>Admin SDK初期化]
        GT[global-teardown.ts<br/>クリーンアップ]
    end

    subgraph "Test Helpers"
        AH[auth-helper.ts<br/>認証・ユーザー作成]
        FH[firestore-helper.ts<br/>Firestoreデータ作成]
    end

    subgraph "Firebase Emulator Suite"
        AUTH[Auth Emulator<br/>:9099]
        FS[Firestore Emulator<br/>:8080]
        UI[Emulator UI<br/>:4000]
    end

    subgraph "Vite Dev Server"
        VITE[React App<br/>:5173]
    end

    PT --> GS
    PT --> GT
    GS --> AH
    GS --> FH
    AH --> AUTH
    FH --> FS

    VITE --> AUTH
    VITE --> FS

    PT -.テスト実行.-> VITE

    style AUTH fill:#9cf
    style FS fill:#9cf
    style VITE fill:#fcf
```

---

## 8. Phase 0-22実装状況ロードマップ

```mermaid
timeline
    title Auth-Data-Persistence仕様 実装ロードマップ

    section Phase 0-6（完了）
        Phase 0 : デモ環境整備
              : 2025-10-23 - 2025-10-31
        Phase 1-6 : 基本認証・データ永続化
                : 2025-10-31 - 2025-11-05

    section Phase 7-12（完了）
        Phase 7-9 : マルチテナント実装
                : 2025-11-05 - 2025-11-08
        Phase 10-12 : RBAC実装
                  : 2025-11-08 - 2025-11-12

    section Phase 13-18（完了）
        Phase 13-15 : Security Rules強化
                  : 2025-11-12 - 2025-11-13
        Phase 16-18 : 本番デプロイ・検証
                  : 2025-11-13 - 2025-11-14

    section Phase 19-22（完了）
        Phase 19-21 : ログアウト・デバッグログ
                  : 2025-11-14 - 2025-11-15
        Phase 22 : 招待フローE2Eテスト
               : 2025-11-14 - 2025-11-15
               : ✅ 基本完了（残存課題あり）

    section Phase 23（推奨）
        Phase 23 : 残存課題対応
               : 2025-11-16 -
               : Cloud Function化・権限設定改善
```

---

## 9. 成果物マトリックス

```mermaid
graph LR
    subgraph "テストコード"
        T1[invitation-flow.spec.ts<br/>6テストシナリオ]
        T2[auth-helper.ts<br/>認証ヘルパー]
        T3[firestore-helper.ts<br/>Firestoreヘルパー]
    end

    subgraph "設定ファイル"
        C1[playwright.config.ts<br/>Playwright設定]
        C2[global-setup.ts<br/>グローバルセットアップ]
        C3[vite.config.ts<br/>ポート5173統一]
    end

    subgraph "ドキュメント"
        D1[phase22-completion.md<br/>完了記録テキスト版]
        D2[phase22-completion-diagram.md<br/>完了記録Mermaid図版]
        D3[phase22-session4-test-results.md<br/>Session 4テスト結果]
        D4[phase22-session3-completion-summary.md<br/>Session 3完了サマリー]
        D5[phase19-21-uncommitted-changes-analysis.md<br/>Phase 19-21変更分析]
    end

    T1 --> C1
    T1 --> T2
    T1 --> T3
    C1 --> C2

    T1 -.記録.-> D3
    D3 -.集約.-> D1
    D1 -.可視化.-> D2

    style D1 fill:#ffc
    style D2 fill:#ffc
    style D3 fill:#ffc
```

---

## 10. Phase 22開発ワークフロー

```mermaid
flowchart TD
    A[Phase 22開始] --> B[E2Eテスト環境整備]
    B --> C[招待受け入れテスト実装]
    C --> D[招待送信テスト実装]
    D --> E[統合テスト実行]

    E --> F{テスト結果}
    F -->|0/6成功| G[Session 2:<br/>基本修正]
    F -->|2/6成功| H[Session 3:<br/>vite.config.ts修正]
    F -->|3/6成功| I[Session 4:<br/>Admin SDK修正]

    G --> E
    H --> E
    I --> E

    E -->|3/6成功<br/>安定| J[テスト結果分析]
    J --> K[残存課題特定]
    K --> L{完全完了可能?}

    L -->|Yes| M[全テスト修正<br/>追加2-6時間]
    L -->|No<br/>推奨| N[基本完了として<br/>ドキュメント化]

    M --> O[Phase 22完全完了<br/>6/6テスト成功]
    N --> P[Phase 22基本完了<br/>3/6テスト成功<br/>残存課題あり]

    P --> Q[完了ドキュメント作成<br/>テキスト+Mermaid図]
    Q --> R[コミット・プッシュ]
    R --> S[GitHub Actions CI/CD]
    S --> T[Phase 23へ引き継ぎ]

    style P fill:#9f9
    style Q fill:#9f9
    style R fill:#9f9
    style T fill:#99f
```

---

## 関連ドキュメント

- **テキスト版**: [phase22-completion-2025-11-15.md](./phase22-completion-2025-11-15.md)
- **テスト結果**: [phase22-session4-test-results-2025-11-15.md](./phase22-session4-test-results-2025-11-15.md)
- **Session 3サマリー**: [phase22-session3-completion-summary-2025-11-15.md](./phase22-session3-completion-summary-2025-11-15.md)

---

**記録者**: Claude Code
**作成日**: 2025-11-15
