# Phase 39: 休暇残高管理 - タスク一覧

**作成日**: 2025-11-26
**仕様ID**: leave-balance-management
**Phase**: 39

---

## タスク一覧

### 39.1 型定義追加 (30分)
- [ ] `PublicHolidayBalance` interface追加
- [ ] `PaidLeaveBalance` interface追加
- [ ] `StaffLeaveBalance` interface追加
- [ ] `LeaveAdjustment` interface追加
- [ ] `FacilityLeaveSettings` interface追加
- [ ] `LeaveBalanceError` type追加

### 39.2 定数追加 (15分)
- [ ] `DEFAULT_LEAVE_SETTINGS` 追加

### 39.3 LeaveBalanceService実装 (2時間)
- [ ] `getLeaveSettings()` 実装
- [ ] `saveLeaveSettings()` 実装
- [ ] `subscribeToLeaveSettings()` 実装
- [ ] `getStaffLeaveBalances()` 実装
- [ ] `getStaffLeaveBalance()` 実装
- [ ] `adjustBalance()` 実装
- [ ] `calculateBalance()` 実装

### 39.4 LeaveSettingsPanel UI (1時間)
- [ ] 設定パネルコンポーネント作成
- [ ] 公休設定フォーム
- [ ] 有給設定フォーム
- [ ] 保存ハンドラー

### 39.5 LeaveBalanceDashboard UI (2時間)
- [ ] ダッシュボードコンポーネント作成
- [ ] スタッフ一覧表示
- [ ] 残高表示
- [ ] 警告表示（残高少・マイナス）
- [ ] フィルタ機能
- [ ] ソート機能

### 39.6 LeaveBalanceDetailModal UI (1時間30分)
- [ ] 詳細モーダルコンポーネント作成
- [ ] 残高詳細表示
- [ ] 調整履歴表示
- [ ] 手動調整フォーム

### 39.7 App.tsx統合 (1時間)
- [ ] `leaveSettings` state追加
- [ ] `subscribeToLeaveSettings` 購読
- [ ] アコーディオン追加
- [ ] ダッシュボード組み込み

### 39.8 Firestoreルール追加 (15分)
- [ ] `leaveSettings` コレクションルール
- [ ] `leaveBalances` コレクションルール

### 39.9 完了処理 (30分)
- [ ] TypeScriptチェック
- [ ] 完了記録作成
- [ ] Git commit

---

## タスク依存関係

```mermaid
graph TD
    A[39.1 型定義] --> B[39.2 定数]
    B --> C[39.3 Service]
    C --> D[39.4 Settings UI]
    C --> E[39.5 Dashboard UI]
    C --> F[39.6 Detail Modal]
    D --> G[39.7 App.tsx統合]
    E --> G
    F --> G
    G --> H[39.8 Firestoreルール]
    H --> I[39.9 完了処理]
```

---

## 優先度

| タスク | 優先度 | 理由 |
|--------|--------|------|
| 39.1-39.3 | 高 | 基盤となる型とService |
| 39.5 | 高 | メイン機能 |
| 39.4, 39.6 | 中 | 設定・詳細画面 |
| 39.7-39.9 | 高 | 統合・完了 |

---

## 見積もり時間

| タスク | 時間 |
|--------|------|
| 39.1 型定義追加 | 30分 |
| 39.2 定数追加 | 15分 |
| 39.3 LeaveBalanceService | 2時間 |
| 39.4 LeaveSettingsPanel | 1時間 |
| 39.5 LeaveBalanceDashboard | 2時間 |
| 39.6 LeaveBalanceDetailModal | 1時間30分 |
| 39.7 App.tsx統合 | 1時間 |
| 39.8 Firestoreルール | 15分 |
| 39.9 完了処理 | 30分 |
| **合計** | **約9時間** |

---

## 関連ドキュメント

- [要件定義書](./requirements.md)
- [設計書](./design.md)
