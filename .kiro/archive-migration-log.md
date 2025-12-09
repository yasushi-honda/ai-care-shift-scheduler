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

## 段階3: auth-data-persistence整理

### 3.1 実施内容

**対象**: `specs/auth-data-persistence/` (2.3MB, 144ファイル)

コアファイル以外をarchiveサブフォルダに移動:

**保持したファイル（4ファイル）:**
- `requirements.md`
- `design.md`
- `tasks.md`
- `spec.json`

**archive/に移動したファイル（140ファイル）:**
- 進捗ログ（phase0-*, phase13-*, phase14-*, phase15-*, phase16-*, phase17-*, phase18-*, phase19-*, phase20-*, phase21-*）
- テストガイド（*-manual-test-guide-*, *-e2e-design-*）
- バグ修正記録（bugfix-*）
- サマリー類（*-completion-*, *-summary-*, *-diagram-*）

### 3.2 care-staff-schedule-compliance整理

**対象**: `specs/care-staff-schedule-compliance/` (328KB, 21ファイル)

**保持したファイル（3ファイル）:**
- `requirements.md`
- `design.md`
- `tasks.md`

**archive/に移動したファイル（17ファイル + diagrams/フォルダ）:**
- ハンドオフ関連（HANDOFF*.md, *_HANDOFF*.md, NEXT_SESSION_GUIDE.md）
- 進捗ログ（phase25-*, phase26-*）
- diagrams/フォルダ全体

### 3.3 効果

| 指標 | 変更前 | 変更後 |
|------|--------|--------|
| auth-data-persistence ルートファイル | 144 | 4 |
| care-staff-schedule-compliance ルートファイル | 21 | 3 |

**注**: ファイルは削除せず archive/ に移動。総サイズは変わらないが、ナビゲーションが大幅に改善。

---

## 段階4: bugfixes整理（スキップ）

**理由**: すべてのbugfixファイルはCLAUDE.mdから直接参照されているため、移動禁止対象。現状維持。

---

## 段階5: 命名規則の統一（スキップ）

**理由**: 既存ファイルは全て`YYYY-MM-DD`形式で一貫しており、CLAUDE.mdからの参照もこの形式。変更するとリンク切れが発生するため、現状維持。

---

## 最終報告

### 完了日時
2025-12-09

### 実施内容サマリー

| 段階 | 内容 | 結果 |
|------|------|------|
| 1 | 事前準備・影響分析 | ✅ 完了 |
| 2 | アーカイブ構造の導入 | ✅ 43ファイル移動 |
| 3 | auth-data-persistence整理 | ✅ 157ファイル整理 |
| 4 | bugfixes整理 | ⏭️ スキップ（参照あり） |
| 5 | 命名規則の統一 | ⏭️ スキップ（一貫性あり） |

### 効果

| 指標 | 変更前 | 変更後 |
|------|--------|--------|
| .kiro/ ルート直下MDファイル | 61 | 23 |
| auth-data-persistence ルートファイル | 144 | 4 |
| care-staff-schedule-compliance ルートファイル | 21 | 3 |
| フォルダ構造 | 4フォルダ | 3フォルダ |

### 新しいフォルダ構造

```
.kiro/
├── archive/                    # 新設: 履歴ドキュメント
│   ├── 2025-10/               # 2ファイル
│   ├── 2025-11/               # 22ファイル
│   └── 2025-12/               # 19ファイル
├── specs/                      # 変更あり
│   ├── auth-data-persistence/
│   │   ├── archive/           # 新設: 140ファイル
│   │   ├── requirements.md
│   │   ├── design.md
│   │   ├── tasks.md
│   │   └── spec.json
│   ├── care-staff-schedule-compliance/
│   │   ├── archive/           # 新設: 17ファイル + diagrams/
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   └── [その他28 spec]/        # 変更なし
├── steering/                   # 変更なし
├── bugfix-*.md (15ファイル)    # 移動禁止（CLAUDE.md参照）
├── postmortem-*.md (2ファイル) # 移動禁止（CLAUDE.md参照）
├── ai-*.md (3ファイル)         # 移動禁止（CLAUDE.md参照）
├── pre-implementation-test-checklist.md
├── phase48-*.md                # 移動禁止（CLAUDE.md参照）
└── archive-migration-log.md    # このファイル
```

### コミット履歴

1. `92e7ca7` - chore(.kiro): 段階2 - アーカイブ構造の導入
2. `298a738` - chore(.kiro): 段階3 - specs内archive整理

### ロールバック方法

バックアップから復元:
```bash
rm -rf .kiro/
cp -r /tmp/kiro-backup-20251209/ .kiro/
```

### 今後の推奨事項

1. **定期的なアーカイブ整理**: 月次でarchive/に移動
2. **新規ファイル作成時**: 命名規則`YYYY-MM-DD`を遵守
3. **大規模spec完了時**: コアファイル以外をarchive/に移動
4. **サイズ削減が必要な場合**: archive/フォルダを別リポジトリに切り出しを検討
