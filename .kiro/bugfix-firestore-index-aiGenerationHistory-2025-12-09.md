# BUG-019: aiGenerationHistoryインデックス不足エラー

## 発生日
2025-12-09

## 症状
評価履歴の取得時に以下のエラーが発生：
```
FirebaseError: The query requires an index.
```

## 原因

### 根本原因
`firestore.indexes.json`で`aiGenerationHistory`のインデックスが`queryScope: "COLLECTION"`として定義されていたが、サブコレクション（`facilities/{facilityId}/aiGenerationHistory`）へのクエリには`COLLECTION_GROUP`スコープが必要だった。

### 技術的背景
Firestoreのインデックスには2種類のスコープがある：
- **COLLECTION**: 特定の単一コレクションへのクエリ用
- **COLLECTION_GROUP**: 同名のすべてのサブコレクションへのクエリ用

`aiGenerationHistory`は`facilities`コレクションのサブコレクションとして存在するため、`COLLECTION_GROUP`スコープが必要。

### 問題のクエリ（evaluationHistoryService.ts）
```typescript
const historyRef = collection(db, 'facilities', facilityId, 'aiGenerationHistory');
q = query(
  historyRef,
  where('targetMonth', '==', targetMonth),
  orderBy('createdAt', 'desc'),
  firestoreLimit(limitCount)
);
```

## 修正

### 1. firestore.indexes.json（コード修正）
```diff
{
  "collectionGroup": "aiGenerationHistory",
- "queryScope": "COLLECTION",
+ "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "targetMonth", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### 2. CI/CDワークフロー（デプロイ漏れ修正）
**問題**: `firestore.indexes.json`は修正済みだったが、CI/CDが`firestore:indexes`をデプロイしていなかった。

```diff
# .github/workflows/ci.yml
- firebase deploy --only firestore:rules --project ai-care-shift-scheduler
+ firebase deploy --only firestore:rules,firestore:indexes --project ai-care-shift-scheduler
```

## 教訓

### チェックリスト追加項目
サブコレクションにクエリを実行する場合：
1. [ ] `firestore.indexes.json`にインデックス定義が存在するか確認
2. [ ] サブコレクションの場合は`queryScope: "COLLECTION_GROUP"`を使用
3. [ ] **CI/CDで`firestore:indexes`がデプロイされているか確認**
4. [ ] デプロイ後、インデックス構築完了まで数分待機（大規模データの場合は長くなる）

### 予防策
- 新しいサブコレクションを追加する際は、必ずインデックス定義も同時に追加
- `where`句と`orderBy`句を組み合わせたクエリは複合インデックスが必要
- **CI/CDワークフローを変更した際は、必要なリソースがすべてデプロイされているか確認**

### 二重の問題（本バグの特徴）
このバグは2つの問題が重なっていた：
1. インデックス定義のスコープが間違っていた（COLLECTION → COLLECTION_GROUP）
2. CI/CDが`firestore:indexes`をデプロイしていなかった

1だけ修正しても2が修正されていなければ本番環境では解決しない。

## 関連Phase
- Phase 54: AI評価履歴・再評価機能（このPhaseで`aiGenerationHistory`の複合クエリを追加）

## 修正完了日時
2025-12-09 11:21 JST

## 参考リンク
- [Firestore複合インデックス](https://firebase.google.com/docs/firestore/query-data/index-overview)
- [コレクショングループクエリ](https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query)
