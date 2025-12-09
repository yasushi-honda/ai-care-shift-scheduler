# 開発プロセス改善提案: 権限エラーデバッグの体系化

**作成日**: 2025-12-08
**背景**: BUG-009で3回失敗した教訓を元に、開発プロセスを改善
**目的**: 同様のミスを繰り返さず、効率的に根本原因を特定できる体制を構築

---

## 現状の問題

### BUG-009で発生した3回の失敗

| 修正回数 | アプローチ | 調査時間 | 結果 |
|---------|-----------|---------|------|
| 1回目 | 症状対処 | 10分 | ❌ 失敗 |
| 2回目 | 部分的根本対処 | 30分 | ❌ 失敗 |
| 3回目 | 完全根本対処 | 90分 | ✅ 成功 |

**総時間**: 約11時間（失敗からの気づき + 再修正を含む）

**理想**: 1回目で成功（調査60分 + 修正30分 = 90分）

**無駄**: 約9.5時間

---

## 失敗の根本原因

### 1. 症状だけを見て修正した（調査不足）

**問題**:
- エラーメッセージ「Missing or insufficient permissions」を見て、すぐに「権限を変更すれば良い」と判断
- `firestore.rules`を読まずに、推測でコードを修正

**結果**:
- 1回目修正: `createDemoUser.ts`の`role`を変更 → 既存データは更新されず失敗
- 2回目修正: `facilities.members[]`のみ更新 → セキュリティルールは`users.facilities[]`を参照していたため失敗

**教訓**:
> **権限エラーが発生したら、まず`firestore.rules`を読む**

---

### 2. セキュリティルールの参照先を理解していなかった

**問題**:
- セキュリティルール`hasRole()`関数が`users.facilities[]`を参照していることを知らなかった
- 「membersに権限情報がある」という仮定だけでコードを修正

**実際のルール**:
```javascript
function hasRole(facilityId, requiredRole) {
  let userProfile = getUserProfile();  // ← users/{uid}
  let facilities = userProfile.facilities;  // ← users.facilities[]を参照
  ...
}
```

**教訓**:
> **仮定せず、実装を読む**

---

### 3. 修正後の検証が不十分だった

**問題**:
- 修正後、すぐにUIでテストしてエラーが出ると「修正が間違っていた」と判断
- Firestoreコンソールでデータが実際にどう変わったかを確認していなかった

**教訓**:
> **修正後は必ずFirestoreデータを確認してからUIテスト**

---

## 改善提案

### 提案1: 権限エラーデバッグチェックリストの導入

**内容**: 権限エラー発生時に従うべきステップを明文化

**成果物**: `.kiro/checklist-permission-error-debug.md`（作成済み）

**使い方**:
1. 権限エラーが発生したら、このチェックリストを開く
2. Phase 1（調査）→ Phase 2（修正）→ Phase 3（検証）の順に進む
3. すべてのチェック項目を確認してから次のステップに進む

**期待効果**:
- 調査漏れを防ぐ
- 根本原因を確実に特定できる
- 修正の品質が向上

---

### 提案2: CLAUDE.mdに権限データ管理箇所を明記

**内容**: 権限情報が複数箇所に保存されていることを明示

**追記内容**:
```markdown
## 権限データの管理箇所（重要）

本プロジェクトでは、権限情報が**2箇所**に保存されています：

1. `users/{userId}.facilities[].role` ← **セキュリティルールが参照**
2. `facilities/{facilityId}.members[].role` ← メンバー一覧表示用

**注意**: 両方を常に同期する必要があります。片方だけ更新すると権限エラーが発生します。

### 権限更新時の必須手順

1. `users.facilities[].role`を更新
2. `facilities.members[].role`を更新
3. **Firestoreトランザクションまたはバッチ処理で整合性を保証**

### 更新箇所の例

- `scripts/seedDemoData.ts` (Line 670-686): デモユーザー権限の同期更新
- `functions/src/grantAccessFromInvitation.ts`: 招待受け入れ時の権限付与
```

