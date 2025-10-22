# Development Workflow - 開発ワークフロー

## 標準開発フロー

このプロジェクトでは、コード品質とセキュリティを保証するために、以下のワークフローを遵守します。

### 1. ローカル開発

```bash
# ブランチを作成（オプション）
git checkout -b feature/new-feature

# コードを書く
# ...

# 変更をステージング
git add .
```

### 2. ローカルコミット

```bash
# コミットメッセージは規約に従う
git commit -m "feat: 新機能の説明"
```

**コミットメッセージ規約**:
```text
<type>: <subject>

type: feat, fix, docs, style, refactor, test, chore
```

### 3. CodeRabbit CLIローカルレビュー（必須）

```bash
# Plain textモードでレビュー
coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md
```

**レビュー項目**:
- セキュリティ脆弱性
- コード品質
- ベストプラクティス違反
- パフォーマンス問題

### 4. レビュー結果の対応

#### 問題がない場合
→ Step 5へ進む

#### 問題がある場合
```bash
# 指摘事項を修正
# ...

# 修正をステージング
git add .

# オプションA: コミットを修正（推奨）
git commit --amend --no-edit

# オプションB: 新しいコミット
git commit -m "fix: CodeRabbitの指摘を修正"

# 再レビュー
coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md
```

### 問題が解決するまで繰り返す

### 5. リモートリポジトリにPush

```bash
# mainブランチの場合
git push origin main

# フィーチャーブランチの場合
git push origin feature/new-feature
```

### 6. GitHub Actions CI/CD監視

```bash
# リアルタイムで監視
gh run watch --exit-status

# または最新のrunをチェック
gh run list --limit 1
```

**CI/CDチェック内容**:
- 依存関係のインストール
- TypeScript型チェック
- テスト実行
- プロダクションビルド
- 成果物のアップロード

### 7. CI/CDエラー対応

#### 成功した場合
✅ 完了！

#### エラーがある場合
```bash
# エラーログを確認
gh run view

# 問題を修正
# ...

# 修正をコミット
git add .
git commit -m "fix: CI/CDエラーを修正"

# 再度push
git push origin main

# 再度監視
gh run watch --exit-status
```

### 成功するまで Step 7 を繰り返す

---

## フローチャート

```text
┌─────────────────┐
│  ローカル開発    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  git commit     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ CodeRabbit CLIレビュー   │
└────────┬────────────────┘
         │
    ┌────▼────┐
    │ 問題？   │
    └─┬────┬──┘
      │YES │NO
      │    │
      │    ▼
      │ ┌──────────┐
      │ │git push  │
      │ └────┬─────┘
      │      │
      │      ▼
      │ ┌─────────────────┐
      │ │GitHub Actions   │
      │ │CI/CD実行        │
      │ └────┬────────────┘
      │      │
      │ ┌────▼────┐
      │ │ 成功？   │
      │ └─┬────┬──┘
      │   │NO  │YES
      │   │    │
      │   │    ▼
      │   │ ┌──────┐
      │   │ │ 完了 │
      │   │ └──────┘
      │   │
      │   └──┐
      │      │
      ▼      ▼
   ┌───────────┐
   │ 問題を修正 │
   └─────┬─────┘
         │
         └──→ 再コミット（Step 2へ）
```

---

## ベストプラクティス

### DO（推奨）
✅ **常にCodeRabbitレビューを受ける**: push前の必須ステップ
✅ **小さなコミットを心がける**: レビューしやすく、問題特定が容易
✅ **CI/CDの結果を確認する**: pushしたら必ず監視
✅ **問題はすぐに修正する**: 後回しにしない
✅ **コミットメッセージを丁寧に書く**: 将来の自分やチームのため

### DON'T（避けるべき）
❌ **レビューをスキップしない**: セキュリティリスクを見逃す
❌ **大きすぎるコミットを作らない**: レビューが困難
❌ **CI/CDエラーを放置しない**: 次のpushで問題が増える
❌ **mainブランチに直接push（大規模変更）**: PRを作成すべき
❌ **--no-verify を使わない**: フックをバイパスしない

