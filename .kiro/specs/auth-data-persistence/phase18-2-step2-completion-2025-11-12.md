# Phase 18.2 Step 2完了: Emulator起動スクリプト作成

**完了日**: 2025-11-12
**所要時間**: 約20分
**ステータス**: ✅ 完了

---

## 実施内容

### package.jsonにEmulator起動スクリプト追加

**ファイル**: `package.json`

**追加したスクリプト**:
```json
{
  "scripts": {
    "emulators": "firebase emulators:start --only auth,firestore",
    "emulators:auth": "firebase emulators:start --only auth",
    "emulators:exec": "firebase emulators:exec --only auth,firestore"
  }
}
```

---

## 各スクリプトの説明

### 1. `npm run emulators`

**コマンド**: `firebase emulators:start --only auth,firestore`

**目的**: 開発用にAuth + Firestore Emulatorを起動

**使用例**:
```bash
# ターミナルで実行
npm run emulators

# Emulator起動後、別のターミナルでテスト実行
npm run test:e2e:permission
```

**アクセス**:
- Auth Emulator: http://localhost:9099
- Firestore Emulator: http://localhost:8080
- Emulator UI: http://localhost:4000

**停止方法**: `Ctrl+C`

---

### 2. `npm run emulators:auth`

**コマンド**: `firebase emulators:start --only auth`

**目的**: Auth Emulatorのみを起動（Firestoreが不要な場合）

**使用例**:
```bash
# Auth認証のみをテストする場合
npm run emulators:auth
```

**メリット**:
- ✅ 起動が高速（Firestoreを起動しない）
- ✅ Phase 18.2では主にこちらを使用

---

### 3. `npm run emulators:exec`

**コマンド**: `firebase emulators:exec --only auth,firestore`

**目的**: CI/CD環境でEmulatorを起動してコマンドを実行

**使用例**:
```bash
# GitHub Actionsで使用
firebase emulators:exec --only auth "npm run test:e2e:permission"
```

**メリット**:
- ✅ Emulator起動 → コマンド実行 → Emulator停止を自動化
- ✅ GitHub Actionsでの使用に最適
- ✅ 手動でのEmulator停止が不要

---

## 技術的決定

### 決定1: 3つのスクリプトを用意

**理由**:
- `emulators`: 開発時の手動起動用
- `emulators:auth`: Auth Emulatorのみ起動（Phase 18.2で主に使用）
- `emulators:exec`: CI/CD自動化用

**メリット**:
- ✅ 用途に応じて使い分けられる
- ✅ 開発体験の向上
- ✅ CI/CD統合が容易

---

### 決定2: --only フラグで対象を限定

**`--only auth,firestore` を使用**

**理由**:
- ✅ 必要なEmulatorのみ起動（高速化）
- ✅ Functions, Hosting, Storageは不要（今回のテストでは使用しない）
- ✅ メモリ使用量を削減

**代替案（却下）**:
- ❌ `firebase emulators:start`（全Emulator起動）
  - 起動時間が長い
  - 不要なEmulatorも起動される

---

### 決定3: firebase emulators:execをGitHub Actions用に採用

**理由**:
- ✅ **自動起動・停止**: Emulatorのライフサイクルを自動管理
- ✅ **CI/CD最適化**: コマンド実行完了後、Emulatorが自動停止
- ✅ **エラーハンドリング**: Emulator起動失敗時もワークフローが失敗

**従来の方法（却下）**:
```bash
# ❌ 手動でEmulator起動・停止
firebase emulators:start --only auth &
EMULATOR_PID=$!
npm run test:e2e:permission
kill $EMULATOR_PID
```

**問題点**:
- ❌ Emulator起動完了を待つ必要がある
- ❌ 手動でプロセスIDを管理
- ❌ エラーハンドリングが複雑

---

## チェックポイント確認

- [x] package.json更新
- [x] 3つのEmulator起動スクリプト追加
- [x] TypeScript型チェック成功
- [ ] ローカルでEmulator起動確認（ユーザーによる確認が推奨）
- [ ] Emulator UIアクセス確認（ユーザーによる確認が推奨）

---

