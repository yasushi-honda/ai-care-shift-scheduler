# Phase 18.2 Step 6トラブルシューティング記録

**作成日**: 2025-11-12
**ステータス**: ⏳ 未完了（トラブルシューティング中）
**所要時間**: 約2時間（継続中）

---

## 概要

Phase 18.2 Step 6「GitHub Actions実行・検証」において、Emulator環境でのE2Eテスト実行を試みましたが、複数の技術的問題に遭遇しました。本ドキュメントでは、発生した問題、実施したトラブルシューティング、および現在の状況を記録します。

---

## 実施したトラブルシューティング

### 問題1: Playwright webServerタイムアウト（第1回目）

**発生時刻**: Run ID 19314450467

**エラー内容**:
```
Error: Timed out waiting 120000ms from config.webServer.
```

**原因**:
- GitHub Actions workflow内で`PLAYWRIGHT_BASE_URL=http://localhost:5173`を設定
- playwright.config.tsが`PLAYWRIGHT_BASE_URL`にlocalhostが含まれている場合、webServerを起動しようとした
- firebase emulators:exec内でwebServerが正しく起動できず、タイムアウト

**対策**:
- playwright.config.tsを修正: `PLAYWRIGHT_BASE_URL`が設定されている場合はwebServerをスキップ
- GitHub Actions workflowから`PLAYWRIGHT_BASE_URL`を削除

**コミット**: `09b9932` - "fix(ci): webServer設定修正 - PLAYWRIGHT_BASE_URL設定時はwebServerスキップ"

**結果**: ❌ 失敗（問題が継続）

---

### 問題2: Playwright webServerタイムアウト（第2回目）

**発生時刻**: Run ID 19314544242

**エラー内容**:
```
Error: Timed out waiting 120000ms from config.webServer.
```

**原因**:
- `PLAYWRIGHT_BASE_URL`を削除したため、playwright.config.tsがwebServerを起動しようとした
- firebase emulators:exec内では開発サーバーが起動していないため、webServerが起動できずタイムアウト

**対策**:
- GitHub Actions workflowを修正:
  - `firebase emulators:exec`の前に`npm run dev &`で開発サーバーをバックグラウンドで起動
  - `npx wait-on http://localhost:5173`で開発サーバーの起動を待機
  - `PLAYWRIGHT_BASE_URL=http://localhost:5173`を再設定してwebServerをスキップ

**コミット**: `ab64f48` - "fix(ci): 開発サーバーを手動起動してwebServerタイムアウト問題を解決"

**結果**: ✅ 部分的に成功（開発サーバー起動成功、新しい問題発生）

---

### 問題3: Viteポート不一致

**発生時刻**: Run ID 19314674682

**エラー内容**:
```
Error: Timed out waiting for: http://localhost:5173
```

**原因**:
- vite.config.tsでポート3000が設定されていた
- GitHub Actions workflow、Playwright設定、Emulator環境ではポート5173を期待
- wait-onがポート5173を待機していたが、開発サーバーはポート3000で起動

**対策**:
- vite.config.tsのポートを3000から5173に変更

**コミット**: `4cbb0b5` - "fix(config): Viteポートを3000から5173に変更してEmulator環境と統一"

**結果**: ✅ 開発サーバー起動成功、新しい問題発生

---

### 問題4: Emulator認証失敗（現在の問題）

**発生時刻**: Run ID 19314772260

**エラー内容**:
```
Error: Emulator認証に失敗しました: test@example.com
```

**詳細**:
- 6つのテストのうち5つが失敗（1つのみ成功）
- 成功したテスト: コンソールログ収集テスト（認証不要）
- 失敗したテスト: すべて認証が必要なテスト

**原因分析**:

#### 原因候補1: グローバルオブジェクト未公開

