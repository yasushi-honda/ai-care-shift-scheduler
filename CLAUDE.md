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
- **auth-data-persistence**: 認証・データ永続化機能（事業所単位マルチテナント設計） - ✅ Phase 0-12.5完了・検証済み
- **monthly-report-enhancement**: Phase 41 レポート機能強化（月次レポート・PDF出力） - ✅ 完了
- **ui-design-improvement**: Phase 42 UIデザイン改善（ボタン統一・アイコン改善） - ✅ 完了
- **navigation-improvement**: Phase 42.1 ナビゲーション改善（戻るボタン・ログアウト確認） - ✅ 完了
- **demo-login**: Phase 42.2 デモログイン機能（Cloud Functionカスタムトークン方式） - ✅ 完了
- **demo-environment-improvements**: Phase 43 デモ環境改善・排他制御（保存スキップ・ロック機構） - ✅ 完了
- **ai-evaluation-feedback**: Phase 44 AIシフト生成パイプライン改善（動的制約・評価ロジック強化） - ✅ 完了
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

### Firebase CLI認証エラー時の対処方針

**原則**: Firebase CLI認証エラーが発生した場合、即座に代替手段に切り替える。

#### 優先順位
1. **GitHub Actions CI/CD** (最優先)
   - コミット→プッシュでFirebase自動デプロイ
   - Hosting, Functions, Firestore Rulesすべて対応
   - 最も信頼性が高く、履歴も残る

2. **gh CLI** (GitHub操作)
   - PR作成・マージ
   - GitHub Actions実行状況確認

3. **gcloud CLI** (GCP直接操作)
   - Cloud Functions管理: `gcloud functions list/deploy/delete`
   - Firestore管理: `gcloud firestore` (※制限あり)
   - IAM権限管理: `gcloud iam service-accounts add-iam-policy-binding`

4. **curl/REST API**
   - Cloud Function実行
   - 簡易的なデータ操作

5. **Firebase CLI** (最終手段)
   - 認証エラーが頻発するため、使用は最小限に
   - 使用前に必ず代替手段を検討

#### 実践例: Firebaseへのデプロイ

```bash
# ❌ 避けるべき方法
firebase deploy --only functions,hosting

# ✅ 推奨方法
git add .
git commit -m "feat: 新機能追加"
git push origin main  # または feature ブランチ
# → GitHub Actions が自動的に firebase deploy を実行
```

#### gcloud CLI認証（Claude Codeから実行可能）

gcloud認証が期限切れの場合、Claude Codeから再認証できます：

```bash
gcloud auth login
```

ブラウザで認証画面が開きます。認証完了後、Claude Codeに戻って作業を続行してください。

**よくあるエラーと対処**:

| エラー | 対処 |
|--------|------|
| `Reauthentication failed` | `gcloud auth login`を実行 |
| `Permission denied` | IAM権限を確認（プロジェクトレベル or SAレベル） |
| `Request had insufficient authentication scopes` | `gcloud auth application-default login`を実行 |

#### トラブルシューティング

Firebase CLI認証エラーが発生した場合:

1. **エラーメッセージを記録しない** - 時間の無駄
2. **即座にGitHub Flowに切り替える**
3. **メモリ `firebase_cli_error_handling.md` を参照**

詳細: [Development Workflow](.kiro/steering/development-workflow.md)

### デプロイ後の確認とキャッシュ対策

#### Firebase Hostingキャッシュの理解

Firebase Hostingは多層キャッシュを使用しています：
- **ブラウザキャッシュ**: Cache-Control ヘッダーで制御
- **CDNキャッシュ**: Firebase側で管理
- **Origin**: Firebase Hosting server

#### デプロイ直後の確認手順

**必須**: デプロイ後は必ずハードリロードで確認すること

```bash
# 1. デプロイ完了を確認
gh run list --limit 1

# 2. 本番環境でハードリロード
# Mac: Cmd + Shift + R
# Windows: Ctrl + Shift + R

# 3. 開発者ツールでJSファイル名を確認
# ローカルのdist/index.htmlと本番環境のソースを比較
```

#### キャッシュ問題が発生した場合

**症状**: デプロイ後も古いバージョンが表示される

**対処方法**:
1. **ブラウザのハードリロード**: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)
2. **シークレットモード**: 新しいブラウザセッションで確認
3. **キャッシュクリア**: ブラウザの設定からキャッシュを削除
4. **待機**: cache-control設定に従い、最大1時間待つ

**予防策**:
- `firebase.json`で`index.html`のキャッシュを無効化済み（設定済み）
- GitHub Actionsでデプロイ検証を自動実行（設定済み）

