# BUG-021: 休暇残高管理の詳細ボタンエラー修正

**修正日**: 2025-12-09
**優先度**: 高
**ステータス**: 解決済み

---

## 概要

「休暇残高管理」セクションでスタッフの「詳細」ボタンをクリックすると、JavaScriptエラーが発生する問題を修正。

---

## 現象

### エラーメッセージ

```
Error fetching staff leave balance: TypeError: Cannot read properties of undefined (reading 'split')
    at Ys (App--DyVKMO6.js:4:17948)
```

### 再現手順

1. シフト管理画面を開く
2. 「休暇残高管理」アコーディオンを展開
3. 任意のスタッフの「詳細」ボタンをクリック
4. エラーが発生

---

## 根本原因

### props名の不一致

`App.tsx`で`LeaveBalanceDashboard`コンポーネントに渡すプロパティ名が、コンポーネントの期待する名前と一致していなかった。

**渡していた値**:
```tsx
<LeaveBalanceDashboard
  targetMonth={requirements.targetMonth}  // ❌ 間違い
  onSaveSettings={handleSaveLeaveSettings}  // 未使用
  disabled={!selectedFacilityId}  // 未使用
  // currentUserId が欠落
/>
```

**期待される値**:
```tsx
interface LeaveBalanceDashboardProps {
  facilityId: string;
  staffList: Staff[];
  yearMonth: string;  // ← targetMonthではない
  leaveSettings: FacilityLeaveSettings | null;
  currentUserId: string;  // ← 欠落していた
}
```

### エラー発生の流れ

1. `yearMonth`が`undefined`（props名が`targetMonth`だったため）
2. 「詳細」ボタンクリック → `handleShowDetail` → `getOrCreateBalance`
3. `getStaffLeaveBalance(facilityId, staffId, yearMonth, settings)` 呼び出し
4. `getPreviousYearMonth(undefined)` → `undefined.split('-')` → TypeError

---

## 修正内容

### 1. App.tsx (1567-1574行)

```tsx
// Before
<LeaveBalanceDashboard
  facilityId={selectedFacilityId || ''}
  staffList={staffList}
  targetMonth={requirements.targetMonth}
  leaveSettings={leaveSettings}
  onSaveSettings={handleSaveLeaveSettings}
  disabled={!selectedFacilityId}
/>

// After
<LeaveBalanceDashboard
  facilityId={selectedFacilityId || ''}
  staffList={staffList}
  yearMonth={requirements.targetMonth}
  leaveSettings={leaveSettings}
  currentUserId={currentUser?.uid || ''}
/>
```

### 2. LeaveBalanceDashboard.tsx (91-96行)

防御的プログラミングとして、`getOrCreateBalance`関数に早期リターンを追加：

```tsx
const getOrCreateBalance = useCallback(async (staffId: string): Promise<StaffLeaveBalance | null> => {
  // 防御的チェック: facilityIdまたはyearMonthが未設定の場合は早期リターン
  if (!facilityId || !yearMonth) {
    console.warn('getOrCreateBalance: facilityId or yearMonth is not set');
    return null;
  }
  // ...
}, [facilityId, yearMonth, leaveSettings, balances]);
```

---

## 変更ファイル

| ファイル | 変更内容 |
|---------|----------|
| `App.tsx` | props名修正、未使用props削除、currentUserId追加 |
| `src/components/LeaveBalanceDashboard.tsx` | 防御的チェック追加 |

---

## 検証

- [x] TypeScript型チェック通過（`npx tsc --noEmit`）
- [x] CodeRabbitレビュー完了
- [x] CI/CDパイプライン実行中

---

## 教訓

### 原因分析

この問題は**静的型チェックでは検出できない**ケースだった：
- TypeScriptの型定義は正しかった
- 問題はprops名のタイポ/不一致
- `LeaveBalanceDashboardProps`の必須propsが渡されていないはずだが、コンパイルが通っていた

### 推測される原因

- TypeScriptの設定（`strictNullChecks`等）が緩い可能性
- あるいは別の場所で型の上書き/anyキャストがある可能性

### 予防策

1. **コンポーネントpropsの型を厳格に検証**する設定を検討
2. **ランタイムエラーログ**を定期的に監視
3. **E2Eテスト**で詳細ボタンクリックのシナリオを追加

---

## 関連ドキュメント

- [LeaveBalanceDashboard.tsx](../src/components/LeaveBalanceDashboard.tsx)
- [leaveBalanceService.ts](../src/services/leaveBalanceService.ts)

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-09