**firebase.ts (52-67行目)**:
```typescript
if (isLocalhost && import.meta.env.DEV) {
  // Auth Emulator接続
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);

  // グローバルオブジェクト公開
  if (typeof window !== 'undefined') {
    (window as any).__firebaseAuth = auth;
    (window as any).__firebaseDb = db;
  }
}
```

**問題点**:
- ✅ `isLocalhost`: trueのはず（localhost環境）
- ❓ `import.meta.env.DEV`: CI環境での値が不明

**Viteの`import.meta.env.DEV`**:
- 開発サーバー（`npm run dev`）: `true`
- プロダクションビルド（`npm run build` + `npm run preview`）: `false`

**GitHub Actions環境**:
- `npm run dev`を使用しているため、`import.meta.env.DEV`は`true`のはず
- しかし、CI環境での実際の値を確認していない

#### 原因候補2: Firebase SDK初期化タイミング

**auth-helper.ts (71行目)**:
```typescript
await page.waitForTimeout(1000);
```

**問題点**:
- Firebase SDKの初期化完了を1秒で想定
- CI環境ではネットワーク遅延などで初期化に時間がかかる可能性

#### 原因候補3: 動的インポートの失敗

**auth-helper.ts (87行目)**:
```typescript
const authModule = await import('firebase/auth');
```

**問題点**:
- Vite開発サーバーがnode_modulesをESMとして提供しない可能性
- CI環境での動作が未検証

---

### 問題5: import.meta.env.DEV削除後も認証失敗（最新の問題）

**発生時刻**: Run ID 19315041811

**エラー内容**:
```
Error: Emulator認証に失敗しました: test@example.com
```

**対策実施**:
1. firebase.tsの`import.meta.env.DEV`条件を削除
   ```typescript
   // 変更前
   if (isLocalhost && import.meta.env.DEV) {

   // 変更後
   if (isLocalhost) {  // CI環境対応
   ```

2. デバッグログ追加
   - firebase.ts: 環境変数、グローバルオブジェクト公開状態
   - auth-helper.ts: 認証フロー詳細

3. コミット: `3f4b753` - "fix(phase18-2): CI環境対応 - Emulator接続条件からimport.meta.env.DEV削除"

**結果**: ❌ 失敗（5/6テスト失敗、同じエラー）

**観察事項**:
- デバッグログが出力されていない（ブラウザコンソールログがキャプチャされていない）
- 認証エラーメッセージは同じ
- 開発サーバー、Emulator起動は成功している

**可能な原因**:
1. **ビルドキャッシュ問題**: firebase.tsの変更が反映されていない可能性
2. **ブラウザコンソールログ未キャプチャ**: デバッグログが確認できず、問題特定が困難
3. **動的インポート失敗**: page.evaluate()内での`import('firebase/auth')`が失敗している可能性
4. **Firebase SDK初期化遅延**: 1秒の待機では不十分な可能性

---

## 現在の状況

### 成功した部分（Step 1-5）

- ✅ **Step 1**: Firebase Emulator設定完了
- ✅ **Step 2**: Emulator起動スクリプト作成完了
- ✅ **Step 3**: Playwright Global Setup作成完了
- ✅ **Step 4**: テストコード調整（Emulator対応）完了
- ✅ **Step 5**: GitHub Actions workflow更新完了

### Step 6で成功した部分

- ✅ 開発サーバー起動成功（ポート5173）
- ✅ 開発サーバー起動待機成功（wait-on）
- ✅ Firebase Emulator起動成功（auth, firestore）
- ✅ Playwrightテスト実行開始成功
- ✅ 1つのテスト成功（コンソールログ収集テスト）

### Step 6で未解決の問題

- ❌ Emulator認証失敗（5/6テスト失敗）
- ❌ `import.meta.env.DEV`削除でも改善せず
- ❌ デバッグログがキャプチャされず、問題特定困難

---

## 次のステップの選択肢（更新版 - 問題5発生後）

### オプション1: ブラウザコンソールログキャプチャを追加（推奨）