詳細: [Deployment Troubleshooting](.kiro/steering/deployment-troubleshooting.md)

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
8. **Document milestones**: Create comprehensive documentation at major milestones (see Documentation Standards below)

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

---

## Documentation Standards

### 原則：テキスト + Mermaid図の併用

**目的**: 将来のAIセッションや新規メンバーが振り返るときに、即座にプロジェクト状況を理解できるようにする

**ベストプラクティス**:
- ✅ **テキストドキュメント**で詳細・理由・コンテキストを記録
- ✅ **Mermaid図**で全体像・構造・関係性を視覚化
- ✅ 両者を**相互参照**して補完し合う

### 記録が必要なマイルストーン

以下のタイミングでは必ず包括的なドキュメントを作成すること：

1. **Phase完了時**（特にPhase 0, Phase 5, Phase 10, Phase 15など大きな節目）
2. **重大なバグ修正後**（設計判断の変更を伴う場合）
3. **本番環境デプロイ後**（初回デプロイ、大規模変更時）
4. **アーキテクチャ変更後**（マルチテナント化、認証方式変更など）
5. **四半期または月次レビュー時**（開発状況の定期的な記録）

### ドキュメント構成（必須）

#### 1. テキストドキュメント（詳細版）

**保存場所**: `.kiro/[適切なディレクトリ]/[記録種別]-[日付].md`

**例**:
- `.kiro/specs/auth-data-persistence/phase0-verification-2025-10-31.md`
- `.kiro/specs/auth-data-persistence/bugfix-2025-10-31.md`
- `.kiro/development-status-2025-10-31.md`

**必須セクション**:
```markdown
# [タイトル]

**更新日**: YYYY-MM-DD
**仕様ID**: [spec-name]（該当する場合）
**Phase**: [phase-number]（該当する場合）

## 概要
[何が行われたか、なぜ行われたか]

## 詳細内容
[詳細な説明、技術的決定、実装方法]

## 検証結果・テスト結果
[動作確認結果、エビデンス]

## 影響分析
[変更による影響範囲、リスク評価]

## 今後の対応
[次のステップ、未完了項目]

## 関連ドキュメント
[関連するファイルへのリンク]

## 学び・振り返り
[今後の改善点、注意事項]
```

#### 2. Mermaid図ドキュメント（構造版）

**保存場所**: `.kiro/[適切なディレクトリ]/[記録種別]-diagram-[日付].md`

**例**:
- `.kiro/development-status-diagram-2025-10-31.md`
- `.kiro/specs/auth-data-persistence/architecture-diagram-2025-10-31.md`

**必須図の種類**（状況に応じて選択）:

1. **ガントチャート** - Phase実装状況、スケジュール
   ```mermaid
   gantt
       title Phase実装進捗状況
       dateFormat YYYY-MM-DD
       section Phase 0-6
       Phase 0: デモ環境整備 :done, p0, 2025-10-23, 2025-10-31
   ```

2. **システムアーキテクチャ図** - コンポーネント構成、技術スタック
   ```mermaid
   graph TB
       subgraph "クライアント層"
           A[React SPA]
       end
       subgraph "Firebase層"
           B[Authentication]
           C[Firestore]
       end
   ```

3. **シーケンス図** - 処理フロー、コンポーネント間のやり取り
   ```mermaid
   sequenceDiagram
       actor User
       participant UI
       participant Backend
       User->>UI: アクション
       UI->>Backend: リクエスト
   ```

4. **ER図** - データモデル、コレクション関係
   ```mermaid
   erDiagram
       USERS ||--o{ FACILITIES : "facilities[]"
       FACILITIES ||--o{ STAFF : "staff subcollection"
   ```

5. **タイムライン** - リリース計画、ロードマップ
   ```mermaid
   timeline
       title リリース計画ロードマップ
       section 完了済み
       Phase 0-12.5 : 実装完了
   ```

6. **フローチャート** - 開発ワークフロー、判断分岐
   ```mermaid
   graph TB
       A[要件定義] --> B[技術設計]
       B --> C{承認}
       C -->|承認| D[実装]
   ```

### 命名規則

**日付フォーマット**: `YYYY-MM-DD`

**ファイル名パターン**:
- Phase検証: `phase[N]-verification-YYYY-MM-DD.md`
- バグ修正: `bugfix-YYYY-MM-DD.md`
- 開発状況: `development-status-YYYY-MM-DD.md`
- 開発状況図: `development-status-diagram-YYYY-MM-DD.md`
- アーキテクチャ: `architecture-diagram-YYYY-MM-DD.md`
- リリースノート: `release-notes-vX.Y.Z-YYYY-MM-DD.md`

### 実装時の注意

