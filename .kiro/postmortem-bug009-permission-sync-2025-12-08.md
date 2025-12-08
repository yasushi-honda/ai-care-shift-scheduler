# BUG-009 ポストモーテム: 権限データ同期問題の根本原因分析

**作成日**: 2025-12-08
**分析手法**: MoEチームミーティング（セキュリティ専門家・データフロー専門家・プロセス専門家）
**重大度**: 高（デモ機能が完全に動作しない）

---

## 1. エグゼクティブサマリー

BUG-009「デモユーザー権限消失問題」は**3回の修正を経ても解決しなかった**重大な問題です。
根本原因は**権限データの非正規化設計**と**セキュリティルールの参照先の誤認識**でした。

**教訓**: 権限エラーが発生したら、**最初にセキュリティルールを読む**ことが必須です。

---

## 2. 問題の時系列

| 日時 | イベント | 結果 |
|-----|---------|------|
| 2025-12-08 | Phase 46でパート職員4名追加のためseedDemoData.ts修正 | - |
| 2025-12-08 | `npm run seed:demo --reset`実行 | デモユーザー権限消失 |
| 2025-12-08 | 1回目修正: 既存membersを保持 | ❌ 失敗 |
| 2025-12-08 | 2回目修正: findIndexで権限強制更新 | ❌ 失敗 |
| 2025-12-08 | 3回目修正: users.facilitiesも同時更新 | ✅ 成功（検証中） |

---

## 3. 根本原因分析

### 3.1 権限データの二重管理構造

```
┌─────────────────────────────────────────────────────────────┐
│                    Firestoreデータモデル                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  users/{userId}                    facilities/{facilityId}  │
│  └─ facilities[]  ◀───同期必須───▶  └─ members[]           │
│     ├─ facilityId                      ├─ userId            │
│     ├─ role ◀─── SoT                   ├─ role              │
│     ├─ grantedAt                       ├─ email             │
│     └─ grantedBy                       └─ name              │
│                                                             │
│  ⚠️ セキュリティルールはusers.facilitiesのみ参照              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 セキュリティルールの参照先

```javascript
// firestore.rules (Line 14-34)
function hasRole(facilityId, requiredRole) {
  let userProfile = getUserProfile();  // ← users/{uid}を取得
  let facilities = userProfile.facilities;  // ← ここだけ参照！
  return checkFacilityRole(facilities, index, facilityId, requiredRole);
}
```

**重要な発見**: セキュリティルールは`users.facilities`**のみ**を参照。`facilities.members`は**参照されない**。

### 3.3 3回の修正失敗の原因

| 修正回 | 実装内容 | 更新箇所 | 失敗原因 |
|--------|---------|---------|---------|
| 1回目 | membersを保持 | `facilities.members`のみ | users.facilitiesは更新されていない |
| 2回目 | findIndexで強制更新 | `facilities.members`のみ | 同上 |
| 3回目 | 両方更新 | `users.facilities` + `facilities.members` | ✅ 正解 |

---

## 4. 見落とされていたポイント

### 4.1 誤った仮定

```
❌ 誤: facilities.membersを更新すれば権限が反映される
✅ 正: users.facilitiesを更新しないと権限は反映されない
```

### 4.2 デバッグ時に見るべきだった情報

1. **firestore.rules** - 権限チェックのロジック
2. **Firestoreの実データ** - 両コレクションの状態比較
3. **AuthContextのログ** - facilityRolesの出力

### 4.3 プロセス上の問題

1. **症状だけを見て対処** - 根本原因を特定せずに修正を繰り返した
2. **セキュリティルールを読まなかった** - 最初に読んでいれば1回で解決
3. **データ整合性の検証不足** - 修正後に両コレクションを確認しなかった

---

## 5. 権限データの正しい理解

### 5.1 Single Source of Truth (SoT)

| コレクション | 役割 | 備考 |
|-------------|------|------|
| `users/{uid}.facilities[]` | **SoT** | セキュリティルールが参照 |
| `facilities/{id}.members[]` | 非正規化データ | UI表示用、同期が必要 |

### 5.2 同期が必要な全操作

| 操作 | ファイル | 同期状態 |
|-----|---------|---------|
| 権限付与 (grantAccess) | userService.ts | ✅ 同期済み |
| 権限削除 (revokeAccess) | userService.ts | ✅ 同期済み |
| 招待経由付与 | userService.ts | ✅ 同期済み |
| デモデータ投入 | seedDemoData.ts | ✅ 修正済み |
| デモユーザー作成 | createDemoUser.ts | ⚠️ 要確認 |

---

## 6. 再発防止策

### 6.1 即座に実施（実施済み）

- [x] seedDemoData.tsで両コレクションを同期更新
- [x] AuthContextにfacilityRolesログを追加

### 6.2 短期対応（推奨）

- [ ] verifyDemoPermissions.ts検証スクリプト作成
- [ ] createDemoUser.tsの見直し
- [ ] CLAUDE.mdに権限管理ルールを追記

### 6.3 長期対応（検討）

- [ ] Cloud Functionでの自動同期
- [ ] CI/CDでのデータ整合性チェック

---

## 7. 権限エラーデバッグチェックリスト

権限エラーが発生した場合、以下の順序で確認すること：

### Step 1: セキュリティルールを読む

```bash
cat firestore.rules | grep -A 20 "function hasRole"
```

**確認ポイント**: どのコレクションを参照しているか？

### Step 2: 実データを確認

```bash
# Firestoreコンソールで確認、または検証スクリプト実行
npx tsx scripts/verifyDemoPermissions.ts
```

**確認ポイント**:
- `users/{uid}.facilities[].role` の値
- `facilities/{id}.members[].role` の値
- 両者が一致しているか

### Step 3: 権限ログを確認

```javascript
// ブラウザコンソールで確認
// [Phase 21 Debug] AuthContext:
//   facilityRoles: [{ facilityId: 'demo-facility-001', role: 'editor' }]
```

### Step 4: 修正後の検証

1. 両コレクションを更新したか確認
2. ブラウザをハードリロード
3. 実際に操作して権限エラーが解消されたか確認

---

## 8. 教訓まとめ

### 技術的教訓

1. **非正規化データは必ず同期が必要** - Firestoreのベストプラクティスだが、同期漏れのリスクがある
2. **セキュリティルールが正** - UIに表示される情報と権限判定は別物
3. **権限データは複数箇所に存在する** - 変更時は全箇所を更新

### プロセス的教訓

1. **権限エラー発生時は最初にセキュリティルールを読む**
2. **症状ではなく根本原因を特定する**
3. **修正後は必ずデータ整合性を検証する**
4. **同じエラーが2回発生したら、アプローチを変える**

---

## 9. 関連ドキュメント

- [BUG-009修正記録](.kiro/bugfix-demo-members-2025-12-08.md)
- [BUG-008修正記録](.kiro/bugfix-thinking-budget-2025-12-08.md)
- [BUG-010修正記録](.kiro/bugfix-timeout-extended-2025-12-08.md)
- [firestore.rules](firestore.rules)
- [userService.ts](src/services/userService.ts)

---

## 10. メトリクス

| 項目 | 値 |
|-----|-----|
| 修正試行回数 | 3回 |
| 解決までの時間 | 約4時間 |
| 影響を受けたユーザー | デモ環境利用者 |
| 根本原因特定の遅延要因 | セキュリティルールの未確認 |

---

**作成者**: Claude Opus 4.5 (MoEチーム分析)
**最終更新**: 2025-12-08
