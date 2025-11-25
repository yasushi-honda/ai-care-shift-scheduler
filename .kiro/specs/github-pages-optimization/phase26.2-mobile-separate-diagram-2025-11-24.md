# Phase 26.2: モバイル専用ページ実装 - システム構成図・フロー図

**作成日**: 2025-11-24
**仕様ID**: github-pages-optimization
**Phase**: 26.2（別ページ方式）

---

## システム構成図

### 全体アーキテクチャ

```mermaid
graph TB
    subgraph "GitHub Pages"
        A[index.html<br/>デスクトップ版]
        B[mobile.html<br/>モバイル版]
        C[technical.html<br/>技術ドキュメント<br/>デスクトップ版]
        D[technical-mobile.html<br/>技術ドキュメント<br/>モバイル版]
    end

    subgraph "ユーザーデバイス"
        E[デスクトップ<br/>≥768px]
        F[モバイル<br/><768px]
    end

    E -->|アクセス| A
    E -->|アクセス| C
    F -->|アクセス| A
    F -->|リダイレクト| B
    F -->|アクセス| C
    F -->|リダイレクト| D

    A -->|リンク| C
    B -->|リンク| D
    C -->|リンク| A
    D -->|リンク| B

    style A fill:#E8F5E9
    style B fill:#FFF9C4
    style C fill:#E1F5FE
    style D fill:#F3E5F5
```

### ページ構成詳細

```mermaid
graph TB
    subgraph "デスクトップページ"
        A1[index.html]
        A2[Mermaid v10<br/>ガントチャート]
        A3[レスポンシブCSS]
        A4[リッチコンテンツ]

        A1 --> A2
        A1 --> A3
        A1 --> A4
    end

    subgraph "モバイルページ"
        B1[mobile.html]
        B2[テーブルレイアウト]
        B3[モバイル最適化CSS]
        B4[シンプルコンテンツ]

        B1 --> B2
        B1 --> B3
        B1 --> B4
    end

    subgraph "リダイレクトロジック"
        C1[JavaScript<br/>window.innerWidth]
        C2[判定:<br/>width < 768px?]
        C3[window.location.href<br/>= 'mobile.html']

        C1 --> C2
        C2 -->|Yes| C3
    end

    A1 --> C1
    C3 --> B1

    style A1 fill:#E8F5E9
    style B1 fill:#FFF9C4
    style C2 fill:#FFCDD2
```

---

## デバイス判定フロー

### index.html アクセスフロー

```mermaid
flowchart TD
    Start([ユーザーがindex.htmlにアクセス])
    LoadHTML[HTMLロード開始]
    ExecuteJS[JavaScriptリダイレクトロジック実行]
    CheckWidth{window.innerWidth<br/>< 768px?}
    CheckPath{pathname includes<br/>'mobile'?}
    RedirectMobile[window.location.href<br/>= 'mobile.html']
    ShowDesktop[index.html表示<br/>デスクトップ版]
    LoadMobile[mobile.html読み込み]
    ShowMobile[mobile.html表示<br/>モバイル版]

    Start --> LoadHTML
    LoadHTML --> ExecuteJS
    ExecuteJS --> CheckWidth
    CheckWidth -->|Yes| CheckPath
    CheckWidth -->|No| ShowDesktop
    CheckPath -->|No| RedirectMobile
    CheckPath -->|Yes| ShowDesktop
    RedirectMobile --> LoadMobile
    LoadMobile --> ShowMobile

    style CheckWidth fill:#FFCDD2
    style CheckPath fill:#FFCDD2
    style ShowDesktop fill:#E8F5E9
    style ShowMobile fill:#FFF9C4
```

### technical.html アクセスフロー

```mermaid
flowchart TD
    Start([ユーザーがtechnical.htmlにアクセス])
    LoadHTML[HTMLロード開始]
    ExecuteJS[JavaScriptリダイレクトロジック実行]
    CheckWidth{window.innerWidth<br/>< 768px?}
    CheckPath{pathname includes<br/>'mobile'?}
    RedirectMobile[window.location.href<br/>= 'technical-mobile.html']
    ShowDesktop[technical.html表示<br/>デスクトップ版]
    LoadMobile[technical-mobile.html読み込み]
    ShowMobile[technical-mobile.html表示<br/>モバイル版]

    Start --> LoadHTML
    LoadHTML --> ExecuteJS
    ExecuteJS --> CheckWidth
    CheckWidth -->|Yes| CheckPath
    CheckWidth -->|No| ShowDesktop
    CheckPath -->|No| RedirectMobile
    CheckPath -->|Yes| ShowDesktop
    RedirectMobile --> LoadMobile
    LoadMobile --> ShowMobile

    style CheckWidth fill:#FFCDD2
    style CheckPath fill:#FFCDD2
    style ShowDesktop fill:#E1F5FE
    style ShowMobile fill:#F3E5F5
```