- **記録は実装の一部**: コードと同様に重要な成果物
- **リアルタイム記録**: 後回しにせず、完了時に即座に記録
- **相互参照**: テキスト ↔ 図を相互リンクで結びつける

---

## Cloud Functions デプロイ確認ルール（重要）

**背景**: 2025-12-05にCORSエラーが発生。原因はCloud Functionsデプロイが3週間失敗していたが、CI/CDワークフローがエラーをマスクしていたため気づかなかった。

### デプロイ後の必須確認

1. **GitHub Actionsログで関数デプロイ成功を確認**

   ```bash
   gh run view <run-id> --log | grep -E "functions\[.*\]"
   # ✔ functions[generateShift(asia-northeast1)] Successful create operation.
   ```

2. **「Deploy complete!」だけを信じない**
   - Hosting/Rulesは成功してもFunctionsが失敗している可能性あり
   - `|| echo` でエラーがマスクされている場合がある

3. **リージョン移行後は必ず実機テスト**
   - フロントエンドが正しいURLを呼び出しているか確認
   - 関数が実際にデプロイされているか `gcloud functions list` で確認

### CORSエラー調査手順

CORSエラーが発生した場合、**CORS設定だけでなく「関数が存在するか」も確認**：

1. **Cloud Functions存在確認**

   ```bash
   gcloud functions list --project=ai-care-shift-scheduler
   ```

2. **GitHub Actionsデプロイログ確認**

   ```bash
   gh run view <最新のrun-id> --log | grep -E "(functions|Error|cloudscheduler)"
   ```

3. **よくある原因**
   - `cloudscheduler.googleapis.com` API未有効化
   - リージョン変更後の古い関数が残存
   - 非インタラクティブモードでの削除失敗

詳細: [BUG-001修正記録](.kiro/bugfix-cors-cloud-functions-2025-12-05.md)

## Gemini 2.5 Flash 設定ルール（重要）

### 必須設定

```typescript
// Vertex AI初期化
const vertexAI = new VertexAI({
  project: projectId,
  location: 'asia-northeast1',  // ❗ 日本リージョン必須
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash',  // ❗ -latestなし
});

// 生成設定
generationConfig: {
  maxOutputTokens: 65536,  // ❗ 思考モード対応（8192だと不足）
  // ...
}
```

### なぜ65536か（BUG-003教訓）

Gemini 2.5 Flashの「思考モード」は`maxOutputTokens`の予算から思考トークンを消費する。

| カテゴリ | 典型的な消費 |
|---------|-------------|
| 思考トークン | 8,000-16,000 |
| 出力トークン | 4,000-8,000 |
| **合計** | 12,000-24,000 |

`maxOutputTokens: 8192`では思考だけでトークンを使い切り、出力が空になる。

### propertyOrdering必須（BUG-002教訓）

responseSchemaには必ず`propertyOrdering`を指定：

```typescript
responseSchema: {
  type: 'object',
  properties: { ... },
  propertyOrdering: ['prop1', 'prop2'],  // ❗ 必須
  required: ['prop1', 'prop2'],
}
```

### タイムアウト設定ルール（BUG-004教訓）

Gemini 2.5 Flash思考モードは処理に時間がかかる（10名規模で約2-3分）。

**必須設定**:

```typescript
// Cloud Functions (shift-generation.ts)
export const generateShift = onRequest({
  timeoutSeconds: 300,  // ❗ 5分（思考モード対応）
  // ...
});

// フロントエンド (geminiService.ts)
const controller = new AbortController();
setTimeout(() => controller.abort(), 180000);  // ❗ 3分
```

**設計原則**:

```text
クライアント timeout (180s) < サーバー timeout (300s)
サーバー timeout (300s) > 想定処理時間 (140s) × 2
```

### 関連ドキュメント

- [BUG-001修正記録](.kiro/bugfix-cors-cloud-functions-2025-12-05.md) - CORS
- [BUG-002修正記録](.kiro/bugfix-gemini-empty-response-2025-12-05.md) - propertyOrdering
- [BUG-003修正記録](.kiro/bugfix-gemini-thinking-tokens-2025-12-05.md) - maxOutputTokens
- [BUG-004修正記録](.kiro/bugfix-timeout-2025-12-05.md) - タイムアウト
- [BUG-005修正記録](.kiro/bugfix-evaluation-panel-display-2025-12-06.md) - Firestoreリスナー競合
- [BUG-006修正記録](.kiro/specs/demo-login/setup-guide.md) - Cloud Function IAM権限
- [ポストモーテム](.kiro/postmortem-gemini-bugs-2025-12-05.md) - 全体分析
- Serenaメモリ: `gemini_region_critical_rule`, `gemini_max_output_tokens_critical_rule`, `cloud_function_custom_token_iam`