**期待効果**:
- 新規メンバーが権限データの構造を理解できる
- 権限更新時に同期漏れを防げる

---

### 提案3: データ整合性チェックスクリプトの作成

**内容**: デモユーザーの権限が正しく同期されているか自動チェック

**ファイル**: `scripts/verifyDemoPermissions.ts`

**実装例**:
```typescript
#!/usr/bin/env tsx

import admin from 'firebase-admin';

const DEMO_USER_UID = 'demo-user-fixed-uid';
const DEMO_FACILITY_ID = 'demo-facility-001';

async function verifyDemoPermissions() {
  const db = admin.firestore();

  // users.facilitiesのroleを取得
  const userDoc = await db.collection('users').doc(DEMO_USER_UID).get();
  if (!userDoc.exists) {
    throw new Error(`Demo user not found: ${DEMO_USER_UID}`);
  }
  const userData = userDoc.data();
  const userFacility = userData?.facilities?.find(f => f.facilityId === DEMO_FACILITY_ID);
  const userRole = userFacility?.role;

  // facilities.membersのroleを取得
  const facilityDoc = await db.collection('facilities').doc(DEMO_FACILITY_ID).get();
  if (!facilityDoc.exists) {
    throw new Error(`Demo facility not found: ${DEMO_FACILITY_ID}`);
  }
  const facilityData = facilityDoc.data();
  const member = facilityData?.members?.find(m => m.userId === DEMO_USER_UID);
  const memberRole = member?.role;

  // 検証
  console.log('');
  console.log('========================================');
  console.log('  デモユーザー権限検証');
  console.log('========================================');
  console.log('');
  console.log(`users/${DEMO_USER_UID}.facilities[].role: ${userRole}`);
  console.log(`facilities/${DEMO_FACILITY_ID}.members[].role: ${memberRole}`);
  console.log('');

  if (userRole !== 'editor') {
    throw new Error(`❌ users.facilities[].role is not 'editor': ${userRole}`);
  }
  if (memberRole !== 'editor') {
    throw new Error(`❌ facilities.members[].role is not 'editor': ${memberRole}`);
  }
  if (userRole !== memberRole) {
    throw new Error(`❌ Permissions are out of sync: users=${userRole}, members=${memberRole}`);
  }

  console.log('✅ デモユーザー権限は正しく同期されています');
  console.log('');
}

admin.initializeApp({
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'ai-care-shift-scheduler',
});

verifyDemoPermissions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('');
    console.error('❌ エラー:', error.message);
    console.error('');
    process.exit(1);
  });
```

**使い方**:
```bash
# デモデータ投入後に実行
npm run seed:demo -- --reset
npm run verify:demo

# または GitHub Actionsで自動実行
```

**期待効果**:
- デモデータ投入後に自動的に整合性をチェック
- CI/CDに組み込むことで、デプロイ前に検証
- 権限の同期漏れを早期発見

---

### 提案4: GitHub ActionsにCI/CDチェックを追加

**内容**: デモ環境のデータ整合性をデプロイ前にチェック

**ファイル**: `.github/workflows/demo-permissions-check.yml`

**実装例**:
```yaml
name: Demo Permissions Check

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main
      - develop

jobs:
  check-demo-permissions:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Authenticate to Firebase
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}

      - name: Verify demo permissions
        run: npm run verify:demo
```

**package.jsonに追加**:
```json
{
  "scripts": {
    "verify:demo": "tsx scripts/verifyDemoPermissions.ts"
  }
}
```

**期待効果**:
- PR作成時に自動チェック
- デモ権限の同期漏れを早期発見
- mainブランチへのマージ前に検証

---

### 提案5: セキュリティルールのドキュメント化

**内容**: `firestore.rules`の各関数に詳細なコメントを追加

