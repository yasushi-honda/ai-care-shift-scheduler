# BUG-002: Gemini空レスポンス修正 - ダイアグラム集

**更新日**: 2025-12-05

---

## 1. 問題発生フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Frontend as React SPA
    participant CF as Cloud Functions<br/>(generateShift)
    participant Gemini as Vertex AI<br/>(Gemini 2.5 Flash)

    User->>Frontend: AIシフト生成ボタン押下
    Frontend->>CF: POST /generateShift
    CF->>CF: 段階的生成モード判定<br/>(10名 > 5名閾値)
    CF->>Gemini: Phase 1: 骨子生成リクエスト<br/>(responseSchema指定)

    Note over Gemini: propertyOrderingなし<br/>→ 構造化出力生成失敗

    Gemini-->>CF: 空レスポンス<br/>(text: "", finishReason: STOP)
    CF->>CF: JSON.parse("")
    CF-->>CF: SyntaxError: Unexpected end of JSON input
    CF-->>Frontend: HTTP 500 Error
    Frontend-->>User: エラー表示
```

## 2. 根本原因の因果関係図

```mermaid
flowchart TD
    subgraph 根本原因
        A[responseSchemaに<br/>propertyOrderingなし]
    end

    subgraph Gemini内部処理
        B[プロパティ生成順序が不定]
        C[Schemaとの整合性チェック失敗]
        D[構造化出力生成を断念]
    end

    subgraph 結果
        E[空のレスポンスを返却]
        F[finishReason: STOP<br/>正常終了扱い]
        G[クライアント側で<br/>JSON Parse Error]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    E --> G

    style A fill:#f66,stroke:#333
    style G fill:#f66,stroke:#333
    style F fill:#ff9,stroke:#333
```

## 3. 修正内容

```mermaid
flowchart LR
    subgraph Before[修正前]
        B1[type: object]
        B2[properties: ...]
        B3[required: ...]
    end

    subgraph After[修正後]
        A1[type: object]
        A2[properties: ...]
        A3[propertyOrdering: ...]
        A4[required: ...]
    end

    Before -->|追加| After

    style A3 fill:#6f6,stroke:#333
```

## 4. Schema構造（修正後）

```mermaid
graph TD
    subgraph SkeletonSchema[骨子生成Schema]
        S1[staffSchedules<br/>type: array]
        S2[items: object]
        S3[staffId<br/>staffName<br/>restDays<br/>nightShiftDays<br/>nightShiftFollowupDays]
        S4[propertyOrdering:<br/>全プロパティ順序指定]

        S1 --> S2
        S2 --> S3
        S2 --> S4
    end

    subgraph DetailedSchema[詳細生成Schema]
        D1[schedule<br/>type: array]
        D2[items: object]
        D3[staffId<br/>staffName<br/>monthlyShifts]
        D4[monthlyShifts items]
        D5[date<br/>shiftType]
        D6[propertyOrdering:<br/>各レベルで指定]

        D1 --> D2
        D2 --> D3
        D3 --> D4
        D4 --> D5
        D2 --> D6
    end

    style S4 fill:#6f6
    style D6 fill:#6f6
```

## 5. 調査プロセス（WBS）

```mermaid
graph TD
    ROOT[BUG-002 調査・修正] --> INVESTIGATE[調査フェーズ]
    ROOT --> FIX[修正フェーズ]
    ROOT --> DOC[ドキュメント化]

    INVESTIGATE --> I1[既存ドキュメント確認<br/>gemini_json_parsing_troubleshooting]
    INVESTIGATE --> I2[Cloud Functionsログ確認<br/>responseLength: 0 発見]
    INVESTIGATE --> I3[Web検索<br/>Gemini 2.5 空レスポンス問題]
    INVESTIGATE --> I4[公式ドキュメント確認<br/>propertyOrdering発見]

    FIX --> F1[Schema修正<br/>propertyOrdering追加]
    FIX --> F2[プロンプト修正<br/>順序整合]
    FIX --> F3[デバッグログ追加]
    FIX --> F4[デプロイ]

    DOC --> D1[修正記録作成]
    DOC --> D2[ダイアグラム作成]
    DOC --> D3[Serenaメモリ更新]

    style I4 fill:#6f6,stroke:#333
    style F1 fill:#6f6,stroke:#333
```

## 6. BUG-001 → BUG-002 の関連

```mermaid
timeline
    title バグ発見・修正タイムライン（2025-12-05）

    section BUG-001
        07:00 : MT-001実行開始
              : CORSエラー発見
        07:05 : cloudscheduler API有効化
        07:10 : 古い関数削除・再デプロイ
        07:15 : CORS修正完了

    section BUG-002
        07:09 : AIシフト生成テスト
              : JSON Parse Error発見
        07:30 : Cloud Functionsログ確認
              : responseLength: 0 発見
        08:00 : Web検索・原因特定
              : propertyOrdering欠如
        08:30 : 修正実装・デプロイ
```

## 7. Gemini 2.5 Structured Output ベストプラクティス

```mermaid
flowchart TD
    subgraph Must[必須]
        M1[propertyOrdering指定]
        M2[required指定]
        M3[全ネストレベルで適用]
    end

    subgraph Recommended[推奨]
        R1[description追加]
        R2[プロンプトと順序一致]
        R3[integer vs number使い分け]
    end

    subgraph Avoid[避けるべき]
        A1[Schemaをプロンプトに重複記載]
        A2[複雑すぎるSchema]
        A3[propertyOrdering省略]
    end

    Must --> Success[成功する構造化出力]
    Recommended --> Success
    Avoid --> Failure[空レスポンス/エラー]

    style M1 fill:#6f6
    style A3 fill:#f66
```

---

## 関連ドキュメント

- [修正記録（詳細）](bugfix-gemini-empty-response-2025-12-05.md)
- [BUG-001修正記録](bugfix-cors-cloud-functions-2025-12-05.md)
- [手動テストチェックリスト](../docs/manual-test-checklist.md)
