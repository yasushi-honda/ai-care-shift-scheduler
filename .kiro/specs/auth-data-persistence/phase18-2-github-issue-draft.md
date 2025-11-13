# GitHub Issue Draft: Phase 18.2未解決問題

**作成日**: 2025-11-13
**目的**: Phase 18.2の未解決問題をGitHub Issueとして記録するための下書き

---

## Issue タイトル

```
[Phase 18.2] Firebase初期化タイミング問題 - Emulator環境でwindow.__firebaseAuthが未定義
```

---

## Issue 本文（Markdown形式）

```markdown
## 概要

Phase 18.2（Firebase Auth Emulator導入）において、GitHub Actions環境でのE2Eテスト実行時に`window.__firebaseAuth is undefined`エラーが発生します。

## 環境

- **GitHub Actions**: Ubuntu latest
- **Node.js**: 20
- **Vite**: 開発サーバー（ポート5173）
- **Firebase Emulator**: auth, firestore
- **Playwright**: 最新版

## 問題の詳細

### エラーメッセージ

```
Error: Emulator認証に失敗しました: test@example.com
```

### デバッグログ

```
🔍 [Auth Debug] グローバルオブジェクト確認: {hasWindow: true, hasAuth: false, hasDb: false, windowKeys: Array(0)}
❌ Firebase Auth がグローバルオブジェクトに存在しません
🔍 [Auth Debug] window.__firebaseAuth is undefined
```

### 発生状況

- **テスト成功率**: 1/6（17%）
- **失敗テスト**: 認証が必要な5つのテスト
- **成功テスト**: 認証不要なコンソールログ収集テスト

### 重要な発見

firebase.tsの「Environment check」ログが**出力されていない**
→ firebase.tsのトップレベルコードが実行されていない可能性

## 根本原因候補

### 候補1: Vite Tree Shakingによる副作用削除

Viteのビルド最適化でfirebase.tsの副作用コード（グローバルオブジェクト設定）が削除された可能性

### 候補2: isLocalhost判定失敗

firebase.ts (48-50行目)の`isLocalhost`判定が`false`になっている可能性

### 候補3: 実行タイミングの問題

index.tsxでのインポート後、page.goto()で新しいブラウザコンテキストが作成され、グローバルオブジェクトがリセットされている可能性

## 実施した対策（未解決）

### 対策1: index.tsxで明示的インポート

**コミット**: `37b5388`

```typescript
// index.tsx (2行目に追加)
import './firebase';  // Firebase初期化を確実に実行（React マウント前）
```

**結果**: ❌ 失敗（同じエラーが継続）

## 再現手順

1. GitHub Actionsワークフロー `e2e-permission-check.yml` を手動トリガー
2. Emulator環境でのテスト実行を確認
3. 5つのテストが `Emulator認証に失敗しました` エラーで失敗

## 期待される動作

- firebase.tsが実行され、`window.__firebaseAuth`がグローバルオブジェクトに設定される
- E2Eテスト内で`window.__firebaseAuth`を使用して認証可能
- 全テスト成功（6/6）

## 推奨される解決策

### ステップ1: ログ強化して原因特定（約30分）

firebase.tsとindex.tsxにログを追加し、実行状況を確認

```typescript
// firebase.ts (1行目に追加)
console.log('🔥 [Firebase] firebase.ts loaded');

// firebase.ts (53行目付近に追加)
console.log('🔥 [Firebase] isLocalhost:', isLocalhost);
console.log('🔥 [Firebase] hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');
```

### ステップ2: 原因に応じた修正

#### パターンA: Tree Shaking原因の場合

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        preserveModules: false,
      },
    },
  },
});
```

```json
// package.json
{
  "sideEffects": ["./firebase.ts", "./index.tsx"]
}
```

#### パターンB: isLocalhost判定失敗の場合

```typescript
// firebase.ts
const isLocalhost = typeof window !== 'undefined' &&
                    (window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname === '0.0.0.0');
```

#### パターンC: 実行タイミング問題の場合

window.__firebaseAuthに依存しないアプローチに変更（auth-helper.ts内で直接firebase/authをインポート）

## 関連ドキュメント

- `.kiro/specs/auth-data-persistence/phase18-2-step6-problem6-analysis-2025-11-13.md` - 詳細な問題分析
- `.kiro/specs/auth-data-persistence/phase18-2-on-hold-decision-2025-11-13.md` - 保留決定ドキュメント
- `.kiro/specs/auth-data-persistence/phase18-2-step6-troubleshooting-2025-11-12.md` - トラブルシューティング履歴

## 関連コミット

- `37b5388` - fix(phase18-2): Firebase初期化タイミング修正 - index.tsxで明示的インポート

## 関連ファイル

- `index.tsx` (2行目): firebase.tsインポート
- `firebase.ts` (62-80行目): Emulator接続・グローバルオブジェクト公開
- `e2e/helpers/auth-helper.ts` (74-121行目): Emulator認証処理
- `e2e/permission-errors.spec.ts` (46-56行目): Emulator環境判定・認証実行

## ラベル

- `bug`: バグ報告
- `phase-18`: Phase 18関連
- `e2e-test`: E2Eテスト関連
- `firebase`: Firebase関連
- `on-hold`: 一時保留中

## 優先度

**中**: 部分的に動作しているため、緊急ではないが、将来的に解決すべき

## 備考

Phase 18.2は一時保留中です。再開時にこのIssueから着手することを推奨します。
```

---

## Issueコマンド（gh CLI使用）

```bash
# GitHub Issueを作成
gh issue create \
  --title "[Phase 18.2] Firebase初期化タイミング問題 - Emulator環境でwindow.__firebaseAuthが未定義" \
  --body-file .kiro/specs/auth-data-persistence/phase18-2-github-issue-draft.md \
  --label "bug,phase-18,e2e-test,firebase,on-hold" \
  --assignee @me
```

---

**作成日**: 2025-11-13
**ステータス**: Draft（Issue作成準備完了）

---

**Note**: 実際にIssueを作成する場合は、上記のgh CLIコマンドを実行するか、GitHub Web UIで手動作成してください。
