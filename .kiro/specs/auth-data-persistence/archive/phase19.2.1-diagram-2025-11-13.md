# Phase 19.2.1 実装図：レスポンシブデザイン対応

**更新日**: 2025-11-13
**仕様ID**: auth-data-persistence
**Phase**: 19.2.1

このドキュメントは [phase19.2.1-complete-2025-11-13.md](./phase19.2.1-complete-2025-11-13.md) の視覚的な補完資料です。

## 1. Phase 19.2.1 実装状況タイムライン

```mermaid
timeline
    title Phase 19.2.1 実装タイムライン（2025-11-13）
    section 準備
        ドキュメントレビュー : 実装計画確認
                              : 既存実装分析
    section 実装
        AdminLayout対応 : ハンバーガーメニュー実装
                        : モバイルオーバーレイサイドバー
                        : ヘッダーレスポンシブ化
        テーブル対応 : UserManagement横スクロール
                    : FacilityManagement横スクロール
        モーダル対応 : SecurityAlertsグリッド
                    : AuditLogsグリッド
    section 検証
        ビルドテスト : 型チェック成功
        CodeRabbit : アクセシビリティ改善
    section 完了
        デプロイ : GitHub Actionsプッシュ
                : ドキュメント作成
```

## 2. レスポンシブデザインアーキテクチャ

```mermaid
graph TB
    subgraph "モバイル表示 (~767px)"
        M_Header[ヘッダー<br/>- ハンバーガーメニュー<br/>- コンパクトレイアウト]
        M_Menu{メニュー<br/>表示状態}
        M_Overlay[オーバーレイサイドバー<br/>- z-50<br/>- 固定位置<br/>- スライドイン]
        M_Backdrop[バックドロップ<br/>- z-40<br/>- 半透明黒]
        M_Content[メインコンテンツ<br/>- フル幅<br/>- p-4]

        M_Header --> M_Menu
        M_Menu -->|開く| M_Overlay
        M_Menu -->|開く| M_Backdrop
        M_Backdrop -.クリック.-> M_Menu
        M_Overlay -.ナビゲート.-> M_Menu
        M_Menu -->|閉じる| M_Content
    end

    subgraph "デスクトップ表示 (768px~)"
        D_Header[ヘッダー<br/>- ユーザー情報表示<br/>- 広いレイアウト]
        D_Sidebar[固定サイドバー<br/>- 常に表示<br/>- w-64]
        D_Content[メインコンテンツ<br/>- flex-1<br/>- p-8]

        D_Header --> D_Sidebar
        D_Sidebar --> D_Content
    end

    style M_Overlay fill:#e3f2fd
    style M_Backdrop fill:#424242,color:#fff
    style D_Sidebar fill:#e8f5e9
```

## 3. モバイルメニュー状態遷移図

```mermaid
stateDiagram-v2
    [*] --> MenuClosed: 初期状態

    MenuClosed --> MenuOpen: ハンバーガーメニュークリック

    MenuOpen --> MenuClosed: バックドロップクリック
    MenuOpen --> MenuClosed: ナビゲーションアイテムクリック
    MenuOpen --> MenuClosed: Escapeキー押下

    MenuOpen --> BodyScrollDisabled: useEffect実行
    BodyScrollDisabled --> BodyScrollEnabled: メニュークローズ

    MenuClosed --> [*]

    note right of MenuOpen
        isMobileMenuOpen = true
        document.body.style.overflow = 'hidden'
        keydown listener追加
    end note

    note right of MenuClosed
        isMobileMenuOpen = false
        document.body.style.overflow = ''
        keydown listener削除
    end note
```

## 4. Tailwind CSSブレークポイント戦略

```mermaid
graph LR
    subgraph "画面サイズ範囲"
        XS[<640px<br/>Extra Small<br/>スマートフォン]
        SM[640px~767px<br/>Small<br/>大型スマホ]
        MD[768px~1023px<br/>Medium<br/>タブレット]
        LG[1024px~1279px<br/>Large<br/>デスクトップ]
        XL[1280px~<br/>Extra Large<br/>大型デスクトップ]
    end

    subgraph "適用スタイル"
        XS_Style[hidden: サイドバー<br/>block: ハンバーガーメニュー<br/>p-4: コンテンツ<br/>grid-cols-1: グリッド]
        MD_Style[block: サイドバー<br/>hidden: ハンバーガーメニュー<br/>p-8: コンテンツ<br/>grid-cols-2: グリッド]
        LG_Style[grid-cols-3: 一部グリッド<br/>より広いレイアウト]
    end

    XS --> XS_Style
    SM --> XS_Style
    MD --> MD_Style
    LG --> MD_Style
    XL --> LG_Style

    style XS_Style fill:#ffcdd2
    style MD_Style fill:#c8e6c9
    style LG_Style fill:#bbdefb
```