**実施内容**:
1. e2e/permission-errors.spec.tsにpage.on('console')イベントリスナー追加
   - すべてのブラウザコンソールログをキャプチャ
   - firebase.ts、auth-helper.tsのデバッグログを確認可能に
2. GitHub Actions再実行・ログ確認
3. デバッグログから問題を特定
4. 修正実施

**所要時間**: 約30分（実装） + 約15分（GitHub Actions実行・確認）

**メリット**:
- ✅ firebase.tsのデバッグログが確認可能
- ✅ window.__firebaseAuthの状態を直接確認可能
- ✅ 問題の根本原因を特定可能

**デメリット**:
- ⏱️ 追加のコード変更が必要

---

### オプション2: ローカルEmulator環境でテスト実行（デバッグ効率的）

**実施内容**:
1. ローカルでFirebase Emulator起動
   ```bash
   firebase emulators:start --only auth,firestore
   ```
2. 別ターミナルで開発サーバー起動
   ```bash
   npm run dev
   ```
3. Playwrightテスト実行
   ```bash
   PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run test:e2e:permission
   ```
4. ブラウザコンソールログをリアルタイム確認
5. 問題を特定・修正後、GitHub Actionsで検証

**所要時間**: 約30分（セットアップ + デバッグ） + 約15分（修正 + GitHub Actions確認）

**メリット**:
- ✅ リアルタイムでデバッグ可能
- ✅ ブラウザDevToolsで詳細確認可能
- ✅ 迅速なイテレーション

**デメリット**:
- ⏱️ ローカル環境のセットアップが必要
- ⚠️ ローカルとCI環境の差異がある可能性

---

### オプション3: 代替認証方式の検討（根本的アプローチ変更）

**実施内容**:
1. window.__firebaseAuthを使わない認証方式を検討
   - 選択肢A: Playwright test fixtureでfirebase/authを直接インポート
   - 選択肢B: Auth Emulator REST APIを直接使用してトークン取得
   - 選択肢C: カスタムトークンを使用した認証
2. 新しいアプローチを実装
3. テスト実行・検証

**所要時間**: 約1-2時間（設計 + 実装 + テスト）

**メリット**:
- ✅ window.__firebaseAuth依存を排除
- ✅ よりシンプルなアーキテクチャ
- ✅ CI環境での安定性向上

**デメリット**:
- ⏱️ 大きな設計変更
- ⚠️ 既存のauth-helper.tsを大幅に書き換え

---

### オプション4: Phase 18.2を一旦保留（時間効率重視）

**実施内容**:
1. Phase 18.2の現状をドキュメント化（本ドキュメント）
2. 未解決の問題をIssueとして記録
3. 他の優先度の高いタスクに移行
4. 後日、Phase 18.2を再開（オプション1またはオプション2で対応）

**所要時間**: 約15分（まとめ作業のみ）

**メリット**:
- ✅ 時間の有効活用
- ✅ 他のタスクを進められる
- ✅ 知見が蓄積された状態で再開可能
- ✅ トラブルシューティング記録が完備

**デメリット**:
- ⚠️ Phase 18.2の目標未達成
- ⚠️ Emulator環境でのテスト自動化が未完成

---

## 学び・振り返り

### 良い判断だった点

1. ✅ **段階的なトラブルシューティング**
   - 各問題を一つずつ解決
   - コミット単位で変更を記録
   - ドキュメントドリブンで進行

2. ✅ **問題の記録**
   - 各エラーメッセージを記録
   - 原因分析を実施
   - 対策を明確化

3. ✅ **複数の解決策を検討**
   - webServerタイムアウト問題で複数のアプローチを試行
   - 問題の根本原因を追求

---

### 改善できた点

1. **事前のローカル検証不足**
   - GitHub Actions環境で初めてテスト実行
   - ローカルでEmulatorテスト実行を先に行うべきだった（Step 4d）

