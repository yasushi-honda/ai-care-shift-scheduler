# AI品質改善ガイド

**作成日**: 2025-12-08
**目的**: AIシフト生成の品質を継続的に改善するための専用ドキュメント

---

## 概要

このドキュメントは、LLMベースのシフト生成システムの品質を**ドキュメントドリブン**で改善するためのガイドです。

### 基本方針

```
テスト → 分析 → 改善 → テスト → ...
```

このサイクルを高速に回し、最善のAI品質を追求します。

---

## 動的制約生成パターン（確立済み）

### 4つの設計原則

| # | 原則 | 説明 | 例 |
|---|------|------|-----|
| 1 | **データ駆動型** | ハードコードせずスタッフデータから抽出 | `staffList.filter(...)` |
| 2 | **条件付き生成** | 該当者がいなければ空文字を返す | `if (staff.length === 0) return ''` |
| 3 | **明示的な警告** | 「違反したシフトは無効」と明記 | `⚠️ 【制約名】（厳守）` |
| 4 | **可読性重視** | 具体的なスタッフ名をリスト化 | `- 田中太郎: **最大3日**` |

### 実装テンプレート

```typescript
function buildDynamic[ConstraintName]Constraints(staffList: Staff[]): string {
  // 1. 該当スタッフを抽出（データ駆動型）
  const targetStaff = staffList.filter(s => /* 条件 */);

  // 2. 基本制約を記述
  let constraints = `
## ⚠️ 【制約名】（厳守）
基本ルール...

**重要**: この制約に違反したシフトは無効です。
`;

  // 3. 該当者がいなければ早期リターン（条件付き生成）
  if (targetStaff.length === 0) {
    return constraints;
  }

  // 4. 個別制限を追加（可読性重視）
  constraints += `
### 個別制限
${targetStaff.map(s => `- ${s.name}: ...`).join('\n')}
`;

  return constraints;
}
```

---

## 実装済み動的制約一覧

| Phase | 関数名 | 役割 | ファイル |
|-------|-------|------|---------|
| 44 | `buildDynamicTimeSlotConstraints` | 時間帯希望（日勤のみ/夜勤のみ） | phased-generation.ts |
| 44 | `buildDynamicNurseConstraints` | 看護師配置要件 | phased-generation.ts |
| 47 | `buildDynamicPartTimeConstraints` | パート職員の曜日・日数制限 | phased-generation.ts |
| 48 | `buildDynamicConsecutiveConstraints` | 連続勤務制限 | phased-generation.ts |
| 49 | `buildDynamicStaffingConstraints` | 日別必要勤務人数 | phased-generation.ts |
| 51 | `withExponentialBackoff` | 429エラーリトライ（指数バックオフ） | phased-generation.ts |
| 52 | `buildDailyAvailabilityAnalysis` | 日別勤務可能人数・リスク日特定 | phased-generation.ts |
| 52 | `buildShiftDistributionGuide` | シフト配置ガイド（早番・遅番候補者明示） | phased-generation.ts |
| 52 | `logPhase1Start/Complete` | Phase 1トレーサビリティログ | phased-generation.ts |
| 52 | `logPhase2BatchComplete` | Phase 2バッチトレーサビリティログ | phased-generation.ts |

---

## 品質目標（SLA）

| 指標 | 目標値 | 許容範囲 |
|-----|-------|---------|
| 人員充足率 | 100% | 95%以上 |
| 制約違反数 | 0件 | 10件以下 |
| 連続勤務超過 | 0件 | 0件 |
| 生成時間 | 3分以内 | 5分以内 |

---

## 問題分析フレームワーク

### 問題発生時のチェックリスト

1. **エラーの種類を特定**
   - [ ] 人員不足（どのシフト？どの日？）
   - [ ] 連続勤務超過
   - [ ] 時間帯希望違反
   - [ ] パート職員の曜日違反

2. **根本原因を分析**
   - [ ] プロンプトに制約が含まれているか？
   - [ ] AIが制約を理解しているか？（警告が明確か）
   - [ ] データに問題はないか？

3. **改善策を検討**
   - [ ] 既存の動的制約を強化？
   - [ ] 新しい動的制約を追加？
   - [ ] プロンプトの表現を変更？

---

## 改善履歴

### Phase 52（2025-12-08）
**問題1**: デモデータで充足率91%・エラー17件（人員不足）・スコア0点
**原因分析**:
1. Phase 1骨子で休日が偏り、一部の日に勤務者が不足
2. Phase 2で早番・遅番より日勤に偏る
3. 日別勤務可能人数の可視化不足（パート職員の曜日制限）

**解決**: 動的制約強化とトレーサビリティログを実装
- `buildDailyAvailabilityAnalysis`: 日別勤務可能人数を計算し不足リスク日を特定
- `buildShiftDistributionGuide`: シフト配置ガイドを動的生成（早番・遅番に配置可能なスタッフを明示）
- `buildDynamicStaffingConstraints`強化: 日別分析と個別スタッフ情報を統合
- トレーサビリティログ: `logPhase1Start/Complete`, `logPhase2BatchComplete`

**設計原則**:
- データ駆動型（ハードコードなし）
- 条件付き生成（該当者がいなければ空文字）
- 明示的な警告（違反は無効と明記）
- 可読性重視（具体的なスタッフ名をリスト化）

---

