# Phase 18: トラブルシューティングガイド

**作成日**: 2025-11-12
**対象**: Phase 18実装者・運用者
**目的**: 問題発生時の迅速な解決

---

## Phase 17で学んだ教訓

**Phase 17の問題パターン**:
1. Firestore Security Rulesの抜け（67% - 4件）
2. Security Rulesの設計矛盾（17% - 1件）
3. 認証トークン初期化タイミング問題（17% - 1件）

**Phase 18での予防策**:
- E2Eテストで80-90%を事前検出
- 監視アラートで残り10-20%を即座に通知

---

## トラブルシューティング フローチャート

```
Permission error発生
↓
E2Eテストで検出？
├─ Yes → firestore.rules確認 → 修正 → デプロイ → 再テスト
└─ No → 本番環境で発生
    ↓
    監視アラート届いた？
    ├─ Yes → ログ確認 → 原因特定 → 修正
    └─ No → アラート設定確認 → 設定修正
```

---

## 問題別トラブルシューティング

### 問題1: E2Eテストで Permission error 検出

**症状**:
```
Error: Permission error detected: Failed to get security alerts: FirebaseError: Missing or insufficient permissions.
```

**原因パターン**:

#### パターンA: Security Rules未定義（最頻出）

**診断方法**:
```bash
# firestore.rules で該当コレクションを検索
grep -n "securityAlerts" firestore.rules
# → 見つからない場合、Rules未定義
```

**解決手順**:

1. `firestore.rules` を開く

2. 該当コレクションのRules追加:
   ```javascript
   match /[コレクション名]/{docId} {
     // super-adminのみ読み取り可能
     allow read: if isAuthenticated() && isSuperAdmin();

     // 認証済みユーザーが作成可能
     allow create: if isAuthenticated();

     // 必要に応じてupdate, deleteルールを追加
   }
   ```

3. デプロイ:
   ```bash
   firebase deploy --only firestore:rules
   ```

4. 再テスト:
   ```bash
   npm run test:e2e:permission
   ```

---

#### パターンB: Security Rules設計矛盾

**例（Phase 17.9）**:
```javascript
// allow list: super-adminは全ユーザーをリスト可能 ✅
allow list: if isAuthenticated() && isSuperAdmin();

// allow get: 自分のドキュメントのみ読み取り可能 ❌ 矛盾！
allow get: if isAuthenticated() && request.auth.uid == userId;
```

**診断方法**:
```bash
# users collectionのルールを確認
grep -A 10 "match /users" firestore.rules
```

**解決手順**:

1. `allow list` と `allow get` の一貫性を確認

2. super-admin権限を追加:
   ```javascript
   allow get: if isAuthenticated() && (request.auth.uid == userId || isSuperAdmin());
   ```

3. デプロイ・再テスト

---

### 問題2: 本番環境で Permission error 発生（E2Eテスト未検出）

**症状**: ユーザーから「Permission errorが出る」と報告

**原因パターン**:

#### パターンA: 認証トークン初期化タイミング問題（Phase 17.8）

**診断方法**:
```bash
# ブラウザコンソールで確認
# ログイン直後に Permission error が表示される
# → 認証トークン初期化前にFirestoreアクセス
```

**解決手順**:

1. `src/contexts/AuthContext.tsx` の `onAuthStateChanged` コールバックを確認

2. 認証トークン強制更新を追加:
   ```typescript
   if (user) {
     // Firestoreの認証トークンを強制的に更新
     try {
       await user.getIdToken(true);
       console.log('✅ Firestore auth token refreshed');
     } catch (tokenError) {
       console.error('❌ Failed to refresh auth token:', tokenError);
     }

     // Firestoreからユーザープロファイルを取得
     const userDoc = await getDoc(doc(db, 'users', user.uid));
     // ...
   }
   ```

3. デプロイ・検証

---

#### パターンB: サブコレクションのRules抜け（Phase 17.5）

**診断方法**:
```bash
# エラーメッセージから対象パスを特定
# 例: "Failed to get version history"
# → versions サブコレクション

# firestore.rules で versions を検索
grep -n "match /versions" firestore.rules
# → 見つからない場合、サブコレクションのRules未定義
```

**解決手順**:

1. 親コレクション（schedules）のRules内にサブコレクションRules追加:
   ```javascript
   match /schedules/{scheduleId} {
     // 既存のルール
     allow read: if isAuthenticated() && (isSuperAdmin() || hasRole(facilityId, 'viewer'));

     // サブコレクションのルール追加
     match /versions/{versionId} {
       allow read: if isAuthenticated() && (isSuperAdmin() || hasRole(facilityId, 'viewer'));
       allow write: if isAuthenticated() && hasRole(facilityId, 'editor');
     }
   }
   ```

