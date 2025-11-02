# Phase 14.1設計書：認証フローE2Eテスト

**作成日**: 2025年11月2日
**仕様ID**: auth-data-persistence
**Phase**: Phase 14.1（認証フローE2Eテスト）
**言語**: 日本語

---

## 📋 目的

Phase 14.1では、認証フローの統合テストとE2Eテストを実装し、Google OAuth認証フローが正常に動作していることを検証します。

### 要件（Requirements 1.1-1.13）

- Google OAuthログインフローのテスト
- 初回ユーザー登録とsuper-admin付与のテスト
- 2人目以降のユーザー登録とアクセス権限なし画面のテスト
- ログアウトと再ログインのテスト

---

## 🎯 実施方針

### Google OAuth認証の課題

**完全な自動化が困難な理由**:
1. Googleログインページへのリダイレクト（外部サービス）
2. Google認証情報が必要（セキュリティ制約）
3. テスト用Googleアカウントの管理が複雑

### 採用するアプローチ

**ハイブリッドアプローチ**:
1. **手動テストガイドの作成**（Google OAuth認証フローの検証手順）
2. **自動E2Eテスト**（認証済み前提のテスト）
   - ログアウト機能のテスト
   - 認証後のユーザー状態確認テスト
   - アクセス権限なし画面の表示テスト

---

## 🏗️ 実装内容

### 1. 手動テストガイド

**ファイル**: `.kiro/specs/auth-data-persistence/phase14-1-auth-flow-manual-test-guide-2025-11-02.md`

**内容**:
1. **初回ユーザー登録とsuper-admin付与の検証**
   - 本番環境（https://ai-care-shift-scheduler.web.app）にアクセス
   - Google OAuthでログイン
   - super-admin権限が付与されていることを確認
   - Firestoreのusersドキュメント確認

2. **2人目以降のユーザー登録の検証**
   - 別のGoogleアカウントでログイン
   - アクセス権限なし画面が表示されることを確認
   - super-adminが招待機能でアクセス権限を付与
   - 権限付与後のアクセス確認

3. **ログアウトと再ログインの検証**
   - ログアウトボタンをクリック
   - ログイン画面に戻ることを確認
   - 再度ログイン
   - 以前の状態が復元されることを確認

### 2. 自動E2Eテスト

**ファイル**: `e2e/auth-flow.spec.ts`

#### 2.1 ログアウト機能のテスト

```typescript
import { test, expect } from '@playwright/test';

test.describe('認証フロー - ログアウト機能', () => {
  test('ログアウトボタンをクリックすると、ログイン画面に戻る', async ({ page }) => {
    await page.goto('/');

    // ログアウトボタンを探す
    const logoutButton = page.getByRole('button', { name: 'ログアウト' });
    await expect(logoutButton).toBeVisible({ timeout: 10000 });

    // ログアウト実行
    await logoutButton.click();

    // ログイン画面に戻ることを確認
    await expect(page).toHaveURL('/', { timeout: 5000 });

    // Googleログインボタンが表示されることを確認
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible({ timeout: 5000 });
  });
});
```

#### 2.2 認証後のユーザー状態確認テスト

**前提条件**: Firebase Authenticationエミュレーターを使用するか、テスト用の認証済みセッションを作成

```typescript
test.describe('認証フロー - ユーザー状態確認', () => {
  test.skip('認証後、ユーザー名が表示される', async ({ page }) => {
    // このテストは認証済み前提のため、Firebase Emulatorまたはモックが必要
    await page.goto('/');

    // ユーザー名表示を確認
    await expect(page.getByText(/ようこそ/)).toBeVisible({ timeout: 5000 });
  });
});
```

#### 2.3 アクセス権限なし画面の表示テスト

```typescript
test.describe('認証フロー - アクセス権限なし画面', () => {
  test.skip('アクセス権限がない場合、Forbiddenページが表示される', async ({ page }) => {
    // このテストは認証済み＋権限なしの状態を作る必要がある
    await page.goto('/forbidden');

    await expect(page.getByRole('heading', { name: 'アクセス権限がありません' })).toBeVisible();
  });
});
```

---

## 📊 テストカバレッジ

### 手動テスト（必須）

