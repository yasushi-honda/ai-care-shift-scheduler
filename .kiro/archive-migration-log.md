# .kiro ドキュメント整理ログ

## 実施日
2025-12-09

## 段階1: 事前準備・影響分析

### 1.1 Git管理状態
- **Git追跡ファイル数**: 336ファイル
- **未コミット変更**: なし
- **バックアップ**: `/tmp/kiro-backup-20251209/` に作成完了

### 1.2 外部参照の調査結果

#### CLAUDE.md からの参照（要保持）
| 参照先 | 用途 |
|--------|------|
| `.kiro/steering/` | Steering設定 |
| `.kiro/specs/` | Spec定義 |
| `.kiro/ai-prompt-design-checklist.md` | 実装前チェック |
| `.kiro/pre-implementation-test-checklist.md` | テストチェック |
| `.kiro/steering/development-workflow.md` | 開発ワークフロー |
| `.kiro/steering/deployment-troubleshooting.md` | デプロイトラブル |
| `.kiro/bugfix-*.md` (BUG-001〜019) | バグ修正記録 |
| `.kiro/postmortem-*.md` | ポストモーテム |
| `.kiro/ai-quality-improvement-guide.md` | AI品質ガイド |
| `.kiro/specs/demo-login/setup-guide.md` | BUG-006参照 |

#### .claude/commands/ からの参照
- `.kiro/specs/$1/` パターンで各specを参照
- `.kiro/steering/` 配下のファイルを参照
- **移動不可**: specs/, steering/ フォルダ構造

### 1.3 現状構造分析

#### ルート直下ファイル（移動候補）
| カテゴリ | ファイル数 | サイズ | 処理方針 |
|----------|-----------|--------|----------|
| bugfix-*.md | 19 | ~100KB | bugfixes/ に集約 |
| phase*.md | 11 | ~150KB | archive/ に移動 |
| session*.md | 8 | ~100KB | archive/ に移動 |
| postmortem-*.md | 3 | ~40KB | bugfixes/ に統合 |
| development-status*.md | 4 | ~50KB | archive/ に移動 |
| その他 | 15 | ~150KB | 個別判断 |

#### specs/ 配下の問題
| spec名 | ファイル数 | サイズ | 処理方針 |
|--------|-----------|--------|----------|
| auth-data-persistence | 144 | 2.3MB | 要圧縮（10-15に） |
| care-staff-schedule-compliance | 23 | 328KB | 統合検討 |
| その他（28 spec） | 各3-7 | 計800KB | 現状維持 |

### 1.4 本番環境への影響
- **コードからの参照**: なし（.kiro は設計ドキュメントのみ）
- **CI/CD影響**: なし
- **開発ツール**: Kiroコマンド（specs/, steering/構造は維持必須）

### 1.5 判断事項

#### 移動禁止（外部参照あり）
1. `.kiro/specs/` フォルダ構造
2. `.kiro/steering/` フォルダ構造
3. CLAUDE.md で明示的にリンクされたbugfixファイル
4. `.kiro/ai-prompt-design-checklist.md`
5. `.kiro/pre-implementation-test-checklist.md`
6. `.kiro/ai-quality-improvement-guide.md`

#### 移動可能（参照なし）
1. `.kiro/*.md`（上記以外のルート直下ファイル）
2. `.kiro/specs/auth-data-persistence/phase*-*.md`（進捗ログ）
3. `.kiro/handoff/`（古いハンドオフ）
4. `.kiro/testing/`

---

## 段階2: アーカイブ構造の導入

### 2.1 作成したアーカイブ構造

```
.kiro/archive/
├── 2025-10/   # 2ファイル
├── 2025-11/   # 22ファイル（handoff/, testing/を含む）
└── 2025-12/   # 19ファイル
```

### 2.2 移動したファイル

#### archive/2025-10/ (2ファイル)
- `development-status-2025-10-31.md`
- `development-status-diagram-2025-10-31.md`

