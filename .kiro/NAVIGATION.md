# 📚 プロジェクトドキュメントナビゲーション

このドキュメントは、AIシフト自動作成プロジェクトの全ドキュメントへの索引です。

## 🚀 クイックスタート

| 目的 | ドキュメント |
|-----|------------|
| プロジェクト概要を知りたい | [`README.md`](../README.md) |
| 開発環境を構築したい | [`README.md`](../README.md) - セットアップセクション |
| テストを実行したい | [`README.md`](../README.md) - テストセクション |
| デプロイしたい | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |

---

## 📋 プロジェクト管理（Steering）

プロジェクト全体の方針・技術スタック・構造に関するドキュメント

| ドキュメント | 内容 |
|------------|------|
| [`steering/product.md`](steering/product.md) | プロダクトビジョン、ビジネス要件 |
| [`steering/tech.md`](steering/tech.md) | 技術スタック、アーキテクチャ決定 |
| [`steering/structure.md`](steering/structure.md) | ファイル構造、コーディング規約 |

---

## 🎯 機能仕様（Specs）

個別機能の要件・設計・実装タスクに関するドキュメント

### ✅ AI Shift Integration Test（完了）

**目的**: AIシフト生成機能の動作を包括的にテスト

| ドキュメント | 内容 |
|------------|------|
| [`specs/ai-shift-integration-test/requirements.md`](specs/ai-shift-integration-test/requirements.md) | 9要件の詳細定義 |
| [`specs/ai-shift-integration-test/design.md`](specs/ai-shift-integration-test/design.md) | 技術設計、アーキテクチャ |
| [`specs/ai-shift-integration-test/tasks.md`](specs/ai-shift-integration-test/tasks.md) | 実装タスク（7/7完了） |
| [`specs/ai-shift-integration-test/IMPLEMENTATION_COMPLETE.md`](specs/ai-shift-integration-test/IMPLEMENTATION_COMPLETE.md) | **実装完了レポート** 📊 |
| [`specs/ai-shift-integration-test/spec.json`](specs/ai-shift-integration-test/spec.json) | メタデータ |

**ステータス**: ✅ 実装完了（2025-10-23）
**テスト結果**: 37/37統合テスト成功、100%成功率

---

## 🏗️ アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                    プロジェクト構成                       │
└─────────────────────────────────────────────────────────┘

Frontend (React + TypeScript)
  ├─ src/
  │   ├─ App.tsx              - メインアプリケーション
  │   ├─ components/          - UIコンポーネント
  │   └─ services/
  │       └─ geminiService.ts - Cloud Functions API呼び出し
  │
  └─ e2e/                     - Playwrightテスト（E2E）

Backend (Cloud Functions + Vertex AI)
  ├─ functions/src/
  │   ├─ index.ts             - エントリポイント
  │   ├─ shift-generation.ts  - AIシフト生成（メイン）
  │   ├─ phased-generation.ts - 段階的生成ロジック
  │   └─ types.ts             - 型定義
  │
  └─ functions/__tests__/     - Jest統合テスト（37テスト）

Infrastructure
  ├─ Firebase Hosting         - フロントエンドホスティング
  ├─ Cloud Functions Gen 2    - サーバーレスバックエンド
  ├─ Firestore               - データ永続化
  └─ Vertex AI               - Gemini 2.5 Flash-Lite
```

---

## 🧪 テスト関連

| テストタイプ | 場所 | 実行コマンド |
|------------|------|------------|
| 統合テスト（Jest） | `functions/__tests__/integration/` | `cd functions && npm run test:integration` |
| E2Eテスト（Playwright） | `e2e/` | `npx playwright test` |
| CI/CD | `.github/workflows/ci.yml` | 自動実行（push時） |

**詳細**: [`README.md`](../README.md) - 🧪 テストセクション

---

## 🔧 技術スタック（クイックリファレンス）

| カテゴリ | 技術 |
|---------|------|
| **フロントエンド** | React 19, TypeScript 5.8, Vite 6 |
| **バックエンド** | Node.js 20, Cloud Functions Gen 2 |
| **AI** | Vertex AI Gemini 2.5 Flash-Lite（us-central1） |
| **データベース** | Firestore |
| **テスト** | Jest, Playwright, Supertest |
| **CI/CD** | GitHub Actions, Firebase CLI |

**詳細**: [`steering/tech.md`](steering/tech.md)

---

## 📝 重要な技術的決定

### Gemini モデルとリージョン

⚠️ **CRITICAL**: 以下の設定は変更しないこと

- **モデル名**: `gemini-2.5-flash-lite` （`-latest` サフィックスなし、GA安定版）
- **リージョン**: `us-central1` （このモデルが動作する唯一のリージョン）

**詳細**: [`specs/ai-shift-integration-test/IMPLEMENTATION_COMPLETE.md`](specs/ai-shift-integration-test/IMPLEMENTATION_COMPLETE.md) - 課題1

### 段階的生成アプローチ

大規模スタッフ（11名以上）に対して2段階生成を実施：

1. **Phase 1**: 骨子生成（休日・夜勤パターン）
2. **Phase 2**: 詳細生成（10名/バッチ）

**詳細**: [`specs/ai-shift-integration-test/IMPLEMENTATION_COMPLETE.md`](specs/ai-shift-integration-test/IMPLEMENTATION_COMPLETE.md) - 課題3

---

## 🆘 トラブルシューティング

問題が発生した場合の参照先：

1. **テスト実行エラー**: [`README.md`](../README.md) - トラブルシューティングセクション
2. **AI生成エラー**: [`specs/ai-shift-integration-test/IMPLEMENTATION_COMPLETE.md`](specs/ai-shift-integration-test/IMPLEMENTATION_COMPLETE.md) - 技術的課題セクション
3. **デプロイエラー**: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) のログ確認

---

## 🎓 新規開発者向けオンボーディング

### 1日目: プロジェクト理解

1. [`README.md`](../README.md) を読む（15分）
2. [`steering/product.md`](steering/product.md) でビジネス要件を理解（10分）
3. [`steering/tech.md`](steering/tech.md) で技術スタックを把握（10分）
4. 本番環境を触る: https://ai-care-shift-scheduler.web.app （10分）

### 2日目: 開発環境構築

1. [`README.md`](../README.md) のセットアップ手順に従う（30分）
2. ローカル開発サーバー起動（5分）
3. テスト実行（`npm run test:integration`）（5分）

### 3日目: コード理解

1. [`specs/ai-shift-integration-test/design.md`](specs/ai-shift-integration-test/design.md) でアーキテクチャ理解（20分）
2. フロントエンドコード読解（`src/App.tsx`, `services/geminiService.ts`）（30分）
3. バックエンドコード読解（`functions/src/shift-generation.ts`）（30分）

---

## 📞 サポート

- **GitHub Issues**: https://github.com/yasushi-honda/ai-care-shift-scheduler/issues
- **リポジトリ**: https://github.com/yasushi-honda/ai-care-shift-scheduler

---

**最終更新**: 2025-10-23
**バージョン**: 1.0
**メンテナ**: 開発チーム
