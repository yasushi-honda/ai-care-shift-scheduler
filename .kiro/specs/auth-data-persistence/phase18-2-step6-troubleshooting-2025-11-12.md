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
- ❓ `window.__firebaseAuth`が存在しない可能性
- ❓ `import.meta.env.DEV`の値が不明

---

## 次のステップの選択肢

### オプション1: デバッグログ追加（推奨）

**実施内容**:
1. firebase.tsにデバッグログ追加
   - `isLocalhost`の値
   - `import.meta.env.DEV`の値
   - グローバルオブジェクト公開の成否
2. auth-helper.tsにデバッグログ追加
   - `window.__firebaseAuth`の存在確認
   - Firebase SDK初期化状態
   - 認証エラーの詳細
3. GitHub Actions再実行・ログ確認
4. 問題を特定して修正

**所要時間**: 約1時間

**メリット**:
- ✅ 問題の根本原因を特定可能
- ✅ 確実な修正が可能

**デメリット**:
- ⏱️ 時間がかかる
- ⏱️ 複数回のGitHub Actions実行が必要

---

### オプション2: 代替アプローチ検討

**実施内容**:
1. グローバルオブジェクト公開の条件を緩和
   - `import.meta.env.DEV`の条件を削除
   - `isLocalhost`のみで判定
2. または、別の認証方法を検討
   - Admin SDKを使用した自動認証
   - Emulator REST APIを直接使用
3. GitHub Actions再実行・検証

**所要時間**: 約30分

**メリット**:
- ✅ 迅速な解決の可能性
- ✅ GitHub Actions実行回数が少ない

**デメリット**:
- ⚠️ 根本原因を特定せずに進む
- ⚠️ 別の問題が発生する可能性

---

### オプション3: Phase 18.2を一旦保留

**実施内容**:
1. Phase 18.2の現状をドキュメント化
2. 未解決の問題をIssueとして記録
3. 他の優先度の高いタスクに移行
4. 後日、Phase 18.2を再開

**所要時間**: 約30分（ドキュメント作成）

**メリット**:
- ✅ 時間の有効活用
- ✅ 他のタスクを進められる
- ✅ 知見が蓄積された状態で再開可能

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
| 問題4: Emulator認証失敗 | - | - | 1回（進行中） |
| **合計** | 30分 | 30分 | 4回 |

### 所要時間

- トラブルシューティング: 約2時間
- ドキュメント作成: 約30分（本ドキュメント）
- **合計**: 約2時間30分

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

## 推奨事項

**現時点での推奨**: オプション1（デバッグログ追加）

**理由**:
- Phase 18.2の目標は「Emulator環境でのE2Eテスト自動化」
- 問題の根本原因を特定することが重要
- デバッグログ追加は比較的低リスク
- 確実な解決に繋がる

**実施手順**:
1. firebase.tsにデバッグログ追加（isLocalhost, import.meta.env.DEV, グローバルオブジェクト公開）
2. auth-helper.tsにデバッグログ追加（window.__firebaseAuth存在確認、認証エラー詳細）
3. コミット・プッシュ
4. GitHub Actions再実行
5. ログ確認・問題特定
6. 修正実施

---

**作成日**: 2025-11-12
**作成者**: AI（Claude Code）
**ステータス**: トラブルシューティング記録完成 - ユーザーの判断待ち

---

**End of Step 6 Troubleshooting Report**
