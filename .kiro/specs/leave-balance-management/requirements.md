# Phase 39: 休暇残高管理 - 要件定義書

**作成日**: 2025-11-26
**仕様ID**: leave-balance-management
**Phase**: 39

---

## 概要

スタッフの公休・有給休暇の残高を管理し、翌月繰越や先使い、残高確認を可能にする機能を実装します。

---

## 機能要件

### FR-39.1: 公休管理

| 項目 | 内容 |
|------|------|
| **月間付与数** | 施設設定で月ごとの公休日数を設定（デフォルト: 9日） |
| **繰越** | 未使用分は翌月に自動繰越 |
| **先使い** | 翌月分の先使い可能（マイナス残高許容） |
| **有効期限** | なし（繰越上限設定可能） |

### FR-39.2: 有給休暇管理

| 項目 | 内容 |
|------|------|
| **年間付与数** | スタッフごとに年間有給日数を設定 |
| **繰越** | 未使用分は2年間繰越可能（法定） |
| **繰越設定** | 施設設定で繰越期間をカスタマイズ可能 |
| **時効** | 2年経過で消滅 |

### FR-39.3: 残高ダッシュボード

| 項目 | 内容 |
|------|------|
| **一覧表示** | スタッフ全員の公休・有給残高を一覧表示 |
| **個人詳細** | 各スタッフの使用履歴・残高推移表示 |
| **警告表示** | 残高不足・マイナス残高を視覚的に警告 |
| **フィルタ** | 部署・期間でフィルタリング |

### FR-39.4: 残高調整

| 項目 | 内容 |
|------|------|
| **手動調整** | 管理者による残高の手動調整 |
| **調整理由** | 調整時にメモ入力必須 |
| **履歴** | 調整履歴を監査ログとして保存 |

---

## 非機能要件

### NFR-39.1: パフォーマンス
- 残高計算は1秒以内
- 100名分のスタッフ一覧表示は2秒以内

### NFR-39.2: データ整合性
- シフト変更時に自動で残高更新
- トランザクションによる一貫性保証

---

## データモデル

### StaffLeaveBalance
```typescript
interface StaffLeaveBalance {
  staffId: string;
  yearMonth: string; // YYYY-MM形式
  publicHoliday: {
    allocated: number;      // 月間付与数
    used: number;           // 当月使用数
    carriedOver: number;    // 前月繰越数
    balance: number;        // 残高
  };
  paidLeave: {
    annualAllocated: number;  // 年間付与数
    used: number;             // 使用累計
    carriedOver: number;      // 前年繰越数
    balance: number;          // 残高
    expiresAt: Timestamp;     // 有効期限
  };
  updatedAt: Timestamp;
  updatedBy: string;
}
```

### FacilityLeaveSettings
```typescript
interface FacilityLeaveSettings {
  facilityId: string;
  publicHoliday: {
    monthlyAllocation: number;  // 月間付与日数
    maxCarryOver: number;       // 繰越上限（-1で無制限）
  };
  paidLeave: {
    carryOverYears: number;     // 繰越年数（デフォルト: 2年）
  };
  updatedAt: Timestamp;
  updatedBy: string;
}
```

---

## 画面設計

### 残高ダッシュボード
- スタッフ一覧（公休残高、有給残高、ステータス）
- フィルタ（全員/残高少/マイナス）
- ソート（名前/残高）

### スタッフ詳細モーダル
- 当月残高詳細
- 使用履歴（直近6ヶ月）
- 残高推移グラフ（将来実装）
- 手動調整ボタン

---

## 成功基準

- [ ] 公休残高の自動計算・繰越
- [ ] 有給残高の自動計算・時効管理
- [ ] 残高ダッシュボードUI
- [ ] 手動調整機能
- [ ] TypeScriptエラーなし

---

## 関連ドキュメント

- [Phase 38完了記録](../shift-type-settings/phase38-completion-2025-11-26.md)
- [休暇申請機能](../care-staff-schedule-compliance/requirements.md)
