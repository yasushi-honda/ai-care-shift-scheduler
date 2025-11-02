# Phase 14.4設計書：バージョン管理機能E2Eテスト

**作成日**: 2025年11月2日
**仕様ID**: auth-data-persistence
**Phase**: Phase 14.4（バージョン管理機能E2Eテスト）
**言語**: 日本語

---

## 📋 目的

Phase 14.4では、シフトのバージョン管理機能が正しく動作していることをE2Eテストで検証します。

### 要件（design.md - バージョン管理実装詳細）

- 下書き保存と確定のE2Eテスト
- バージョン履歴の作成と表示のテスト
- 過去バージョンへの復元のテスト
- バージョン履歴の不変性テスト

---

## 🎯 実施方針

### Phase 14.4の課題

**Phase 14.1-14.3で得られた知見を活用**:
- Google OAuth認証フローの完全自動化は困難（外部サービス依存）
- 認証済みユーザーでのバージョン管理操作テストが必要

**Phase 14.4の特有の課題**:
1. バージョン管理操作には認証済みユーザーとシフトデータが必要
2. versionsサブコレクションへのアクセス確認が必要
3. Firestore Security Rulesによるバージョン履歴の不変性確認が必要
4. Firebase Auth Emulatorなしでは、テストユーザーの管理が困難

### 採用するアプローチ

**ハイブリッドアプローチ（Phase 14.1-14.3と同様）**:
1. **手動テストガイド**:
   - 本番環境でのバージョン管理機能の検証手順
   - 下書き保存、確定、バージョン履歴表示、復元の各機能を網羅

2. **自動E2Eテスト（限定的）**:
   - 認証不要なUI要素の表示テスト
   - バージョン履歴ボタン、確定ボタン、下書き保存ボタンの表示確認

3. **将来の拡張（Firebase Auth Emulator導入後）**:
   - テストユーザーとシフトデータの自動作成
   - バージョン管理操作の自動テスト（下書き保存→確定→復元）

---

## 🏗️ 実装内容

### 1. 手動テストガイド

**ファイル**: `.kiro/specs/auth-data-persistence/phase14-4-version-manual-test-guide-2025-11-02.md`

**内容**:
#### 1.1 下書き保存と確定の検証
- **シフト生成**: AIまたはデモシフト生成（status='draft', version=1）
- **シフト編集**: シフトセルをダブルクリックして編集
- **下書き保存**: 下書き保存ボタンをクリック（status='draft'のまま）
- **シフト確定**: 確定ボタンをクリック（status='confirmed', version=2）
- **Firestore確認**:
  - schedulesドキュメントのstatus='confirmed', version=2を確認
  - versionsサブコレクションにversionNumber=1が作成されていることを確認

#### 1.2 バージョン履歴の作成と表示の検証
- **バージョン履歴ボタンクリック**: 紫色のバージョン履歴ボタンをクリック
- **モーダル表示確認**: バージョン履歴モーダルが表示されることを確認
- **バージョン一覧確認**:
  - versionNumber=1が表示されることを確認
  - 作成日時、作成者、変更説明が表示されることを確認
- **Firestore確認**:
  - `/facilities/{facilityId}/schedules/{scheduleId}/versions` サブコレクションを確認
  - versionNumber=1のドキュメントが存在することを確認

#### 1.3 過去バージョンへの復元の検証
- **シフト再編集**: 確定後のシフトをさらに編集・下書き保存
- **バージョン履歴モーダル表示**: バージョン履歴ボタンをクリック
- **過去バージョン選択**: versionNumber=1の「復元」ボタンをクリック
- **復元確認ダイアログ**: 確認ダイアログが表示されることを確認
- **復元実行**: 「復元」ボタンをクリック
- **カレンダー確認**:
  - カレンダーが過去バージョンの内容に戻ることを確認
  - 編集した箇所が元に戻ることを確認
- **Firestore確認**:
  - schedulesドキュメントのstaffSchedulesが過去バージョンの内容になっていることを確認
  - versionが3にインクリメントされていることを確認
  - versionsサブコレクションに新しいバージョン（versionNumber=2）が作成されていることを確認

#### 1.4 バージョン履歴の不変性の検証
- **Firebase Consoleでバージョン履歴を手動変更**（失敗することを確認）:
  - `/facilities/{facilityId}/schedules/{scheduleId}/versions/{versionNumber}` ドキュメントを手動更新しようとする
  - Firestore Security Rulesにより拒否されることを確認
- **Firebase Consoleでバージョン履歴を手動削除**（失敗することを確認）:
  - versionsサブコレクション内のドキュメントを削除しようとする
  - Firestore Security Rulesにより拒否されることを確認

### 2. 自動E2Eテスト（限定的）

**ファイル**: `e2e/version-management.spec.ts`

