# プログレス表示改善設計

**作成日**: 2025-12-08
**Phase**: 45+（Phase 45で基本実装、今後の改善計画）

---

## 現状分析

### バックエンド処理フロー（実際）

#### 5名以下: 一括生成モード

```
1. リクエスト受信・バリデーション
2. Vertex AI呼び出し（一括）
3. 評価ロジック実行
4. レスポンス送信
```

#### 6名以上: 段階的生成モード

```
1. リクエスト受信・バリデーション
2. Phase 1: 骨子生成（generateSkeleton）
   - 休日パターン
   - 夜勤パターン（夜勤施設の場合）
3. Phase 2: 詳細生成（generateDetailedShifts）
   - バッチ処理（5名ずつ）
   - 各バッチでAI呼び出し
4. 評価ロジック実行
5. レスポンス送信
```

### フロントエンド表示（現状）

```typescript
// src/components/AIGenerationProgress/types.ts
export const GENERATION_STEPS: StepDefinition[] = [
  { id: 1, label: 'リクエスト送信中', startTimeSeconds: 0 },
  { id: 2, label: 'AIがシフトを分析中', startTimeSeconds: 5 },
  { id: 3, label: 'シフト案を生成中', startTimeSeconds: 30 },
  { id: 4, label: '評価・最適化中', startTimeSeconds: 90 },
  { id: 5, label: '結果を保存中', startTimeSeconds: 150 },
];
```

**問題点**:
1. **時間ベースの擬似的な進行**: 実際の処理進行と無関係
2. **段階的生成の反映なし**: バックエンドの2段階が表示されない
3. **バッチ処理が見えない**: 12名なら3バッチあるが不可視

---

## 改善オプション

### オプションA: 時間ベースの改善（短期・低コスト）

現在の時間ベースを維持しつつ、ステップ定義を実際の処理に近づける。

```typescript
// 改善案
export const GENERATION_STEPS: StepDefinition[] = [
  { id: 1, label: 'リクエスト送信中', startTimeSeconds: 0 },
  { id: 2, label: '骨子を生成中', startTimeSeconds: 5 },  // Phase 1
  { id: 3, label: 'シフト詳細を生成中', startTimeSeconds: 60 }, // Phase 2
  { id: 4, label: '評価・最適化中', startTimeSeconds: 150 },
  { id: 5, label: '完了処理中', startTimeSeconds: 180 },
];
```

**メリット**:
- 実装変更が最小限
- バックエンドの変更不要

**デメリット**:
- 依然として擬似的（実際の進行と乖離の可能性）
- バッチ進行は表示できない

### オプションB: Server-Sent Events（中期・中コスト）

バックエンドからリアルタイムで進行状況を通知。

```typescript
// バックエンド（SSE）
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
});

// Phase 1開始
res.write(`data: ${JSON.stringify({ step: 'skeleton', progress: 0 })}\n\n`);

// Phase 1完了
res.write(`data: ${JSON.stringify({ step: 'skeleton', progress: 100 })}\n\n`);

// Phase 2（バッチごと）
for (let i = 0; i < batches; i++) {
  res.write(`data: ${JSON.stringify({
    step: 'detailed',
    batch: i + 1,
    totalBatches: batches,
    progress: ((i + 1) / batches) * 100
  })}\n\n`);
}
```

```typescript
// フロントエンド
const eventSource = new EventSource('/generateShift');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateProgress(data);
};
```

**メリット**:
- リアルタイムで正確な進行表示
- バッチ進行も表示可能（「3/6バッチ完了」）

**デメリット**:
- Cloud Functionsの変更が必要
- SSEのタイムアウト管理が複雑

### オプションC: ポーリング + Firestore（中期・中コスト）

Firestoreに進行状況を書き込み、フロントエンドがポーリング。

```typescript
// バックエンド
await db.collection('generationProgress').doc(generationId).set({
  step: 'skeleton',
  progress: 50,
  message: '骨子を生成中...',
  updatedAt: new Date(),
});
```

```typescript
// フロントエンド（リアルタイムリスナー）
const unsubscribe = onSnapshot(
  doc(db, 'generationProgress', generationId),
  (doc) => {
    const data = doc.data();
    updateProgress(data);
  }
);
```

**メリット**:
- Firestoreのリアルタイム機能を活用
- フロントエンド実装がシンプル

**デメリット**:
- Firestoreの読み取りコスト増加
- クリーンアップが必要

### オプションD: 段階的プロンプト対応（長期・将来）

プロンプト分割アプローチ（オプションA/B）を実装した場合の表示。

```typescript
// 3段階生成の場合
export const GENERATION_STEPS_ADVANCED: StepDefinition[] = [
  { id: 1, label: 'リクエスト送信中', phase: 'init' },
  { id: 2, label: '休日パターン生成中', phase: '1a' },      // Phase 1a
  { id: 3, label: '人員配置検証中', phase: '1b' },           // Phase 1b
  { id: 4, label: 'シフト詳細生成中', phase: '2', showBatch: true },  // Phase 2
  { id: 5, label: '評価・最適化中', phase: 'eval' },
  { id: 6, label: '完了処理中', phase: 'finish' },
];
```

---

## 推奨アプローチ

### 短期（Phase 50）: オプションA

1. ステップ定義を実際の処理に近づける
2. 予測時間をスタッフ数に応じて動的に調整

```typescript
// スタッフ数による予測時間調整
function getEstimatedSeconds(staffCount: number): number {
  if (staffCount <= 5) return 90;    // 一括生成
  if (staffCount <= 10) return 150;  // 2バッチ
  if (staffCount <= 15) return 210;  // 3バッチ
  return 270;  // 4バッチ以上
}
```

### 中期（Phase 55以降）: オプションC

1. Firestoreに進行状況を書き込む機能を追加
2. フロントエンドでリアルタイムリスナーを使用
3. バッチ進行を「詳細生成中 (3/6バッチ)」のように表示

### 長期: 段階的プロンプト対応

1. プロンプト分割アプローチ実装後に対応
2. 各フェーズ（1a, 1b, 2）ごとの進行表示

---

## 実装チェックリスト

### 短期（オプションA）

- [ ] `types.ts`のステップ定義を更新
- [ ] 予測時間をスタッフ数に応じて動的化
- [ ] テスト・検証

### 中期（オプションC）

- [ ] Firestore進行状況コレクション設計
- [ ] バックエンドに進行状況書き込み追加
- [ ] フロントエンドにリアルタイムリスナー追加
- [ ] 進行状況のクリーンアップ機能
- [ ] セキュリティルール更新

---

## 関連ドキュメント

- [プロンプトエンジニアリング戦略](./prompt-engineering-strategy.md)
- [AI品質改善ガイド](./ai-quality-improvement-guide.md)
- [Phase 45仕様](./specs/ai-generation-progress/)

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
