# 実装前テストチェックリスト

**作成日**: 2025-12-08
**目的**: 本番環境エラーを防ぐため、実装・デプロイ前に必ず確認する項目

---

## 概要

BUG-017（JSONパースエラー）とBUG-018（leaveRequests型エラー）から学んだ教訓に基づき、
本番テスト前に必ず実施すべきチェック項目をまとめる。

**原則**: 「本番環境で初めてエラーを発見する」状況を絶対に避ける

---

## 1. 型安全性チェック（BUG-018対策）

### 1.1 型定義確認

新しいコードを書く前に、使用するすべての型を確認する。

```bash
# 型定義ファイルを確認
cat functions/src/types.ts | grep -A 10 "interface TypeName"
```

| チェック項目 | 確認方法 |
|------------|---------|
| 型がArray（配列）かRecord（オブジェクト）か | 型定義の構文を確認 |
| ネストされた型の構造 | インデックスシグネチャを確認 |
| オプショナル（?）の有無 | プロパティ名の後を確認 |

### 1.2 イテレーション方法の選択

| データ型 | 正しいイテレーション |
|---------|---------------------|
| `Array<T>` | `for (const item of array)` |
| `Record<K, V>` | `for (const [key, value] of Object.entries(record))` |
| `Map<K, V>` | `for (const [key, value] of map)` |
| `Set<T>` | `for (const item of set)` |

### 1.3 危険な型キャストの回避

```typescript
// ❌ 危険信号 - 絶対に避ける
data as unknown as Array<T>
(data as any).forEach(...)

// ✅ 安全な方法
if (Array.isArray(data)) { ... }
for (const [key, value] of Object.entries(data)) { ... }
```

---

## 2. 論理的整合性チェック（BUG-017対策）

### 2.1 思考シミュレーション

新しいAIプロンプトや制約を実装する前に、最悪ケースを想定：

```
思考シミュレーション:
1. 最小入力は何か？（例: バッチサイズ=2名）
2. 最大要件は何か？（例: 5名/日配置）
3. 最小入力で最大要件は達成可能か？
4. 達成不可能な場合、AIはどう反応するか？
```

### 2.2 数値の整合性

| チェック項目 | 確認方法 |
|------------|---------|
| ゼロ除算の可能性 | 分母が0になりうるケースを列挙 |
| 端数処理の影響 | Math.floor/ceil/roundの結果が0になるケース |
| バッチサイズ vs 要件 | 最小バッチでも要件が数学的に達成可能か |

---

## 3. ローカルテスト実施（必須）

### 3.1 TypeScript型チェック

```bash
# functions ディレクトリで型チェック
cd functions && npx tsc --noEmit
```

**合格基準**: エラー0件（警告は許容）

### 3.2 ユニットテスト

```bash
# ユニットテスト実行
npm test -- --run
```

**合格基準**: すべてのテスト通過

### 3.3 新規関数のテスト作成

新しい関数を追加した場合、以下のテストを必ず作成：

| テスト種別 | 目的 |
|-----------|------|
| 正常ケース | 期待通りの入力で期待通りの出力 |
| 空入力 | `null`, `undefined`, `[]`, `{}` |
| 境界値 | 最小値、最大値、ゼロ |
| 型エラーケース | 間違った型が渡された場合 |

---

## 4. CodeRabbitレビュー（必須）

```bash
# デプロイ前に必ず実行
coderabbit review --plain --base-commit HEAD~1 --config CLAUDE.md
```

**合格基準**: レビュー通過（重大な指摘なし）

---

## 5. Cloud Functions統合テスト

### 5.1 ローカルエミュレータテスト

```bash
# Firebase Emulatorで関数をテスト
firebase emulators:start --only functions
```

### 5.2 実データでのテスト（デモ環境）

デプロイ後、本番環境ではなくデモ環境で最初にテスト：
1. デモログインでログイン
2. AI生成を実行
3. Cloud Functionsログを確認

```bash
# Cloud Functionsログ確認
gcloud functions logs read generateShift --region=asia-northeast1 --limit=20
```

---

## 6. チェックリストサマリー

### デプロイ前の必須チェック

- [ ] **型定義を確認**したか？（types.ts を読んだか）
- [ ] **`as unknown as`** を使っていないか？
- [ ] **思考シミュレーション**を実施したか？（最悪ケース検証）
- [ ] **TypeScript型チェック**通過したか？（`npx tsc --noEmit`）
- [ ] **ユニットテスト**すべて通過したか？（`npm test`）
- [ ] **CodeRabbitレビュー**通過したか？
- [ ] **新規関数のテスト**を作成したか？

### デプロイ後の必須チェック

- [ ] **デモ環境**で動作確認したか？
- [ ] **Cloud Functionsログ**でエラーがないか？
- [ ] **関数デプロイ成功**を確認したか？（`gcloud functions list`）

---

## 7. 関連ドキュメント

- [BUG-017修正記録](.kiro/bugfix-batch-prompt-json-2025-12-08.md)
- [BUG-018修正記録](.kiro/bugfix-leave-requests-type-2025-12-08.md)
- [AIプロンプト設計チェックリスト](.kiro/ai-prompt-design-checklist.md)
- [CLAUDE.md](../CLAUDE.md)

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