## 5. テーブル横スクロール実装パターン

```mermaid
graph TD
    subgraph "実装前の構造"
        A1[外側コンテナ<br/>overflow-hidden<br/>角丸維持]
        A2[テーブル<br/>min-w-full<br/>幅が画面を超える]

        A1 --> A2
    end

    subgraph "実装後の構造"
        B1[外側コンテナ<br/>overflow-hidden<br/>角丸維持]
        B2[内側コンテナ<br/>overflow-x-auto<br/>横スクロール有効]
        B3[テーブル<br/>min-w-full<br/>スクロール可能]

        B1 --> B2
        B2 --> B3
    end

    subgraph "効果"
        C1[モバイル: 横スクロール可能]
        C2[デスクトップ: スクロール不要]
        C3[角丸エッジ: 維持]
    end

    B3 -.-> C1
    B3 -.-> C2
    B1 -.-> C3

    style A2 fill:#ffcdd2
    style B3 fill:#c8e6c9
    style C1 fill:#bbdefb
    style C2 fill:#bbdefb
    style C3 fill:#bbdefb
```

## 6. z-index階層管理

```mermaid
graph TB
    subgraph "z-index階層（高 → 低）"
        Z50[z-50<br/>モバイルメニュー<br/>スライドインサイドバー]
        Z40[z-40<br/>バックドロップ<br/>半透明黒背景]
        Z0[z-0 (デフォルト)<br/>通常コンテンツ<br/>ヘッダー・メインコンテンツ]
    end

    Z50 -.上に表示.-> Z40
    Z40 -.上に表示.-> Z0

    style Z50 fill:#1976d2,color:#fff
    style Z40 fill:#424242,color:#fff
    style Z0 fill:#e0e0e0
```

## 7. アクセシビリティ改善フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Button as ハンバーガーボタン
    participant State as isMobileMenuOpen
    participant Effect as useEffect
    participant Menu as モバイルメニュー
    participant Body as document.body

    User->>Button: クリック
    Button->>State: setIsMobileMenuOpen(true)
    State->>Effect: トリガー
    Effect->>Body: style.overflow = 'hidden'
    Effect->>Effect: keydownリスナー追加
    Effect->>Menu: 表示（role="dialog"）

    alt Escapeキー押下
        User->>Effect: Escape keydown
        Effect->>State: setIsMobileMenuOpen(false)
    else バックドロップクリック
        User->>State: onClick → false
    else ナビゲーション
        User->>Menu: リンククリック
        Menu->>State: onClick → false
    end

    State->>Effect: トリガー（cleanup）
    Effect->>Body: style.overflow = ''
    Effect->>Effect: keydownリスナー削除
    Effect->>Menu: 非表示
```

## 8. CodeRabbit指摘対応状況

```mermaid
graph TD
    A[CodeRabbit指摘<br/>potential_issue] --> B{対応状況}

    B -->|✅ 実装済み| C1[Escapeキーでクローズ]
    B -->|✅ 実装済み| C2[bodyスクロール無効化]
    B -->|✅ 実装済み| C3[ARIA属性追加<br/>role, aria-modal, aria-label]
    B -->|⏳ 今後対応| C4[フォーカストラップ実装]
    B -->|⏳ 今後対応| C5[マジックナンバー解消<br/>top-[73px]]

    C1 --> D[アクセシビリティ向上]
    C2 --> D
    C3 --> D
    C4 -.Phase 19.2.2.-> E[更なる改善]
    C5 -.Phase 19.2.2.-> E

    style C1 fill:#c8e6c9
    style C2 fill:#c8e6c9
    style C3 fill:#c8e6c9
    style C4 fill:#fff9c4
    style C5 fill:#fff9c4
    style D fill:#bbdefb
    style E fill:#f8bbd0