---

## AI API統合 デバッグログ必須項目

**背景**: BUG-002で追加したログがBUG-003/004の即時発見に貢献

### 必須ログ出力

```typescript
// AIレスポンス受信時に必ず出力
console.log('📊 AI Response Details:', {
  finishReason,          // ❗ 'STOP'以外は異常
  responseLength,        // ❗ 0の場合は異常
  usageMetadata: {
    promptTokenCount,
    thoughtsTokenCount,  // ❗ 思考トークン消費量
    candidatesTokenCount,
    totalTokenCount,
  },
  processingTimeMs,      // 処理時間（タイムアウト調整の参考）
});
```

### finishReasonの解釈

| finishReason | 意味 | 対処 |
|-------------|------|------|
| `STOP` | 正常完了 | なし |
| `MAX_TOKENS` | トークン不足 | maxOutputTokens増加 |
| `SAFETY` | 安全性フィルタ | プロンプト見直し |
| `OTHER` | その他エラー | ログ詳細確認 |

---

## Cloud Function カスタムトークン発行 IAM設定（重要）

**背景**: BUG-006（2025-12-07）でdemoSignIn関数が500エラー。原因はIAM権限不足。

### 問題

`createCustomToken()`呼び出し時に以下のエラー：

```text
auth/insufficient-permission
Permission 'iam.serviceAccounts.signBlob' denied
```

### 原因

Firebase Admin SDKの`createCustomToken()`は**App Engineサービスアカウント**で署名する。
Cloud Function（2nd Gen）は**Computeサービスアカウント**で実行される。
そのため、Cloud Function SAがApp Engine SAに対してToken Creator権限を持つ必要がある。

### 正しい解決方法（サービスアカウントレベル）

```bash
# ❌ 間違い: プロジェクトレベルでは不十分
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:..." \
  --role="roles/iam.serviceAccountTokenCreator"

# ✅ 正解: サービスアカウントレベルで権限付与
gcloud iam service-accounts add-iam-policy-binding \
  PROJECT_ID@appspot.gserviceaccount.com \
  --project=PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

### gcloud認証が必要な場合

```bash
gcloud auth login
# ブラウザで認証画面が開く
```

### 確認コマンド

```bash
# Cloud FunctionのSAを確認
gcloud functions describe FUNCTION_NAME --region=asia-northeast1 \
  --format="value(serviceConfig.serviceAccountEmail)"

# IAM権限を確認
gcloud iam service-accounts get-iam-policy \
  PROJECT_ID@appspot.gserviceaccount.com
```

### 注意事項

- IAM権限の反映には**最大7分**かかる
- 設定直後にエラーが出ても数分待って再試行

### 参考資料

- [setup-guide.md](.kiro/specs/demo-login/setup-guide.md)
- Serenaメモリ: `cloud_function_custom_token_iam`

---

## Phase 43 デモ環境設計ルール（重要）

**背景**: 2025-12-07にデモ環境制限が誤って本番ユーザーにも適用された問題を修正。

### 設計原則

**デモ環境制限はデモアカウントでログインした場合のみ適用する**

```typescript
// ✅ 正しい実装
const isDemoEnvironment = isDemoUser;  // デモユーザーのみ

// ❌ 間違った実装（以前のバグ）
const isDemoEnvironment = isDemoUser || isDemoFacility;  // 施設も含めていた
```

### 理由

| ユースケース | 期待される動作 |
|-------------|---------------|
| デモアカウント + サンプル施設 | 制限あり（保存スキップ、バナー表示） |
| 本番アカウント + サンプル施設 | **制限なし**（フル機能テスト可能） |
| 本番アカウント + 本番施設 | 制限なし（通常操作） |

### 判定ロジック

```typescript
// AuthContext.tsx
const DEMO_USER_UID = 'demo-user-fixed-uid';
const DEMO_FACILITY_ID = 'demo-facility-001';

const isDemoUser = userProfile?.provider === 'demo'
  || currentUser?.uid === DEMO_USER_UID;

const isDemoFacility = selectedFacilityId === DEMO_FACILITY_ID;

// デモ環境制限はデモユーザーの場合のみ（施設単体では判定しない）
const isDemoEnvironment = isDemoUser;
```

### 注意事項

- `isDemoFacility` は今後の拡張用に保持（UIでのサンプルデータ表示など）
- デモ環境バナー（🧪）は `isDemoEnvironment` で表示判定
- 保存スキップも `isDemoEnvironment` で判定

### 参考資料

- [Phase 43ドキュメント](docs/phase43-demo-improvements.html)
- Serenaメモリ: `phase43_demo_improvements_2025-12-07`
