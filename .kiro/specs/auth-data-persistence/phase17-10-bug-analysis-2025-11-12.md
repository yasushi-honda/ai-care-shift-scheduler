# Phase 17.10: onUserDelete Cloud Function修正 - バグ分析

**作成日**: 2025-11-12
**仕様ID**: auth-data-persistence
**Phase**: 17.10
**種別**: バグ修正（重大）
**優先度**: 🔴 緊急

---

## 目次

1. [バグ概要](#バグ概要)
2. [エラー詳細](#エラー詳細)
3. [根本原因分析](#根本原因分析)
4. [影響範囲](#影響範囲)
5. [解決策の方向性](#解決策の方向性)

---

## バグ概要

### 症状

Firebase Authenticationからユーザーを削除しても、Firestoreの`/users/{userId}`ドキュメントが削除されず、管理画面のユーザー一覧に削除済みユーザーが表示され続ける。

### 発見経緯

ユーザーからの質問：
> Authentication側で削除してしまったユーザーはhostingのフロントエンド側では反映して削除されない？

調査の結果、`onUserDelete` Cloud Functionが実装されているが、**デプロイに失敗している**ことが判明。

### エラー発生条件

- `onUserDelete` Cloud FunctionがFirebase Functions v1構文で実装されている
- プロジェクトはFirebase Functions v2を使用している
- デプロイ時にTypeScriptエラーが発生し、関数がデプロイされない

---

## エラー詳細

### GitHub Actions CI/CDログ

**GitHub Actions Run ID**: 19293842580（Phase 17.9デプロイ）

```
##[error]src/onUserDelete.ts(19,39): error TS2339: Property 'auth' does not exist on type 'typeof import("/home/runner/work/***/***/functions/node_modules/firebase-functions/lib/v2/index")'.
##[error]src/onUserDelete.ts(19,67): error TS7006: Parameter 'user' implicitly has an 'any' type.
```

### エラー発生箇所

**ファイル**: `functions/src/onUserDelete.ts`
**行**: Line 19

```typescript
export const onUserDelete = functions.auth.user().onDelete(async (user) => {
  // ↑ v1構文：functions.auth は v2 では存在しない
  const uid = user.uid;
  // ...
});
```

### デプロイ状況

```bash
$ gcloud functions list --filter="name:onUserDelete"
# → 結果なし（関数がデプロイされていない）
```

---

## 根本原因分析

### Firebase Functions v1 vs v2の違い

#### v1構文（現在のコード - 動作しない）

```typescript
import * as functions from 'firebase-functions';

export const onUserDelete = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const userEmail = user.email || 'unknown';
  // ...
});
```

**問題点**:
- `functions.auth`はv1のAPI
- プロジェクトは`firebase-functions/v2`を使用（`index.ts`で`setGlobalOptions`を使用）
- v2では`functions.auth`は存在しない

---

#### v2構文（正しい）

```typescript
import { onUserDeleted } from 'firebase-functions/v2/identity';

export const onUserDelete = onUserDeleted(async (event) => {
  const user = event.data;
  const uid = user.uid;
  const userEmail = user.email || 'unknown';
  // ...
});
```

**変更点**:
1. インポート: `firebase-functions` → `firebase-functions/v2/identity`
2. 関数: `functions.auth.user().onDelete()` → `onUserDeleted()`
3. パラメータ: `user` → `event` (userは`event.data`に格納)

---

### プロジェクトのFunctions設定

**ファイル**: `functions/src/index.ts`

```typescript
import { setGlobalOptions } from 'firebase-functions/v2';

// グローバル設定（v2のAPI）
setGlobalOptions({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 120,
  minInstances: 0,
  maxInstances: 10,
});

// エンドポイントのエクスポート
export { onUserDelete } from './onUserDelete';
```

**確認**: `setGlobalOptions`はv2のAPIであり、プロジェクト全体がv2ベースであることが確認できる。

---

### なぜこのバグが見逃されたか

1. **ローカルでのTypeScriptコンパイルチェック未実施**:
   - `onUserDelete.ts`作成時にローカルでコンパイルチェックを実行していなかった
   - CI/CDでのみエラーが発見された

2. **CI/CDログの確認不足**:
   - GitHub Actionsが失敗しているが、エラー詳細を確認していなかった
   - Firestore RulesとHostingは成功しているため、全体として"成功"と見なされていた

3. **機能テストの不足**:
   - Firebase Authenticationからのユーザー削除をテストしていなかった
   - onUserDelete関数の動作確認が行われていなかった

---

## 影響範囲

### 影響を受ける機能

1. **ユーザー削除の不整合**:
   - Firebase Authenticationからユーザー削除
   - Firestoreの`/users/{userId}`ドキュメントは**削除されない**
   - データの不整合が発生

2. **管理画面のユーザー一覧**:
   - 削除済みユーザーが一覧に表示され続ける
   - 削除済みユーザーの詳細ページにアクセスできてしまう
   - ユーザー管理が混乱する

3. **監査ログの欠落**:
   - ユーザー削除操作が監査ログに記録されない
   - セキュリティ監査が困難

### 影響を受けないもの

- ✅ その他のCloud Functions（generateShift, assignSuperAdminOnFirstUser等）
- ✅ Firebase Authentication自体のユーザー削除機能
- ✅ Firestore Security Rules
- ✅ フロントエンドの機能

---

## 解決策の方向性

### 提案する修正

**onUserDelete.tsをFirebase Functions v2構文に書き換え**

#### 修正内容

**Before（v1構文 - 動作しない）**:
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onUserDelete = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const userEmail = user.email || 'unknown';
  // ...
});
```

**After（v2構文 - 正しい）**:
```typescript
import { onUserDeleted } from 'firebase-functions/v2/identity';
import * as admin from 'firebase-admin';

export const onUserDelete = onUserDeleted(async (event) => {
  const user = event.data;
  const uid = user.uid;
  const userEmail = user.email || 'unknown';
  // ...
});
```

### 修正の根拠

1. **v2構文への統一**:
   - プロジェクト全体がv2を使用（`setGlobalOptions`）
   - v2構文を使用することで一貫性を保つ

2. **TypeScriptエラーの解消**:
   - `firebase-functions/v2/identity`から`onUserDeleted`をインポート
   - v2のAPIを使用することでコンパイルエラーが解消される

3. **機能の実現**:
   - Firebase Authenticationからのユーザー削除時にFirestoreドキュメントも削除
   - データ整合性を保つ
   - 監査ログに記録

---

## テスト戦略

### 修正後のテスト

1. **TypeScriptコンパイルチェック**:
   ```bash
   cd functions
   npm run build
   ```

2. **デプロイ確認**:
   ```bash
   # GitHub Actions CI/CD
   git push origin main

   # デプロイ成功確認
   gcloud functions list --filter="name:onUserDelete"
   ```

3. **機能テスト**:
   - Firebase Console → Authentication → テストユーザー作成
   - テストユーザーを削除
   - Firestoreでドキュメントが削除されたか確認
   - 管理画面でユーザー一覧から削除されたか確認
   - 監査ログに記録されたか確認

---

## 次のステップ

1. ✅ バグ分析ドキュメント作成（本ドキュメント）
2. 📝 技術設計ドキュメント作成
3. 🔧 onUserDelete.ts修正
4. 🚀 デプロイ（GitHub Actions CI/CD）
5. ✅ 本番環境で検証
6. 📝 Phase 17.10検証ドキュメント作成

---

## 関連ドキュメント

- `functions/src/onUserDelete.ts` - 修正対象ファイル
- `functions/src/index.ts` - Cloud Functions設定
- `phase17-summary-2025-11-12.md` - Phase 17総括レポート

---

**レポート作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: 分析完了・技術設計へ