2. **環境変数の事前確認不足**
   - `import.meta.env.DEV`の値をCI環境で確認していなかった
   - Viteの動作をCI環境で事前検証していなかった

3. **デバッグログの不足**
   - firebase.tsやauth-helper.tsにデバッグログが不足
   - 問題発生時の状態把握が困難

---

## 統計情報

### トラブルシューティング統計

| 問題 | 原因特定時間 | 修正時間 | GitHub Actions実行回数 |
|------|------------|---------|---------------------|
| 問題1: webServerタイムアウト（第1回） | 10分 | 10分 | 1回 |
| 問題2: webServerタイムアウト（第2回） | 15分 | 15分 | 1回 |
| 問題3: Viteポート不一致 | 5分 | 5分 | 1回 |
| 問題4: Emulator認証失敗（原因分析） | 30分 | - | 1回 |
| 問題5: import.meta.env.DEV削除でも失敗 | 15分 | 10分 | 1回 |
| **合計** | 75分（1時間15分） | 40分 | 5回 |

### 所要時間

- トラブルシューティング: 約3時間15分
- ドキュメント作成: 約45分（本ドキュメント初版 + 更新）
- **合計**: 約4時間

---

## 関連ドキュメント

### Phase 18.2

- `phase18-2-implementation-plan-2025-11-12.md` - Phase 18.2実装計画
- `phase18-2-step1-completion-2025-11-12.md` - Step 1完了
- `phase18-2-step2-completion-2025-11-12.md` - Step 2完了
- `phase18-2-step3-completion-2025-11-12.md` - Step 3完了
- `phase18-2-step4-summary-2025-11-12.md` - Step 4総括
- `phase18-2-step5-completion-2025-11-12.md` - Step 5完了
- `phase18-2-step6-troubleshooting-2025-11-12.md` - Step 6トラブルシューティング（本ドキュメント）

### 参考資料

- Vite Environment Variables: https://vite.dev/guide/env-and-mode.html
- Firebase Emulator Suite: https://firebase.google.com/docs/emulator-suite
- Playwright Configuration: https://playwright.dev/docs/test-configuration

---

## 推奨事項（更新版 - 問題5発生後）

**現時点での推奨**: オプション2（ローカルEmulator環境でテスト実行）

**理由**:
1. **デバッグ効率が最も高い**
   - ブラウザDevToolsでリアルタイム確認可能
   - console.logが即座に確認できる
   - 迅速なイテレーション

2. **問題5の状況を考慮**
   - GitHub Actions上でのデバッグは時間がかかる（既に5回実行）
   - デバッグログがキャプチャされず、問題特定が困難
   - ローカルなら問題を直接観察可能

3. **コスト対効果**
   - セットアップ時間: 約10分
   - デバッグ効率: GitHub Actionsの5-10倍
   - 総所要時間: 30-45分で解決可能

**実施手順**:
1. ローカルでFirebase Emulator起動
   ```bash
   firebase emulators:start --only auth,firestore
   ```
2. 別ターミナルで開発サーバー起動（ポート5173）
   ```bash
   npm run dev
   ```
3. Playwrightテスト実行
   ```bash
   PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run test:e2e:permission
   ```
4. ブラウザコンソールで以下を確認:
   - firebase.tsのデバッグログ（isLocalhost, import.meta.env.DEV）
   - window.__firebaseAuthの存在
   - 動的インポート（`import('firebase/auth')`）の成否
5. 問題を特定・修正
6. ローカルで再テスト・成功確認
7. コミット・プッシュ・GitHub Actions検証

**代替推奨**: オプション1（ブラウザコンソールログキャプチャ追加）
- ローカル環境が利用できない場合
- CI環境での動作を直接確認したい場合

---

**作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: トラブルシューティング記録完成 - ユーザーの判断待ち

---

**End of Step 6 Troubleshooting Report**
