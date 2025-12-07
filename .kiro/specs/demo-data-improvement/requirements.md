# Phase 43.1: デモデータ改善

**作成日**: 2025-12-07
**ステータス**: 設計中

---

## 1. 概要

### 1.1 背景

現在のデモデータ（`seedDemoData.ts`）は、AI生成エンジン（`functions/src/shift-generation.ts`）が期待するデータ形式と**重大な不一致**がある。

そのため、デモ環境でシフト生成を実行すると「この要件では実現不可能です」というエラーが発生し、デモンストレーションの目的を果たせない。

### 1.2 目的

- デモ環境でAIシフト生成が**成功する**データ構造に修正
- 実際の介護施設のシフト運用に近いリアルなデモデータを提供
- 新規ユーザーが機能を体験できる状態にする

---

## 2. 問題分析

### 2.1 スタッフデータの不一致

| フィールド | 現在（seedDemoData.ts） | 期待される形式（types.ts） | 問題 |
|-----------|------------------------|--------------------------|------|
| `id` | `staffId` | `id` | フィールド名が異なる |
| `role` | `position: string` | `role: Role` (enum) | 型が異なる |
| `qualifications` | `certifications: string[]` | `qualifications: Qualification[]` (enum) | 型が異なる |
| `weeklyWorkCount` | 存在しない | `{ hope: number; must: number }` | **必須フィールド欠落** |
| `maxConsecutiveWorkDays` | `maxConsecutiveDays` | `maxConsecutiveWorkDays` | フィールド名が異なる |
| `availableWeekdays` | 存在しない | `number[]` | **必須フィールド欠落** |
| `unavailableDates` | 存在しない | `string[]` | **必須フィールド欠落** |
| `timeSlotPreference` | 存在しない | `TimeSlotPreference` (enum) | **必須フィールド欠落** |
| `isNightShiftOnly` | `nightShiftOnly` | `isNightShiftOnly` | フィールド名が異なる |

### 2.2 シフト要件の不一致

| フィールド | 現在 | 期待される形式 | 問題 |
|-----------|------|--------------|------|
| `timeSlots` | 存在しない | `ShiftTime[]` | **必須フィールド欠落** |
| `requirements` | `shiftTypes[]`（配列形式） | `Record<string, DailyRequirement>` | 形式が完全に異なる |

### 2.3 人員配置の実現可能性

現在のシフト要件：

| シフト | 必要人数 | 必要資格 |
|--------|---------|---------|
| 早番 | 2名 | 介護福祉士 |
| 日勤 | 3名 | **正看護師** |
| 遅番 | 2名 | なし |
| 夜勤 | 2名 | 介護福祉士 |

現在のスタッフ構成：

| 資格 | 人数 | 備考 |
|------|------|------|
| 正看護師 | 2名 | 佐藤花子、鈴木美咲 |
| 介護福祉士 | 5名 | |
| 介護職員初任者研修 | 3名 | |

**問題**: 日勤に正看護師3名が必要だが、看護師は2名しかいない。
これにより「この要件では実現不可能です」エラーが発生。

---

## 3. 要件定義

### 3.1 データ形式の修正

#### FR-1: スタッフデータの形式統一

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-1.1 | スタッフデータを`Staff`型（types.ts）に完全準拠させる | Must |
| FR-1.2 | `role`フィールドを`Role` enumに変換する | Must |
| FR-1.3 | `qualifications`フィールドを`Qualification[]` enumに変換する | Must |
| FR-1.4 | `weeklyWorkCount`を追加する（hope: 4-5, must: 3-4） | Must |
| FR-1.5 | `availableWeekdays`を追加する（0-6の配列） | Must |
| FR-1.6 | `timeSlotPreference`を追加する | Must |
| FR-1.7 | `unavailableDates`を追加する（空配列可） | Must |

#### FR-2: シフト要件の形式統一

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-2.1 | シフト要件を`ShiftRequirement`型に完全準拠させる | Must |
| FR-2.2 | `timeSlots`配列を追加する | Must |
| FR-2.3 | `requirements`をRecord形式に変換する | Must |

### 3.2 実現可能なシフト要件

#### FR-3: 人員配置の調整

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-3.1 | 各シフトの必要人数をスタッフ構成で実現可能な値に調整 | Must |
| FR-3.2 | 資格要件を緩和または調整（看護師必須を削除or人数削減） | Must |
| FR-3.3 | 夜勤専従スタッフの制約を考慮した人数配置 | Must |

