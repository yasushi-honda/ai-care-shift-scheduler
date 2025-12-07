# デモユーザー作成ガイド

## 前提条件

デモログイン機能はCloud Functionでカスタムトークンを発行する方式を採用しています。
この方式を動作させるには、**IAM権限の設定が必須**です。

---

## Step 0: IAM権限の設定（必須）

Cloud Functionsがカスタムトークンを発行するには、サービスアカウントに
`Service Account Token Creator` ロールが必要です。

### GCP Consoleで設定する場合

1. [GCP Console IAM](https://console.cloud.google.com/iam-admin/iam?project=ai-care-shift-scheduler) にアクセス
2. サービスアカウント `ai-care-shift-scheduler@appspot.gserviceaccount.com` を探す
3. 鉛筆アイコン（編集）をクリック
4. 「別のロールを追加」をクリック
5. **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`) を選択
6. 「保存」をクリック

### gcloud CLIで設定する場合

```bash
gcloud projects add-iam-policy-binding ai-care-shift-scheduler \
  --member="serviceAccount:ai-care-shift-scheduler@appspot.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

### 確認方法

```bash
gcloud projects get-iam-policy ai-care-shift-scheduler \
  --flatten="bindings[].members" \
  --filter="bindings.members:ai-care-shift-scheduler@appspot.gserviceaccount.com" \
  --format="table(bindings.role)"
```

出力に `roles/iam.serviceAccountTokenCreator` が含まれていればOK。

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