#### 2.1 UI要素の表示テスト

**実装可能な理由**: URLに直接アクセスして、認証不要でUI要素を確認

```typescript
test.describe('バージョン管理機能 - UI要素表示', () => {
  test('「下書き保存」ボタンが表示される', async ({ page }) => {
    await page.goto('/');

    // 「下書き保存」ボタンが表示されることを確認
    const draftButton = page.getByRole('button', { name: '下書き保存' });
    await expect(draftButton).toBeVisible({ timeout: 10000 });
  });

  test('「確定」ボタンが表示される', async ({ page }) => {
    await page.goto('/');

    // 「確定」ボタンが表示されることを確認
    const confirmButton = page.getByRole('button', { name: '確定' });
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
  });

  test('「バージョン履歴」ボタンが表示される', async ({ page }) => {
    await page.goto('/');

    // 「バージョン履歴」ボタン（紫色、時計アイコン）が表示されることを確認
    const versionHistoryButton = page.getByRole('button', { name: 'バージョン履歴' });
    await expect(versionHistoryButton).toBeVisible({ timeout: 10000 });
  });
});
```

#### 2.2 将来の拡張（test.skip）

**Firebase Auth Emulator導入後に実装予定**:

```typescript
test.describe('バージョン管理機能 - 完全自動テスト（Firebase Auth Emulator必要）', () => {
  test.skip('シフトを下書き保存できる', async ({ page }) => {
    // Firebase Auth Emulatorでadminユーザーを作成
    // ログイン
    // シフト生成（status='draft', version=1）
    // シフト編集
    // 下書き保存ボタンをクリック
    // Firestoreにstatus='draft'が保存されたことを確認
  });

  test.skip('シフトを確定してバージョン履歴が作成される', async ({ page }) => {
    // Firebase Auth Emulatorでadminユーザーを作成
    // ログイン
    // シフト生成（status='draft', version=1）
    // 確定ボタンをクリック
    // Firestoreにstatus='confirmed', version=2が保存されたことを確認
    // versionsサブコレクションにversionNumber=1が作成されたことを確認
  });

  test.skip('バージョン履歴モーダルが表示される', async ({ page }) => {
    // Firebase Auth Emulatorでadminユーザーを作成
    // ログイン
    // シフト生成・確定（バージョン履歴を作成）
    // バージョン履歴ボタンをクリック
    // モーダルが表示されることを確認
    // versionNumber=1が表示されることを確認
  });

  test.skip('過去バージョンに復元できる', async ({ page }) => {
    // Firebase Auth Emulatorでadminユーザーを作成
    // ログイン
    // シフト生成・確定（バージョン1）
    // シフト編集・下書き保存
    // バージョン履歴モーダルを開く
    // versionNumber=1の「復元」ボタンをクリック
    // 確認ダイアログでOKをクリック
    // カレンダーが過去バージョンに戻ることを確認
    // Firestoreに新バージョンが作成されたことを確認
  });

  test.skip('バージョン履歴は変更・削除できない（不変性）', async ({ page }) => {
    // Firebase Auth Emulatorでadminユーザーを作成
    // ログイン
    // シフト生成・確定（バージョン履歴を作成）
    // Firestore SDKを使ってversionsサブコレクションのドキュメントを更新しようとする
    // Firestore Security Rulesにより拒否されることを確認（permission-denied エラー）
  });
});
```

---

## 📊 テストカバレッジ

### 手動テスト（必須）

| テストケース | 検証項目 | 期待結果 |
|---|---|------|
| **下書き保存** | | |
| シフト生成 | AIまたはデモシフト生成 | status='draft', version=1 |
| シフト編集 | シフトセルをダブルクリックして編集 | UIに即座に反映される |
| 下書き保存 | 下書き保存ボタンをクリック | Firestoreに保存される（status='draft'のまま） |
| **シフト確定** | | |
| 確定ボタンクリック | 確定ボタンをクリック | status='confirmed', version=2 |
| バージョン履歴作成 | versionsサブコレクション確認 | versionNumber=1が作成される |
| 確定ボタン無効化 | 確定後の確定ボタン状態 | ボタンが無効化される |
| **バージョン履歴表示** | | |
| モーダル表示 | バージョン履歴ボタンをクリック | モーダルが表示される |
| バージョン一覧 | モーダル内容確認 | versionNumber, 作成日時, 作成者が表示される |
| **過去バージョン復元** | | |
| 復元実行 | versionNumber=1を復元 | カレンダーが過去バージョンの内容に戻る |
| 新バージョン作成 | versionsサブコレクション確認 | 復元前の状態がversionNumber=2として保存される |
| versionインクリメント | schedulesドキュメント確認 | version=3になる |
| **バージョン履歴不変性** | | |
| 更新拒否 | Firestore Consoleで手動更新 | Security Rulesにより拒否される |
| 削除拒否 | Firestore Consoleで手動削除 | Security Rulesにより拒否される |