| テストケース | 検証項目 | 期待結果 |
|---|---|---|
| 初回ユーザー登録 | Google OAuthログイン | ログイン成功 |
| | super-admin権限付与 | usersドキュメントにsuper-admin権限が記録される |
| | 管理画面アクセス | 全機能にアクセス可能 |
| 2人目以降の登録 | Google OAuthログイン | ログイン成功 |
| | アクセス権限なし画面 | Forbiddenページが表示される |
| | 招待による権限付与 | 招待リンクから権限を取得 |
| | 権限付与後アクセス | 付与された権限の範囲でアクセス可能 |
| ログアウト | ログアウトボタンクリック | ログイン画面に戻る |
| | 再ログイン | 以前の状態が復元される |

### 自動E2Eテスト

| テストケース | 実装状況 | 備考 |
|---|---|---|
| ログアウト機能 | ✅ 実装可能 | Google OAuth不要 |
| 認証後ユーザー状態 | ⚠️ 部分的 | Firebase Emulatorまたはモックが必要 |
| アクセス権限なし画面 | ⚠️ 部分的 | 認証済み＋権限なし状態の作成が必要 |

---

## 🚀 実装手順

### Step 1: 手動テストガイドの作成

1. ドキュメント作成: `phase14-1-auth-flow-manual-test-guide-2025-11-02.md`
2. 検証手順の詳細化
3. スクリーンショット撮影（オプション）

### Step 2: 自動E2Eテストの実装

1. テストファイル作成: `e2e/auth-flow.spec.ts`
2. ログアウト機能のテスト実装
3. テスト実行と検証

### Step 3: Firebase Authエミュレーター連携（今後）

**Phase 17以降で検討**:
- Firebase Auth Emulatorのセットアップ
- テスト用ユーザーの自動作成
- 認証済み状態のテスト拡充

---

## 📁 ファイル構成

```
.kiro/specs/auth-data-persistence/
├── phase14-1-auth-flow-e2e-design-2025-11-02.md  # 本ドキュメント
└── phase14-1-auth-flow-manual-test-guide-2025-11-02.md  # 手動テストガイド

e2e/
└── auth-flow.spec.ts  # 自動E2Eテスト
```

---

## 🐛 既知の制限事項

### 1. Google OAuth認証の完全自動化は不可

**制限**: Googleログインページは外部サービスのため、完全な自動化は困難

**緩和策**: 手動テストガイドと組み合わせたハイブリッドアプローチ

### 2. 認証済み状態の作成

**制限**: Playwrightで認証済み状態を作成するには、Firebase Auth Emulatorまたはモックが必要

**緩和策**:
- Phase 14.1では手動テストガイドを中心に検証
- Phase 17以降でFirebase Auth Emulatorを導入して自動化を拡充

### 3. CI/CDでのE2Eテスト実行

**制限**: 現在、CI/CDでE2Eテストは無効化されている（UIが頻繁に変更されるため）

**緩和策**:
- ローカル環境での手動実行を推奨
- UI安定後にCI/CDで有効化

---

## 📝 関連ドキュメント

- **Phase 14ステータス**: `.kiro/specs/auth-data-persistence/phase14-status-2025-11-01.md`
- **既存E2Eテストパターン**: `.kiro/specs/auth-data-persistence/existing-e2e-test-patterns-2025-11-01.md`
- **E2Eテスト動作確認**: `.kiro/specs/auth-data-persistence/e2e-test-verification-2025-11-01.md`
- **仕様書**: `.kiro/specs/auth-data-persistence/requirements.md` - Requirements 1.1-1.13
- **タスク**: `.kiro/specs/auth-data-persistence/tasks.md` - Phase 14.1

---

## 💡 学び

### Phase 14.1設計で得られた知見

1. **Google OAuth認証の自動化の難しさ**
   - 外部サービスへの依存により、完全な自動化は困難
   - 手動テストガイドと組み合わせることで、現実的なテスト戦略を構築

2. **ハイブリッドアプローチの有効性**
   - 手動テスト: Google OAuth認証フローの検証
   - 自動E2Eテスト: ログアウト機能など、認証に依存しない機能の検証

3. **Firebase Auth Emulatorの必要性**
   - 認証済み状態のテストを自動化するには、エミュレーターが必須
   - Phase 17以降で導入を検討

4. **CI/CDとの統合**
   - UIが頻繁に変更される開発初期段階では、E2Eテストのメンテナンスコストが高い
   - UI安定後にCI/CDで有効化することで、コストを削減

---

**作成日**: 2025年11月2日
**Phase 14.1ステータス**: 🟡 **設計完了**（実装は次のステップ）
**次のアクション**: 手動テストガイドの作成とログアウト機能E2Eテストの実装