#### archive/2025-11/ (22ファイル)
**旧ルート直下:**
- `development-status-2025-11-17.md`
- `handover-to-next-session-2025-11-12.md`
- `next-session-action-plan-2025-11-15.md`
- `phase19.2.4-completion-2025-11-13.md`
- `project-status-diagram-2025-11-12.md`
- `project-status-summary-2025-11-15.md`
- `phase22-*.md` (12ファイル)

**旧handoff/:**
- `deployment-record-2025-11-17.md`
- `README.md`
- `session-summary-2025-11-17.md`
- `version-history-fix-handoff-2025-11-17.md`

**旧testing/:**
- `version-history-manual-test-guide.md`

#### archive/2025-12/ (19ファイル)
- `ai-evaluation-analysis-2025-12-05.md`
- `ai-production-quality-diagram-2025-12-08.md`
- `ai-quality-improvement-analysis-2025-12-08.md`
- `bugfix-cors-cloud-functions-diagram-2025-12-05.md`
- `bugfix-gemini-empty-response-diagram-2025-12-05.md`
- `bugfix-leave-requests-type-2025-12-08.md`
- `checklist-permission-error-debug.md`
- `HANDOFF-2025-12-08.md`
- `HANDOFF-PROMPT-2025-12-08.md`
- `improvement-proposal-permission-debugging.md`
- `mt001-test-result-2025-12-05.md`
- `NAVIGATION.md`
- `phase47-parttime-constraints-implementation-2025-12-08.md`
- `phase50-detailed-prompt-enhancement-2025-12-08.md`
- `phase52-dynamic-constraints-design-2025-12-08.md`
- `postmortem-bug009-three-failures.md`
- `progress-display-improvement.md`
- `prompt-engineering-strategy.md`

### 2.3 保持したファイル（移動禁止）

CLAUDE.mdから直接参照されているため現在位置を維持:

**重要ドキュメント:**
- `ai-prompt-design-checklist.md`
- `pre-implementation-test-checklist.md`
- `ai-quality-improvement-guide.md`
- `ai-production-quality-review-2025-12-08.md`
- `phase48-consecutive-constraints-implementation-2025-12-08.md`

**Bugfix記録 (BUG-001〜019):**
- `bugfix-cors-cloud-functions-2025-12-05.md` (BUG-001)
- `bugfix-gemini-empty-response-2025-12-05.md` (BUG-002)
- `bugfix-gemini-thinking-tokens-2025-12-05.md` (BUG-003)
- `bugfix-timeout-2025-12-05.md` (BUG-004)
- `bugfix-evaluation-panel-display-2025-12-06.md` (BUG-005)
- `bugfix-demo-data-sync-2025-12-08.md` (BUG-007)
- `bugfix-thinking-budget-2025-12-08.md` (BUG-008)
- `bugfix-demo-members-2025-12-08.md` (BUG-009)
- `bugfix-timeout-extended-2025-12-08.md` (BUG-010)
- `bugfix-sdk-migration-2025-12-08.md` (BUG-012)
- `bugfix-json-schema-thinking-2025-12-08.md` (BUG-013)
- `bugfix-responsemimetype-thinking-2025-12-08.md` (BUG-014)
- `bugfix-schedule-format-conversion-2025-12-08.md` (BUG-015)
- `bugfix-batch-prompt-json-2025-12-08.md` (BUG-017)
- `bugfix-firestore-index-aiGenerationHistory-2025-12-09.md` (BUG-019)

**Postmortem:**
- `postmortem-gemini-bugs-2025-12-05.md`
- `postmortem-bug009-permission-sync-2025-12-08.md`

### 2.4 削除したフォルダ

- `handoff/` → 内容をarchive/2025-11/に移動後削除
- `testing/` → 内容をarchive/2025-11/に移動後削除

### 2.5 効果

| 指標 | 変更前 | 変更後 |
|------|--------|--------|
| ルート直下MDファイル | 61 | 23 |
| フォルダ数 | 4 (specs, steering, handoff, testing) | 3 (specs, steering, archive) |

**注**: specs/フォルダはまだ未整理（段階3で対応）

---

## 段階3以降の作業ログ
（実施時に追記）
