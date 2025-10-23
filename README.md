# AIシフト自動作成

[![CI/CD Pipeline](https://github.com/yasushi-honda/ai-care-shift-scheduler/actions/workflows/ci.yml/badge.svg)](https://github.com/yasushi-honda/ai-care-shift-scheduler/actions/workflows/ci.yml)
[![Firebase Hosting](https://img.shields.io/badge/Firebase-Hosting-orange)](https://ai-care-shift-scheduler.web.app)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

介護・福祉事業所向けのAIシフト自動作成システム

## 🌟 概要

**AIシフト自動作成**は、介護・福祉事業所のシフト作成業務を劇的に効率化するWebアプリケーションです。Google の最新AI「Gemini 2.5 Flash-Lite」を活用し、スタッフの資格・希望・労働基準法を考慮した最適なシフトを自動生成します。

### 主な機能

- ✅ **スタッフ情報管理**: 名前、役職、資格、勤務可否を一元管理
- ✅ **シフト要件設定**: 時間帯別必要人員と資格要件を設定
- ✅ **休暇申請管理**: スタッフの勤務不可日を簡単登録
- ✅ **AIシフト自動生成**: Gemini AIによる最適化（Cloud Functions実装後）
- ✅ **デモシフト生成**: ランダムシフトでUIを体験
- ✅ **カレンダー表示**: 直感的なシフト確認
- ✅ **CSV エクスポート**: 既存システムへの連携

## 🚀 デモ

**本番環境**: https://ai-care-shift-scheduler.web.app

> ⚠️ **注意**: 現在は認証機能がないため、誰でもアクセス可能です。本番データは入力しないでください。

## 📚 ドキュメント

プロジェクトの詳細ドキュメントは以下を参照してください：

- **[📖 ドキュメントナビゲーション](.kiro/NAVIGATION.md)** - 全ドキュメントへの索引
- **[🎯 AI統合テスト完了レポート](.kiro/specs/ai-shift-integration-test/IMPLEMENTATION_COMPLETE.md)** - テスト結果・実装詳細
- **[🏗️ 技術スタック](.kiro/steering/tech.md)** - アーキテクチャ・技術決定
- **[📋 プロダクト仕様](.kiro/steering/product.md)** - ビジネス要件

### クイックリンク

| 目的 | ドキュメント |
|-----|------------|
| 新規開発者オンボーディング | [NAVIGATION.md - オンボーディング](.kiro/NAVIGATION.md#-新規開発者向けオンボーディング) |
| テスト実行方法 | [README.md - テスト](#-テスト) |
| トラブルシューティング | [README.md - トラブルシューティング](#トラブルシューティング) |

## 📋 必要要件

- **Node.js**: 20.x LTS
- **npm**: 10.x
- **Firebase CLI**: 13.x（デプロイ時）
- **gcloud CLI**: 最新版（GCP操作時）

## 🛠️ セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/yasushi-honda/ai-care-shift-scheduler.git
cd ai-care-shift-scheduler
```

### 2. 依存関係のインストール

```bash
# ルートディレクトリ
npm install

# Cloud Functions（デプロイ時）
cd functions
npm install
cd ..
```

### 3. 環境変数の設定

`.env.local` ファイルを作成し、Firebase設定を追加：

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id

# GCP Configuration
VITE_GCP_PROJECT_ID=your-project-id
VITE_GCP_PROJECT_NUMBER=your-project-number
```

> 📝 **Note**: Firebase Console で Web App を作成し、設定を取得してください。

### 4. ローカル開発サーバー起動

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開く

### 5. ビルド

```bash
npm run build
```

成果物は `dist/` ディレクトリに生成されます。

## 🌐 デプロイ

### Firebase Hosting へのデプロイ

```bash
# ビルド
npm run build

# デプロイ
firebase deploy --only hosting
```

### Cloud Functions のデプロイ

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

## 📁 プロジェクト構造

```
ai-care-shift-scheduler/
├── .github/              # GitHub Actions CI/CD
├── .kiro/                # Spec-Driven Development
│   ├── steering/         # プロジェクト方針
│   │   ├── product.md
│   │   ├── tech.md
│   │   ├── architecture.md
│   │   ├── structure.md
│   │   └── implementation-log.md
│   └── specs/            # 機能仕様（将来使用）
├── components/           # Reactコンポーネント
├── services/             # ビジネスロジック
├── functions/            # Cloud Functions
├── public/               # 静的ファイル
├── App.tsx               # ルートコンポーネント
├── types.ts              # TypeScript型定義
├── firebase.json         # Firebase設定
└── README.md             # 本ファイル
```

詳細は [.kiro/steering/structure.md](.kiro/steering/structure.md) を参照してください。

## 🏗️ アーキテクチャ

```
┌─────────────┐
│   Users     │
└──────┬──────┘
       │ HTTPS
       ▼
┌──────────────────────────────┐
│  Firebase Hosting (CDN)      │
│  React + TypeScript          │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Cloud Functions (us-central1)       │
│  - generateShift                     │
│    (Gemini 2.5 Flash-Lite)           │
└───┬──────────────────────┬───────────┘
    │                      │
    ▼                      ▼
┌──────────────────────┐   ┌──────────┐
│  Firestore           │   │Vertex AI │
│  (asia-northeast1)   │   │ Gemini   │
└──────────────────────┘   └──────────┘
```

詳細は [.kiro/steering/architecture.md](.kiro/steering/architecture.md) を参照してください。

## 🔧 技術スタック

### フロントエンド
- **React** 19.x - UIライブラリ
- **TypeScript** 5.8.x - 型安全な開発
- **Vite** 6.x - 高速ビルドツール
- **Tailwind CSS** 3.x - ユーティリティファーストCSS

### バックエンド
- **Cloud Functions** (Gen 2) - サーバーレスAPI
- **Vertex AI** - Gemini 2.5 Flash-Lite（最新版）
- **Firestore** - NoSQLデータベース
- **Cloud Storage** - ファイルストレージ

### インフラ
- **Firebase Hosting** - 静的サイトホスティング
- **GCP** - Google Cloud Platform
- **GitHub Actions** - CI/CDパイプライン

詳細は [.kiro/steering/tech.md](.kiro/steering/tech.md) を参照してください。

## 📖 ドキュメント

### Steering（プロジェクト方針）
- [product.md](.kiro/steering/product.md) - プロダクトコンテキストとビジネス目標
- [tech.md](.kiro/steering/tech.md) - 技術スタックと技術的決定
- [architecture.md](.kiro/steering/architecture.md) - システムアーキテクチャ
- [structure.md](.kiro/steering/structure.md) - ファイル構成とコードパターン
- [implementation-log.md](.kiro/steering/implementation-log.md) - 実装ログ

### その他
- [CLAUDE.md](CLAUDE.md) - Claude Code用プロジェクト説明

## 🚦 CI/CD

このプロジェクトはGitHub Actionsによる自動CI/CDパイプラインを採用しています。

### ワークフロー（概要）

以下は簡略化された概要です。詳細は [`.github/workflows/ci.yml`](.github/workflows/ci.yml) を参照してください。

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  build-and-test:
    # Node.js 20, npm ci
    - 依存関係のインストール
    - TypeScript型チェック（npx tsc --noEmit）
    - ビルド実行（npm run build）
    - 成果物のアップロード（7日間保存）

  deploy:
    # mainブランチへのpush時のみ実行
    - ビルド成果物をダウンロード
    - Firebase Hostingへ自動デプロイ（FirebaseExtended/action-hosting-deploy@v0）
    - 本番環境: https://ai-care-shift-scheduler.web.app
```

### 自動デプロイ

mainブランチへのpush時、GitHub Actionsが自動的にFirebase Hostingへデプロイします。

**必要な設定**:
- `FIREBASE_SERVICE_ACCOUNT` シークレットがGitHubリポジトリに設定済み
- Firebase Hosting設定が `firebase.json` で定義済み

**デプロイフロー**:
1. コード変更をcommit & push to main
2. GitHub Actionsがビルドとテストを実行
3. テスト成功後、自動的にFirebase Hostingへデプロイ
4. 本番環境が即座に更新される

### 手動実行

1. リポジトリの "Actions" タブを開く
2. "CI/CD Pipeline" を選択
3. "Run workflow" をクリック

### ローカルからのデプロイ

CI/CDを経由せず、ローカルから直接デプロイすることも可能です:

```bash
# ビルド
npm run build

# Firebase Hostingへデプロイ
firebase deploy --only hosting
```

## 🔐 セキュリティ

### 現状（MVP）
- ⚠️ **認証なし**: 誰でもアクセス可能
- ⚠️ **Firestore全開放**: セキュリティルールは開発モード
- ✅ **HTTPS通信**: すべての通信は暗号化
- ✅ **APIキー非公開**: Cloud Functions経由でVertex AIを呼び出し（実装後）

### Phase 2（予定）
- ✅ Firebase Authentication導入
- ✅ Firestore Security Rules強化
- ✅ 事業所ごとのデータ分離

## 🧪 テスト

本プロジェクトは包括的なテストスイートを備えています。

### 統合テスト（Jest）

Cloud Functions APIの動作を検証する統合テストです。

```bash
# functionsディレクトリに移動
cd functions

# 統合テスト実行（本番Cloud Functions APIを使用）
npm run test:integration

# 環境変数の設定（オプション）
export CLOUD_FUNCTION_URL=https://us-central1-ai-care-shift-scheduler.cloudfunctions.net/generateShift
export SKIP_AI_TESTS=false  # trueにするとAI呼び出しをモック化（CI/CD用）
```

**テストカバレッジ**:
- ✅ 基本的なシフト生成（5名スタッフ）
- ✅ Firestoreへのデータ保存検証
- ✅ 入力バリデーション（空配列、未定義フィールド、サイズ制限）
- ✅ キャッシュ機能（冪等性）検証
- ✅ パフォーマンステスト（5名/20名/50名スタッフ）

**実行結果**: 37/37 テスト成功（100%成功率）

### E2Eテスト（Playwright）

ブラウザ上でのユーザーシナリオを検証するE2Eテストです。

```bash
# ルートディレクトリで実行

# ローカル環境でE2Eテスト実行（開発サーバー起動）
npm run test

# 本番環境でAI生成E2Eテスト実行（実際のVertex AI呼び出しあり、課金注意）
PLAYWRIGHT_BASE_URL=https://ai-care-shift-scheduler.web.app npx playwright test e2e/ai-shift-generation.spec.ts

# UIモードで対話的にテスト実行
npm run test:ui
```

**テストカバレッジ**:
- ✅ デモシフト作成フロー
- ✅ AIシフト生成UIフロー（ローディング → 生成中メッセージ → シフト表示）
- ✅ エラーメッセージ表示
- ✅ CSVエクスポート

**CI/CD環境での動作**:
- AI生成テストは自動的にスキップされます（コスト削減のため）
- デモシフトテストのみ実行されます

### テストデータ

統合テストで使用する標準テストデータ:
- 5名の標準スタッフ
- 4つの時間帯（早番、日勤、遅番、夜勤）
- サンプル休暇申請データ
- パフォーマンステスト用: 20名、50名のスタッフリスト

### トラブルシューティング

#### 統合テストのエラー

**問題**: `CLOUD_FUNCTION_URL environment variable must be set`
```bash
# 解決策: Cloud Function URLを設定
export CLOUD_FUNCTION_URL=https://us-central1-ai-care-shift-scheduler.cloudfunctions.net/generateShift
```

**問題**: `Request failed with status code 401`
```bash
# 原因: GCP認証が必要な場合
gcloud auth application-default login
```

**問題**: キャッシュテストが失敗する
```bash
# 原因: Firestoreインデックスが未作成
cd functions
firebase deploy --only firestore:indexes
```

#### E2Eテストのエラー

**問題**: `Timed out waiting 120000ms from config.webServer`
```bash
# 原因: 開発サーバー起動に失敗
# 解決策1: ポート5173が使用されていないか確認
lsof -ti:5173 | xargs kill -9

# 解決策2: 本番環境でテスト実行
PLAYWRIGHT_BASE_URL=https://ai-care-shift-scheduler.web.app npm run test
```

**問題**: AI生成テストがタイムアウトする（90秒超過）
```bash
# 原因: Cloud Functionsのコールドスタート + 大規模シフト生成
# 解決策: テストを再実行（2回目以降はキャッシュで高速化）
```

#### Vertex AIエラー

**問題**: `Vertex AI API has not been enabled`
```bash
# 解決策: Vertex AI APIを有効化
gcloud services enable aiplatform.googleapis.com --project=ai-care-shift-scheduler
```

**問題**: `Model gemini-2.5-flash-lite not found`
```bash
# 原因: モデル名が間違っている、またはリージョンが間違っている
# 確認: functions/src/shift-generation.ts で以下を確認
# - モデル名: gemini-2.5-flash-lite（-latestなし、GA安定版）
# - リージョン: us-central1（このモデルが利用可能な唯一のリージョン）
```

**問題**: `Quota exceeded for quota metric 'aiplatform.googleapis.com/generate_content_requests'`
```bash
# 原因: Vertex AI APIのクォータ超過
# 解決策: GCP Consoleでクォータ増加をリクエスト
```

#### Firestoreエラー

**問題**: `Missing or insufficient permissions`
```bash
# 原因: Firestoreセキュリティルールが厳しすぎる（本番環境）
# 解決策: firebase.jsonで開発モードのルールを確認
# 注意: MVPでは認証なしのため、本番環境でも全開放状態
```

詳細なトラブルシューティングは [.kiro/specs/ai-shift-integration-test/tasks.md](.kiro/specs/ai-shift-integration-test/tasks.md) を参照してください。

## 🐛 既知の問題

1. **認証機能がない**
   - Phase 2で Firebase Authentication 導入予定

## 🗓️ ロードマップ

### Phase 1: MVP（完了） - 2025年Q4
- ✅ 基本的なシフト作成機能
- ✅ Firebase Hostingデプロイ
- ✅ Cloud Functions実装（Gemini 2.5 Flash-Lite）

### Phase 2: 認証とマルチテナント - 2026年Q1
- Firebase Authentication導入
- 事業所ごとのデータ分離
- 管理者権限管理

### Phase 3: 高度な最適化 - 2026年Q2
- 過去データからの学習
- スタッフ希望の自動考慮
- 公平性スコアの可視化

### Phase 4: エンタープライズ機能 - 2026年Q3-Q4
- 複数事業所一括管理
- モバイルアプリ（スタッフ用）
- 給与システム連携API

詳細は [.kiro/steering/product.md](.kiro/steering/product.md) を参照してください。

## 🤝 コントリビューション

コントリビューションを歓迎します！以下の手順でお願いします：

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'feat: Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

### コミットメッセージ規約

```
<type>: <subject>

type: feat, fix, docs, style, refactor, test, chore
```

例:
- `feat: スタッフ情報編集機能を追加`
- `fix: カレンダー表示のバグを修正`
- `docs: README.mdを更新`

## 📄 ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。

## 👨‍💻 開発者

**Yasushi Honda**
- Email: admin@fuku-no-tane.com
- GitHub: [@yasushi-honda](https://github.com/yasushi-honda)

## 🙏 謝辞

- **Google Cloud Platform** - インフラとAIサービス
- **Firebase** - ホスティングとバックエンドサービス
- **React** - UIライブラリ
- **Tailwind CSS** - スタイリング
- **Claude Code** - AI支援開発環境

---

**本番環境**: https://ai-care-shift-scheduler.web.app

**問い合わせ**: [Issues](https://github.com/yasushi-honda/ai-care-shift-scheduler/issues)
