# 権限エラーデバッグチェックリスト

**目的**: Firestore権限エラー発生時に、体系的に根本原因を特定し、確実に修正する

**背景**: BUG-009では「症状だけを見て修正」したため3回失敗した。このチェックリストに従えば1回で修正可能。

---

## Phase 1: 調査（修正前）

**原則**: **コードを書く前に、必ず根本原因を特定する**

### ステップ1: エラー情報の収集

```
[ ] エラーメッセージをコピー（完全な文言）
[ ] エラーが発生した操作を記録（どの画面で何をした時か）
[ ] 影響を受けるユーザー・環境を特定（デモ環境のみ？本番も？）
[ ] ブラウザのDevToolsでネットワークタブを確認（HTTPステータスコード、レスポンス）
```

**出力例**:
```
エラーメッセージ: "Missing or insufficient permissions"
発生操作: デモ環境でシフト保存時
影響範囲: デモユーザー（demo-user-fixed-uid）のみ
HTTPステータス: 403 Forbidden
```

---

### ステップ2: Firestore Security Rulesの読解（必須）

```
[ ] firestore.rulesファイルを開く
[ ] エラーが発生したコレクションのルールを特定
    例: /facilities/{facilityId}/schedules/{scheduleId}
[ ] 権限チェック関数を特定（hasRole, isSuperAdmin など）
[ ] 権限チェック関数が参照しているコレクション・フィールドを特定
    例: getUserProfile() → users/{uid}
         userProfile.facilities → users.facilities[]
[ ] ロール階層を確認（どのロールが何を許可されているか）
    例: editor は write 可能、viewer は read のみ
```

**確認例**:
```javascript
// firestore.rules
match /facilities/{facilityId}/schedules/{scheduleId} {
  allow write: if hasRole(facilityId, 'editor');  // ← editorが必要
}

function hasRole(facilityId, requiredRole) {
  let userProfile = getUserProfile();  // ← users/{uid}を取得
  let facilities = userProfile.facilities;  // ← users.facilities[]を参照
  ...
}
```

**重要**: 権限チェック関数がどのデータパスを参照しているかを正確に把握する

---

### ステップ3: Firestoreデータの確認（必須）

```
[ ] Firebase Consoleを開く
[ ] セキュリティルールが参照しているコレクション・ドキュメントに移動
[ ] 実際のデータを確認
[ ] 期待値と実際の値を比較
```

**確認箇所の例**:

| データパス | 期待値 | 実際の値 | 一致？ |
|-----------|--------|---------|--------|
| `users/{userId}.facilities[].role` | editor | viewer | ❌ |
| `users/{userId}.facilities[].facilityId` | demo-facility-001 | demo-facility-001 | ✅ |
| `facilities/{facilityId}.members[].role` | editor | editor | ✅ |
| `facilities/{facilityId}.members[].userId` | demo-user-fixed-uid | demo-user-fixed-uid | ✅ |

**Firebase Consoleの開き方**:
```bash
# URLを直接開く
https://console.firebase.google.com/project/ai-care-shift-scheduler/firestore/databases/-default-/data/~2Fusers~2F{userId}
```

---

### ステップ4: データ不整合の特定（必須）

```
[ ] セキュリティルールが参照しているデータが正しいか確認
[ ] 権限情報が複数箇所にある場合、すべての箇所を確認
    例: users.facilities[] と facilities.members[] の両方
[ ] 不整合箇所をリストアップ
```

**不整合例**:
```
不整合箇所:
- users/demo-user-fixed-uid.facilities[0].role = 'viewer' ← ❌ 'editor'であるべき
- facilities/demo-facility-001.members[1].role = 'editor' ← ✅ 正しい

原因: users.facilitiesが更新されていない
```

---

### ステップ5: データ更新箇所の特定（必須）