**提案する調整後のシフト要件**:

| シフト | 時間 | 必要人数 | 必要資格 |
|--------|------|---------|---------|
| 早番 | 07:00-16:00 | 2名 | なし（介護福祉士優先） |
| 日勤 | 09:00-18:00 | 2名 | 看護師1名以上 |
| 遅番 | 11:00-20:00 | 2名 | なし |
| 夜勤 | 17:00-翌09:00 | 2名 | 介護福祉士1名以上 |

### 3.3 対象月の更新

#### FR-4: 動的な対象月

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-4.1 | 対象月を現在月の翌月に設定（常に未来の月） | Should |
| FR-4.2 | または固定で将来の月（2025-12等）を設定 | Should |

---

## 4. 設計

### 4.1 修正後のスタッフデータ例

```typescript
const demoStaffs: Staff[] = [
  {
    id: 'staff-tanaka',
    name: '田中太郎',
    role: Role.Admin,
    qualifications: [Qualification.CertifiedCareWorker],
    weeklyWorkCount: { hope: 5, must: 4 },
    maxConsecutiveWorkDays: 5,
    availableWeekdays: [1, 2, 3, 4, 5], // 月-金
    unavailableDates: [],
    timeSlotPreference: TimeSlotPreference.DayOnly,
    isNightShiftOnly: false,
  },
  // ...
];
```

### 4.2 修正後のシフト要件例

```typescript
const demoRequirements: ShiftRequirement = {
  targetMonth: '2025-12',
  timeSlots: [
    { name: '早番', start: '07:00', end: '16:00', restHours: 1 },
    { name: '日勤', start: '09:00', end: '18:00', restHours: 1 },
    { name: '遅番', start: '11:00', end: '20:00', restHours: 1 },
    { name: '夜勤', start: '17:00', end: '09:00', restHours: 2 },
  ],
  requirements: {
    '早番': {
      totalStaff: 2,
      requiredQualifications: [],
      requiredRoles: [],
    },
    '日勤': {
      totalStaff: 2,
      requiredQualifications: [
        { qualification: Qualification.RegisteredNurse, count: 1 }
      ],
      requiredRoles: [],
    },
    '遅番': {
      totalStaff: 2,
      requiredQualifications: [],
      requiredRoles: [],
    },
    '夜勤': {
      totalStaff: 2,
      requiredQualifications: [
        { qualification: Qualification.CertifiedCareWorker, count: 1 }
      ],
      requiredRoles: [],
    },
  },
};
```

### 4.3 スタッフ構成の調整

合計10名のスタッフ構成（現行維持、フィールド名修正のみ）:

| 役職 | 人数 | 資格 | 夜勤専従 | 時間帯希望 |
|------|------|------|---------|-----------|
| 管理者 | 1名 | 介護福祉士 | No | 日勤のみ |
| 看護職員 | 2名 | 看護師 | No | いつでも可 |
| 介護職員 | 5名 | 介護福祉士 or 初任者研修 | No | いつでも可 |
| 介護職員（夜勤専従） | 2名 | 介護福祉士 | Yes | 夜勤のみ |

---

## 5. 変更対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `scripts/seedDemoData.ts` | スタッフ・シフト要件のデータ構造を全面修正 |
| `.kiro/specs/demo-data-improvement/requirements.md` | 本仕様書 |

---

## 6. テスト計画

### 6.1 手動テスト

- [ ] デモデータ投入後、デモ環境でログイン
- [ ] サンプル施設を選択
- [ ] シフト生成を実行
- [ ] 「この要件では実現不可能です」エラーが出ないことを確認
- [ ] シフト表が正常に生成されることを確認

### 6.2 確認項目

- [ ] 各シフトの必要人数が充足されている
- [ ] 夜勤専従スタッフが夜勤のみに配置されている
- [ ] 連続勤務日数が制約を超えていない
- [ ] 夜勤後の休息（明け休み、公休）が確保されている

---

## 7. 承認

- [ ] 要件レビュー完了
- [ ] 実装開始承認

---

## 変更履歴

| 日付 | 変更者 | 内容 |
|------|--------|------|
| 2025-12-07 | Claude | 初版作成 |