2. デプロイ・検証

---

### 問題3: 監視アラートが届かない

**症状**: Permission error が発生しているのにアラートが届かない

**原因パターン**:

#### パターンA: アラートポリシー未設定

**診断方法**:
1. Google Cloud Console → **Monitoring** → **Alerting** → **Policies**
2. "Firestore Permission Error Alert" が存在するか確認

**解決**: `phase18-monitoring-setup-guide.md` に従ってアラート設定

---

#### パターンB: 閾値に達していない

**診断方法**:
```
アラート条件: 5分間に3回以上
実際の発生回数: 1-2回のみ
```

**解決**:
- アラートポリシーを編集して閾値を下げる（5分間に1回）
- または、エラー頻度が低い場合はそのまま

---

#### パターンC: 通知チャネル未設定

**診断方法**:
1. **Monitoring** → **Alerting** → **Notification Channels**
2. Email チャネルが存在するか確認

**解決**: 通知チャネルを追加

---

### 問題4: E2Eテストがタイムアウト

**症状**:
```
Error: Timeout 30000ms exceeded
```

**原因パターン**:

#### パターンA: ページ読み込みが遅い

**診断方法**:
```bash
# ブラウザの Network タブで読み込み時間を確認
```

**解決**:
```typescript
// テストのタイムアウトを延長
test.setTimeout(60000); // 60秒
```

---

#### パターンB: 要素が見つからない

**診断方法**:
```bash
# --debug モードで実行
npm run test:e2e:permission -- --debug
```

**解決**:
```typescript
// 要素の待機時間を延長
await expect(page.getByText(/施設を選択/i)).toBeVisible({ timeout: 10000 });
```

---

### 問題5: GitHub Actions CI/CDでテスト失敗

**症状**: ローカルでは成功するがCI/CDで失敗

**原因パターン**:

#### パターンA: 認証状態がCI/CDに保存されていない

**診断**: GitHub Actionsは認証済みブラウザ状態を持たない

**解決**: 手動トリガー（workflow_dispatch）のみで実行

---

#### パターンB: TEST_USER_IDが設定されていない

**診断**: GitHub Actions ログで確認

**解決**: workflow_dispatch の入力パラメータで TEST_USER_ID を指定

---

## チェックリスト: Permission error発生時

**即座に実行**:
- [ ] エラーメッセージをコピー
- [ ] 発生場所を特定（ページURL、機能）
- [ ] ブラウザコンソールのログ全体を保存

**原因調査**:
- [ ] `firestore.rules` で該当コレクションのルールを確認
- [ ] サブコレクションの場合、親コレクションも確認
- [ ] `allow list` と `allow get` の一貫性を確認

**修正**:
- [ ] Security Rules追加・修正
- [ ] コミット・CodeRabbitレビュー
- [ ] デプロイ（`firebase deploy --only firestore:rules`）

**検証**:
- [ ] E2Eテスト実行（`npm run test:e2e:permission`）
- [ ] 本番環境で動作確認
- [ ] ユーザーに確認依頼

**再発防止**:
- [ ] 類似コレクションも横展開して確認
- [ ] E2Eテストに新しいテストケース追加
- [ ] ドキュメント更新

---

## よくある質問

### Q1: Permission errorを意図的に発生させてテストしたい

**A**: `firestore.rules` を一時的に変更:
```javascript
match /test/{docId} {
  allow read, write: if false; // 意図的にPermission error
}
```

→ テスト後、必ず元に戻すこと

---

### Q2: 監視アラートの誤検知を減らしたい

**A**: アラート条件の閾値を上げる（5分間に3回 → 10回）

---

### Q3: E2Eテストを既存のCI/CDに統合したい

**A**: Firebase Auth Emulatorの導入が必要（Phase 19以降で検討）

---

## 緊急連絡先

**Phase 18関連の問題**:
- ドキュメント: `.kiro/specs/auth-data-persistence/phase18-*.md`
- 実装者: AI（Claude Code）+ ユーザー

**Firebase関連の問題**:
- Firebase Console: https://console.firebase.google.com/
- Google Cloud Console: https://console.cloud.google.com/

---

## 次のステップ

問題解決後:
1. `phase18-verification.md` に解決内容を記録
2. E2Eテストに新しいテストケース追加（再発防止）
3. ドキュメント更新

---

**ガイド作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**最終更新**: 2025-11-12
