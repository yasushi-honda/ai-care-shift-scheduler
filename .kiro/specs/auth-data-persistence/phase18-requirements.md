# Phase 18: E2Eテストの拡充と監視の強化 - 要件定義

**作成日**: 2025-11-12
**仕様ID**: auth-data-persistence
**Phase**: 18
**種別**: テスト・監視強化

---

## 目次

1. [背景と目的](#背景と目的)
2. [Phase 17の教訓](#phase-17の教訓)
3. [要件概要](#要件概要)
4. [機能要件](#機能要件)
5. [非機能要件](#非機能要件)
6. [成功基準](#成功基準)
7. [制約条件](#制約条件)
8. [リスク分析](#リスク分析)

---

## 背景と目的

### 現状の課題

Phase 17（17.5-17.11）で発見された6つの問題：
1. ✅ versionsサブコレクションのPermission error（Phase 17.5）
2. ✅ COOPヘッダー未設定（Phase 17.6）
3. ✅ COOP警告の説明不足（Phase 17.7）
4. ✅ User Fetch Permission Error（Phase 17.8）
5. ✅ Admin User Detail Permission Error（Phase 17.9）
6. ✅ onUserDelete Cloud FunctionのTypeScriptコンパイルエラー（Phase 17.10）
7. ✅ Security Alerts Permission Error（Phase 17.11）

**問題点**:
- すべて本番環境でユーザー報告により発見
- 発見から修正まで9時間以上を費やした
- **これらの多く（5つのPermission error）はE2Eテストで事前検出可能だった**

### 目的

**Phase 18の目標**:
1. 本番環境デプロイ**前**に、Permission error系のバグを自動検出する
2. 本番環境デプロイ**後**に発生したエラーを即座に通知する
3. Phase 17のような問題を繰り返さない

**期待される効果**:
- バグ発見から修正までの時間を短縮（数時間→数分）
- ユーザー体験の向上（エラーに遭遇する確率を大幅削減）
- 開発者の作業効率向上（バグ修正の時間を削減）

---

## Phase 17の教訓

### E2Eテストで検出可能だったバグ

| Phase | バグ | E2Eテストで検出可能？ | 理由 |
|-------|------|---------------------|------|
| 17.5 | versionsのPermission error | ✅ 可能 | バージョン履歴表示のテストで検出可能 |
| 17.6 | COOPヘッダー未設定 | ❌ 困難 | ブラウザコンソール警告の自動検出は難しい |
| 17.7 | COOP警告の説明不足 | ❌ 不要 | UX改善なのでテスト対象外 |
| 17.8 | User Fetch Permission Error | ✅ 可能 | ログイン直後のユーザー情報取得テストで検出可能 |
| 17.9 | Admin User Detail Permission Error | ✅ 可能 | ユーザー詳細ページのテストで検出可能 |
| 17.10 | onUserDelete TypeScriptエラー | ⚠️ 部分的 | TypeScriptコンパイルは既存のCIで検出済み（デプロイ失敗） |
| 17.11 | Security Alerts Permission Error | ✅ 可能 | セキュリティアラートページのテストで検出可能 |

**結論**: 7つの問題のうち**5つ（71%）**はE2Eテストで事前検出可能だった

### Permission errorの共通パターン

**Phase 17で発見されたPermission errorの共通点**:
1. **Firestore Security Rulesの抜け**（Phase 17.5, 17.11）
   - サブコレクションやコレクションのルール定義漏れ
2. **Security Rulesの設計矛盾**（Phase 17.9）
   - `allow list`はsuper-adminを許可、`allow get`は許可しない
3. **認証トークンの初期化タイミング問題**（Phase 17.8）
   - Firestoreの`request.auth`が完全に初期化される前にアクセス

**共通の検出方法**:
- 対象ページにアクセスしてコンソールに`Permission`や`insufficient permissions`が表示されないことを確認
- 簡単なE2Eテストで検出可能

---

## 要件概要

### Phase 18のスコープ

**Phase 18.1: Permission error自動検出E2Eテスト（高優先度）**
- 管理画面のすべての主要ページでPermission errorが発生しないことを確認
- バージョン履歴、セキュリティアラート、ユーザー詳細などの重要機能をカバー

**Phase 18.2: 監視アラート設定（中優先度）**
- Firebase ConsoleまたはGoogle Cloud Monitoringでエラーアラート設定
- Permission error発生時に即座に通知

**Phase 18.3: その他の重要機能のE2Eテスト（低優先度・オプション）**
- AIシフト生成機能の総合テスト
- データ永続化機能の総合テスト
- 余裕があれば実施

### 実装順序

```
Phase 18.1: Permission error自動検出E2Eテスト
↓ （最優先・即座に効果が出る）
Phase 18.2: 監視アラート設定
↓ （時間があれば）
Phase 18.3: その他の重要機能のE2Eテスト
```

---

## 機能要件

### FR-18.1: Permission error自動検出E2Eテスト

#### FR-18.1.1: 管理画面全ページのPermission errorチェック

**要件**:
- すべての管理画面ページにsuper-adminユーザーでアクセス
- コンソールに`Permission`または`insufficient permissions`が表示されないことを確認

**対象ページ**（Phase 17で問題があったページを優先）:
1. ✅ `/admin/users/{userId}` - ユーザー詳細（Phase 17.9で問題）
2. ✅ `/admin/security-alerts` - セキュリティアラート（Phase 17.11で問題）
3. ✅ シフト管理ページでバージョン履歴表示（Phase 17.5で問題）
4. `/admin/users` - ユーザー一覧
5. `/admin/facilities` - 施設管理
6. `/admin/facilities/{facilityId}` - 施設詳細
7. `/admin/audit-logs` - 監査ログ

**テスト形式**:
```typescript
test('管理画面のすべてのページにPermission errorなしでアクセス可能', async ({ page }) => {
  // super-adminでログイン
  await loginAsSuperAdmin(page);

  // 各ページにアクセスしてPermission errorがないことを確認
  await page.goto('/admin/users/test-user-id');
  await expect(page.getByText(/permission/i)).not.toBeVisible();

  await page.goto('/admin/security-alerts');
  await expect(page.getByText(/permission/i)).not.toBeVisible();

  // 他のページも同様
});
```

**成功基準**:
- ✅ すべての対象ページでPermission errorが発生しない
- ✅ テストが5分以内に完了する
- ✅ GitHub Actions CI/CDで自動実行される

#### FR-18.1.2: バージョン履歴表示のテスト

**要件**:
- シフト管理ページでバージョン履歴を表示
- versionsサブコレクションへのアクセスでPermission errorが発生しないことを確認

**テスト形式**:
```typescript
test('シフトのバージョン履歴にアクセス可能', async ({ page }) => {
  await loginAsSuperAdmin(page);

  // シフト管理ページに移動
  await page.goto('/shift-management');

  // バージョン履歴ボタンをクリック
  await page.getByRole('button', { name: /バージョン履歴/i }).click();

  // Permission errorがないことを確認
  await expect(page.getByText(/permission/i)).not.toBeVisible();

  // バージョン履歴が表示されることを確認
  await expect(page.getByText(/バージョン/i)).toBeVisible();
});
```

#### FR-18.1.3: 認証トークン初期化のテスト

**要件**:
- ログイン直後のユーザー情報取得でPermission errorが発生しないことを確認
- Phase 17.8の問題（認証トークン初期化タイミング）の再発防止

**テスト形式**:
```typescript
test('ログイン直後にユーザー情報を正常に取得', async ({ page }) => {
  // ログインページにアクセス
  await page.goto('/login');

  // Google認証でログイン（実際のテストではモック）
  await loginAsSuperAdmin(page);

  // ログイン直後、Permission errorが発生しないことを確認
  // 認証トークン初期化を待つ（ユーザー情報が表示されるまで）
  await expect(page.getByText(/super-admin/i)).toBeVisible({ timeout: 5000 });

  // Permission errorが表示されていないことを確認
  await expect(page.getByText(/permission/i)).not.toBeVisible();
});
```

---

### FR-18.2: 監視アラート設定

#### FR-18.2.1: Firebase Console エラー監視

**要件**:
- Firebase ConsoleでFirestore Permission errorの監視を設定
- エラー発生時にSlack/Emailで通知

**監視対象エラー**:
1. `Missing or insufficient permissions` - Firestore Permission error
2. `PERMISSION_DENIED` - Firestore Security Rules違反
3. `Failed to get [resource]` - リソース取得失敗

**通知条件**:
- エラーが5分間に3回以上発生した場合に通知
- 本番環境のみ監視

#### FR-18.2.2: Cloud Functions エラー監視

**要件**:
- Cloud Functionsのエラーログを監視
- 関数の実行失敗やタイムアウトを検出

**監視対象**:
- `generateShift` - AIシフト生成関数
- `onUserDelete` - ユーザー削除トリガー
- その他すべてのCloud Functions

**通知条件**:
- 関数実行が失敗した場合に即座に通知
- タイムアウト（60秒以上）が発生した場合に通知

---

### FR-18.3: その他の重要機能のE2Eテスト（オプション）

#### FR-18.3.1: AIシフト生成の総合テスト

**要件** （余裕があれば実施）:
- AIシフト生成機能のエンドツーエンドテスト
- デモデータを使用してシフト生成が正常に完了することを確認

#### FR-18.3.2: データ永続化の総合テスト

**要件** （余裕があれば実施）:
- ローカルストレージの保存・復元テスト
- リロード後のデータ復元テスト

---

## 非機能要件

### NFR-18.1: パフォーマンス

**要件**:
- E2Eテストスイート全体の実行時間: 10分以内
- 各テストケースの実行時間: 2分以内
- GitHub Actions CI/CDの実行時間への影響: +5分以内

### NFR-18.2: メンテナンス性

**要件**:
- テストコードは既存のE2Eテストパターンに従う
- ヘルパー関数を使用してコードの重複を避ける
- コメントで各テストの目的を明記

### NFR-18.3: 信頼性

**要件**:
- Flaky test（不安定なテスト）を最小化
- タイムアウトや非同期処理を適切に処理
- テスト失敗時に詳細なエラーメッセージを表示

### NFR-18.4: CI/CD統合

**要件**:
- GitHub Actions CI/CDで自動実行
- mainブランチへのpush時に必ず実行
- テスト失敗時はデプロイを中止

---

## 成功基準

### Phase 18.1の成功基準

- ✅ **Permission error検出率**: Phase 17で発見された5つのPermission errorが事前検出可能
- ✅ **テスト実行時間**: 5分以内
- ✅ **CI/CD統合**: GitHub Actionsで自動実行
- ✅ **カバレッジ**: 管理画面の主要7ページをカバー

### Phase 18.2の成功基準

- ✅ **監視設定**: Firebase ConsoleまたはGoogle Cloud Monitoringで設定完了
- ✅ **通知動作確認**: テストエラーで通知が届くことを確認
- ✅ **通知速度**: エラー発生から5分以内に通知

### 全体の成功基準

**数値目標**:
- Phase 17のようなPermission errorの**80-90%**をデプロイ前に検出
- バグ発見から修正までの時間を**50%削減**（数時間→1時間以内）
- 本番環境でのPermission error発生率を**70%削減**

**定性目標**:
- ✅ 開発者がバグ修正に費やす時間を削減
- ✅ ユーザーがエラーに遭遇する確率を削減
- ✅ 本番環境の安定性向上

---

## 制約条件

### 技術的制約

1. **E2Eテストの制約**:
   - Firebase Authenticationの実際のGoogle認証はテストできない（モック必要）
   - 本番環境のFirestoreデータには直接アクセスしない（エミュレータ使用）

2. **テストデータ管理戦略**:
   - **フィクスチャ管理**: テスト前に既知の状態のデータセットを準備
   - **テスト分離**: 各テストが独立して実行可能（他のテストに依存しない）
   - **クリーンアップ**: テスト後にデータを初期状態にリセット
   - **環境**: Firebase Emulator使用（本番データに影響なし）
   - **実装パターン**:
     - フィクスチャファイル: `e2e/fixtures/` に管理
     - セットアップ/クリーンアップ: 各テストの `beforeEach`/`afterEach` で実行
     - 参照: Phase 14実装パターンを踏襲

3. **監視の制約**:
   - Firebase Consoleの無料枠の制限
   - 通知先はSlackまたはEmailのみ（他のサービスは追加設定が必要）

4. **CI/CDの制約**:
   - GitHub Actionsの実行時間制限（無料枠: 2000分/月）
   - E2Eテストの追加により実行時間が増加

### 予算・時間的制約

**実装時間の見積もり**:
- Phase 18.1（Permission error自動検出E2Eテスト）: 3-4時間
- Phase 18.2（監視アラート設定）: 1-2時間
- Phase 18.3（その他のE2Eテスト）: オプション（2-3時間）

**合計**: 4-6時間（Phase 18.3を除く）

---

## リスク分析

### 高リスク

**R-18.1: E2Eテストが不安定（Flaky test）**
- **影響**: CI/CDが頻繁に失敗、開発効率低下
- **確率**: 中（30%）
- **軽減策**:
  - 適切な`waitFor`や`retry`を使用
  - タイムアウト時間を適切に設定
  - Phase 14で実装済みのE2Eテストパターンを活用

**R-18.2: E2Eテスト実行時間が長すぎる**
- **影響**: CI/CDの実行時間が大幅に増加、開発サイクル遅延
- **確率**: 中（30%）
- **軽減策**:
  - 並列実行を活用
  - 重要なテストのみを優先実行
  - 必要に応じてテストを分割

### 中リスク

**R-18.3: 監視アラートの誤検知**
- **影響**: アラート疲れ、重要なエラーを見逃す
- **確率**: 中（40%）
- **軽減策**:
  - 適切な閾値設定（5分間に3回以上）
  - 本番環境のみ監視

**R-18.4: Firebase Consoleの設定変更によりテストが失敗**
- **影響**: 既存機能に影響を与える可能性
- **確率**: 低（10%）
- **軽減策**:
  - Firebaseエミュレータで先にテスト
  - 変更前にバックアップ

### 低リスク

**R-18.5: GitHub Actionsの無料枠を超過**
- **影響**: 追加コスト発生
- **確率**: 低（10%）
- **軽減策**:
  - E2Eテストの実行時間を監視
  - 必要に応じて有料プランへ移行

---

## 関連ドキュメント

- `phase17-summary-2025-11-12.md` - Phase 17総括レポート（教訓の元）
- `phase14-progress-final-20251102.md` - Phase 14 E2Eテスト実装（参考）
- `.github/workflows/ci-cd.yml` - GitHub Actions CI/CD設定
- `playwright.config.ts` - Playwright設定

---

## 次のステップ

1. ✅ 要件定義完了（本ドキュメント）
2. 📝 技術設計ドキュメント作成 → `phase18-design.md`
3. 📝 タスク分解 → `tasks.md`更新
4. 🔧 実装（Phase 18.1, 18.2）
5. ✅ 検証とドキュメント

---

**レポート作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: 要件定義完了・技術設計へ