---

## ページ間ナビゲーションフロー

```mermaid
graph TB
    subgraph "デスクトップ環境（≥768px）"
        D1[index.html]
        D2[technical.html]

        D1 -->|リンク| D2
        D2 -->|リンク| D1
    end

    subgraph "モバイル環境（<768px）"
        M1[mobile.html]
        M2[technical-mobile.html]

        M1 -->|リンク| M2
        M2 -->|リンク| M1
    end

    subgraph "クロスリンク"
        M1 -.->|"デスクトップ版を見る<br/>リンク"| D1
        M2 -.->|"デスクトップ版を見る<br/>リンク"| D2
    end

    style D1 fill:#E8F5E9
    style D2 fill:#E1F5FE
    style M1 fill:#FFF9C4
    style M2 fill:#F3E5F5
```

---

## データ構造

### mobile.html コンテンツ構造

```mermaid
graph TB
    Mobile[mobile.html]
    Header[header<br/>📊 シフト管理システム]
    Container[container]
    Card1[card: プロジェクト概要<br/>86%削減メトリック]
    Card2[card: 実装状況テーブル<br/>✅改善1,2 完了<br/>⏳改善3 未実装]
    Card3[card: 削減効果の推移テーブル<br/>50分→25分→7分]
    Card4[card: 改善機能の詳細]
    Card5[card: 開発規模・投資実績]
    Card6[card: リンク集<br/>本番環境/技術ドキュメント]
    Card7[card: 技術スタック]
    Footer[footer<br/>最終更新: 2025-11-24]

    Mobile --> Header
    Mobile --> Container
    Container --> Card1
    Container --> Card2
    Container --> Card3
    Container --> Card4
    Container --> Card5
    Container --> Card6
    Container --> Card7
    Mobile --> Footer

    style Mobile fill:#FFF9C4
    style Header fill:#155799,color:#fff
    style Card2 fill:#E8F5E9
```

### technical-mobile.html コンテンツ構造

```mermaid
graph TB
    Tech[technical-mobile.html]
    Header[header<br/>🛠️ 技術ドキュメント]
    Container[container]
    Card1[card: システム構成<br/>フロントエンド/バックエンド/AI/テスト]
    Card2[card: Phase 25実装スケジュール]
    Card3[card: データモデル<br/>users/facilities/staff/shifts]
    Card4[card: セキュリティルール<br/>Firestore/Cloud Functions]
    Card5[card: デプロイ構成]
    Card6[card: パフォーマンス指標]
    Card7[card: リンク集]
    Footer[footer<br/>最終更新: 2025-11-24]

    Tech --> Header
    Tech --> Container
    Container --> Card1
    Container --> Card2
    Container --> Card3
    Container --> Card4
    Container --> Card5
    Container --> Card6
    Container --> Card7
    Tech --> Footer

    style Tech fill:#F3E5F5
    style Header fill:#155799,color:#fff
```

---

## CSS設計方針

### モバイルページCSS原則

```mermaid
graph LR
    A[モバイルCSS原則]
    B[viewport設定<br/>maximum-scale=5]
    C[相対単位使用<br/>rem, %, vw]
    D[タッチフレンドリー<br/>padding ≥0.75rem]
    E[シンプルレイアウト<br/>カードベース]
    F[固定フォントサイズ<br/>text-size-adjust: 100%]

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F

    style A fill:#FFE4B5
```

---

## デプロイメントフロー

```mermaid
sequenceDiagram
    participant Dev as 開発者
    participant Git as Gitリポジトリ
    participant GHA as GitHub Actions
    participant GHP as GitHub Pages
    participant User as ユーザー

    Dev->>Git: git push origin main
    Git->>GHA: トリガー: Deploy to GitHub Pages
    GHA->>GHA: npm run build
    GHA->>GHA: コピー: docs/→dist/docs/
    GHA->>GHP: デプロイ: dist/
    GHP->>GHP: CDNキャッシュ更新
    User->>GHP: アクセス
    GHP->>User: mobile.html or index.html<br/>（デバイス判定に基づく）

    Note over GHA,GHP: デプロイ時間: 約2-3分
    Note over GHP,User: キャッシュTTL: index.html=0,<br/>mobile.html=3600s
```

