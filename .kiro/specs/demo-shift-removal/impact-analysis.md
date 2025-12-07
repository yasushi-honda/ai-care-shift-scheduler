# デモシフト作成機能削除 - 影響範囲分析

**作成日**: 2025-12-07
**ステータス**: 分析完了

---

## 1. 背景

Phase 43で「デモシフト作成」機能が削除された。
この機能は、AIシフト生成に依存せずランダムなシフトを生成するテスト用機能だったが、
デモ環境改善に伴い不要となった。

---

## 2. 修正が必要なファイル

### 2.1 UIコンポーネント（修正必須）

| ファイル | 行 | 内容 | 対応 |
|----------|-----|------|------|
| `components/ShiftTable.tsx` | 380 | 「デモシフト作成」ボタンへの参照 | テキスト修正 |

### 2.2 E2Eテスト（修正必須）

| ファイル | 問題 | 対応 |
|----------|------|------|
| `e2e/shift-creation.spec.ts` | デモシフト作成ボタンのテスト | スキップまたは削除 |
| `e2e/data-crud.spec.ts` | デモシフト生成ボタン表示テスト | スキップまたは削除 |
| `e2e/leave-request.spec.ts` | デモシフト作成ボタン確認 | スキップまたは削除 |
| `e2e/bulk-copy-scheduled-to-actual.spec.ts` | デモシフト作成依存 | スキップまたは削除 |
| `e2e/copy-scheduled-button.spec.ts` | デモシフト作成依存 | スキップまたは削除 |
| `e2e/planned-actual-shift-edit.spec.ts` | デモシフト作成依存 | スキップまたは削除 |

### 2.3 ドキュメント（修正必須）

| ファイル | 内容 | 対応 |
|----------|------|------|
| `public/manual.html` | デモシフト生成の説明セクション | 削除または更新 |
| `README.md` | デモシフト生成の記載 | 削除 |
| `docs/manual-test-checklist.md` | デモシフト作成のテスト項目 | 削除 |
| `docs/manual-test-plan.md` | デモシフト作成の記載 | 削除 |
| `docs/phase42-ui-design.html` | デモシフト作成ボタンの表示 | 削除 |

### 2.4 Steeringドキュメント（修正必須）

| ファイル | 内容 | 対応 |
|----------|------|------|
| `.kiro/steering/tech.md` | デモシフト作成ボタンの記載 | 削除 |
| `.kiro/steering/product.md` | デモシフト生成機能の記載 | 削除 |
| `.kiro/steering/structure.md` | デモシフト作成の代替案内 | 削除 |
| `.kiro/steering/architecture.md` | デモシフト作成の案内 | 削除 |
| `.kiro/steering/implementation-log.md` | デモシフト作成の案内 | 削除 |

### 2.5 仕様書（履歴として保持、修正不要）

以下は履歴として保持し、修正しない：
- `.kiro/specs/version-history-fix-2025-11-17.md`
- `.kiro/specs/demo-environment-improvements/tasks.md`
- `.kiro/specs/ui-design-improvement/` 配下
- `.kiro/specs/auth-data-persistence/` 配下
- `.kiro/specs/care-staff-schedule-compliance/` 配下
- `.kiro/specs/ai-shift-integration-test/` 配下

### 2.6 テストガイド（修正必須）

| ファイル | 内容 | 対応 |
|----------|------|------|
| `.kiro/testing/version-history-manual-test-guide.md` | デモシフト生成シナリオ | 削除または更新 |

---

## 3. 修正方針

### 3.1 UIテキスト

```diff
- 左のパネルで条件を設定し、「シフト作成実行」または「デモシフト作成」ボタンを押してください。
+ 左のパネルで条件を設定し、「シフト作成実行」ボタンを押してください。
```

### 3.2 E2Eテスト

デモシフト作成に依存するテストは、以下のいずれかで対応：
1. AIシフト生成を使用するよう変更
2. テストをスキップ（`test.skip`）
3. テストを削除

### 3.3 ドキュメント

- 「デモシフト作成」「デモシフト生成」への参照を削除
- 代わりに「AIシフト生成」への案内に変更

---

## 4. 修正優先度

| 優先度 | 対象 | 理由 |
|--------|------|------|
| 高 | UIテキスト | ユーザーに直接表示される |
| 高 | E2Eテスト | CI/CDが失敗する可能性 |
| 中 | public/manual.html | ユーザーマニュアル |
| 中 | README.md | プロジェクト概要 |
| 低 | Steeringドキュメント | 内部ドキュメント |
| 低 | テストガイド | 手動テスト用 |