### 自動E2Eテスト

| テストケース | 実装状況 | 備考 |
|---|---|------|
| 下書き保存ボタン表示 | ✅ 実装可能 | 認証不要 |
| 確定ボタン表示 | ✅ 実装可能 | 認証不要 |
| バージョン履歴ボタン表示 | ✅ 実装可能 | 認証不要 |
| 下書き保存機能テスト | ⚠️ 部分的 | Firebase Emulatorが必要 |
| 確定機能テスト | ⚠️ 部分的 | Firebase Emulatorが必要 |
| バージョン履歴表示テスト | ⚠️ 部分的 | Firebase Emulatorが必要 |
| 復元機能テスト | ⚠️ 部分的 | Firebase Emulatorが必要 |
| 不変性テスト | ⚠️ 部分的 | Firebase Emulatorが必要 |

---

## 🚀 実装手順

### Step 1: 手動テストガイドの作成

1. ドキュメント作成: `phase14-4-version-manual-test-guide-2025-11-02.md`
2. 各機能の検証手順を詳細化
3. チェックリスト形式で整理

### Step 2: 自動E2Eテストの実装

1. テストファイル作成: `e2e/version-management.spec.ts`
2. UI要素表示テスト実装（3テスト）
3. 将来の拡張（test.skip）を記述（5テスト）

### Step 3: Firebase Auth Emulator連携（Phase 17以降）

**Phase 17以降で検討**:
- Firebase Auth Emulatorのセットアップ
- テスト用施設とユーザー、シフトデータの自動作成スクリプト
- バージョン管理操作の完全自動テスト拡充

---

## 📁 ファイル構成

```
.kiro/specs/auth-data-persistence/
├── phase14-4-version-e2e-design-2025-11-02.md  # 本ドキュメント
└── phase14-4-version-manual-test-guide-2025-11-02.md  # 手動テストガイド

e2e/
└── version-management.spec.ts  # 自動E2Eテスト
```

---

## 🐛 既知の制限事項

### 1. Firebase Auth Emulatorなしでは完全自動化は不可

**制限**: テストユーザーとシフトデータの作成・管理が手動でしか行えない

**緩和策**: 手動テストガイドで対応

### 2. Firestore Security Rulesテストが困難

**制限**: バージョン履歴の不変性をE2Eテストで直接検証することが困難

**緩和策**:
- 手動テストガイドでFirebase Consoleからの手動変更を試みて確認
- Phase 17以降でFirestore Emulatorを使用したSecurity Rulesテストを検討

### 3. versionsサブコレクションへのアクセス確認が困難

**制限**: E2Eテストから直接Firestoreのサブコレクションを確認できない

**緩和策**:
- UIレベルでの確認（バージョン履歴モーダルに表示される = サブコレクションに保存されている）
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
- **Phase 14.2設計書**: `.kiro/specs/auth-data-persistence/phase14-2-crud-e2e-design-2025-11-02.md`
- **Phase 14.3設計書**: `.kiro/specs/auth-data-persistence/phase14-3-rbac-e2e-design-2025-11-02.md`
- **設計書**: `.kiro/specs/auth-data-persistence/design.md` - バージョン管理実装詳細
- **タスク**: `.kiro/specs/auth-data-persistence/tasks.md` - Phase 14.4

---

## 💡 学び

### Phase 14.4設計で得られた知見

1. **Phase 14.1-14.3のハイブリッドアプローチの再利用**
   - バージョン管理操作も認証が必要なため、手動テストガイドが有効
   - 認証不要なUI要素（ボタン）は自動E2Eテストで実装可能

2. **Firestore Security Rulesテストの重要性**
   - バージョン履歴の不変性は、Security Rulesによって保証される
   - E2Eテストだけでなく、Security Rulesのユニットテストも必要（Phase 17以降で検討）

3. **versionsサブコレクションの設計検証**
   - バージョン履歴モーダルでの表示により、サブコレクションの存在を間接的に確認可能
   - Firestore Consoleでの直接確認が最も確実

4. **Firebase Auth Emulatorの必要性（再確認）**
   - 完全自動化には、テストユーザーとシフトデータの自動管理が必須
   - Phase 17以降での導入が強く推奨される

5. **手動テストガイドの価値（再確認）**
   - 実際の本番環境でのテストにより、予期しない問題を発見できる
   - バージョン管理のような複雑な機能では、手動テストが特に有効

---

**作成日**: 2025年11月2日
**Phase 14.4ステータス**: 🟡 **設計完了**（実装は次のステップ）
**次のアクション**: 手動テストガイドの作成とバージョン管理E2Eテストの実装