```

## 9. 対応ファイル構成マップ

```mermaid
graph TB
    subgraph "管理画面ページ"
        AL[AdminLayout.tsx<br/>✅ ハンバーガーメニュー<br/>✅ レスポンシブヘッダー<br/>✅ オーバーレイサイドバー]
        UM[UserManagement.tsx<br/>✅ テーブル横スクロール]
        FM[FacilityManagement.tsx<br/>✅ テーブル横スクロール]
        FD[FacilityDetail.tsx<br/>✅ 既に実装済み]
        UD[UserDetail.tsx<br/>✅ 既に実装済み]
        SA[SecurityAlerts.tsx<br/>✅ モーダルレスポンシブ]
        ALog[AuditLogs.tsx<br/>✅ モーダルレスポンシブ]
    end

    subgraph "共通レイアウト"
        AL --> UM
        AL --> FM
        AL --> FD
        AL --> UD
        AL --> SA
        AL --> ALog
    end

    style AL fill:#1976d2,color:#fff
    style UM fill:#c8e6c9
    style FM fill:#c8e6c9
    style FD fill:#e0e0e0
    style UD fill:#e0e0e0
    style SA fill:#bbdefb
    style ALog fill:#bbdefb
```

## 10. 今後の実装ロードマップ

```mermaid
gantt
    title Phase 19実装ロードマップ
    dateFormat YYYY-MM-DD

    section 完了済み
    Phase 19.1.1~19.1.4 パフォーマンス最適化 :done, p191, 2025-11-12, 2025-11-12
    Phase 19.1.5 React.memo最適化 :done, p195, 2025-11-13, 2025-11-13
    Phase 19.2.1 レスポンシブデザイン :done, p1921, 2025-11-13, 2025-11-13

    section 推奨次ステップ
    Phase 19.2.2 アクセシビリティ強化 :active, p1922, 2025-11-14, 1d
    Phase 19.3 モバイル専用UI :p193, after p1922, 2d

    section Phase 20
    Phase 20.1 E2Eテスト拡張 :p201, after p193, 2d
    Phase 20.2 パフォーマンス計測 :p202, after p201, 1d
```

## 11. レスポンシブデザイン成果サマリー

```mermaid
mindmap
  root((Phase 19.2.1<br/>成果))
    モバイル対応
      ハンバーガーメニュー
        トグルアイコン
        オーバーレイ表示
      テーブル横スクロール
        6ファイル対応
        UX向上
      レスポンシブグリッド
        モーダル対応
        1列↔2列
    アクセシビリティ
      キーボードサポート
        Escapeキー
        フォーカス管理
      ARIA属性
        role="dialog"
        aria-modal
      スクロール制御
        bodyスクロール無効化
    品質保証
      ビルドテスト
        型エラー0件
        約1.5秒
      CodeRabbitレビュー
        1件指摘
        75%対応
      ドキュメント
        完了レポート
        Mermaid図
```

## 12. Phase 19.2.2 推奨実装項目

```mermaid
graph TD
    A[Phase 19.2.2<br/>アクセシビリティ強化] --> B[フォーカストラップ実装]
    A --> C[マジックナンバー解消]
    A --> D[テーブルスクロールヒント]

    B --> B1[focus-trap-react導入検討]
    B --> B2[Tab/Shift+Tab制御]
    B --> B3[初期フォーカス設定]

    C --> C1[HEADER_HEIGHT定数化]
    C --> C2[CSS変数化検討]

    D --> D1[スクロールインジケーター]
    D --> D2[ツールチップヒント]

    style A fill:#1976d2,color:#fff
    style B fill:#c8e6c9
    style C fill:#bbdefb
    style D fill:#fff9c4
```

---

## 参照

詳細な実装内容、テスト結果、学びと振り返りについては、以下のドキュメントを参照してください：

- **テキストドキュメント**: [phase19.2.1-complete-2025-11-13.md](./phase19.2.1-complete-2025-11-13.md)
- **実装計画**: [phase19-plan-2025-11-13.md](./phase19-plan-2025-11-13.md)
- **前フェーズ完了報告**: [phase19.1.5-complete-2025-11-13.md](./phase19.1.5-complete-2025-11-13.md)
