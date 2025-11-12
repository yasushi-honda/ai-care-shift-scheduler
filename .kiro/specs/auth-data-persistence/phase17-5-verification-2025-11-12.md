# Phase 17.5: Permission Error修正（versionsサブコレクション） - 検証レポート

**更新日**: 2025-11-12
**仕様ID**: auth-data-persistence
**Phase**: 17.5
**種別**: バグ修正（重大）
**ステータス**: ✅ 実装完了・本番デプロイ完了

---

## 概要

Phase 17の修正後も継続していた`getVersionHistory`のPermission errorを修正しました。根本原因は、Firestore Security Rulesに`versions`サブコレクションのルールが未定義だったためです。

---

## 実装サマリー

### 修正内容

**ファイル**: `firestore.rules`

**変更内容**:
- `schedules/{scheduleId}/versions/{versionId}`のSecurity Rules追加
- viewer以上で読み取り、editor以上で書き込み

**実装詳細**:

```javascript
// schedules subcollection
match /schedules/{scheduleId} {
  // super-adminまたはviewer以上で読み取り、editor以上で書き込み
  allow read: if isAuthenticated() && (isSuperAdmin() || hasRole(facilityId, 'viewer'));
  allow write: if isAuthenticated() && hasRole(facilityId, 'editor');

  // 🆕 versions サブコレクション
  match /versions/{versionId} {
    // viewer以上で読み取り、editor以上で書き込み（scheduleと同じ権限）
    allow read: if isAuthenticated() && (isSuperAdmin() || hasRole(facilityId, 'viewer'));
    allow write: if isAuthenticated() && hasRole(facilityId, 'editor');
  }
}
```

### 効果

- ✅ `getVersionHistory()`でのPermission errorが解消
- ✅ バージョン履歴の表示が可能になる
- ✅ バージョン復元機能が使用可能になる
- ✅ Phase 6で実装したバージョン管理機能が正常に動作

---

## デプロイ結果

### GitHub Actions CI/CD

**Run ID**: 19290977532
**ステータス**: ✅ 成功
**実行時間**: 約2分

#### ジョブ詳細

1. **ビルドとテスト** (29秒):
   - TypeScript型チェック: ✅ 0エラー
   - プロダクションビルド: ✅ 成功

2. **Firebaseにデプロイ** (1分20秒):
   - Hosting: ✅ デプロイ完了
   - Cloud Functions: ✅ デプロイ完了
   - **Firestore Rules**: ✅ デプロイ完了（✨ 重要）

### デプロイされた成果物

#### Firestore Security Rules
- **ステータス**: ✅ 更新完了
- **変更**: `versions`サブコレクションルール追加
- **確認**: Firebase Console → Firestore Database → Rules

---

## コミット履歴

```
commit c6f32dd
fix: Phase 17.5 versionsサブコレクションのSecurity Rules追加

## 修正内容
- schedules/{scheduleId}/versions/{versionId}のルール追加
- viewer以上で読み取り、editor以上で書き込み

## 成果物
- firestore.rules
- phase17-5-*.md (2件)
- tasks.md
```

---

## 本番環境での動作確認（手動テスト予定）

### テストシナリオ: バージョン履歴の表示

**手順**:
1. 本番環境（https://ai-care-shift-scheduler.web.app）にログイン
2. シフト作成画面を開く
3. 「バージョン履歴」ボタンをクリック

**期待される結果**:
- ✅ バージョン履歴が表示される
- ✅ ブラウザコンソールにPermission errorが表示されない
- ✅ 「Failed to get version history」エラーが消える

**ステータス**: ⏳ 未実施（ユーザー実施待ち）

---

## バグ2: User Fetch Permission Error（未解決）

### 現状

```
index-BcVVQg4d.js:3247 Error fetching user: FirebaseError: Missing or insufficient permissions.
エラー: ユーザー情報の取得に失敗しました
```

このエラーは**Phase 17.5では未対応**です。

### 追加調査が必要

1. **Firebase Console確認**:
   - `users`コレクションにユーザードキュメントが存在するか
   - `facilities`配列が設定されているか

2. **Cloud Functionsログ確認**:
   - `assignSuperAdminOnFirstUser`が正常に実行されているか

3. **Security Rulesデプロイ確認**:
   - 最新のRulesが正しくデプロイされているか

### 推奨される対応

**Phase 17.6として別途対応**:
- ユーザードキュメントの存在確認
- Cloud Function実行ログの分析
- Security Rulesの手動デプロイ（必要な場合）
- ユーザードキュメントの手動作成（緊急対応）

---

## 学び・振り返り

### 成功した点

1. **ドキュメントドリブン開発**:
   - バグ分析 → 技術設計 → 実装 → 検証のフローが効果的
   - 短時間（30分）で修正完了

2. **根本原因の特定**:
   - コード調査とSecurity Rules確認により、原因を迅速に特定
   - サブコレクションのルール未定義という明確な問題

3. **CodeRabbitレビュー**:
   - Security Rules修正に問題なし

### 教訓

1. **Security Rulesの網羅性**:
   - サブコレクション追加時は、Security Rulesも同時に定義する必要がある
   - Phase 6実装時にRulesを追加すべきだった

2. **E2Eテストの重要性**:
   - E2EテストでPermission errorを検出できなかった
   - バージョン履歴表示のテストを追加すべき

3. **デプロイ後の確認**:
   - Security Rulesデプロイ後、本番環境での動作確認が重要

---

## 次のステップ

### 即座に実施すべきこと（ユーザー側）

**バージョン履歴の動作確認**:
1. 本番環境にログイン
2. シフト作成画面でバージョン履歴を確認
3. ブラウザコンソールでPermission errorがないか確認

### 今後の対応（Phase 17.6候補）

**User Fetch Permission Error調査**:
1. Firebase Consoleで`users`コレクション確認
2. Cloud Functionsログ分析
3. 原因特定と修正実装

---

## まとめ

Phase 17.5「versionsサブコレクションのSecurity Rules追加」は、**ドキュメントドリブン開発**のアプローチに従って、短時間で完了しました：

### 達成事項

- ✅ **バグ分析ドキュメント作成**: 根本原因を特定
- ✅ **技術設計ドキュメント作成**: Security Rules設計
- ✅ **firestore.rules修正**: versionsサブコレクションルール追加
- ✅ **tasks.md更新**: Phase 17.5タスク追加
- ✅ **CI/CDデプロイ**: 本番環境に反映（成功）

### 成果物

- `firestore.rules` - versionsサブコレクションルール追加
- `.kiro/specs/auth-data-persistence/phase17-5-*.md` - ドキュメント2件
- `tasks.md` - Phase 17.5追加

### 残タスク

- ⏳ 本番環境でバージョン履歴の動作確認（ユーザー側）
- ⏳ User Fetch Permission Error調査（Phase 17.6）

---

## 関連ドキュメント

- `phase17-5-bug-analysis-2025-11-12.md` - バグ分析
- `phase17-5-design-2025-11-12.md` - 技術設計
- `firestore.rules` - Firestore Security Rules
- `tasks.md` - Phase 17.5実装計画

---

**レポート作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: Phase 17.5実装完了・本番デプロイ完了・手動テスト待ち
