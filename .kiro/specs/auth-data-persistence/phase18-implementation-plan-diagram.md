# Phase 18: E2Eテストの拡充と監視の強化 - 実装計画（図解版）

**作成日**: 2025-11-12
**仕様ID**: auth-data-persistence
**Phase**: 18
**目的**: 振り返り・引き継ぎ用の視覚化ドキュメント

---

## 目次

1. [Phase 18実装タイムライン](#phase-18実装タイムライン)
2. [実装フロー](#実装フロー)
3. [Permission error検出の仕組み](#permission-error検出の仕組み)
4. [Phase 18アーキテクチャ](#phase-18アーキテクチャ)
5. [テスト実行フロー](#テスト実行フロー)
6. [監視アラートフロー](#監視アラートフロー)
7. [Phase 17-18の関係](#phase-17-18の関係)

---

## Phase 18実装タイムライン

```mermaid
gantt
    title Phase 18 実装タイムライン
    dateFormat YYYY-MM-DD
    section Phase 18準備
    要件定義ドキュメント作成           :done, req, 2025-11-12, 1h
    技術設計ドキュメント作成           :done, design, after req, 1h
    実装計画書作成（Mermaid図）       :active, plan, after design, 1h
    経緯まとめドキュメント作成         :crit, context, after plan, 30m

    section Phase 18.1実装
    コンソール監視ヘルパー実装         :p181_helper, after context, 1h
    Permission error検出テスト実装    :p181_test, after p181_helper, 2h
    ローカル環境検証                  :p181_verify, after p181_test, 1h
    実装ガイド・マニュアル作成         :p181_doc, after p181_verify, 1h

    section Phase 18.2実装
    監視アラート設定ガイド作成         :p182_guide, after p181_doc, 1h
    Google Cloud Monitoring設定       :p182_setup, after p182_guide, 1h
    動作確認とトラブルシューティング   :p182_verify, after p182_setup, 1h

    section Phase 18完了
    検証ドキュメント作成               :verify, after p182_verify, 1h
    Phase 18総括レポート作成          :summary, after verify, 1h
```

**推定総工数**: 約13時間
- Phase 18準備: 3.5時間
- Phase 18.1実装: 5時間
- Phase 18.2実装: 3時間
- Phase 18完了: 2時間

---

## 実装フロー

```mermaid
flowchart TD
    Start([Phase 18開始]) --> Doc1[要件定義]
    Doc1 --> Doc2[技術設計]
    Doc2 --> Doc3[実装計画・経緯まとめ]

    Doc3 --> Decision1{実装開始?}
    Decision1 -->|No| Review[ドキュメントレビュー]
    Review --> Doc3
    Decision1 -->|Yes| Phase181

    Phase181[Phase 18.1実装開始]
    Phase181 --> Helper[コンソール監視ヘルパー作成]
    Helper --> Test[Permission error検出テスト作成]
    Test --> Verify1[ローカル環境検証]

    Verify1 --> Check1{テスト成功?}
    Check1 -->|No| Debug1[デバッグ・修正]
    Debug1 --> Test
    Check1 -->|Yes| Doc181[実装ガイド・マニュアル作成]

    Doc181 --> Phase182[Phase 18.2実装開始]
    Phase182 --> Guide[監視アラート設定ガイド作成]
    Guide --> Setup[Google Cloud Monitoring設定]
    Setup --> Verify2[動作確認]

    Verify2 --> Check2{アラート動作OK?}
    Check2 -->|No| Debug2[設定調整]
    Debug2 --> Setup
    Check2 -->|Yes| Doc182[トラブルシューティングガイド作成]

    Doc182 --> Final[検証ドキュメント・総括レポート作成]
    Final --> End([Phase 18完了])

    style Start fill:#90EE90
    style End fill:#90EE90
    style Phase181 fill:#FFD700
    style Phase182 fill:#FFD700
    style Decision1 fill:#FFA500
    style Check1 fill:#FFA500
    style Check2 fill:#FFA500
```

---

## Permission error検出の仕組み

### シーケンス図: Permission error検出フロー

```mermaid
sequenceDiagram
    actor E2Eテスト
    participant Monitor as ConsoleMonitor
    participant Browser as ブラウザ
    participant Page as Webページ
    participant Firestore as Firestore
    participant Test as テストアサーション

    E2Eテスト->>Monitor: new ConsoleMonitor(page)
    Note over Monitor: コンソールリスナー開始

    E2Eテスト->>Browser: page.goto('/admin/users')
    Browser->>Page: ページ読み込み
    Page->>Firestore: getDoc(users/userId)

    alt Permission error発生
        Firestore-->>Page: ❌ Missing or insufficient permissions
        Page->>Browser: console.error("Permission error")
        Browser->>Monitor: consoleイベント発火
        Monitor->>Monitor: メッセージを記録
        Note over Monitor: {type: 'error', text: 'Permission...'}
    else 正常動作
        Firestore-->>Page: ✅ ドキュメント取得成功
        Page->>Browser: UI表示
    end

    E2Eテスト->>Monitor: hasPermissionError()
    Monitor->>Monitor: パターンマッチング
    Note over Monitor: /permission/i<br/>/insufficient permissions/i

    alt Permission error検出
        Monitor-->>Test: ❌ エラーメッセージを返却
        Test->>Test: expect(...).toBeNull()
        Test-->>E2Eテスト: ❌ テスト失敗
    else Permission errorなし
        Monitor-->>Test: ✅ null を返却
        Test->>Test: expect(null).toBeNull()
        Test-->>E2Eテスト: ✅ テスト成功
    end
```

### データフロー図

```mermaid
graph LR
    A[ブラウザコンソール] -->|console.error| B[ConsoleMonitor]
    B -->|ログ記録| C[consoleMessages配列]
    C -->|パターンマッチ| D{Permission error?}
    D -->|Yes| E[エラーメッセージ返却]
    D -->|No| F[null返却]
    E --> G[テスト失敗]
    F --> H[テスト成功]

    style A fill:#FFE4B5
    style B fill:#87CEEB
    style C fill:#87CEEB
    style D fill:#FFA500
    style E fill:#FF6347
    style F fill:#90EE90
    style G fill:#FF6347
    style H fill:#90EE90
```

---

## Phase 18アーキテクチャ

### システム全体構成

```mermaid
graph TB
    subgraph "Phase 18.1: E2Eテスト"
        A[Playwright E2Eテスト]
        B[ConsoleMonitor<br/>ヘルパー]
        C[permission-errors.spec.ts]
        A --> B
        A --> C
        C --> B
    end

    subgraph "本番環境"
        D[Firebase Hosting]
        E[Firestore]
        F[Cloud Functions]
        D --> E
        D --> F
    end

    subgraph "Phase 18.2: 監視"
        G[Google Cloud<br/>Monitoring]
        H[Alerting Policy]
        I[Notification<br/>Channel]
        G --> H
        H --> I
    end

    subgraph "CI/CD"
        J[GitHub Actions]
        K[手動トリガー<br/>workflow_dispatch]
        J --> K
    end

    A -->|テスト実行| D
    E -->|Permission error| G
    F -->|実行エラー| G
    I -->|Email通知| L[開発者]
    K -->|テスト実行| A

    style A fill:#87CEEB
    style B fill:#87CEEB
    style C fill:#87CEEB
    style G fill:#FFD700
    style H fill:#FFD700
    style I fill:#FFD700
    style J fill:#90EE90
    style K fill:#90EE90
```

### ファイル構成

```mermaid
graph TD
    Root[プロジェクトルート]

    Root --> E2E[e2e/]
    Root --> Kiro[.kiro/specs/auth-data-persistence/]
    Root --> GH[.github/workflows/]

    E2E --> Helper[helpers/console-monitor.ts<br/>🆕 Phase 18.1]
    E2E --> Test[permission-errors.spec.ts<br/>🆕 Phase 18.1]
    E2E --> Existing[既存テストファイル群]

    Kiro --> Req[phase18-requirements.md<br/>✅ 作成済み]
    Kiro --> Design[phase18-design.md<br/>✅ 作成済み]
    Kiro --> Plan[phase18-implementation-plan-diagram.md<br/>🔄 作成中]
    Kiro --> Context[phase17-18-context.md<br/>📝 次に作成]
    Kiro --> ImplGuide[phase18-implementation-guide.md<br/>📝 Phase 18.1後に作成]
    Kiro --> TestManual[phase18-test-manual.md<br/>📝 Phase 18.1後に作成]
    Kiro --> Monitor[phase18-monitoring-setup-guide.md<br/>📝 Phase 18.2で作成]
    Kiro --> Trouble[phase18-troubleshooting.md<br/>📝 Phase 18.2後に作成]
    Kiro --> Verify[phase18-verification.md<br/>📝 最後に作成]

    GH --> Workflow[e2e-permission-check.yml<br/>🆕 Phase 18.1]

    style Helper fill:#FFD700
    style Test fill:#FFD700
    style Workflow fill:#FFD700
    style Plan fill:#87CEEB
    style Context fill:#FFA07A
    style ImplGuide fill:#FFA07A
    style TestManual fill:#FFA07A
    style Monitor fill:#FFA07A
    style Trouble fill:#FFA07A
    style Verify fill:#FFA07A
```

---

## テスト実行フロー

### ローカル環境でのテスト実行

```mermaid
flowchart TD
    Start([開発者がテスト実行開始])

    Start --> Login[本番環境にログイン]
    Login --> SetEnv[環境変数設定<br/>TEST_USER_ID=xxx]
    SetEnv --> RunCmd[npm run test:e2e:permission実行]

    RunCmd --> Playwright[Playwright起動]
    Playwright --> Browser[ブラウザ起動<br/>Chromium]
    Browser --> Monitor[ConsoleMonitor起動]

    Monitor --> Test1[テスト1: ユーザー詳細ページ]
    Test1 --> Check1{Permission error?}
    Check1 -->|Yes| Fail1[❌ テスト失敗]
    Check1 -->|No| Pass1[✅ テスト成功]

    Pass1 --> Test2[テスト2: セキュリティアラート]
    Test2 --> Check2{Permission error?}
    Check2 -->|Yes| Fail2[❌ テスト失敗]
    Check2 -->|No| Pass2[✅ テスト成功]

    Pass2 --> Test3[テスト3: バージョン履歴]
    Test3 --> Check3{Permission error?}
    Check3 -->|Yes| Fail3[❌ テスト失敗]
    Check3 -->|No| Pass3[✅ テスト成功]

    Pass3 --> TestN[その他のテスト...]
    TestN --> Report[テストレポート生成]

    Fail1 --> Report
    Fail2 --> Report
    Fail3 --> Report

    Report --> Result{全テスト成功?}
    Result -->|Yes| Success([✅ テスト完了<br/>Permission errorなし])
    Result -->|No| Failure([❌ テスト失敗<br/>Permission error検出])

    Failure --> Debug[デバッグ<br/>コンソールログ確認]
    Debug --> Fix[firestore.rules修正]
    Fix --> Deploy[デプロイ]
    Deploy --> RunCmd

    style Start fill:#90EE90
    style Success fill:#90EE90
    style Failure fill:#FF6347
    style Fix fill:#FFD700
    style Deploy fill:#FFD700
```

### CI/CD（GitHub Actions）でのテスト実行

```mermaid
flowchart TD
    Start([開発者が手動トリガー])

    Start --> GH[GitHub Actions起動]
    GH --> Input[TEST_USER_ID入力]
    Input --> Setup[環境セットアップ]

    Setup --> Install1[npm ci実行]
    Install1 --> Install2[Playwright install実行]
    Install2 --> RunTest[テスト実行]

    RunTest --> Result{テスト結果}
    Result -->|Success| Upload1[✅ レポートアップロード]
    Result -->|Failure| Upload2[❌ レポートアップロード]

    Upload1 --> Notify1[✅ 成功通知]
    Upload2 --> Notify2[❌ 失敗通知]

    Notify1 --> End1([完了: デプロイ可能])
    Notify2 --> End2([完了: 修正必要])

    style Start fill:#90EE90
    style End1 fill:#90EE90
    style End2 fill:#FF6347
    style GH fill:#87CEEB
```

---

## 監視アラートフロー

### Permission error検出と通知

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as Webアプリ
    participant Firestore as Firestore
    participant Logging as Cloud Logging
    participant Monitoring as Cloud Monitoring
    participant Alert as Alerting Policy
    participant Email as Email通知
    participant Dev as 開発者

    User->>App: ページアクセス
    App->>Firestore: データ取得リクエスト

    alt Security Rules違反
        Firestore-->>App: ❌ Permission denied
        App->>App: console.error("Permission error")
        App->>Logging: エラーログ記録
        Note over Logging: textPayload: "Missing or insufficient permissions"

        Logging->>Monitoring: ログエントリ送信
        Monitoring->>Alert: 条件チェック<br/>5分間に3回以上?

        alt 閾値超過
            Alert->>Email: アラート送信
            Email->>Dev: 📧 Permission error alert
            Note over Dev: 即座に対応可能<br/>（Phase 17では数時間後に発見）
        end
    else 正常動作
        Firestore-->>App: ✅ データ取得成功
        App->>User: ページ表示
    end
```

### 監視システムの階層構造

```mermaid
graph TB
    subgraph "本番環境"
        A[Webアプリ] --> B[Cloud Logging]
        C[Cloud Functions] --> B
        D[Firestore] --> B
    end

    subgraph "監視層"
        B --> E[Cloud Monitoring]
        E --> F1[Alerting Policy 1:<br/>Permission Error]
        E --> F2[Alerting Policy 2:<br/>Cloud Functions Error]
        E --> F3[Alerting Policy 3:<br/>HTTP 5xx Error]
    end

    subgraph "通知層"
        F1 --> G[Notification Channel]
        F2 --> G
        F3 --> G
        G --> H1[Email]
        G --> H2[Slack<br/>オプション]
    end

    subgraph "対応層"
        H1 --> I[開発者]
        H2 --> I
        I --> J[迅速な修正<br/>Phase 17: 9時間<br/>Phase 18: 1時間以内]
    end

    style A fill:#FFE4B5
    style B fill:#87CEEB
    style E fill:#87CEEB
    style F1 fill:#FFD700
    style F2 fill:#FFD700
    style F3 fill:#FFD700
    style G fill:#90EE90
    style J fill:#90EE90
```

---

## Phase 17-18の関係

### Phase 17で発見された問題とPhase 18の解決策

```mermaid
graph TD
    subgraph "Phase 17: 問題発見"
        P175[17.5: versions Permission error]
        P176[17.6: COOP警告]
        P177[17.7: 説明ログ追加]
        P178[17.8: User Fetch Permission error]
        P179[17.9: Admin User Detail Permission error]
        P1710[17.10: onUserDelete TypeScriptエラー]
        P1711[17.11: Security Alerts Permission error]
    end

    subgraph "問題分析"
        Analysis[5つのPermission error<br/>全て事後対応<br/>総工数: 9時間以上]
    end

    subgraph "Phase 18: 予防策"
        P181[18.1: Permission error<br/>自動検出E2Eテスト]
        P182[18.2: 監視アラート設定]
    end

    subgraph "期待される効果"
        Effect1[80-90%のPermission errorを<br/>デプロイ前に検出]
        Effect2[残り10-20%は<br/>本番環境で即座に通知]
        Effect3[バグ修正時間を50%削減<br/>数時間 → 1時間以内]
    end

    P175 --> Analysis
    P178 --> Analysis
    P179 --> Analysis
    P1711 --> Analysis

    Analysis --> P181
    Analysis --> P182

    P181 --> Effect1
    P182 --> Effect2
    Effect1 --> Effect3
    Effect2 --> Effect3

    style Analysis fill:#FF6347
    style P181 fill:#FFD700
    style P182 fill:#FFD700
    style Effect1 fill:#90EE90
    style Effect2 fill:#90EE90
    style Effect3 fill:#90EE90
```

### タイムライン: Phase 0 → Phase 18

```mermaid
timeline
    title AI Care Shift Scheduler開発ロードマップ
    section Phase 0-12.5完了
    Phase 0-6 : デモ環境整備
              : 認証・データ永続化
              : AIシフト生成
    Phase 7-12.5 : バージョン管理
                 : 監査ログ・セキュリティ
                 : 招待機能
    section Phase 13-16完了
    Phase 13 : セキュリティ強化
    Phase 14 : E2Eテスト実装
    Phase 15-16 : データ復元機能
    section Phase 17完了（本番環境バグ修正）
    Phase 17.5-17.11 : 5つのPermission error修正
                     : COOP警告対応
                     : 総工数9時間以上
    section Phase 18実施中（予防策）
    Phase 18.1 : Permission error自動検出
    Phase 18.2 : 監視アラート設定
    Phase 18完了 : 再発防止体制確立
```

---

## ドキュメント相互参照

### Phase 18関連ドキュメント構成

```mermaid
graph TD
    subgraph "Phase 17振り返り"
        A[phase17-summary-2025-11-12.md<br/>Phase 17総括レポート]
    end

    subgraph "Phase 18要件・設計"
        B[phase18-requirements.md<br/>要件定義]
        C[phase18-design.md<br/>技術設計]
        D[phase18-implementation-plan-diagram.md<br/>実装計画（Mermaid図）<br/>本ドキュメント]
    end

    subgraph "Phase 18実装"
        E[phase17-18-context.md<br/>経緯まとめ]
        F[phase18-implementation-guide.md<br/>実装ガイド]
        G[phase18-test-manual.md<br/>テスト実行マニュアル]
    end

    subgraph "Phase 18監視"
        H[phase18-monitoring-setup-guide.md<br/>監視設定ガイド]
        I[phase18-troubleshooting.md<br/>トラブルシューティング]
    end

    subgraph "Phase 18完了"
        J[phase18-verification.md<br/>検証レポート]
    end

    A -->|教訓| B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G

    D --> H
    H --> I

    G --> J
    I --> J

    style A fill:#FFE4B5
    style B fill:#87CEEB
    style C fill:#87CEEB
    style D fill:#87CEEB
    style E fill:#FFA07A
    style F fill:#FFA07A
    style G fill:#FFA07A
    style H fill:#FFA07A
    style I fill:#FFA07A
    style J fill:#90EE90
```

**参照の流れ**:
1. **Phase 17総括** → なぜPhase 18が必要か理解
2. **要件定義** → 何を実現するか理解
3. **技術設計** → どのように実装するか理解
4. **実装計画（本ドキュメント）** → 全体像とタイムラインを視覚的に理解
5. **経緯まとめ** → Phase 17-18の詳細な背景を理解
6. **実装ガイド** → 実際の実装手順を理解
7. **テスト実行マニュアル** → テストの実行方法を理解
8. **監視設定ガイド** → 監視の設定方法を理解
9. **トラブルシューティング** → 問題発生時の対処法を理解
10. **検証レポート** → Phase 18完了確認

---

## 次のステップ

### 今すぐ作成すべきドキュメント

**優先度1（最高）**:
1. ✅ `phase18-implementation-plan-diagram.md` - 本ドキュメント（作成中）
2. 📝 `phase17-18-context.md` - Phase 17-18の経緯まとめ（次に作成）

**優先度2（高）**:
3. 📝 `phase18-implementation-guide.md` - 実装ガイド（Phase 18.1実装時）
4. 📝 `phase18-test-manual.md` - テスト実行マニュアル（Phase 18.1実装時）

**優先度3（中）**:
5. 📝 `phase18-monitoring-setup-guide.md` - 監視設定ガイド（Phase 18.2実装時）
6. 📝 `phase18-troubleshooting.md` - トラブルシューティング（Phase 18.2実装時）

**優先度4（完了時）**:
7. 📝 `phase18-verification.md` - 検証レポート（Phase 18完了時）

### 実装開始前のチェックリスト

- ✅ Phase 18要件定義完了
- ✅ Phase 18技術設計完了
- 🔄 Phase 18実装計画（Mermaid図）作成中
- ⏳ Phase 17-18経緯まとめ作成待ち
- ⏳ 実装ガイド・マニュアル作成待ち

---

**ドキュメント作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: Phase 18実装計画（視覚化）完了
**次のステップ**: Phase 17-18経緯まとめドキュメント作成

---

## 補足: Mermaid図の見方

### ガントチャート
- **緑色のバー**: 完了済みのタスク
- **黄色のバー**: 実行中のタスク
- **赤色のバー**: 重要タスク（crit）

### フローチャート
- **緑色の楕円**: 開始/終了ポイント
- **黄色の長方形**: 重要なフェーズ
- **オレンジ色の菱形**: 判断ポイント

### シーケンス図
- **上から下**: 時系列の流れ
- **矢印**: メッセージの送受信
- **破線の矢印**: 返り値

### グラフ
- **青色**: データ処理・監視系
- **黄色**: 重要な処理
- **緑色**: 成功状態
- **赤色**: エラー状態
