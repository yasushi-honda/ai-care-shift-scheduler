# ポストモーテム: Geminiシフト生成バグ連鎖（BUG-001〜004）

**作成日**: 2025-12-05
**影響範囲**: AIシフト自動生成機能（本番環境）
**解決日**: 2025-12-05（同日中に全4件を修正）

---

## 概要

AIシフト生成機能の本番手動テスト（MT-001）において、4つの連鎖バグが発見された。各バグは前のバグを修正することで顕在化した「隠れバグ」であり、適切なログ・エラーハンドリング・タイムアウト設定の重要性を示している。

## バグ連鎖の構造

```
BUG-001: CORSエラー
    ↓ 修正後
BUG-002: propertyOrdering欠如（Gemini 2.5特有）
    ↓ 修正後（デバッグログ追加）
BUG-003: MAX_TOKENS（思考トークンが出力予算を消費）
    ↓ 修正後
BUG-004: クライアントタイムアウト（60秒 < 処理時間140秒）
    ↓ 修正後
✅ 正常動作
```

---

## 根本原因分析

### なぜこれらの問題が残っていたのか

| バグ | 根本原因 | 見落とした理由 |
|------|---------|---------------|
| BUG-001 | CORS設定漏れ | ローカル開発環境では発生しない |
| BUG-002 | Gemini 2.5の新仕様 | 旧バージョンでは不要だった |
| BUG-003 | 思考モードのトークン消費 | 仕様書に明記されていない |
| BUG-004 | タイムアウト設定の不整合 | 単体テストでは短時間で完了 |

### 共通パターン

1. **環境差異**: ローカル vs 本番で挙動が異なる
2. **新機能の副作用**: Gemini 2.5の新機能（思考モード）の影響を過小評価
3. **非機能要件の軽視**: タイムアウト、CORS等の設定が後回しに
4. **テストカバレッジ不足**: 実際のAI呼び出しを含むE2Eテストがない

---

## 教訓と再発防止策

### 1. 本番同等環境でのテスト必須

**問題**: ローカル環境では発生しないバグが本番で顕在化

**対策**:
- [ ] ステージング環境の整備（Firebase Preview Channel活用）
- [ ] 本番デプロイ前のスモークテストチェックリスト
- [ ] Cloud Functions実行のE2Eテスト（実API呼び出し含む）

### 2. 外部APIの仕様変更追跡

**問題**: Gemini 2.5の新機能・仕様変更を把握していなかった

**対策**:
- [ ] Gemini/Vertex AIリリースノートの定期確認
- [ ] 依存APIのバージョンアップ時は変更点を確認
- [ ] APIレスポンスの詳細ログを常に有効化

### 3. タイムアウト設定の層間整合性

**問題**: フロントエンド60秒 < バックエンド120秒 < 実処理時間140秒

**対策（CLAUDE.md反映済み）**:
```
クライアント timeout > サーバー timeout > 想定処理時間 × 1.5
```

具体的設定:
- Cloud Functions: 300秒
- フロントエンドfetch: 180秒
- 想定処理時間: 120秒

### 4. デバッグログの価値

**成功例**: BUG-002修正時に追加したログがBUG-003/004の即時発見に貢献

**ベストプラクティス**:
```typescript
// 必須ログ項目（AIレスポンス）
console.log('📊 AI Response Details:', {
  finishReason,        // STOP, MAX_TOKENS, SAFETY等
  responseLength,      // 0の場合は異常
  usageMetadata,       // トークン消費量
  processingTime,      // 処理時間
});
```

---

## 転用可能なナレッジ

### Gemini 2.5 Flash/Pro設定テンプレート

```typescript
// 推奨設定（思考モード対応）
generationConfig: {
  maxOutputTokens: 65536,    // 思考トークン + 出力トークン
  temperature: 0.3,          // 構造化出力では低め推奨
  responseMimeType: 'application/json',
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {...},
    propertyOrdering: [...], // 必須！Gemini 2.5で追加
    required: [...],
  },
},
```

### タイムアウト設計原則

```
長時間AI処理のタイムアウト設計:
1. 処理時間を計測（本番データサイズで）
2. Cloud Functions timeout = 処理時間 × 2.5
3. クライアント timeout = Cloud Functions timeout × 0.6
4. ユーザーへのフィードバック = 30秒ごとに進捗表示
```

### CORS設定チェックリスト

```typescript
// Cloud Functions v2 CORS設定
export const myFunction = onRequest(
  {
    cors: true,  // または ['https://yourdomain.com']
    // 他の設定...
  },
  async (req, res) => {...}
);
```

---

## 今後の改善アクション

### 短期（1週間以内）

- [x] BUG-001〜004の修正完了
- [x] ドキュメント整備
- [x] CLAUDE.mdへの設定ルール追加
- [x] MT-001再テストで正常動作確認 ✅ 2025-12-05完了

### 中期（1ヶ月以内）

- [ ] ステージング環境の構築
- [ ] AI呼び出し含むE2Eテストの追加
- [ ] 本番デプロイ前チェックリストの策定

### 長期（継続的）

- [ ] Geminiリリースノートの定期確認（月次）
- [ ] パフォーマンスモニタリングの導入
- [ ] エラーアラートの設定（finishReason != STOP時）

---

## 関連ドキュメント

- [BUG-001: CORS修正](.kiro/bugfix-cors-cloud-functions-2025-12-05.md)
- [BUG-002: propertyOrdering修正](.kiro/bugfix-gemini-empty-response-2025-12-05.md)
- [BUG-003: MAX_TOKENS修正](.kiro/bugfix-gemini-thinking-tokens-2025-12-05.md)
- [BUG-004: タイムアウト修正](.kiro/bugfix-timeout-2025-12-05.md)
- [GitHub Pages: バグ修正記録](docs/index.html)

---

## 振り返りまとめ

> **今回の最大の学び**: 1つのバグ修正が次のバグを顕在化させる。適切なログを残すことで、連鎖バグの発見と修正が格段に早くなる。

> **開発プロセスへの反映**: 本番環境でのテストを「最終確認」ではなく「発見の機会」と位置づけ、十分なデバッグログと段階的なテストを心がける。