```
[ ] そのデータを更新しているスクリプト・関数を検索
[ ] データ初期投入スクリプトを確認（seedDemoData.ts など）
[ ] ランタイムでの更新処理を確認（招待受け入れなど）
[ ] 複数箇所にデータがある場合、すべてを同期する仕組みがあるか確認
```

**検索コマンド**:
```bash
# users.facilitiesを更新している箇所を検索
grep -r "facilities:" functions/src/ scripts/ | grep -v node_modules

# facilities.membersを更新している箇所を検索
grep -r "members:" functions/src/ scripts/ | grep -v node_modules
```

**確認例**:
```
データ更新箇所:
- scripts/seedDemoData.ts (Line 667): facilities.membersを更新
- scripts/createDemoUser.ts (Line 102): users.facilitiesを更新

問題: seedDemoData.tsではusers.facilitiesを更新していない！
```

---

## Phase 2: 修正

**原則**: **根本原因を特定してから、データの同期を保つように修正**

### ステップ6: 修正方針の決定

```
[ ] 不整合の原因を明確にする
[ ] 修正すべきスクリプト・関数を特定
[ ] 修正方針を決定（どのデータをどう更新するか）
[ ] 既存データの更新も考慮（新規作成だけでなく）
```

**修正方針例**:
```
修正方針:
- seedDemoData.tsでusers.facilities[]も同時に更新
- 既存のデモユーザーがviewerの場合、editorに強制更新
- Firestoreトランザクション内で両方を更新（データ整合性保証）
```

---

### ステップ7: 修正実装

```
[ ] コードを修正
[ ] 複数箇所にデータがある場合、必ずすべてを同期
[ ] 既存データの更新ロジックも追加
[ ] トランザクションまたはバッチ処理で整合性を保証
```

**実装例**:
```typescript
// seedDemoData.ts

// facilities.membersを更新
const members: FacilityMember[] = [...existingMembers];
const existingDemoUserIndex = members.findIndex(m => m.userId === DEMO_USER_UID);
if (existingDemoUserIndex >= 0) {
  members[existingDemoUserIndex] = {
    ...members[existingDemoUserIndex],
    role: 'editor',
  };
} else {
  members.push({ userId: DEMO_USER_UID, role: 'editor', grantedAt: now });
}
batch.set(facilityRef, { members, ... });

// users.facilitiesも同時に更新（同期）
const demoUserRef = db.collection('users').doc(DEMO_USER_UID);
const demoUserDoc = await demoUserRef.get();
if (demoUserDoc.exists) {
  const userData = demoUserDoc.data();
  if (userData?.facilities) {
    const userFacilities = userData.facilities.map((f) => {
      if (f.facilityId === DEMO_FACILITY_ID) {
        return { ...f, role: 'editor' };  // viewerをeditorに更新
      }
      return f;
    });
    batch.update(demoUserRef, { facilities: userFacilities });
  }
}

await batch.commit();  // トランザクション保証
```

---

## Phase 3: 検証（修正後）

**原則**: **Firestoreデータを確認してからUIテスト**

### ステップ8: 修正スクリプトの実行

```
[ ] 修正したスクリプトを実行
[ ] エラーなく完了することを確認
[ ] 実行ログを確認（どのデータが更新されたか）
```

**実行例**:
```bash
npm run seed:demo -- --reset
# または
VITE_FIREBASE_PROJECT_ID="ai-care-shift-scheduler" npm run seed:demo -- --reset --force --yes
```

**期待されるログ**:
```
✓ 施設: デモ施設
✓ デモユーザー権限更新: users/demo-user-fixed-uid.facilities[].role = editor
✓ スタッフ: 12名
```

---

### ステップ9: Firestoreデータの確認（必須）

```
[ ] Firebase Consoleでデータが更新されたことを確認
[ ] セキュリティルールが参照するすべてのデータパスを確認
[ ] 期待値と実際の値が一致することを確認
```

**確認箇所**:

| データパス | 期待値 | 実際の値 | 一致？ |
|-----------|--------|---------|--------|
| `users/demo-user-fixed-uid.facilities[0].role` | editor | editor | ✅ |
| `facilities/demo-facility-001.members[].role` (デモユーザー) | editor | editor | ✅ |

**Firebase Consoleでの確認方法**:
1. https://console.firebase.google.com/project/ai-care-shift-scheduler/firestore を開く
2. `users` → `demo-user-fixed-uid` → `facilities[0].role` を確認
3. `facilities` → `demo-facility-001` → `members[]` を確認

---

### ステップ10: UIテスト（最終確認）

```
[ ] デモログインでアクセス
[ ] エラーが発生した操作を再現
[ ] エラーが解消されたことを確認
[ ] 関連機能も動作することを確認
```

**テストシナリオ例**:
```
1. デモログインページにアクセス
2. 「デモアカウントでログイン」ボタンをクリック
3. シフト管理 → AI自動生成
4. 生成されたシフトを保存
5. エラーなく保存されることを確認
6. 月次レポートで集計表示されることを確認
```

---

### ステップ11: デプロイ後の確認（本番環境）

```
[ ] デプロイ完了を確認
[ ] 本番環境でFirestoreデータを確認
[ ] 本番環境でUIテストを実施
[ ] エラーが完全に解消されたことを確認
```

---

## チェックリスト完了後

### ドキュメント化

```
[ ] BUGFIXドキュメントを作成（.kiro/bugfix-XXX.md）
[ ] 根本原因を記録
[ ] 修正内容を記録
[ ] 再発防止策を記録
[ ] CLAUDE.mdに追記（必要な場合）
```

### 再発防止

```
[ ] 同様の権限データが他にもないか確認
[ ] データ同期のユニットテストを追加（検討）
[ ] CI/CDにデータ整合性チェックを追加（検討）
[ ] ドキュメントに権限データ管理箇所を明記
```

---

## よくある落とし穴

### 1. セキュリティルールを読まずに修正

**NG**: エラーメッセージだけを見て「権限を変更すれば良い」と仮定

**OK**: `firestore.rules`を読んで、どのデータパスが参照されているかを確認

---

### 2. データの一部だけを更新

**NG**: `facilities.members[]`だけ更新して、`users.facilities[]`を忘れる

**OK**: 権限情報が複数箇所にある場合、**すべて同期**する

---

### 3. 新規作成だけを考慮

**NG**: 新規ユーザー作成時の処理だけを修正

**OK**: 既存ユーザーのデータ更新も考慮（`findIndex`で検索して更新）

---

### 4. スクリプト修正 = データ更新と勘違い

**NG**: `createDemoUser.ts`を修正しただけで「直った」と思う

**OK**: スクリプト修正後、必ず再投入してFirestoreデータを更新

---

### 5. UIテストだけで検証

**NG**: 修正後すぐにUIテストして、エラーが出たら「修正が間違っていた」と判断

**OK**: Firestoreコンソールでデータが更新されたことを確認してからUIテスト

---

## まとめ

### 重要な原則

1. **調査 → 修正 → 検証**: この順番を守る
2. **セキュリティルールを最初に読む**: 権限エラーの発生源は常にルール
3. **仮定せず実装を読む**: 「こうなっているはず」ではなく実際を確認
4. **データの同期を保つ**: 複数箇所にデータがある場合、すべて更新
5. **Firestoreデータ確認 → UIテスト**: この順番で検証

### このチェックリストを使うべき時

- Firestore権限エラー（"Missing or insufficient permissions"）が発生した時
- セキュリティルールを変更した時
- デモ環境・本番環境でデータを再投入した時
- 権限ロジックに変更を加えた時

---

**作成日**: 2025-12-08
**作成者**: Claude Opus 4.5
**関連**: [ポストモーテム: BUG-009](.kiro/postmortem-bug009-three-failures.md)
