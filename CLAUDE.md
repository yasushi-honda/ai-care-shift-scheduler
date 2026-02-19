# Claude Code Spec-Driven Development

**最終更新**: 2026-02-16（LLM→Solver完全移行完了 - LLMコード削除・UI表記統一）

Kiro-style Spec Driven Development implementation using claude code slash commands, hooks and agents.

---

## Project Context

### Paths
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`
- Commands: `.claude/commands/`

### Steering vs Specification
- **Steering** (`.kiro/steering/`) - Project-wide rules and context
- **Specs** (`.kiro/specs/`) - Feature-specific development process

---

## Active Specifications

| Spec | Phase | Status |
|------|-------|--------|
| ai-shift-integration-test | - | ✅ 完了 |
| auth-data-persistence | 0-12.5 | ✅ 完了 |
| monthly-report-enhancement | 41 | ✅ 完了 |
| ui-design-improvement | 42 | ✅ 完了 |
| navigation-improvement | 42.1 | ✅ 完了 |
| demo-login | 42.2 | ✅ 完了 |
| demo-environment-improvements | 43 | ✅ 完了 |
| ai-evaluation-feedback | 44 | ✅ 完了 |
| ai-generation-progress | 45 | ✅ 完了 |
| constraint-level-evaluation | 53 | ✅ 完了 |
| evaluation-history-reevaluate | 54 | ✅ 完了 |
| data-configuration-diagnosis | 55 | ✅ 完了 |
| hybrid-solver-poc | 57 | ✅ 完了 |
| solver-production-deploy | 58 | ✅ 完了 |
| dependency-updates-p0-p3 | 59 | ✅ 完了 |
| compliance-leave-management | 25 | ✅ 完了 |
| shift-type-settings | 38 | ✅ 完了 |
| leave-balance-management | 39 | ✅ 完了 |
| double-click-shift-edit | 38.5 | ✅ 完了 |
| arrow-key-navigation | - | ✅ 完了 |
| ctrl-arrow-navigation | - | ✅ 完了 |
| home-end-navigation | - | ✅ 完了 |
| pageup-pagedown-navigation | - | ✅ 完了 |
| keyboard-accessibility | - | ✅ 完了 |
| keyboard-shortcut-help | - | ✅ 完了 |
| ci-cd-e2e-integration | - | ✅ 完了 |
| demo-data-improvement | - | ✅ 完了 |
| demo-shift-removal | - | ✅ 完了 |
| github-pages-optimization | - | ✅ 完了 |
| mobile-touch-support | - | ✅ 完了 |
| undo-functionality | - | ✅ 完了 |
| redo-functionality | - | ✅ 完了 |
| administrative-compliance-ui | 61 | 🔄 要件定義中 |

Use `/kiro:spec-status [feature-name]` to check progress.

---

## Development Guidelines

- Think in English, generate responses in Japanese（思考は英語、回答は日本語）
- ドキュメントは簡潔に、詳細はsteeringファイルへリンク（冗長な記述を避ける）

---

## セッション開始時の環境確認

**新しいセッション開始時は必ず環境変数とアカウント設定を確認すること**

### 確認コマンド

```bash
# 1. GitHub アカウント確認
gh auth status

# 2. GCP アカウント/プロジェクト確認
gcloud config list --format="table(core.account,core.project)"

# 3. 期待値との照合
# - GitHub: yasushi-honda (Active)
# - GCP Account: admin@fuku-no-tane.com
# - GCP Project: ai-care-shift-scheduler
```

### 不一致時の対処

```bash
# GCP認証が必要な場合
gcloud auth login admin@fuku-no-tane.com

# direnv再読み込み
direnv allow
```

### 環境ファイル構成

| ファイル | 用途 |
|----------|------|
| `.envrc` | GCP/GitHub CLI自動切替（direnv） |
| `.env` / `.env.local` | Firebase/GCP環境変数 |
| `.firebaserc` | Firebaseプロジェクト設定 |
| `.git/config` | Git user設定 |

**詳細**: [development-workflow.md](.kiro/steering/development-workflow.md)

---

## Git Workflow - GitHub Flow

1. **mainブランチ**: 常に安定・デプロイ可能
2. **featureブランチ**: `feature/<name>`, `bugfix/<description>`
3. **PRベースのマージ**: CI/CD通過後にマージ

```bash
# 開発フロー
git checkout -b feature/new-feature
# ... 開発 ...
git commit -m "feat: 新機能実装"
git push origin feature/new-feature
gh pr create --title "..." --body "..."
# → CodeRabbitがPR作成時に自動レビュー（GitHub連携）
```

詳細: [development-workflow.md](.kiro/steering/development-workflow.md)

---

## 実装前テストルール

**原則**: 「本番環境で初めてエラーを発見する」状況を絶対に避ける

### 必須チェック

| # | 項目 | 実行方法 |
|---|------|---------|
| 1 | 型チェック | `cd functions && npx tsc --noEmit` |
| 2 | CodeRabbitレビュー | PR作成時に自動実行（GitHub連携） |

詳細: [pre-implementation-test-checklist.md](.kiro/pre-implementation-test-checklist.md)

---

## CI/CD Workflow

```bash
# 1. featureブランチ作成
git checkout -b feature/xxx

# 2. コード変更 → コミット
git add . && git commit -m "..."

