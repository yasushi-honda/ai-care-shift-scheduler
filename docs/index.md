---
layout: default
title: シフト管理システム - 改善実績
---

# シフト管理システム 改善実績

## 実績入力の効率化について

月末のシフト実績入力作業を大幅に効率化しました。

---

## 改善の流れ

```mermaid
graph LR
    A[従来の方法<br/>50分/月] --> B[改善1<br/>予定と同じボタン<br/>25分/月]
    B --> C[改善2<br/>一括コピー機能<br/>7分/月]

    style A fill:#ffcccc
    style B fill:#fff4cc
    style C fill:#ccffcc
```

---

## 作業時間の削減効果

```mermaid
gantt
    title 月間作業時間の推移
    dateFormat YYYY-MM-DD

    section 従来
    手動入力: done, old, 2025-11-01, 50m

    section 改善1
    予定と同じボタン: done, imp1, 2025-11-23, 25m

    section 改善2
    一括コピー機能: done, imp2, 2025-11-24, 7m
```

### 削減率

- **改善1**: 50% 削減（50分 → 25分）
- **改善2**: 86% 削減（50分 → 7分）

---

## 改善内容の詳細

### 1. 「予定と同じ」ボタンの追加

実績入力時に予定通りだった場合、ワンクリックで入力できるようになりました。

```mermaid
flowchart LR
    A[実績入力画面を開く] --> B{予定通り？}
    B -->|はい| C[予定と同じボタンをクリック]
    B -->|いいえ| D[手動で入力]
    C --> E[完了]
    D --> E

    style C fill:#ccffcc
    style D fill:#ffcccc
```

**効果**: 入力時間が50%削減

---

### 2. 一括コピー機能

複数のスタッフの実績を一度にまとめて入力できるようになりました。

```mermaid
flowchart TD
    A[シフト表を表示] --> B[予定を実績にコピーボタンをクリック]
    B --> C[スタッフを選択]
    C --> D[期間を指定]
    D --> E[実行ボタンをクリック]
    E --> F[全スタッフの実績が一括入力完了]

    style F fill:#ccffcc
```

**効果**: 入力時間が86%削減

---

## 改善スケジュール

```mermaid
gantt
    title 改善実施スケジュール
    dateFormat YYYY-MM-DD

    section 企画
    改善案の検討: done, plan, 2025-11-23, 1d

    section 実装
    予定と同じボタン: done, impl1, 2025-11-23, 1d
    一括コピー機能: done, impl2, 2025-11-24, 1d

    section 稼働
    本番環境リリース: done, release, 2025-11-24, 1d
```

---

## 本番環境

[シフト管理システムを開く](https://ai-care-shift-scheduler.web.app)

---

## 開発者向け技術情報

[技術ドキュメント（詳細な構成図等）](technical.html)

---

**最終更新**: 2025年11月24日
