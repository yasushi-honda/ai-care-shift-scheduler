<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

[![CI/CD Pipeline](https://github.com/yasushi-honda/ai-care-shift-scheduler/actions/workflows/ci.yml/badge.svg)](https://github.com/yasushi-honda/ai-care-shift-scheduler/actions/workflows/ci.yml)

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1qWiD3dUgCc2z3AMHsQoV99fd4cyOWf5o

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## CI/CD

このプロジェクトはGitHub Actionsを使用した自動CI/CDパイプラインを採用しています。

### 特徴

- ✅ **セキュア認証**: PAT不要、`GITHUB_TOKEN`による自動認証
- ✅ **自動ビルド**: mainブランチへのpush/PRで自動実行
- ✅ **TypeScript型チェック**: コード品質の自動検証
- ✅ **ビルド成果物**: distフォルダを7日間保存

### ワークフロー

1. **トリガー**: `main`または`develop`ブランチへのpush/PR
2. **ビルドとテスト**: 依存関係のインストール、型チェック、ビルド
3. **デプロイ準備**: mainブランチのみ、成果物の検証

### 手動実行

GitHub ActionsのUIから手動でワークフローを実行することもできます：
1. リポジトリの "Actions" タブを開く
2. "CI/CD Pipeline" を選択
3. "Run workflow" をクリック