# 3. push → PR作成
git push -u origin feature/xxx
gh pr create --title "..." --body "..."
# → CodeRabbit自動レビュー + GitHub Actions CI実行

# 4. CI確認 + Claudeレビュー
gh run list --limit 1
gh pr diff <PR番号>  # 差分確認してレビュー

# 5. マージ → デプロイ
gh pr merge --squash  # CI通過 + レビューOK後
gh run list --limit 1  # デプロイ確認
```

### Claudeレビュー（マージ前）

大規模変更時はClaudeでレビューを実施：

```bash
gh pr diff <PR番号>  # 差分を確認してレビュー依頼
```

**Firebase CLI認証エラー時**: GitHub Actions CI/CDに即座に切り替える
詳細: [development-workflow.md](.kiro/steering/development-workflow.md)

---

## 重要ルール（Steering Reference）

以下のルールは詳細をsteeringファイルで管理。**変更前に必ず参照すること**。

### 権限管理

- `users.facilities[]`と`facilities.members[]`の**両方を同期更新**
- セキュリティルールは`users.facilities`のみ参照

**詳細**: [permission-rules.md](.kiro/steering/permission-rules.md)

### デモ環境

- デモ環境でもFirestoreへ保存を許可
- 排他制御（LockService）で複数ユーザー対応

**詳細**: [demo-environment.md](.kiro/steering/demo-environment.md)

### CP-SAT Solver（シフト生成エンジン）

- OR-Tools CP-SATによる決定的シフト生成（LLM完全廃止済み）
- 制約はSolverモデル内で定義（`solver-functions/solver/unified_builder.py`）

**詳細**: [ADR-0004](docs/adr/0004-hybrid-architecture-adoption.md)

### Firestoreインデックス

- サブコレクションは`queryScope: "COLLECTION_GROUP"`必須
- CI/CDに`firestore:indexes`を含める

### Cloud Functionsデプロイ確認

- `gh run view <id> --log | grep -E "functions\[.*\]"` で成功確認
- 「Deploy complete!」だけを信じない

---

## 評価システム（Phase 53）

4段階の制約レベル評価:

| Level | 名称 | 減点 |
|-------|------|------|
| 1 | 絶対必須（労基法） | 即0点 |
| 2 | 運営必須（人員不足） | -12点/件 |
| 3 | 努力目標（希望休） | -4点/件 |
| 4 | 推奨 | 0点 |

設定: `functions/src/evaluation/constraintLevelMapping.ts`

---

## Steeringファイル一覧

| ファイル | 内容 |
|----------|------|
| [product.md](.kiro/steering/product.md) | プロダクトコンテキスト |
| [tech.md](.kiro/steering/tech.md) | 技術スタック |
| [architecture.md](.kiro/steering/architecture.md) | システムアーキテクチャ |
| [structure.md](.kiro/steering/structure.md) | ファイル構成 |
| [development-workflow.md](.kiro/steering/development-workflow.md) | 開発ワークフロー |
| [permission-rules.md](.kiro/steering/permission-rules.md) | 権限管理ルール |
| [demo-environment.md](.kiro/steering/demo-environment.md) | デモ環境設計 |
| [documentation-standards.md](.kiro/steering/documentation-standards.md) | ドキュメント基準 |
| [solver-generation-flow.md](.kiro/steering/solver-generation-flow.md) | Solverシフト生成フロー |
| [solver-optimization-strategy.md](.kiro/steering/solver-optimization-strategy.md) | Solver最適化戦略 |
| [care-compliance.md](.kiro/steering/care-compliance.md) | 介護報酬算定ガイドライン |
| [deployment-troubleshooting.md](.kiro/steering/deployment-troubleshooting.md) | デプロイトラブルシューティング |
| [implementation-log-index.md](.kiro/steering/implementation-log-index.md) | 実装ログインデックス |

---

## バグ修正記録

全バグ修正記録は `.kiro/bugfix-*.md` に保存。

主要なバグと教訓:
- **BUG-002/003/008/012/013/014/022**: Gemini API設定（LLM廃止済み・アーカイブ）
- **BUG-009**: 権限同期 → [permission-rules.md](.kiro/steering/permission-rules.md)
- **BUG-019**: Firestoreインデックス → `COLLECTION_GROUP`必須
- **BUG-023/025**: LLM生成品質（LLM廃止済み・アーカイブ）
- **BUG-024**: staffId→idマッピング不整合 → [bugfix-024-staffid-mapping.md](.kiro/bugfix-024-staffid-mapping.md)

ポストモーテム: [postmortem-gemini-bugs-2025-12-05.md](.kiro/postmortem-gemini-bugs-2025-12-05.md)（LLM時代の参考資料）

---

## Spec Workflow

```bash
# Phase 0: Steering（オプション）
/kiro:steering

# Phase 1: Specification
/kiro:spec-init [description]
/kiro:spec-requirements [feature]
/kiro:spec-design [feature]
/kiro:spec-tasks [feature]

# Phase 2: Progress
/kiro:spec-status [feature]
```

---

## Development Rules

1. Run `/kiro:steering` before major development（オプション）
2. Follow 3-phase workflow: Requirements → Design → Tasks → Implementation
3. Each phase requires human review
4. Document milestones per [documentation-standards.md](.kiro/steering/documentation-standards.md)
