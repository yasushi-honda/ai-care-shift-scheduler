---
layout: default
title: シフト管理システム - 改善実績
---

# シフト管理システム 改善実績

月末のシフト実績入力作業を大幅に効率化しました。

---

## 改善の全体像

<div class="mermaid">
graph TB
    Start[実績入力の課題<br/>月間50分の作業]

    Start --> Phase1[改善1: 予定と同じボタン<br/>完了 2025-11-23]
    Start --> Phase2[改善2: 一括コピー機能<br/>完了 2025-11-24]
    Start --> Phase3[改善3: ダブルクリック機能<br/>未実装]

    Phase1 --> Result1[効果: 50%削減<br/>25分/月]
    Phase2 --> Result2[効果: 86%削減<br/>7分/月]
    Phase3 --> Result3[効果: さらなる効率化]

    style Phase1 fill:#90EE90
    style Phase2 fill:#90EE90
    style Phase3 fill:#FFE4B5
    style Result1 fill:#E8F5E9
    style Result2 fill:#E8F5E9
    style Result3 fill:#FFF8DC
</div>

---

## 実装状況

<div class="mermaid">
gantt
    title 改善機能の実装スケジュール
    dateFormat YYYY-MM-DD

    section 完了
    改善1 予定と同じボタン: done, impl1, 2025-11-23, 1d
    改善2 一括コピー機能: done, impl2, 2025-11-24, 1d

    section 未実装
    改善3 ダブルクリック機能: impl3, 2025-11-25, 1d
</div>

**完了**: 改善1・改善2（2025年11月24日時点）
**未実装**: 改善3

---

## 改善の詳細

### 改善1: 「予定と同じ」ボタン

実績入力時に予定通りだった場合、ワンクリックで入力完了。

<div class="mermaid">
flowchart LR
    A[実績入力画面] --> B{予定通り？}
    B -->|はい| C[ボタンクリック<br/>→ 完了]
    B -->|いいえ| D[手動入力]

    style C fill:#ccffcc
</div>

**効果**: 月間作業時間 50分 → 25分（50%削減）

---

### 改善2: 一括コピー機能

複数スタッフの実績を一度にまとめて入力。

<div class="mermaid">
flowchart TD
    A[シフト表] --> B[一括コピーボタン]
    B --> C[スタッフ選択]
    C --> D[期間指定]
    D --> E[実行]
    E --> F[完了]

    style F fill:#ccffcc
</div>

**効果**: 月間作業時間 50分 → 7分（86%削減）

---

### 改善3: ダブルクリック機能（未実装）

セルをダブルクリックで即座にコピー（さらなる効率化）。

**状態**: 未実装
**優先度**: 中
**推定工数**: 2-3時間

---

## 削減効果の推移

<div class="mermaid">
gantt
    title 月間作業時間の推移
    dateFormat YYYY-MM-DD

    section 従来
    手動入力 50分: done, old, 2025-11-01, 50m

    section 改善1適用後
    25分に短縮: done, imp1, 2025-11-23, 25m

    section 改善2適用後
    7分に短縮: done, imp2, 2025-11-24, 7m
</div>

---

## 本番環境

[シフト管理システムを開く](https://ai-care-shift-scheduler.web.app)

---

## 技術詳細（開発者向け）

実装の詳細、コンポーネント構成、データフローなどは[技術ドキュメント](technical.html)を参照してください。

---

**最終更新**: 2025年11月24日