---

## リスク対策マトリックス

```mermaid
graph TB
    subgraph "高リスク"
        R1[モバイル判定が<br/>正しく動作しない]
        S1[シンプルな<br/>window.innerWidth判定]

        R2[デスクトップ版が壊れる]
        S2[リダイレクトロジックを<br/>最小限に]

        R1 --> S1
        R2 --> S2
    end

    subgraph "中リスク"
        R3[ブラウザキャッシュ問題]
        S3[デプロイ後に<br/>ハードリロード案内]

        R4[コンテンツ重複管理]
        S4[モバイル版は<br/>最小限のコンテンツに]

        R3 --> S3
        R4 --> S4
    end

    style R1 fill:#FFCDD2
    style R2 fill:#FFCDD2
    style R3 fill:#FFF9C4
    style R4 fill:#FFF9C4
    style S1 fill:#C8E6C9
    style S2 fill:#C8E6C9
    style S3 fill:#E1F5FE
    style S4 fill:#E1F5FE
```

---

## 検証計画

### E2Eテスト構成

```mermaid
graph TB
    Tests[E2Eテスト: mobile-separate-page.spec.ts]

    subgraph "モバイルデバイステスト（375x667）"
        T1[index.html→mobile.html<br/>リダイレクト検証]
        T2[mobile.html<br/>表示検証]
        T3[technical.html→technical-mobile.html<br/>リダイレクト検証]
        T4[technical-mobile.html<br/>表示検証]
        T5[本番環境リンク<br/>機能検証]
    end

    subgraph "デスクトップデバイステスト（1280x720）"
        T6[index.html<br/>リダイレクトされないこと]
        T7[index.html<br/>正常表示]
        T8[technical.html<br/>リダイレクトされないこと]
        T9[technical.html<br/>正常表示]
    end

    subgraph "境界値テスト"
        T10[767px:<br/>リダイレクトされる]
        T11[768px:<br/>リダイレクトされない]
    end

    subgraph "ナビゲーションテスト"
        T12[mobile.html→technical-mobile.html]
        T13[technical-mobile.html→mobile.html]
        T14[モバイル版→デスクトップ版リンク]
    end

    Tests --> T1
    Tests --> T2
    Tests --> T3
    Tests --> T4
    Tests --> T5
    Tests --> T6
    Tests --> T7
    Tests --> T8
    Tests --> T9
    Tests --> T10
    Tests --> T11
    Tests --> T12
    Tests --> T13
    Tests --> T14

    style Tests fill:#FFE4B5
    style T1 fill:#E8F5E9
    style T6 fill:#E1F5FE
    style T10 fill:#FFF9C4
    style T12 fill:#F3E5F5
```

---

## 実装完了基準

### Definition of Done

```mermaid
graph LR
    subgraph "必須項目"
        D1[✅ mobile.html作成]
        D2[✅ technical-mobile.html作成]
        D3[✅ リダイレクトロジック実装]
        D4[✅ E2Eテスト作成]
        D5[✅ ドキュメント整備]
        D6[⏳ Git コミット]
        D7[⏳ GitHub Pages デプロイ]
        D8[⏳ 本番環境動作確認]
    end

    D1 --> D2
    D2 --> D3
    D3 --> D4
    D4 --> D5
    D5 --> D6
    D6 --> D7
    D7 --> D8

    style D1 fill:#C8E6C9
    style D2 fill:#C8E6C9
    style D3 fill:#C8E6C9
    style D4 fill:#C8E6C9
    style D5 fill:#C8E6C9
    style D6 fill:#FFF9C4
    style D7 fill:#FFF9C4
    style D8 fill:#FFF9C4
```

---

## 次フェーズ候補

- **Phase 26.3**: モバイルページのコンテンツ充実化
  - より詳細な実装状況
  - インタラクティブな要素（アコーディオンなど）
  - スクリーンショット追加

- **Phase 27**: デスクトップ版の機能強化
  - より高度なMermaid図の追加
  - アニメーション効果
  - フィルタリング機能

---

関連ドキュメント:
- [WBS・ガントチャート](./phase26.2-mobile-separate-wbs-2025-11-24.md)
- [完了ドキュメント](./phase26.2-completion-2025-11-24.md)（実装後作成）