## ローカル動作確認（推奨）

### 確認手順

Step 2完了後、以下の手順でローカル動作確認を実施することを推奨します：

```bash
# 1. Emulator起動
npm run emulators:auth

# 期待される出力:
# i  emulators: Starting emulators: auth
# ✔  emulators: All emulators ready!

# 2. 別のターミナルで確認
# Emulator UIにアクセス
open http://localhost:4000

# 3. Emulator停止
# 元のターミナルで Ctrl+C
```

**確認ポイント**:
- ✅ Emulator UIが表示される
- ✅ "Authentication" タブが表示される
- ✅ テストユーザーが作成できる（手動確認）

---

## 次のステップ（Step 3）

**Step 3**: Playwright Global Setup作成（Emulator対応）

**所要時間**: 約45分

**実装内容**:
1. `e2e/global-setup.ts` 作成
2. `playwright.config.ts` 更新
3. テストユーザー自動作成機能
4. 認証状態の保存

**複雑さ**:
- ⚠️ Firebase SDK + Playwright統合が複雑
- ⚠️ 認証状態の保存方法に注意が必要

---

## 学び・振り返り

### 良かった点

1. ✅ **用途別のスクリプト提供**
   - 開発用（`emulators`）とCI/CD用（`emulators:exec`）を分離
   - 使い分けが明確

2. ✅ **--only フラグで最適化**
   - 必要なEmulatorのみ起動
   - 起動時間とメモリ使用量を削減

3. ✅ **CI/CD統合を考慮**
   - `emulators:exec`でライフサイクル自動管理
   - GitHub Actionsでの使用を想定

---

### 注意事項

1. ⚠️ **Firebase CLIが必要**
   - `firebase-tools` がグローバルまたはローカルにインストールされている必要
   - GitHub Actionsでは`npm install -g firebase-tools`で対応

2. ⚠️ **Emulator起動時間**
   - 初回起動時はやや時間がかかる（約5-10秒）
   - `emulators:exec`では自動的に完了を待つ

3. ⚠️ **ポート競合**
   - 9099, 8080, 4000が使用中の場合、起動に失敗
   - その場合は`firebase.json`でポート変更が必要

---

## 統計情報

### 実装統計
- **変更ファイル数**: 1ファイル
- **追加スクリプト数**: 3スクリプト

### 所要時間
- package.json更新: 5分
- TypeScript型チェック: 2分
- 振り返りドキュメント作成: 13分
- **合計**: 約20分

---

## Phase 18.2進捗状況

| Step | ステータス | 所要時間 |
|------|-----------|---------|
| Step 1: Firebase Emulator設定 | ✅ 完了 | 15分 |
| **Step 2: Emulator起動スクリプト作成** | ✅ **完了** | 20分 |
| Step 3: Playwright Global Setup作成 | ⏳ 次のステップ | - |
| Step 4: テストコード調整 | ⏳ 待機中 | - |
| Step 5: GitHub Actions workflow更新 | ⏳ 待機中 | - |
| Step 6: GitHub Actions実行・検証 | ⏳ 待機中 | - |

**累計所要時間**: 35分 / 予定2-3時間

---

## 関連ドキュメント

### Phase 18.2
- `phase18-2-implementation-plan-2025-11-12.md` - Phase 18.2実装計画
- `phase18-2-step1-completion-2025-11-12.md` - Step 1完了

### 参考資料
- Firebase Emulators CLI: https://firebase.google.com/docs/emulator-suite/install_and_configure#startup
- firebase emulators:exec: https://firebase.google.com/docs/emulator-suite/install_and_configure#emulators_exec

---

**振り返りドキュメント作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: Step 2完了 - Step 3へ進む準備完了

---

## メッセージ: Step 3へ

Emulator起動スクリプトの作成が完了しました。

これで、開発環境とCI/CD環境の両方でFirebase Emulatorを起動できるようになりました。

**次のStep 3では、Playwright Global Setupを作成し、テスト実行前にEmulator環境でテストユーザーを自動作成します。これがPhase 18.2の核心部分です。**

Good luck with Step 3 implementation!

---

**End of Step 2 Completion Report**