**実装例**:
```javascript
// ==================== Helper Functions ====================

/**
 * 指定施設に対して指定ロール以上の権限を持つかチェック
 *
 * 参照データ: users/{uid}.facilities[]
 * データ構造: { facilityId: string, role: string, grantedAt: Timestamp }
 *
 * 注意: facilities/{facilityId}.members[]は参照しない
 *       membersはメンバー一覧表示用であり、権限チェックには使用されない
 *
 * @param facilityId - チェック対象の施設ID
 * @param requiredRole - 必要なロール ('super-admin', 'admin', 'editor', 'viewer')
 * @returns 権限があればtrue
 */
function hasRole(facilityId, requiredRole) {
  let userProfile = getUserProfile();  // users/{uid}を取得
  let facilities = userProfile.facilities;  // users.facilities[]を参照
  ...
}
```

**期待効果**:
- セキュリティルールの仕様を明確化
- 参照先データパスを明示
- 新規メンバーが理解しやすくなる

---

### 提案6: 定期的なセキュリティレビュー

**内容**: Phaseごとにセキュリティルールをレビュー

**レビュータイミング**:
- 新しいコレクションを追加した時
- 権限ロジックを変更した時
- デモ環境に変更を加えた時
- Phase完了時（Phase 10, 20, 30...）

**レビュー項目**:
```markdown
## セキュリティルールレビューチェックリスト

- [ ] 新しいコレクションにルールが追加されているか
- [ ] 権限チェック関数の参照先が正しいか
- [ ] ロール階層が正しく実装されているか
- [ ] デモユーザーの権限が適切か（editor以上）
- [ ] 権限データの同期が保たれているか
- [ ] ドキュメントが最新か（CLAUDE.md, firestore.rules コメント）
```

**期待効果**:
- セキュリティ問題を早期発見
- 権限ロジックの一貫性を保つ

---

## 実装優先度

### 優先度: 高（今週中に実施）

- [x] **提案1: 権限エラーデバッグチェックリストの導入** - 完了
- [x] **提案2: CLAUDE.mdに権限データ管理箇所を明記** - 次のステップで実施
- [ ] **提案3: データ整合性チェックスクリプトの作成** - 実装推奨

### 優先度: 中（次のPhaseで実施）

- [ ] **提案4: GitHub ActionsにCI/CDチェックを追加** - 提案3完了後
- [ ] **提案5: セキュリティルールのドキュメント化** - セキュリティレビュー時

### 優先度: 低（将来的に検討）

- [ ] **提案6: 定期的なセキュリティレビュー** - Phase 50以降で体制化

---

## 期待される成果

### 短期的成果（1-2週間）

- ✅ 権限エラーの修正時間を1回で完了（11時間 → 90分に短縮）
- ✅ 権限データの同期漏れゼロ
- ✅ セキュリティルールの理解度向上

### 中期的成果（1-2ヶ月）

- ✅ CI/CDでデモ環境の自動検証
- ✅ セキュリティルールのドキュメント整備
- ✅ 新規メンバーのオンボーディング時間短縮

### 長期的成果（3-6ヶ月）

- ✅ セキュリティ問題の発生率低下
- ✅ 開発効率の向上
- ✅ コードベースの品質向上

---

## まとめ

### BUG-009から得た教訓

1. **症状対処ではなく根本対処**: セキュリティルールを読んでから修正
2. **仮定せず実装を読む**: 推測でコードを書かない
3. **データの同期を保つ**: 複数箇所にデータがある場合、すべて更新
4. **修正後はFirestoreデータ確認**: UIテストの前にデータを確認

### 改善提案の重要ポイント

- **体系的なデバッグプロセス**: チェックリストで漏れをなくす
- **自動化**: CI/CDでデータ整合性を自動チェック
- **ドキュメント化**: 権限データの構造を明文化
- **定期レビュー**: セキュリティルールを定期的に見直す

**最も重要な改善**: **提案1（チェックリスト）**と**提案2（CLAUDE.md明記）**
→ これだけでも次回の権限エラーを1回で解決可能

---

**作成日**: 2025-12-08
**作成者**: Claude Opus 4.5
**関連ドキュメント**:
- [ポストモーテム: BUG-009](.kiro/postmortem-bug009-three-failures.md)
- [権限エラーデバッグチェックリスト](.kiro/checklist-permission-error-debug.md)