---

## ツールのセットアップ

### CodeRabbit CLI

**インストール確認**:
```bash
coderabbit --version
```

**認証**:
```bash
coderabbit auth login
```

**設定ファイル**: `CLAUDE.md`（プロジェクトルート）

### GitHub CLI

**インストール確認**:
```bash
gh --version
```

**認証**:
```bash
gh auth login
```

**よく使うコマンド**:
```bash
# Runの監視
gh run watch --exit-status

# Run一覧
gh run list --limit 5

# Run詳細
gh run view <RUN_ID>

# PRの作成
gh pr create --title "feat: 新機能" --body "説明"

# PRのマージ
gh pr merge --squash
```

---

## トラブルシューティング

### CodeRabbit CLIがエラー

#### "No files found for review"
```bash
# ベースコミットを明示的に指定
coderabbit review --plain --base-commit HEAD~1
```

#### "Raw mode is not supported"
```bash
# Plain textモードを使用
coderabbit review --plain
```

### GitHub Actions がタイムアウト

```bash
# タイムアウト設定を確認
cat .github/workflows/ci.yml

# jobs.<job_id>.timeout-minutes を調整
```

### Git Pushが拒否される

```bash
# リモートの変更を取得
git pull --rebase origin main

# コンフリクトがあれば解決
git add .
git rebase --continue

# 再度push
git push origin main
```

---

## CI/CD設定

### GitHub Actions ワークフロー

**ファイル**: `.github/workflows/ci.yml`

**トリガー**:
- `push` to `main` or `develop`
- `pull_request` to `main` or `develop`

**ジョブ**:
1. **ビルドとテスト**
   - Node.js 20セットアップ
   - 依存関係インストール
   - TypeScript型チェック
   - テスト実行
   - プロダクションビルド
   - 成果物アップロード

2. **デプロイ準備**
   - 成果物ダウンロード
   - デプロイ準備完了

### 成果物の保存期間

**設定**: 7日間

**理由**: デバッグやロールバックのため

---

## セキュリティチェックリスト

コミット前に以下を確認：

- [ ] APIキーや秘密情報をコミットしていない
- [ ] `.env.local` は `.gitignore` に含まれている
- [ ] Firestore/Storage Rulesは適切（開発モードの場合は明記）
- [ ] 依存関係の脆弱性スキャン完了
- [ ] TypeScript型エラーがない
- [ ] テストが通る

---

## 例: 実際の作業フロー

### シナリオ: 新機能の追加

```bash
# 1. ブランチ作成
git checkout -b feature/staff-export

# 2. 開発
# ... コードを書く

# 3. コミット
git add services/exportService.ts components/ExportButton.tsx
git commit -m "feat: スタッフ情報のエクスポート機能を追加"

# 4. CodeRabbitレビュー
coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md

# 5. レビュー結果の確認
# → セキュリティ問題が発見された

# 6. 修正
# ... コードを修正

# 7. 修正をコミット
git add services/exportService.ts
git commit --amend --no-edit

# 8. 再レビュー
coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md
# → 問題なし

# 9. Push
git push origin feature/staff-export

# 10. CI/CD監視
gh run watch --exit-status
# → 成功

# 11. PRを作成（オプション）
gh pr create \
  --title "feat: スタッフ情報のエクスポート機能" \
  --body "CSVとExcel形式でエクスポート可能にしました"

# 12. マージ
gh pr merge --squash
```

---

## まとめ

このワークフローを遵守することで：

✅ **コード品質の保証**: CodeRabbitによる自動レビュー
✅ **セキュリティの担保**: 脆弱性の早期発見
✅ **CI/CDの安定性**: エラーの早期検出
✅ **チーム開発の円滑化**: 一貫したプロセス
✅ **デプロイの安全性**: 本番環境への影響最小化

**次のコミットから、このワークフローを必ず適用してください。**
