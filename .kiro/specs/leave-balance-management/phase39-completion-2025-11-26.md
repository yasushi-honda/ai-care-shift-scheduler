# Phase 39: 休暇残高管理 - 完了記録

**完了日**: 2025-11-26
**仕様ID**: leave-balance-management
**Phase**: 39

---

## 実装内容

### 39.1 型定義追加 (`types.ts`)

以下の型を追加:
- `PublicHolidayBalance`: 公休残高（付与数、使用数、繰越数、残高）
- `PaidLeaveBalance`: 有給残高（年間付与、使用数、繰越数、残高、有効期限）
- `LeaveAdjustment`: 残高調整履歴
- `StaffLeaveBalance`: スタッフごとの月別休暇残高
- `FacilityLeaveSettings`: 施設の休暇設定
- `LeaveBalanceError`: エラー型

### 39.2 定数追加 (`constants.ts`)

- `DEFAULT_LEAVE_SETTINGS`: デフォルト休暇設定
  - 公休: 月9日付与、無制限繰越
  - 有給: 2年繰越

### 39.3 Service層 (`src/services/leaveBalanceService.ts`)

以下の機能を実装:
- `getLeaveSettings()`: 休暇設定取得（存在しない場合はデフォルト作成）
- `saveLeaveSettings()`: 休暇設定保存
- `subscribeToLeaveSettings()`: 設定のリアルタイム購読
- `getStaffLeaveBalances()`: スタッフ残高一覧取得
- `getStaffLeaveBalance()`: 個別残高取得（自動初期化付き）
- `adjustBalance()`: 残高調整
- `updateLeaveUsage()`: 休暇使用時の残高更新
- `getBalanceStatus()`: 残高ステータス判定（ok/low/negative）
- `calculateInitialBalance()`: 初期残高計算（繰越ロジック含む）

### 39.4 UIコンポーネント (`src/components/LeaveBalanceDashboard.tsx`)

以下の機能を持つダッシュボードを実装:
- スタッフ一覧表示（公休/有給残高）
- フィルタ機能（全員/残少/マイナス）
- ソート機能（名前/公休/有給）
- ステータスバッジ（ok:緑、low:黄、negative:赤）
- 詳細モーダル
  - 公休詳細（付与、繰越、使用、残高）
  - 有給詳細（年間付与、繰越、使用、残高、有効期限）
  - 調整履歴
  - 残高調整フォーム
- 施設設定パネル
  - 公休: 月間付与日数、繰越上限
  - 有給: 繰越期間（年）

### 39.5 App.tsx統合

- `leaveSettings` state追加
- `subscribeToLeaveSettings()` でリアルタイム購読
- `handleSaveLeaveSettings()` ハンドラ追加
- 「休暇残高管理」Accordion追加
- `LeaveBalanceIcon` アイコン追加

### 39.6 Firestoreルール更新

`firestore.rules` に以下を追加:
- `leaveSettings` subcollection: viewer読み取り、editor書き込み
- `leaveBalances` subcollection: viewer読み取り、editor書き込み

---

## ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `types.ts` | 6つの型追加 |
| `constants.ts` | DEFAULT_LEAVE_SETTINGS追加 |
| `src/services/leaveBalanceService.ts` | 新規作成（全機能） |
| `src/components/LeaveBalanceDashboard.tsx` | 新規作成（UI全体） |
| `App.tsx` | 統合（import, state, useEffect, Accordion） |
| `firestore.rules` | leaveSettings, leaveBalances追加 |
| `.kiro/specs/leave-balance-management/` | Spec一式 |

---

## 設計ポイント

### 繰越ロジック

**公休**:
- 前月残高を次月に繰越
- `maxCarryOver` で上限設定可能（-1で無制限）

**有給**:
- 年度末（3月31日）基準で有効期限計算
- `carryOverYears` で繰越年数設定
- 有効期限切れの残高は繰越されない

### ステータス判定

| 残高 | ステータス | 表示色 |
|-----|---------|-------|
| < 0 | negative | 赤 |
| 0-3 | low | 黄 |
| > 3 | ok | 緑 |

---

## 次のステップ

- シフト表との連携（休暇使用時の自動残高更新）
- 年間カレンダービュー
- 有給取得率レポート
- 一括付与機能

---

## 関連ドキュメント

- [要件定義書](./requirements.md)
- [設計書](./design.md)
- [タスク一覧](./tasks.md)
- [図表](./phase39-diagrams-2025-11-26.md)
