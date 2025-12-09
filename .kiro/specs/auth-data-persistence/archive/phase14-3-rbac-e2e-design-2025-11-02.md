# Phase 14.3設計書：RBAC権限チェックE2Eテスト

**作成日**: 2025年11月2日
**仕様ID**: auth-data-persistence
**Phase**: Phase 14.3（RBAC権限チェックE2Eテスト）
**言語**: 日本語

---

## 📋 目的

Phase 14.3では、ロールベースアクセス制御（RBAC）が正しく機能していることをE2Eテストで検証します。

### 要件（Requirements 2.1-2.15, 12.1-12.18）

- super-adminの全権限テスト（管理画面アクセス、全施設管理）
- admin権限の施設管理とメンバー招待テスト
- editor権限のシフト作成・編集テスト
- viewer権限の閲覧のみテスト
- 権限なし操作の拒否テスト

---

## 🎯 実施方針

### RBAC E2Eテストの課題

**Phase 14.1で得られた知見を活用**:
- Google OAuth認証フローの完全自動化は困難（外部サービス依存）
- 複数ロールのユーザーを作成してテストする場合、認証済み状態の管理が複雑

**Phase 14.3の特有の課題**:
1. 異なるロール（super-admin, admin, editor, viewer）のユーザーを用意する必要がある
2. 各ユーザーでログイン → 権限チェック → ログアウトのサイクルが必要
3. Firebase Auth Emulatorなしでは、テストユーザーの作成と削除が困難

### 採用するアプローチ

**ハイブリッドアプローチ（Phase 14.1と同様）**:
1. **手動テストガイド**:
   - 本番環境での各ロールの権限検証手順
   - super-admin、admin、editor、viewerの各ロールで検証

2. **自動E2Eテスト（限定的）**:
   - アクセス権限なし画面（Forbidden）の表示テスト
   - 管理画面へのアクセス拒否テスト（認証なし前提）

3. **将来の拡張（Firebase Auth Emulator導入後）**:
   - テストユーザーの自動作成
   - 各ロールでの操作を自動テスト

---

## 🏗️ 実装内容

### 1. 手動テストガイド

**ファイル**: `.kiro/specs/auth-data-persistence/phase14-3-rbac-manual-test-guide-2025-11-02.md`

**内容**:
#### 1.1 super-admin権限の検証
- 管理画面（/admin）へのアクセス
- 施設管理機能の操作
- ユーザー管理機能の操作
- すべての施設へのアクセス

#### 1.2 admin権限の検証
- 自分の施設のシフト作成・編集・削除
- スタッフ管理
- メンバー招待（editor/viewerのみ）
- 管理画面へのアクセス拒否

#### 1.3 editor権限の検証
- シフト作成・編集・閲覧
- スタッフ情報の閲覧のみ
- スタッフ編集・削除の拒否
- メンバー招待機能へのアクセス拒否

#### 1.4 viewer権限の検証
- シフト閲覧のみ
- 全ての編集操作の拒否
- スタッフ情報の閲覧のみ

#### 1.5 権限なしユーザーの検証
- ログイン成功
- `/forbidden` ページへのリダイレクト
- すべての機能へのアクセス拒否

### 2. 自動E2Eテスト（限定的）

**ファイル**: `e2e/rbac-permissions.spec.ts`

#### 2.1 アクセス権限なし画面の表示テスト

**実装可能な理由**: URLに直接アクセスするだけで、認証済み状態は不要

```typescript
test.describe('RBAC権限チェック - アクセス権限なし画面', () => {
  test('Forbiddenページが正しく表示される', async ({ page }) => {
    await page.goto('/forbidden');

    // ヘッディングを確認
    await expect(page.getByRole('heading', { name: 'アクセス権限がありません' })).toBeVisible();

    // メッセージを確認
    await expect(page.getByText(/施設への招待を受けるか、管理者に連絡してください/)).toBeVisible();
  });

  test('Forbiddenページに管理画面へのリンクが表示されない', async ({ page }) => {
    await page.goto('/forbidden');

    // 管理画面リンクが存在しないことを確認
    const adminLink = page.getByRole('link', { name: /管理/ });
    await expect(adminLink).not.toBeVisible();
  });
});
```

#### 2.2 将来の拡張（test.skip）

**Firebase Auth Emulator導入後に実装予定**:

```typescript
test.describe('RBAC権限チェック - 各ロール', () => {
  test.skip('super-adminは管理画面にアクセスできる', async ({ page }) => {
    // Firebase Auth Emulatorでsuper-adminユーザーを作成
    // ログイン
    // 管理画面にアクセス
    // 施設管理、ユーザー管理が表示されることを確認
  });

  test.skip('adminはシフト作成・編集ができる', async ({ page }) => {
    // Firebase Auth Emulatorでadminユーザーを作成
    // ログイン
    // シフト作成・編集操作
    // 成功することを確認
  });

  test.skip('editorはシフト作成・編集ができるが、スタッフ編集はできない', async ({ page }) => {
    // Firebase Auth Emulatorでeditorユーザーを作成
    // ログイン
    // シフト作成・編集操作: 成功
    // スタッフ編集操作: 拒否されることを確認
  });

  test.skip('viewerはすべて閲覧のみで、編集操作が拒否される', async ({ page }) => {
    // Firebase Auth Emulatorでviewerユーザーを作成
    // ログイン
    // シフト閲覧: 成功
    // シフト編集操作: ボタンが表示されないか、操作が拒否されることを確認
  });
});
```

