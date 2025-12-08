# BUG-010: クライアント側タイムアウト不足問題

**発生日**: 2025-12-08
**修正日**: 2025-12-08
**影響範囲**: デモ環境、AIシフト生成機能
**重大度**: 中（機能は動作するが、12名規模でタイムアウト）

---

## 1. 問題概要

### 症状
1. デモ環境でシフト生成実行
2. 約3分後に「リクエストがタイムアウトしました」エラー
3. コンソールに `AbortError: signal is aborted without reason`

### 期待される動作
- 12名スタッフのシフト生成が正常に完了
- 結果が画面に表示される

---

## 2. 根本原因分析

### Cloud Functionsログ分析

```
実行ID: wdiaiw46z1jr
開始: 23:48:18
評価完了: 23:51:36
所要時間: 約3分18秒（198秒）
```

### 処理時間の内訳

| フェーズ | 開始時刻 | 終了時刻 | 所要時間 |
|---------|---------|---------|---------|
| Phase 1: 骨子生成 | 23:48:18 | 23:49:44 | 86秒 |
| Phase 2 Batch 1 | 23:49:44 | 23:50:48 | 64秒 |
| Phase 2 Batch 2 | 23:50:48 | 23:51:36 | 48秒 |
| **合計** | | | **198秒** |

### 問題のコード（修正前）

```typescript
// services/geminiService.ts
// タイムアウト設定（3分 = 180秒）
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 180000);
```

### 問題の構造

```
クライアントタイムアウト (180秒) < 実際の処理時間 (198秒)
→ 処理完了前にクライアントがAbort
```

---

## 3. 修正内容

### タイムアウト延長

```typescript
// services/geminiService.ts（修正後）
// タイムアウト設定（4分 = 240秒）
// Gemini 2.5 Flash思考モードにより、12名規模で約3-4分かかる
// BUG-010対策: 180秒では12名スタッフで不足するため延長
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 240000);
```

### デバッグログ強化（BUG-009教訓）

```typescript
// src/contexts/AuthContext.tsx
// BUG-009対策: 権限情報を明示的にログ出力
const facilityRoles = userProfile?.facilities?.map((f) => ({
  facilityId: f.facilityId,
  role: f.role,
})) || [];
console.log('[Phase 21 Debug] AuthContext: setLoading(false)', {
  currentUser: user?.uid || null,
  userProfileExists: !!userProfile,
  selectedFacilityId,
  facilityRoles, // 権限情報を追加
});
```

---

## 4. 設計原則（更新）

### タイムアウト設計

```
クライアント timeout (240s) > 想定最大処理時間 (200s)
クライアント timeout (240s) < サーバー timeout (300s)
```

### スタッフ数と処理時間の関係

| スタッフ数 | 想定処理時間 | 推奨タイムアウト |
|-----------|-------------|-----------------|
| 5名以下 | 60-90秒 | 120秒 |
| 6-10名 | 90-150秒 | 180秒 |
| 11-15名 | 150-240秒 | 240秒 |
| 16名以上 | 240秒以上 | 300秒 |

---

## 5. 影響範囲

| 影響対象 | 影響内容 |
|---------|---------|
| services/geminiService.ts | タイムアウト180s→240s |
| src/contexts/AuthContext.tsx | 権限ログ追加 |
| デモ環境 | 12名スタッフで正常動作 |

---

## 6. 検証方法

1. デモログインでアクセス
2. シフト管理 → AI自動生成（12名スタッフ）
3. 4分以内に結果が表示されることを確認
4. コンソールで権限ログを確認：
   ```
   facilityRoles: [{ facilityId: 'demo-facility-001', role: 'editor' }]
   ```

---

## 7. 関連BUG

| BUG ID | 問題 | 関連性 |
|--------|------|--------|
| BUG-008 | thinkingBudget過消費 | 同セッション |
| BUG-009 | デモユーザー権限消失 | 同セッション、権限ログ追加のきっかけ |
| **BUG-010** | タイムアウト不足 | 本件 |

---

## 8. 学び

1. **処理時間はスタッフ数に比例**: Phase 46でパート職員4名追加後、処理時間が増加
2. **余裕を持ったタイムアウト設計**: 想定処理時間の1.2-1.5倍を設定
3. **デバッグログの重要性**: 権限ログをあらかじめ出力しておくと問題発見が早い

---

## 9. 関連コミット

- `b127977` - fix: タイムアウト延長(180s→240s)・権限ログ追加

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
