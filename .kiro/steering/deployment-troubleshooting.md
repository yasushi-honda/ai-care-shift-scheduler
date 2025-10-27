# デプロイとキャッシュのトラブルシューティング

## 問題の概要

**発生日時**: 2025-10-27
**Phase**: Phase 10.1 - 管理画面レイアウトとナビゲーション
**症状**: デプロイ後も本番環境に新しいコードが反映されず、古いバージョンが配信され続ける

## 根本原因の分析

### 1. Firebase Hostingのキャッシュ構造

Firebase Hostingは複数レイヤーでキャッシュを行います：

```
ブラウザキャッシュ (cache-control: max-age=3600)
     ↓
CDNキャッシュ (Firebase CDN)
     ↓
Firebase Hosting Origin
```

**問題点**:
- `index.html`に1時間（3600秒）のキャッシュが設定されている
- CDNキャッシュは即座にクリアされない
- ブラウザキャッシュも残り続ける

### 2. GitHub Actions CI/CDの挙動

**観察された動作**:
```bash
# デプロイログ
✔ hosting[***]: file upload complete
✔ hosting[***]: version finalized
✔ hosting[***]: release complete
```

しかし、実際には：
- Cloud Functions deploymentでエラーが発生（cleanup policy警告）
- エラーによりworkflow全体が`failure`扱い
- しかし、Hostingデプロイ自体は完了している（矛盾）

### 3. 確認された事実

**ローカルビルド**:
```bash
$ cat dist/index.html
<script type="module" crossorigin src="/assets/index-DgwZvC7h.js"></script>
```

**本番環境**:
```bash
$ curl https://ai-care-shift-scheduler.web.app/
<script type="module" crossorigin src="/assets/index-5s5skRMl.js"></script>
```

**結論**: 本番環境に最新のビルドがデプロイされていない

## 根本原因

### 最も可能性が高い原因

**GitHub Actionsワークフローの設計問題**:

```yaml
# .github/workflows/ci.yml（推定）
- name: Firebase deploy
  run: firebase deploy --only hosting,functions,firestore:rules
```

この設計では：
1. `functions` deploymentが失敗すると全体がfailureになる
2. しかし、`hosting`は先に成功している可能性がある
3. **ただし、buildステップとの同期問題がある可能性**

### セカンダリ原因候補

1. **Buildステップの問題**:
   - GitHub Actionsで`npm run build`が実行されているが、結果が正しく使用されていない可能性
   - distディレクトリが正しくアップロードされていない

2. **Firebase Hostingの設定問題**:
   - `firebase.json`で`public`ディレクトリの設定が誤っている可能性

## 検証手順

### 1. firebase.jsonの確認

```bash
cat firebase.json | jq '.hosting'
```

### 2. GitHub Actionsログの詳細確認

```bash
gh run view <run-id> --log | grep -A10 "hosting"
```

### 3. Firebase Hostingのバージョン確認

```bash
gcloud app versions list --project ai-care-shift-scheduler
```

## 予防策と恒久対策

### 短期対策（即時実施）

#### 1. firebase.jsonの cache-control 設定を最適化

```json
{
  "hosting": {
    "public": "dist",
    "headers": [
      {
        "source": "/index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },
      {
        "source": "/assets/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

**理由**:
- `index.html`: キャッシュ無効化により、常に最新版を取得
- `/assets/**`: ハッシュ付きファイル名なので長期キャッシュOK

#### 2. デプロイ後の検証ステップを追加

```yaml
- name: Verify deployment
  run: |
    sleep 30  # CDN反映待ち
    DEPLOYED_HASH=$(curl -s https://ai-care-shift-scheduler.web.app/ | grep -o 'index-[^.]*\.js' | head -1)
    LOCAL_HASH=$(cat dist/index.html | grep -o 'index-[^.]*\.js' | head -1)

    if [ "$DEPLOYED_HASH" != "$LOCAL_HASH" ]; then
      echo "❌ Deployment verification failed"
      echo "Deployed: $DEPLOYED_HASH"
      echo "Expected: $LOCAL_HASH"
      exit 1
    fi
    echo "✅ Deployment verified successfully"
```

#### 3. Functions deploymentを分離

```yaml
# Hosting deploymentを優先
- name: Deploy Hosting
  run: firebase deploy --only hosting --project ${{ secrets.FIREBASE_PROJECT_ID }}

- name: Deploy Functions (failure許容)
  run: firebase deploy --only functions --project ${{ secrets.FIREBASE_PROJECT_ID }} || true

- name: Deploy Firestore Rules
  run: firebase deploy --only firestore:rules --project ${{ secrets.FIREBASE_PROJECT_ID }}
```

### 中期対策

#### 4. Preview Channelの活用

```bash
# PRごとにpreview channelをデプロイ
firebase hosting:channel:deploy pr-$PR_NUMBER --expires 7d
```

**メリット**:
- 本番反映前に動作確認が可能
- キャッシュ問題の影響を受けない

#### 5. デプロイ手順のドキュメント化

**手動デプロイ時のチェックリスト**:
1. ✅ `npm run build`を実行
2. ✅ `dist/index.html`のハッシュを確認
3. ✅ `firebase deploy --only hosting`
4. ✅ 本番環境でハードリロード（Cmd+Shift+R）
5. ✅ 本番環境のHTMLソースでハッシュを確認
6. ✅ 管理画面リンクの表示を確認（super-adminユーザー）

### 長期対策

#### 6. CI/CDパイプラインの改善

- **Staging環境の導入**: 本番デプロイ前に検証
- **Canary deployment**: 段階的なリリース
- **自動E2Eテスト**: デプロイ後の動作確認

#### 7. モニタリングとアラート

- Firebase Hosting metricsの監視
- デプロイ成功/失敗のSlack通知
- 本番環境のエラーログ監視

## ユーザーへの対処方法

### デプロイ直後にユーザーが古いバージョンを見ている場合

**ユーザーに案内する手順**:

1. **ハードリロード（最優先）**:
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`

2. **キャッシュクリア**:
   - Chrome: 設定 → プライバシーとセキュリティ → 閲覧履歴データの削除
   - 「キャッシュされた画像とファイル」のみ選択

3. **シークレットモード/プライベートブラウジング**:
   - キャッシュの影響を受けない新しいセッション

4. **最終手段**:
   - 1時間待つ（cache-control: max-age=3600）

## 今回の対応

### 実施した対策

1. ✅ 空のコミットでデプロイを再トリガー
2. ⏳ firebase.jsonのキャッシュ設定最適化（次のステップ）
3. ⏳ GitHub Actionsワークフローの改善（次のステップ）

### 次のアクション

1. firebase.jsonにcache-control設定を追加
2. GitHub Actionsにデプロイ検証ステップを追加
3. デプロイ手順をCLAUDE.mdに追記

## 学んだ教訓

1. **キャッシュは思った以上に強力**: Firebase Hostingの多層キャッシュを理解する必要がある
2. **デプロイ成功 ≠ コード反映**: デプロイログが成功でも、実際の反映は別問題
3. **検証の自動化が必須**: 人間の目視確認だけでは不十分
4. **ドキュメント化の重要性**: トラブル時の対応手順を残すことで、次回同じ問題を防げる

---

**作成日**: 2025-10-27
**最終更新**: 2025-10-27
**関連Issue**: Phase 10.1 デプロイ問題
