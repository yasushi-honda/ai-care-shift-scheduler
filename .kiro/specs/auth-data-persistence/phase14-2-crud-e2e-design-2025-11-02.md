# Phase 14.2設計書：データCRUD操作E2Eテスト

**作成日**: 2025年11月2日
**仕様ID**: auth-data-persistence
**Phase**: Phase 14.2（データCRUD操作E2Eテスト）
**言語**: 日本語

---

## 📋 目的

Phase 14.2では、スタッフ・シフト・休暇申請・要件設定の各データに対するCRUD操作が正しく機能していることをE2Eテストで検証します。

### 要件（Requirements 3.1-3.7, 4.1-4.7, 5.1-5.6, 6.1-6.5）

- **Requirement 3**: スタッフ情報のCRUD操作（作成・読取・更新・削除）
- **Requirement 4**: シフトデータのCRUD操作（生成・読取・更新・バージョン管理）
- **Requirement 5**: 休暇申請のCRUD操作（作成・読取・削除）
- **Requirement 6**: 要件設定の保存・読込

---

## 🎯 実施方針

### Phase 14.2の課題

**Phase 14.1と14.3で得られた知見を活用**:
- Google OAuth認証フローの完全自動化は困難（外部サービス依存）
- 認証済みユーザーでのデータ操作テストが必要

**Phase 14.2の特有の課題**:
1. CRUD操作テストには認証済みユーザーが必要
2. テストデータのセットアップとクリーンアップが必要
3. Firestore操作の結果確認が必要（UIレベル＋データレベル）
4. Firebase Auth Emulatorなしでは、テストユーザーの管理が困難

### 採用するアプローチ

**ハイブリッドアプローチ（Phase 14.1・14.3と同様）**:
1. **手動テストガイド**:
   - 本番環境での各CRUD操作の検証手順
   - スタッフ、シフト、休暇申請、要件設定の各機能を網羅

2. **自動E2Eテスト（限定的）**:
   - 認証不要なUI要素の表示テスト
   - モーダルやフォームの表示確認

3. **将来の拡張（Firebase Auth Emulator導入後）**:
   - テストユーザーの自動作成
   - CRUD操作の自動テスト（データ作成→確認→削除）

---

## 🏗️ 実装内容

### 1. 手動テストガイド

**ファイル**: `.kiro/specs/auth-data-persistence/phase14-2-crud-manual-test-guide-2025-11-02.md`

**内容**:
#### 1.1 スタッフ情報のCRUD操作検証
- **Create（作成）**: 新規スタッフ追加フォームから登録
- **Read（読取）**: スタッフ一覧に表示されることを確認
- **Update（更新）**: スタッフ編集フォームから更新
- **Delete（削除）**: スタッフ削除ボタンから削除

**検証項目**:
- Firestoreへの保存確認（`/facilities/{facilityId}/staff/{staffId}`）
- UI反映の即時性（リアルタイムリスナー）
- エラーハンドリング（ネットワークエラー、権限エラー）

#### 1.2 シフトデータのCRUD操作検証
- **Create（生成）**: AIシフト生成またはデモシフト生成
- **Read（読取）**: 対象月のシフトカレンダーに表示されることを確認
- **Update（更新）**: シフトセルのダブルクリックで編集
- **Version Management（バージョン管理）**: 下書き保存→確定→バージョン履歴

**検証項目**:
- Firestoreへの保存確認（`/facilities/{facilityId}/schedules/{scheduleId}`）
- バージョン履歴の作成確認（`/facilities/{facilityId}/schedules/{scheduleId}/versions/{versionNumber}`）
- 下書き状態と確定状態の遷移
- 過去バージョンへの復元

#### 1.3 休暇申請のCRUD操作検証
- **Create（作成）**: カレンダー上でスタッフの休暇を登録
- **Read（読取）**: カレンダーに休暇マーカーが表示されることを確認
- **Delete（削除）**: 休暇削除ボタンから削除

**検証項目**:
- Firestoreへの保存確認（`/facilities/{facilityId}/leaveRequests/{requestId}`）
- カレンダーUIでの即時反映
- シフト生成時の休暇考慮

#### 1.4 要件設定の保存・読込検証
- **Save（保存）**: 要件設定フォームから保存（自動保存1秒debounce）
- **Load（読込）**: ページリロード後の要件設定復元

**検証項目**:
- Firestoreへの保存確認（`/facilities/{facilityId}/requirements/default`）
- デフォルト設定のフォールバック動作
- 要件変更の即時保存

### 2. 自動E2Eテスト（限定的）

**ファイル**: `e2e/data-crud.spec.ts`

#### 2.1 スタッフ追加モーダルの表示テスト

**実装可能な理由**: 認証不要でモーダルの表示確認が可能

```typescript
test.describe('データCRUD操作 - スタッフ管理UI', () => {
  test('「スタッフ追加」ボタンをクリックするとモーダルが表示される', async ({ page }) => {
    await page.goto('/');

    // 「スタッフ追加」ボタンをクリック
    const addStaffButton = page.getByRole('button', { name: 'スタッフ追加' });
    await addStaffButton.click();

    // モーダルが表示されることを確認
    await expect(page.getByRole('heading', { name: '新規スタッフ追加' })).toBeVisible();
  });
});
```

