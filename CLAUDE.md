# Claude Code Spec-Driven Development

Kiro-style Spec Driven Development implementation using claude code slash commands, hooks and agents.

## Project Context

### Paths
- Steering: `.kiro/steering/`
- Specs: `.kiro/specs/`
- Commands: `.claude/commands/`

### Steering vs Specification

**Steering** (`.kiro/steering/`) - Guide AI with project-wide rules and context
**Specs** (`.kiro/specs/`) - Formalize development process for individual features

### Active Specifications
- **ai-shift-integration-test**: AI自動シフト生成機能の統合テストと検証（TDD） - ✅ 完了
- **auth-data-persistence**: 認証・データ永続化機能（事業所単位マルチテナント設計） - 📝 仕様策定中
- Use `/kiro:spec-status [feature-name]` to check progress

## Development Guidelines
- Think in English, but generate responses in Japanese (思考は英語、回答の生成は日本語で行うように)

## Git Workflow - GitHub Flow

このプロジェクトは **GitHub Flow** を採用しています。

### 基本原則
1. **mainブランチは常に安定・デプロイ可能な状態を維持**
   - 本番環境（Firebase Hosting）に直結
   - 破壊的変更は厳禁

2. **すべての新機能・修正はfeatureブランチで開発**
   - ブランチ命名規則: `feature/<feature-name>`, `bugfix/<issue-description>`
   - mainから分岐、mainにマージ

3. **Pull Request（PR）ベースのマージ**
   - コードレビューを経てマージ
   - CI/CDパイプラインが自動実行
   - マージ後は自動デプロイ

4. **マージ後はfeatureブランチ削除**
   - クリーンな状態を保つ
   - 履歴はGitHub上に残る

### ワークフロー

```
1. 新機能開発開始
   git checkout main
   git pull origin main
   git checkout -b feature/new-feature

2. 開発・コミット
   [コード変更]
   git add .
   git commit -m "feat: 新機能実装"

3. CodeRabbitローカルレビュー（後述のCI/CD Workflowを参照）
   coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md

4. Push
   git push origin feature/new-feature

5. GitHub上でPR作成
   gh pr create --title "新機能: ..." --body "..."

6. レビュー・CI/CD通過後、mainにマージ
   gh pr merge --squash

7. featureブランチ削除
   git checkout main
   git pull origin main
   git branch -d feature/new-feature
```

### ブランチ保護ルール（推奨）
- mainブランチへの直接pushは禁止
- PRマージ前にCI/CD成功を必須とする
- 最低1名のレビュー承認を推奨

## CI/CD Workflow (重要)
**コード変更時は必ず以下のワークフローに従うこと**:
1. コード変更
2. `git add .` → `git commit -m "..."`
3. **CodeRabbit CLIローカルレビュー実施・完了待ち** ← 必須！
   ```bash
   coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md
   ```
4. レビュー結果に基づいて修正（問題がある場合）
   - 修正後: `git add .` → `git commit --amend --no-edit` または新規コミット
   - 再レビュー: 再度Step 3を実行
5. レビューOK後に `git push`
6. GitHub Actions CI/CD実行を監視
   ```bash
   gh run list --limit 1
   ```

**重要**: pushする前に必ずCodeRabbitレビューを実行すること。スキップ禁止。

詳細: [Development Workflow](.kiro/steering/development-workflow.md)

## Workflow

### Phase 0: Steering (Optional)
`/kiro:steering` - Create/update steering documents
`/kiro:steering-custom` - Create custom steering for specialized contexts

Note: Optional for new features or small additions. You can proceed directly to spec-init.

### Phase 1: Specification Creation
1. `/kiro:spec-init [detailed description]` - Initialize spec with detailed project description
2. `/kiro:spec-requirements [feature]` - Generate requirements document
3. `/kiro:spec-design [feature]` - Interactive: "Have you reviewed requirements.md? [y/N]"
4. `/kiro:spec-tasks [feature]` - Interactive: Confirms both requirements and design review

### Phase 2: Progress Tracking
`/kiro:spec-status [feature]` - Check current progress and phases

## Development Rules
1. **Consider steering**: Run `/kiro:steering` before major development (optional for new features)
2. **Follow 3-phase approval workflow**: Requirements → Design → Tasks → Implementation
3. **Approval required**: Each phase requires human review (interactive prompt or manual)
4. **No skipping phases**: Design requires approved requirements; Tasks require approved design
5. **Update task status**: Mark tasks as completed when working on them
6. **Keep steering current**: Run `/kiro:steering` after significant changes
7. **Check spec compliance**: Use `/kiro:spec-status` to verify alignment

## Steering Configuration

### Current Steering Files
Managed by `/kiro:steering` command. Updates here reflect command changes.

### Active Steering Files
- `product.md`: Always included - Product context and business objectives
- `tech.md`: Always included - Technology stack and architectural decisions
- `structure.md`: Always included - File organization and code patterns

### Custom Steering Files
<!-- Added by /kiro:steering-custom command -->
<!-- Format:
- `filename.md`: Mode - Pattern(s) - Description
  Mode: Always|Conditional|Manual
  Pattern: File patterns for Conditional mode
-->

### Inclusion Modes
- **Always**: Loaded in every interaction (default)
- **Conditional**: Loaded for specific file patterns (e.g., "*.test.js")
- **Manual**: Reference with `@filename.md` syntax