---

## 📊 テストカバレッジ

### 手動テスト（必須）

| テストケース | 検証項目 | 期待結果 |
|---|---|------|
| super-admin権限 | 管理画面アクセス | 全機能にアクセス可能 |
| | 施設管理 | 全施設を管理可能 |
| | ユーザー管理 | すべてのユーザーを管理可能 |
| admin権限 | シフト作成・編集・削除 | 自分の施設のみ操作可能 |
| | スタッフ管理 | 自分の施設のみ操作可能 |
| | メンバー招待 | editor/viewerのみ招待可能 |
| | 管理画面アクセス | 拒否される |
| editor権限 | シフト作成・編集 | 可能 |
| | スタッフ閲覧 | 可能 |
| | スタッフ編集・削除 | 拒否される |
| | メンバー招待 | 拒否される |
| viewer権限 | シフト閲覧 | 可能 |
| | すべての編集操作 | 拒否される |
| 権限なしユーザー | ログイン | 成功 |
| | Forbiddenページ表示 | 表示される |
| | すべての機能アクセス | 拒否される |

### 自動E2Eテスト

| テストケース | 実装状況 | 備考 |
|---|---|------|
| Forbiddenページ表示 | ✅ 実装可能 | 認証不要 |
| Forbiddenページ内容確認 | ✅ 実装可能 | 認証不要 |
| super-admin権限チェック | ⚠️ 部分的 | Firebase Emulatorが必要 |
| admin権限チェック | ⚠️ 部分的 | Firebase Emulatorが必要 |
| editor権限チェック | ⚠️ 部分的 | Firebase Emulatorが必要 |
| viewer権限チェック | ⚠️ 部分的 | Firebase Emulatorが必要 |

---

## 🚀 実装手順

### Step 1: 手動テストガイドの作成

1. ドキュメント作成: `phase14-3-rbac-manual-test-guide-2025-11-02.md`
2. 各ロールの検証手順を詳細化
3. チェックリスト形式で整理

### Step 2: 自動E2Eテストの実装

1. テストファイル作成: `e2e/rbac-permissions.spec.ts`
2. Forbiddenページの表示テスト実装
3. 将来の拡張（test.skip）を記述

### Step 3: Firebase Auth Emulator連携（Phase 17以降）

**Phase 17以降で検討**:
- Firebase Auth Emulatorのセットアップ
- テスト用ユーザーの自動作成スクリプト
- 各ロールでの自動テスト拡充

---

## 📁 ファイル構成

```
.kiro/specs/auth-data-persistence/
├── phase14-3-rbac-e2e-design-2025-11-02.md  # 本ドキュメント
└── phase14-3-rbac-manual-test-guide-2025-11-02.md  # 手動テストガイド

e2e/
└── rbac-permissions.spec.ts  # 自動E2Eテスト
```

---

## 🐛 既知の制限事項

### 1. Firebase Auth Emulatorなしでは完全自動化は不可

**制限**: テストユーザーの作成と削除が手動でしか行えない

**緩和策**: 手動テストガイドで対応

### 2. 複数ロールのテストが煩雑

**制限**: 各ロールでログイン→テスト→ログアウトのサイクルが必要

**緩和策**:
- Phase 14.3では手動テストガイドで対応
- Phase 17でFirebase Auth Emulator導入後に自動化を拡充

### 3. CI/CDでのE2Eテスト実行

**制限**: 現在、CI/CDでE2Eテストは無効化されている

**緩和策**:
- ローカル環境での手動実行を推奨
- UI安定後にCI/CDで有効化

---

## 📝 関連ドキュメント

- **Phase 14ステータス**: `.kiro/specs/auth-data-persistence/phase14-status-2025-11-01.md`
- **Phase 14.1設計書**: `.kiro/specs/auth-data-persistence/phase14-1-auth-flow-e2e-design-2025-11-02.md`
- **Phase 14.1手動テストガイド**: `.kiro/specs/auth-data-persistence/phase14-1-auth-flow-manual-test-guide-2025-11-02.md`
- **仕様書**: `.kiro/specs/auth-data-persistence/requirements.md` - Requirements 2.1-2.15
- **タスク**: `.kiro/specs/auth-data-persistence/tasks.md` - Phase 14.3

---

## 💡 学び

### Phase 14.3設計で得られた知見

1. **Phase 14.1のハイブリッドアプローチの再利用**
   - Google OAuth認証と同様に、RBAC権限テストも手動テストガイドが有効
   - 認証が関わるテストは、Firebase Auth Emulatorなしでは完全自動化が困難

2. **Forbiddenページの自動テスト**
   - 認証不要なページ（Forbiddenページ）は自動E2Eテストで実装可能
   - Phase 14.1のログアウト機能テストと同様のアプローチ

3. **Firebase Auth Emulatorの必要性（再確認）**
   - 各ロールのテストユーザーを自動作成できるエミュレーターが必須
   - Phase 17以降での導入が推奨される

4. **手動テストガイドの価値**
   - 実際の本番環境でのテストにより、予期しない問題を発見できる
   - 自動化が困難な部分を補完する重要な手段

---

**作成日**: 2025年11月2日
**Phase 14.3ステータス**: 🟡 **設計完了**（実装は次のステップ）
**次のアクション**: 手動テストガイドの作成とForbiddenページE2Eテストの実装
