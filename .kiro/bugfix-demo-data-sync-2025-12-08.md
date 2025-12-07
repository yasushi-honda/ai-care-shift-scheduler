# BUG-007: デモデータ同期問題の修正

**発生日**: 2025-12-08
**修正日**: 2025-12-08
**影響範囲**: デモ環境、スタッフ管理UI
**重大度**: 中（デモ機能に影響）

---

## 1. 問題概要

### 症状
1. デモ環境でシフト生成すると「充足率79%」「この要件では実現不可能です」エラー
2. 近藤理恵のスタッフ設定が「管理者」「資格なし」と表示される
3. 保存時に「権限がありません」エラー

### 期待される動作
- 充足率98%以上
- 近藤理恵: 機能訓練指導員、理学療法士
- デモユーザーは保存可能（editor権限）

---

## 2. 根本原因分析

### 問題1: Firestoreデモデータの未同期

**原因**: Phase 44で`seedDemoData.ts`を修正したが、本番Firestoreへの再投入を実施していなかった。

| 項目 | seedDemoData.ts | 本番Firestore |
|------|-----------------|---------------|
| 近藤理恵のtimeSlotPreference | いつでも可 | 日勤のみ（古いまま） |

**影響**: 「日勤のみ」スタッフが2名（田中・近藤）になり、早番・遅番に配置可能なスタッフが不足。

### 問題2: デモユーザー権限の問題

**原因**: `seedDemoData.ts`の再投入時に施設メンバーが初期化され、既存のデモユーザーが`viewer`のままになった。

### 問題3: Role/Qualification enumの不足

**原因**: `types.ts`のenumに「機能訓練指導員」「理学療法士」が定義されていなかった。

```typescript
// Before
export enum Role {
  Admin = "管理者",
  CareWorker = "介護職員",
  Nurse = "看護職員",
  // ...（機能訓練指導員がない）
}
```

UIの`<select>`は`ROLES`配列の値のみを選択肢として表示するため、Firestoreに保存された「機能訓練指導員」が見つからず、デフォルトの「管理者」が表示されていた。

---

## 3. 修正内容

### 修正1: Firestoreデモデータの再投入

```bash
VITE_FIREBASE_PROJECT_ID="ai-care-shift-scheduler" npm run seed:demo -- --reset --force --yes
```

### 修正2: デモユーザー権限の修正

```typescript
// users.facilities[].role と facilities.members[].role を editor に更新
```

### 修正3: types.ts の修正

```typescript
export enum Role {
  Admin = "管理者",
  CareWorker = "介護職員",
  Nurse = "看護職員",
  CareManager = "ケアマネージャー",
  Operator = "オペレーター",
  FunctionalTrainer = "機能訓練指導員",  // 追加
}

export enum Qualification {
  CertifiedCareWorker = "介護福祉士",
  RegisteredNurse = "看護師",
  LicensedPracticalNurse = "准看護師",
  DriversLicense = "普通自動車免許",
  PhysicalTherapist = "理学療法士",  // 追加
  SocialWorker = "生活相談員",  // 追加
  HomeCareSupportWorker = "介護職員初任者研修",  // 追加
}
```

### 修正4: constants.ts の修正

```typescript
export const ROLES: Role[] = [
  // ... 既存
  Role.FunctionalTrainer,  // 追加
];

export const QUALIFICATIONS: Qualification[] = [
  // ... 既存
  Qualification.PhysicalTherapist,  // 追加
  Qualification.SocialWorker,  // 追加
  Qualification.HomeCareSupportWorker,  // 追加
];
```

---

## 4. 影響範囲

| 影響対象 | 影響内容 |
|---------|---------|
| types.ts | Role, Qualification enum拡張 |
| constants.ts | ROLES, QUALIFICATIONS配列拡張 |
| Firestore | デモスタッフデータ再投入 |
| デモユーザー | 権限をviewerからeditorに変更 |
| UI | スタッフ管理画面で新しい役職・資格が選択可能に |

---

## 5. 検証方法

1. デモログインでアクセス
2. スタッフ管理で近藤理恵を確認
   - 役職: 機能訓練指導員
   - 資格: 理学療法士
3. シフト生成を実行
   - 充足率: 98%以上
   - エラー: なし
4. 保存可能であることを確認

---

## 6. 再発防止策

### 即時対応
- [x] seedDemoData.ts修正後は必ず本番への再投入を実施
- [x] enumに新しい値を追加する際は定数配列も更新

### 長期対応
- [ ] CI/CDでデモデータの整合性チェックを追加（候補）
- [ ] seedDemoData.tsにデモユーザー権限の維持ロジックを追加（候補）

---

## 7. 関連コミット

- `a668384` - fix: デイサービス関連のRole・Qualification enumを追加

---

## 8. 学び

1. **データ投入スクリプトの修正 ≠ データの更新**: スクリプトを修正しても本番データは自動的に更新されない
2. **enumと定数配列の同期**: UIの選択肢は定数配列から生成されるため、両方を更新する必要がある
3. **デモデータの整合性確認**: 定期的にFirestoreの実データを確認する習慣が重要

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