#### 2.2 シフト生成ボタンの表示テスト

```typescript
test.describe('データCRUD操作 - シフト生成UI', () => {
  test('「シフト作成実行」ボタンが表示される', async ({ page }) => {
    await page.goto('/');

    // 「シフト作成実行」ボタンが表示されることを確認
    await expect(page.getByRole('button', { name: 'シフト作成実行' })).toBeVisible();
  });

  test('「デモシフト生成」ボタンが表示される', async ({ page }) => {
    await page.goto('/');

    // 「デモシフト生成」ボタンが表示されることを確認
    await expect(page.getByRole('button', { name: 'デモシフト生成' })).toBeVisible();
  });
});
```

#### 2.3 将来の拡張（test.skip）

**Firebase Auth Emulator導入後に実装予定**:

```typescript
test.describe('データCRUD操作 - 完全自動テスト', () => {
  test.skip('スタッフを作成してFirestoreに保存される', async ({ page }) => {
    // Firebase Auth Emulatorでadminユーザーを作成
    // ログイン
    // スタッフ追加フォーム入力
    // 保存ボタンクリック
    // Firestoreに保存されたことを確認
  });

  test.skip('スタッフを編集してFirestoreに反映される', async ({ page }) => {
    // スタッフ編集フォーム入力
    // 保存ボタンクリック
    // Firestoreに更新されたことを確認
  });

  test.skip('スタッフを削除してFirestoreから削除される', async ({ page }) => {
    // スタッフ削除ボタンクリック
    // 確認ダイアログでOK
    // Firestoreから削除されたことを確認
  });

  test.skip('シフトを生成してFirestoreに保存される', async ({ page }) => {
    // AIシフト生成ボタンクリック
    // 生成完了まで待機
    // Firestoreに保存されたことを確認
  });

  test.skip('シフトを編集して下書き保存される', async ({ page }) => {
    // シフトセルをダブルクリック
    // ドロップダウンで値変更
    // 下書き保存ボタンクリック
    // Firestoreに保存されたことを確認（status='draft'）
  });

  test.skip('シフトを確定してバージョン履歴が作成される', async ({ page }) => {
    // 確定ボタンクリック
    // Firestoreにバージョン履歴が作成されたことを確認
  });

  test.skip('休暇申請を作成してFirestoreに保存される', async ({ page }) => {
    // カレンダー上で休暇登録
    // Firestoreに保存されたことを確認
  });

  test.skip('休暇申請を削除してFirestoreから削除される', async ({ page }) => {
    // 休暇削除ボタンクリック
    // Firestoreから削除されたことを確認
  });

  test.skip('要件設定を変更してFirestoreに自動保存される', async ({ page }) => {
    // 要件設定フォーム入力
    // 1秒待機（debounce）
    // Firestoreに保存されたことを確認
  });
});
```

---

## 📊 テストカバレッジ

### 手動テスト（必須）

| テストケース | 検証項目 | 期待結果 |
|---|---|------|
| **スタッフCRUD** | | |
| スタッフ作成 | 新規スタッフ追加フォーム入力・保存 | Firestoreに保存され、リストに表示される |
| スタッフ読取 | ページロード時 | Firestoreから全スタッフ取得され表示される |
| スタッフ更新 | スタッフ編集フォーム入力・保存 | Firestoreに更新され、リストに反映される |
| スタッフ削除 | スタッフ削除ボタンクリック | Firestoreから削除され、リストから消える |
| **シフトCRUD** | | |
| シフト生成 | AIまたはデモシフト生成 | Firestoreに保存され、カレンダーに表示される |
| シフト読取 | ページロード時・対象月変更 | Firestoreからシフト取得され表示される |
| シフト編集（下書き） | シフトセル編集・下書き保存 | Firestoreに保存される（status='draft'） |
| シフト確定 | 確定ボタンクリック | status='confirmed'に変更、バージョン履歴作成 |
| バージョン履歴 | バージョン履歴モーダル表示 | 全バージョン一覧が表示される |
| バージョン復元 | 過去バージョン選択・復元 | 選択バージョンがシフトに反映される |
| **休暇申請CRUD** | | |
| 休暇作成 | カレンダー上で休暇登録 | Firestoreに保存され、カレンダーに表示される |
| 休暇読取 | ページロード時・対象月変更 | Firestoreから休暇取得され表示される |
| 休暇削除 | 休暇削除ボタンクリック | Firestoreから削除され、カレンダーから消える |
| **要件設定** | | |
| 要件保存 | 要件設定フォーム入力 | Firestoreに自動保存される（1秒debounce） |
| 要件読取 | ページロード時 | Firestoreから要件取得されフォームに反映される |
| デフォルト設定 | 要件が存在しない場合 | デフォルト設定が使用される |

