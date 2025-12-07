# デモユーザー作成ガイド

## 前提条件

デモログイン機能はCloud Functionでカスタムトークンを発行する方式を採用しています。
この方式を動作させるには、**IAM権限の設定が必須**です。

---

## Step 0: IAM権限の設定（必須）

Cloud Functionsがカスタムトークン（`createCustomToken`）を発行するには、
**Cloud FunctionのサービスアカウントがApp Engineサービスアカウントに対して
トークン作成権限を持つ必要があります**。

### 背景知識

Firebase Admin SDKの`createCustomToken()`は内部的に以下を行います：
1. App Engineデフォルトサービスアカウント（`PROJECT_ID@appspot.gserviceaccount.com`）を使って署名
2. Cloud Functionのサービスアカウント（`PROJECT_NUMBER-compute@developer.gserviceaccount.com`）が署名リクエストを発行

そのため、**Cloud FunctionのSAがApp Engine SAに対してToken Creatorである必要がある**。

### gcloud CLIで設定する場合（推奨）

#### 1. gcloud認証（期限切れの場合）

```bash
gcloud auth login
```

ブラウザで認証画面が開きます。認証完了後、続行してください。

#### 2. Cloud Function実行サービスアカウントの確認

```bash
gcloud functions describe demoSignIn --region=asia-northeast1 \
  --project=ai-care-shift-scheduler \
  --format="value(serviceConfig.serviceAccountEmail)"
```

出力例: `737067812481-compute@developer.gserviceaccount.com`

#### 3. IAM権限の付与（重要：サービスアカウントレベル）

```bash
# Cloud Function SAがApp Engine SAに対してトークンを作成できるようにする
gcloud iam service-accounts add-iam-policy-binding \
  ai-care-shift-scheduler@appspot.gserviceaccount.com \
  --project=ai-care-shift-scheduler \
  --member="serviceAccount:737067812481-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

**注意**: プロジェクトレベルのIAM（`gcloud projects add-iam-policy-binding`）では
不十分です。サービスアカウントレベルでの権限付与が必要です。

### GCP Consoleで設定する場合

1. [GCP Console - サービスアカウント](https://console.cloud.google.com/iam-admin/serviceaccounts?project=ai-care-shift-scheduler) にアクセス
2. `ai-care-shift-scheduler@appspot.gserviceaccount.com` をクリック
3. **権限** タブを選択
4. **アクセスを許可** をクリック
5. **新しいプリンシパル**: `737067812481-compute@developer.gserviceaccount.com`
6. **ロール**: **Service Account Token Creator** を選択
7. **保存** をクリック

### 確認方法

```bash
gcloud iam service-accounts get-iam-policy \
  ai-care-shift-scheduler@appspot.gserviceaccount.com \
  --project=ai-care-shift-scheduler
```

出力に以下が含まれていればOK：
```yaml
bindings:
- members:
  - serviceAccount:737067812481-compute@developer.gserviceaccount.com
  role: roles/iam.serviceAccountTokenCreator
```

### IAM権限反映の注意

- IAM権限の反映には**最大7分**かかることがあります
- 設定直後にエラーが出ても、数分待ってから再試行してください

### トラブルシューティング

#### エラー: `Permission 'iam.serviceAccounts.signBlob' denied`

このエラーは以下を意味します：
1. IAM権限が不足している
2. IAM権限がまだ反映されていない（最大7分待つ）
3. 権限の付与先が間違っている（プロジェクトレベルではなくSAレベル）

#### 確認コマンド

```bash
# Cloud Functionのテスト
curl -s -X POST \
  'https://asia-northeast1-ai-care-shift-scheduler.cloudfunctions.net/demoSignIn' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://ai-care-shift-scheduler.web.app' \
  -d '{}'
```

成功時: `{"customToken":"eyJhbGciOiJSUz..."}`
失敗時: `{"error":"...", "debug":{...}}`

---

## Step 1以降: Firebase Consoleでの手動セットアップ

**注意**: Cloud Functionがデモユーザーを自動作成するため、以下の手順は
Cloud Functionが失敗した場合のフォールバック用です。

### 1. Firebase Authenticationでデモユーザーを作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト `ai-care-shift-scheduler` を選択
3. 左メニューから **Authentication** を選択
4. **Users** タブを選択
5. **Add user** ボタンをクリック
6. 以下の情報を入力:
   - **Email**: `demo@example.com`
   - **Password**: `demo-password-2024`
7. **Add user** をクリック
8. 作成されたユーザーの **UID** をコピー（例: `abc123xyz...`）

### 2. Firestoreでユーザードキュメントを作成

1. Firebase Console で **Firestore Database** を選択
2. **users** コレクションを選択（なければ作成）
3. **Add document** をクリック
4. **Document ID**: 上記でコピーしたUID
5. 以下のフィールドを追加:

```
userId (string): [コピーしたUID]
email (string): demo@example.com
displayName (string): デモユーザー
provider (string): password
facilities (array):
  - facilityId (string): demo-facility-001
    role (string): viewer
    grantedAt (timestamp): [現在時刻]
createdAt (timestamp): [現在時刻]
lastLoginAt (timestamp): [現在時刻]
```

### 3. 施設メンバーにデモユーザーを追加

1. Firestore で **facilities** > **demo-facility-001** を選択
2. **members** 配列に以下を追加:

```
{
  userId: [コピーしたUID],
  role: "viewer",
  grantedAt: [現在時刻]
}
```

### 4. 動作確認

1. https://ai-care-shift-scheduler.web.app にアクセス
2. ログインページで「デモアカウントでログイン」をクリック
3. サンプル介護施設のデータが表示されることを確認

## セキュリティ考慮事項

- デモユーザーは **viewer** 権限のみ（データ変更不可）
- 本番データへの影響なし
- パスワードは固定値だが、権限が制限されているため安全