**問題2（BUG-017）**: JSONパースエラー - AIが拒否レスポンスを返却
**原因**: バッチプロンプトが「各営業日に5名配置せよ」を要求したが、バッチ2は2名しかいない
→ AIは「2名で5名は論理的に不可能」と判断し、JSONではなく日本語で拒否

**根本原因**: **設計時に最悪ケースの論理的整合性チェックを怠った**
```
思考シミュレーション不足:
- バッチサイズ: 2名（最悪ケース）
- プロンプト要件: 「5名/日配置」（絶対値）
→ 2名で5名は数学的に不可能 → 設計段階で検出すべきだった
```

**解決**:
1. `buildDetailedPrompt`を修正
   - バッチコンテキストを明記「全12名中の2名分」
   - 絶対値要件→比例配分の「目安」に変更
   - JSON出力形式を明示的に記載
2. **AIプロンプト設計チェックリスト**を作成（[詳細](ai-prompt-design-checklist.md)）

**教訓（今後の設計プロセスに追加）**:
1. プロンプト実装前に**思考シミュレーション**を実施
2. 最悪ケース（最小バッチ、最小人数）で要件が達成可能か確認
3. 「絶対に〇〇せよ」は避け、「目安として」「比例配分で」を使用
4. バッチ処理は「全体の一部」であることを必ず明記

**結果**: 検証中

---

**問題3（BUG-018）**: leaveRequests is not iterable
**原因**: `LeaveRequest`型はネストされたRecord型だが、配列としてイテレートしていた

```typescript
// LeaveRequest型定義（types.ts:33-37）
interface LeaveRequest {
  [staffId: string]: {
    [date: string]: LeaveType;
  };
}

// ❌ 間違い（476行目）
for (const leave of leaveRequests as Array<{...}>)

// ✅ 正しい
for (const [staffId, dateMap] of Object.entries(leaveRequests))
```

**根本原因**: **型定義を確認せずにコードを書いた**
- `as unknown as Array<...>` で強制キャストしていたが、実行時はRecord型のまま

**解決**:
1. `Object.entries()` を使用してRecord型を正しくイテレート
2. `typeof`でランタイム型チェックを追加
3. [BUG-018修正ドキュメント](bugfix-leave-requests-type-2025-12-08.md)

**教訓**:
1. 新しいコードを書く前に**型定義を必ず確認**
2. `as unknown as` は**危険信号** - 型キャストに頼らない
3. Record vs Array の区別を意識する

**結果**: 検証中

### Phase 51（2025-12-08）
**問題**: 429 (RESOURCE_EXHAUSTED) エラー発生
**原因**: Vertex AI APIのレート制限に達した（連続リクエスト時）
**解決**: `withExponentialBackoff`関数を追加
- 切り詰めた指数バックオフ（Truncated Exponential Backoff）を実装
- 最大3回リトライ、初期2秒、最大32秒待機
- ジッター（ランダム性）追加で衝突回避
- Phase 1骨子生成、Phase 2バッチ生成の両方をラップ
**結果**: 検証中

### Phase 50（2025-12-08）
**問題**: 人員不足77件（充足率21%）
**原因**: Phase 2で「休日以外の日にも休を出力」していた
**解決**: `buildDetailedPrompt`（デイサービス）を大幅改善
- 各スタッフの休日数・勤務日数を計算して表示
- 「休日以外の日に休を入れてはいけない」ルールを強調
- 日別配置要件の合計を明示
- チェックリストに「各日の合計勤務者数」を追加
- デバッグログ追加（シフト配分の内訳）
**結果**: 検証中

### Phase 49（2025-12-08）
**問題**: 人員不足14件（充足率92%）
**原因**: Phase 1骨子生成時に休日が偏り、一部の営業日で勤務者が不足
**解決**: `buildDynamicStaffingConstraints`関数を追加
- 各スタッフの月間勤務日数・休日数を表形式で明示
- 人員不足リスクのある日を警告表示
**結果**: Phase 2の問題が顕在化（→Phase 50で対応）

### Phase 48（2025-12-08）
**問題**: 連続勤務超過11件
**原因**: 「連続5日まで」が静的な一文だけで、AIが無視
**解決**: `buildDynamicConsecutiveConstraints`関数を追加
- 個別制限を名前付きでリスト化
- 「6日以上で無効」と明示
**結果**: 連続勤務超過0件を達成

### Phase 47（2025-12-08）
**問題**: パート職員の曜日制限違反
**原因**: 曜日制限がプロンプトに含まれていなかった
**解決**: `buildDynamicPartTimeConstraints`関数を追加
**結果**: 曜日制限違反0件を達成

---

## 次のステップ

### 短期（Phase 51以降）
- [x] 自動リトライ機構の追加（Phase 51で完了）
- [ ] Evalシステムの構築（複数テストケース自動実行）

### 中期
- [ ] ハイブリッドアプローチの検討（LLM + 制約ソルバー）
- [ ] A/Bテスト基盤の構築

### 長期
- [ ] シフトデータの蓄積・分析
- [ ] Fine-tuningの検討

---

## 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md) - プロジェクトルール
- [ai-production-quality-review-2025-12-08.md](./ai-production-quality-review-2025-12-08.md) - 品質レビュー
- [phased-generation.ts](../functions/src/phased-generation.ts) - 実装コード

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
