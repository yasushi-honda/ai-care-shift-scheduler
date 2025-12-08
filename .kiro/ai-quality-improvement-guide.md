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
