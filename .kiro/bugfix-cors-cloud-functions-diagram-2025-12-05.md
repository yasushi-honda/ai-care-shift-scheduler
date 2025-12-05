# BUG-001: CORSエラー修正 - ダイアグラム集

**更新日**: 2025-12-05

---

## 1. 問題発生タイムライン

```mermaid
timeline
    title Cloud Functions デプロイ問題タイムライン

    section 正常期間
        2025-10-31 : 最後の正常デプロイ
                   : generateShift(us-central1)

    section 問題期間（3週間）
        2025-11-14 : cloudscheduler API権限エラー開始
                   : Functionsデプロイ失敗開始
        2025-11-26 : asia-northeast1移行コミット
                   : デプロイ失敗（気づかず）
        2025-12-05 : 手動テストでCORSエラー発見

    section 修正完了
        2025-12-05 : API有効化・再デプロイ
                   : 全関数asia-northeast1で稼働
```

## 2. 問題の因果関係図

```mermaid
flowchart TD
    subgraph 根本原因
        A[cloudscheduler.googleapis.com<br/>APIが無効]
    end

    subgraph デプロイ失敗
        B[scheduledBackup関数が<br/>Cloud Schedulerを必要]
        C[Firebase CLIが<br/>API有効化を試行]
        D[権限エラーで失敗]
        E[Functionsデプロイ<br/>全体が中断]
    end

    subgraph 問題のマスキング
        F[CI/CDワークフロー設計]
        G["|| echo で<br/>エラーを無視"]
        H[Hosting/Rules<br/>デプロイは成功]
        I[ワークフロー全体<br/>「成功」表示]
    end

    subgraph 結果
        J[古いus-central1関数<br/>のみ稼働]
        K[フロントエンドは<br/>asia-northeast1を呼び出し]
        L[関数が存在しない<br/>CORSエラー発生]
    end

    A --> B
    B --> C
    C --> D
    D --> E

    E --> F
    F --> G
    G --> H
    H --> I

    E --> J
    J --> K
    K --> L

    style A fill:#f66,stroke:#333
    style L fill:#f66,stroke:#333
    style I fill:#ff9,stroke:#333
```

## 3. 修正作業フロー

```mermaid
flowchart LR
    subgraph Step1[Step 1: 調査]
        A1[CORSエラー発見] --> A2[GitHub Actions<br/>ログ確認]
        A2 --> A3[cloudscheduler<br/>権限エラー特定]
    end

    subgraph Step2[Step 2: API有効化]
        B1[gcloud auth login] --> B2[gcloud services enable<br/>cloudscheduler]
        B2 --> B3[API有効化成功]
    end

    subgraph Step3[Step 3: 古い関数削除]
        C1[gcloud functions delete<br/>generateShift us-central1] --> C2[他3関数も削除]
    end

    subgraph Step4[Step 4: 再デプロイ]
        D1[git commit --allow-empty] --> D2[git push]
        D2 --> D3[GitHub Actions<br/>デプロイ成功]
    end

    Step1 --> Step2 --> Step3 --> Step4

    style A1 fill:#f66
    style D3 fill:#6f6
```

## 4. Cloud Functions リージョン構成（修正後）

```mermaid
graph TB
    subgraph GCP["Google Cloud Platform"]
        subgraph Tokyo["asia-northeast1 (東京)"]
            F1[generateShift<br/>AIシフト生成]
            F2[assignSuperAdminOnFirstUser<br/>初回ユーザー権限]
            F3[updateLastLogin<br/>ログイン更新]
            F4[archiveAuditLogs<br/>監査ログアーカイブ]
            F5[backupFacilityData<br/>施設バックアップ]
            F6[restoreFacilityData<br/>施設リストア]
            F7[scheduledBackup<br/>定期バックアップ]
            F8[generateMonthlyReport<br/>月次レポート生成]
            F9[scheduledMonthlyReport<br/>定期レポート]
            F10[fixFirstUserRole<br/>初回ロール修正]
        end

        subgraph Iowa["us-central1 (アイオワ)"]
            F11[onUserDelete<br/>ユーザー削除]
        end

        subgraph VertexAI["Vertex AI"]
            V1[Gemini 2.5 Flash<br/>asia-northeast1]
        end
    end

    subgraph Client["クライアント"]
        C1[Firebase Hosting<br/>React SPA]
    end

    C1 -->|POST| F1
    F1 -->|API Call| V1

    style Tokyo fill:#e1f5fe
    style F1 fill:#4caf50,color:#fff
```

## 5. WBS（作業分解図）

```mermaid
graph TD
    ROOT[BUG-001 修正] --> INVESTIGATE[調査フェーズ]
    ROOT --> FIX[修正フェーズ]
    ROOT --> DOC[ドキュメント化]

    INVESTIGATE --> I1[CORSエラー確認]
    INVESTIGATE --> I2[GitHub Actionsログ分析]
    INVESTIGATE --> I3[根本原因特定]

    FIX --> F1[cloudscheduler API有効化]
    FIX --> F2[古い関数削除]
    FIX --> F3[再デプロイトリガー]
    FIX --> F4[デプロイ成功確認]

    DOC --> D1[修正記録作成]
    DOC --> D2[ダイアグラム作成]
    DOC --> D3[GitHub Pages更新]
    DOC --> D4[Gitコミット・Push]

    style ROOT fill:#4caf50,color:#fff
    style I3 fill:#f44336,color:#fff
    style F4 fill:#4caf50,color:#fff
```

## 6. ガントチャート

```mermaid
gantt
    title BUG-001 修正作業タイムライン
    dateFormat HH:mm
    axisFormat %H:%M

    section 調査
    CORSエラー発見           :done, a1, 00:00, 10min
    既存ドキュメント確認     :done, a2, after a1, 15min
    GitHub Actionsログ分析   :done, a3, after a2, 20min
    根本原因特定             :done, a4, after a3, 10min

    section 修正
    gcloud認証               :done, b1, after a4, 5min
    cloudscheduler API有効化 :done, b2, after b1, 2min
    古い関数削除             :done, b3, after b2, 5min
    再デプロイトリガー       :done, b4, after b3, 2min
    デプロイ完了待ち         :done, b5, after b4, 5min

    section ドキュメント化
    修正記録作成             :active, c1, after b5, 15min
    ダイアグラム作成         :active, c2, after c1, 20min
    GitHub Pages更新         :c3, after c2, 15min
    Gitコミット・Push        :c4, after c3, 5min
```

## 7. 再発防止チェックリスト

```mermaid
flowchart TD
    subgraph デプロイ時
        D1{Functionsデプロイ<br/>成功?}
        D1 -->|Yes| D2[次ステップへ]
        D1 -->|No| D3[即時アラート]
        D3 --> D4[ワークフロー失敗]
    end

    subgraph 確認事項
        C1[デプロイログ詳細確認]
        C2[全関数の存在確認]
        C3[エンドポイント疎通確認]
    end

    subgraph 監視
        M1[Cloud Monitoring<br/>アラート設定]
        M2[週次手動テスト<br/>実施]
    end

    D2 --> C1
    C1 --> C2
    C2 --> C3
    C3 --> M1
    M1 --> M2
```

---

## 関連ドキュメント

- [修正記録（詳細）](bugfix-cors-cloud-functions-2025-12-05.md)
- [手動テストチェックリスト](../docs/manual-test-checklist.md)
