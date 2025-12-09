# 引き継ぎドキュメント - README

**最終更新**: 2025-11-17 05:10 UTC

このディレクトリには、プロジェクトの引き継ぎに関する重要なドキュメントが保存されています。

---

## 🚀 新規AIセッション・新規メンバー向けクイックスタート

### 最初に読むべきドキュメント（優先順位順）

#### 1. プロジェクト全体理解
**目的**: プロジェクトの基本情報を理解する

| ドキュメント | パス | 内容 |
|------------|------|------|
| **プロダクト概要** | [.kiro/steering/product.md](../steering/product.md) | ビジネス目標、ユーザーストーリー |
| **技術スタック** | [.kiro/steering/tech.md](../steering/tech.md) | 使用技術、アーキテクチャ |
| **プロジェクト構造** | [.kiro/steering/structure.md](../steering/structure.md) | ファイル構成、コード規約 |
| **開発ワークフロー** | [.kiro/steering/development-workflow.md](../steering/development-workflow.md) | GitHub Flow、CI/CD、デプロイ手順 |

#### 2. 最新の開発状況
**目的**: 現在の開発状況と最新の変更を理解する

| ドキュメント | パス | 内容 |
|------------|------|------|
| **開発状況レポート** | [.kiro/development-status-2025-11-17.md](../development-status-2025-11-17.md) | プロジェクト全体のステータス |
| **最新セッション完了サマリー** | [./session-summary-2025-11-17.md](./session-summary-2025-11-17.md) | 最新セッションの完全な記録 |

#### 3. 具体的な実装詳細（必要に応じて）
**目的**: 特定の機能や修正の詳細を理解する

| ドキュメント | パス | 内容 |
|------------|------|------|
| **バージョン履歴修正** | [.kiro/specs/version-history-fix-verification-2025-11-17.md](../specs/version-history-fix-verification-2025-11-17.md) | 最新の重要な修正 |
| **Cloud Functions責務分離** | [.kiro/specs/cloud-functions-responsibility-separation-2025-11-17.md](../specs/cloud-functions-responsibility-separation-2025-11-17.md) | アーキテクチャ変更 |

---

## 📂 引き継ぎドキュメント一覧

### 2025年11月17日セッション

#### セッション完了記録
- [**session-summary-2025-11-17.md**](./session-summary-2025-11-17.md)
  - **内容**: セッション全体の完全な記録（時系列、成果物、学び）
  - **対象読者**: 新規AIセッション、プロジェクトマネージャー
  - **重要度**: ⭐⭐⭐⭐⭐

#### デプロイ記録
- [**deployment-record-2025-11-17.md**](./deployment-record-2025-11-17.md)
  - **内容**: デプロイの完全な記録（コミットハッシュ、検証結果、メトリクス）
  - **対象読者**: DevOps、新規AI、トラブルシューティング時
  - **重要度**: ⭐⭐⭐⭐⭐

#### 引き継ぎチェックリスト
- [**version-history-fix-handoff-2025-11-17.md**](./version-history-fix-handoff-2025-11-17.md)
  - **内容**: 次のステップ、未完了項目、トラブルシューティング
  - **対象読者**: 次のセッションを担当するAI
  - **重要度**: ⭐⭐⭐⭐

---

## 🎯 よくある質問（FAQ）

### Q1: このプロジェクトは何ですか？
**A**: AI自動シフト生成機能を持つ介護施設向けシフト管理システムです。

詳細: [.kiro/steering/product.md](../steering/product.md)

### Q2: 最新の修正内容は何ですか？
**A**: バージョン履歴クリア問題の修正（Cloud Functions責務分離）

詳細: [.kiro/specs/version-history-fix-verification-2025-11-17.md](../specs/version-history-fix-verification-2025-11-17.md)

### Q3: 技術スタックは何ですか？
**A**:
- Frontend: React + TypeScript + Vite
- Backend: Cloud Functions (Node.js)
- Database: Firestore
- AI: Vertex AI Gemini 2.5 Flash
- Hosting: Firebase Hosting
- CI/CD: GitHub Actions

詳細: [.kiro/steering/tech.md](../steering/tech.md)

### Q4: デプロイ方法は？
**A**: GitHub ActionsによるCI/CD自動デプロイ（git push → 自動デプロイ）

