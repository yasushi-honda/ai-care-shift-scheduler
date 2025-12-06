# デモユーザー作成ガイド

## Firebase Consoleでの手動セットアップ

デモログイン機能を有効にするには、Firebase Consoleで以下の設定を行ってください。

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