### 自動E2Eテスト

| テストケース | 実装状況 | 備考 |
|---|---|------|
| スタッフ追加モーダル表示 | ✅ 実装可能 | 認証不要 |
| シフト生成ボタン表示 | ✅ 実装可能 | 認証不要 |
| デモシフト生成ボタン表示 | ✅ 実装可能 | 認証不要 |
| スタッフCRUD完全自動テスト | ⚠️ 部分的 | Firebase Emulatorが必要 |
| シフトCRUD完全自動テスト | ⚠️ 部分的 | Firebase Emulatorが必要 |
| 休暇申請CRUD完全自動テスト | ⚠️ 部分的 | Firebase Emulatorが必要 |
| 要件設定の保存・読込テスト | ⚠️ 部分的 | Firebase Emulatorが必要 |

---

## 🚀 実装手順

### Step 1: 手動テストガイドの作成

1. ドキュメント作成: `phase14-2-crud-manual-test-guide-2025-11-02.md`
2. 各CRUD操作の検証手順を詳細化
3. チェックリスト形式で整理

### Step 2: 自動E2Eテストの実装

1. テストファイル作成: `e2e/data-crud.spec.ts`
2. スタッフ追加モーダル表示テスト実装
3. シフト生成ボタン表示テスト実装
4. 将来の拡張（test.skip）を記述

### Step 3: Firebase Auth Emulator連携（Phase 17以降）

**Phase 17以降で検討**:
- Firebase Auth Emulatorのセットアップ
- テスト用施設とユーザーの自動作成スクリプト
- CRUD操作の完全自動テスト拡充

---

## 📁 ファイル構成

```
.kiro/specs/auth-data-persistence/
├── phase14-2-crud-e2e-design-2025-11-02.md  # 本ドキュメント
└── phase14-2-crud-manual-test-guide-2025-11-02.md  # 手動テストガイド

e2e/
└── data-crud.spec.ts  # 自動E2Eテスト
```

---

## 🐛 既知の制限事項

### 1. Firebase Auth Emulatorなしでは完全自動化は不可

**制限**: テストユーザーの作成と認証済み状態の管理が手動でしか行えない

**緩和策**: 手動テストガイドで対応

### 2. テストデータのクリーンアップが困難

**制限**: 自動テストでは作成したデータの削除が難しい

**緩和策**:
- Phase 14.2では手動テストガイドで対応
- Phase 17でFirebase Auth Emulator導入後にクリーンアップスクリプトを追加

### 3. Firestore操作の直接確認が困難

**制限**: E2Eテストから直接Firestoreのデータを確認できない

**緩和策**:
- UIレベルでの確認（データが表示される = Firestoreに保存されている）
- Firebase Consoleでの手動確認（手動テスト時）

### 4. CI/CDでのE2Eテスト実行

**制限**: 現在、CI/CDでE2Eテストは無効化されている

**緩和策**:
- ローカル環境での手動実行を推奨
- UI安定後にCI/CDで有効化

---

## 📝 関連ドキュメント

- **Phase 14ステータス**: `.kiro/specs/auth-data-persistence/phase14-status-2025-11-01.md`
- **Phase 14.1設計書**: `.kiro/specs/auth-data-persistence/phase14-1-auth-flow-e2e-design-2025-11-02.md`
- **Phase 14.3設計書**: `.kiro/specs/auth-data-persistence/phase14-3-rbac-e2e-design-2025-11-02.md`
- **仕様書**: `.kiro/specs/auth-data-persistence/requirements.md` - Requirements 3.1-3.7, 4.1-4.7, 5.1-5.6, 6.1-6.5
- **タスク**: `.kiro/specs/auth-data-persistence/tasks.md` - Phase 14.2

---

## 💡 学び

### Phase 14.2設計で得られた知見

1. **Phase 14.1・14.3のハイブリッドアプローチの再利用**
   - CRUD操作テストも認証が必要なため、手動テストガイドが有効
   - 認証不要なUI要素（ボタン、モーダル）は自動E2Eテストで実装可能

2. **UIレベルでの確認の有効性**
   - Firestoreへの保存確認は、UIにデータが表示されることで間接的に確認可能
   - リアルタイムリスナーによる即時反映がテストの信頼性を高める

3. **テストデータ管理の重要性**
   - CRUD操作テストでは、テストデータのセットアップとクリーンアップが必須
   - Firebase Auth Emulatorなしでは、手動での管理が必要

4. **Firebase Auth Emulatorの必要性（再確認）**
   - 完全自動化には、テストユーザーとテストデータの自動管理が必須
   - Phase 17以降での導入が推奨される

5. **手動テストガイドの価値（再確認）**
   - 実際の本番環境でのテストにより、予期しない問題を発見できる
   - 自動化が困難な部分を補完する重要な手段

---

**作成日**: 2025年11月2日
**Phase 14.2ステータス**: 🟡 **設計完了**（実装は次のステップ）
**次のアクション**: 手動テストガイドの作成とCRUD操作E2Eテストの実装
