# Phase 48: 連続勤務制約の動的生成 - 実装記録

**作成日**: 2025-12-08
**実装者**: Claude Opus 4.5
**関連Issue**: AI生成シフトで11件の連続勤務超過が発生

---

## 1. 概要

### 問題
Phase 47でパート職員制約を追加後、AI生成シフトで以下の問題が発生：
- 制約違反: 15件（SLA目標: 10件以下）
- 内訳: 人員不足4件、**連続勤務超過11件**
- 総合スコア: 5/100

### 根本原因分析（ドキュメントドリブン）

`.kiro/ai-production-quality-review-2025-12-08.md`の「動的制約生成の設計原則」と照合：

| 原則 | パート職員 | 時間帯希望 | 看護師配置 | 連続勤務 |
|-----|----------|----------|----------|---------|
| データ駆動型 | ✅ | ✅ | ✅ | ❌ 固定値 |
| 条件付き生成 | ✅ | ✅ | ✅ | ❌ 一律記載 |
| 明示的な警告 | ✅ | ✅ | ✅ | ❌ なし |
| 可読性重視 | ✅ | ✅ | ✅ | ❌ なし |

**結論**: 連続勤務制約だけが設計原則に従っていなかった。

### 解決策
`buildDynamicConsecutiveConstraints`関数を追加し、設計原則に準拠した動的制約生成を実装。

---

## 2. 実装内容

### 2.1 buildDynamicConsecutiveConstraints関数

**ファイル**: `functions/src/phased-generation.ts:165-212`

```typescript
/**
 * Phase 48: 連続勤務制約の動的生成
 *
 * 設計原則（ai-production-quality-review-2025-12-08.mdより）:
 * 1. データ駆動型: スタッフごとのmaxConsecutiveWorkDaysを参照
 * 2. 条件付き生成: 制限があるスタッフのみリスト化
 * 3. 明示的な警告: 違反時の無効化を明記
 * 4. 可読性重視: 具体的なスタッフ名をリスト化
 */
function buildDynamicConsecutiveConstraints(staffList: Staff[]): string {
  const DEFAULT_MAX_CONSECUTIVE = 5;

  // 連続勤務制限があるスタッフを抽出
  const restrictedStaff = staffList.filter(s => {
    const maxDays = s.maxConsecutiveWorkDays ?? DEFAULT_MAX_CONSECUTIVE;
    return maxDays < DEFAULT_MAX_CONSECUTIVE;
  });

  let constraints = `
## ⚠️ 【連続勤務制約】（厳守）
**基本ルール**: すべてのスタッフは連続勤務**最大${DEFAULT_MAX_CONSECUTIVE}日**までです。
6日以上連続で勤務させると、シフトが無効になります。

**推奨**: 休日を適切に分散させ、連続勤務は3〜4日に抑えることを推奨します。
`;

  // 個別制限があるスタッフがいる場合
  if (restrictedStaff.length > 0) {
    const individualConstraints = restrictedStaff.map(s => {
      const maxDays = s.maxConsecutiveWorkDays ?? DEFAULT_MAX_CONSECUTIVE;
      return `- ${s.name}: **最大${maxDays}日**まで`;
    }).join('\n');

    constraints += `
### 個別制限（より厳しい制限）
以下のスタッフは基本ルールより厳しい制限があります：
${individualConstraints}

**重要**: 上記スタッフの連続勤務を制限日数内に抑えてください。
`;
  }

  return constraints;
}
```

### 2.2 buildSkeletonPromptの更新

**変更箇所**: `functions/src/phased-generation.ts:402-409`

```typescript
// Before
4. 連続勤務は最大5日まで

// After
4. **連続勤務制限を厳守**（詳細は下記参照）
${buildDynamicConsecutiveConstraints(staffList)}
```

### 2.3 出力前チェックリストの強化

**変更箇所**: `functions/src/phased-generation.ts:427-432`

```typescript
# 出力前チェック
□ 全${staffList.length}名分の骨子があるか
□ 日曜日（${sundays.join(', ')}日）が全員のrestDaysに含まれているか
□ 各営業日に${totalStaffPerDay}名以上が勤務可能か
□ **連続勤務が5日を超えていないか**（休日が適切に分散されているか）  // ← 追加
□ パート職員が制限外の曜日に勤務していないか
```

---

## 3. 設計原則への準拠確認