詳細: [.kiro/steering/development-workflow.md](../steering/development-workflow.md)

### Q5: 現在のプロジェクト状態は？
**A**: ✅ Phase 0-12.5完了、バージョン履歴修正完了、本番環境稼働中

詳細: [.kiro/development-status-2025-11-17.md](../development-status-2025-11-17.md)

### Q6: 次に実装すべき機能は？
**A**: Phase 13以降の実装（詳細はspecsディレクトリを参照）

または、将来的な改善提案：冪等性機能の実装（優先度: 低）

詳細: [./session-summary-2025-11-17.md](./session-summary-2025-11-17.md#将来への引き継ぎ事項)

### Q7: 過去の問題とその解決策は？
**A**: 主要な問題と解決策は以下を参照：
- バージョン履歴クリア問題: [version-history-fix-verification-2025-11-17.md](../specs/version-history-fix-verification-2025-11-17.md)
- Firestore設計: [gcp_architecture_final](../steering/gcp_architecture_final.md)
- Gemini JSONパース問題: Serenaメモリ `gemini_json_parsing_troubleshooting`

### Q8: テストはどこにありますか？
**A**:
- ユニットテスト: `src/__tests__/`
- E2Eテスト: `e2e/`
- テストガイド: [.kiro/testing/](../testing/)

---

## 🔗 関連ドキュメントディレクトリ

| ディレクトリ | 内容 | 用途 |
|------------|------|------|
| [.kiro/steering/](../steering/) | プロジェクトガイドライン | 開発方針、技術スタック |
| [.kiro/specs/](../specs/) | 仕様・設計ドキュメント | 機能仕様、技術設計 |
| [.kiro/testing/](../testing/) | テストガイド | テスト手順、シナリオ |
| [.kiro/handoff/](../handoff/) | 引き継ぎドキュメント | セッション記録、デプロイ記録 |

---

## 📝 ドキュメント作成ガイドライン

新しいセッションでドキュメントを作成する場合は、以下のガイドラインに従ってください：

### 命名規則
- Phase完了記録: `phase[N]-verification-YYYY-MM-DD.md`
- バグ修正記録: `bugfix-[description]-YYYY-MM-DD.md`
- セッション完了サマリー: `session-summary-YYYY-MM-DD.md`
- デプロイ記録: `deployment-record-YYYY-MM-DD.md`

### 必須セクション
1. **概要**: 何が行われたか
2. **詳細内容**: 技術的決定、実装方法
3. **検証結果**: 動作確認、エビデンス
4. **影響分析**: 変更の影響範囲
5. **今後の対応**: 次のステップ
6. **関連ドキュメント**: 相互参照リンク
7. **学び・振り返り**: 改善点

詳細: [CLAUDE.md](../../CLAUDE.md#documentation-standards)

---

## 🆘 トラブルシューティング

### Firebase CLIエラーが発生した場合
→ GitHub Actions CI/CDに切り替える（推奨）

詳細: [.kiro/steering/development-workflow.md](../steering/development-workflow.md#firebase-cli認証エラー時の対処方針)

### デプロイ後にキャッシュ問題が発生した場合
→ ハードリロード（Cmd+Shift+R）を実施

詳細: [.kiro/steering/deployment-troubleshooting.md](../steering/deployment-troubleshooting.md)

### Cloud Functionsのログを確認したい場合
```bash
# gcloud CLIで確認（推奨）
gcloud functions logs read generateShift \
  --region=us-central1 \
  --limit=50

# またはGCP Console
https://console.cloud.google.com/functions/details/us-central1/generateShift
```

---

## 📊 プロジェクトメトリクス（参考）

### 現在の状態（2025-11-17時点）
- **Phase**: 0-12.5完了
- **本番環境**: 稼働中
- **最終デプロイ**: 2025-11-17 04:56 UTC
- **コミットハッシュ**: b1a0703

### 技術指標
- TypeScript型チェック: ✅ 100%成功
- ユニットテスト: ✅ 47件 100%成功
- E2Eテスト: ⚠️ 5件中3件成功（2件は無関係な失敗）

---

**最終更新**: 2025-11-17 05:10 UTC
**メンテナンス**: 主要なセッション完了後に更新すること