### 動的制約生成の4原則チェック

| 原則 | 実装 | 説明 |
|-----|------|------|
| データ駆動型 | ✅ | `s.maxConsecutiveWorkDays`属性を参照 |
| 条件付き生成 | ✅ | 個別制限があるスタッフのみ追加セクションに表示 |
| 明示的な警告 | ✅ | 「6日以上で無効」を明記 |
| 可読性重視 | ✅ | 具体的なスタッフ名と制限日数をリスト化 |

---

## 4. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `functions/src/phased-generation.ts` | buildDynamicConsecutiveConstraints関数追加、buildSkeletonPrompt更新 |

---

## 5. 期待される効果

### Before（Phase 47後）
| 指標 | 値 |
|-----|---|
| 充足率 | 97% |
| 制約違反 | 15件（人員不足4件、連勤超過11件） |
| 総合スコア | 5/100 |

### After（Phase 48後）
| 指標 | 期待値 |
|-----|-------|
| 充足率 | 97%維持 |
| 制約違反 | 4-5件（連勤超過0件） |
| 総合スコア | 70-80/100 |

---

## 6. 生成されるプロンプト例

### 連続勤務制約セクション
```
## ⚠️ 【連続勤務制約】（厳守）
**基本ルール**: すべてのスタッフは連続勤務**最大5日**までです。
6日以上連続で勤務させると、シフトが無効になります。

**推奨**: 休日を適切に分散させ、連続勤務は3〜4日に抑えることを推奨します。
```

### 個別制限がある場合の追加表示
```
### 個別制限（より厳しい制限）
以下のスタッフは基本ルールより厳しい制限があります：
- 田中太郎: **最大3日**まで
- 佐藤花子: **最大4日**まで

**重要**: 上記スタッフの連続勤務を制限日数内に抑えてください。
```

---

## 7. 検証方法

### 本番環境でのテスト
1. デモログインでアクセス
2. シフト管理 → AI自動生成を実行
3. 評価パネルで以下を確認:
   - 連続勤務超過: 0件を期待
   - 制約違反合計: 10件以下を期待
   - 総合スコア: 70点以上を期待

### Cloud Functionsログで確認
```bash
gcloud functions logs read generateShift --region=asia-northeast1 --limit=50
```

確認ポイント:
- プロンプトに「⚠️ 【連続勤務制約】（厳守）」が含まれているか
- finishReason: 'STOP'（正常終了）

---

## 8. 動的制約の実装パターン（標準化）

Phase 44-48で確立された動的制約生成パターン:

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

  // 3. 個別制限があれば追加（条件付き生成）
  if (targetStaff.length > 0) {
    constraints += `
### 個別制限
${targetStaff.map(s => `- ${s.name}: ...`).join('\n')}
`;
  }

  return constraints;
}
```

### 実装済み動的制約一覧

| 関数名 | Phase | 役割 |
|-------|-------|------|
| `buildDynamicTimeSlotConstraints` | 44 | 時間帯希望（日勤のみ/夜勤のみ） |
| `buildDynamicNurseConstraints` | 44 | 看護師配置要件 |
| `buildDynamicPartTimeConstraints` | 47 | パート職員の曜日・日数制限 |
| `buildDynamicConsecutiveConstraints` | 48 | 連続勤務制限 |

---

## 9. 学び・振り返り

### 問題発見のプロセス
1. AI生成結果をSLA目標と照合
2. 制約違反の内訳を分析（連勤超過11件が主要問題）
3. ドキュメントの設計原則と既存実装を比較
4. 連続勤務制約だけが設計原則に従っていないことを発見

### 設計原則の有効性
- ドキュメント化された設計原則により、問題の根本原因を迅速に特定
- 既存パターンに従うことで、一貫性のある実装が可能

### 今後の注意点
- 新しい制約を追加する際は、必ず4原則をチェック
- 「静的な一文」ではなく「動的なセクション」として実装

---

## 10. 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| `.kiro/ai-production-quality-review-2025-12-08.md` | 設計原則の定義 |
| `.kiro/phase47-parttime-constraints-implementation-2025-12-08.md` | Phase 47実装記録 |
| `.kiro/HANDOFF-2025-12-08.md` | 引継ぎドキュメント |
| Serenaメモリ: `ai_production_quality_review_2025-12-08` | 品質レビューサマリー |

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
