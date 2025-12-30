# AI Generation Flow - AIシフト生成フロー

## 概要

Phase 55時点のAI生成処理の詳細フローを示します。

## 1. 全体フロー図

```mermaid
flowchart TD
    A[クライアント<br/>React App] -->|POST /generateShift| B[Cloud Function<br/>generateShift]

    B --> C{スタッフ数チェック}
    C -->|≤5名| D[小規模生成<br/>Single API Call]
    C -->|>5名| E[段階的生成<br/>Phased Generation]

    D --> F[Gemini 2.5 Pro<br/>一括生成]

    E --> G[Phase 1: 骨子生成<br/>generateSkeleton]
    G --> H[Gemini 2.5 Pro<br/>休日・夜勤パターン]
    H --> I[バリデーション<br/>validateSkeletonOutput]
    I --> J{有効?}
    J -->|No| K[自動修正<br/>autoFixSkeleton]
    K --> I
    J -->|Yes| L[Phase 2: 詳細生成<br/>generateDetailedShifts]

    L --> M[バッチ処理<br/>5名ずつ]
    M --> N[Gemini 2.5 Pro<br/>シフト種別割当]
    N --> O{全バッチ完了?}
    O -->|No| M
    O -->|Yes| P[形式変換<br/>monthlyShifts形式]

    F --> Q[評価処理<br/>EvaluationService]
    P --> Q

    Q --> R[4段階評価<br/>制約違反検出]
    R --> S[根本原因分析<br/>rootCauseAnalysis]
    S --> T[レスポンス生成]

    T -->|JSON| A
```

## 2. モデル選択フロー

```mermaid
flowchart TD
    A[generateWithFallback] --> B{プライマリモデル<br/>gemini-2.5-pro}
    B -->|成功| C[レスポンス返却]
    B -->|失敗/空レスポンス| D[フォールバック<br/>gemini-2.5-pro]
    D -->|成功| C
    D -->|失敗| E[エラー<br/>両モデル失敗]

    subgraph retry["リトライ (withExponentialBackoff)"]
        F[初回試行] --> G{成功?}
        G -->|No| H[待機<br/>backoff × multiplier]
        H --> I[再試行<br/>max 3回]
        I --> G
        G -->|Yes| J[結果返却]
    end

    B --> retry
    D --> retry
```

## 3. Phase 1: 骨子生成 詳細

```mermaid
sequenceDiagram
    participant C as generateSkeleton
    participant A as buildDailyAvailabilityAnalysis
    participant P as buildSkeletonPrompt
    participant G as Gemini 2.5 Pro
    participant V as Validation

    C->>A: 日別分析実行
    A-->>C: riskDays, businessDays

    C->>P: プロンプト構築
    Note right of P: 動的制約生成<br/>- 連勤制限<br/>- パートタイム考慮<br/>- 人員配置要件
    P-->>C: JSONプロンプト

    C->>G: generateWithFallback
    G-->>C: staffSchedules[]

    C->>V: validateSkeletonOutput
    V-->>C: isValid, errors

    alt 無効な場合
        C->>C: autoFixSkeleton
        C->>V: 再バリデーション
    end

    C-->>C: logPhase1Complete
```

## 4. Phase 2: 詳細生成 詳細

```mermaid
sequenceDiagram
    participant D as generateDetailedShifts
    participant V as validatePhase2Input
    participant P as buildDetailedPrompt
    participant G as Gemini 2.5 Pro
    participant L as Logging

    D->>V: Phase2入力検証
    V-->>D: isValid, warnings

    loop 5名ずつバッチ処理
        D->>P: バッチ用プロンプト
        Note right of P: 骨子の休日を参照<br/>日勤シフト種別を割当
        P-->>D: JSONプロンプト

        D->>G: generateWithFallback
        G-->>D: schedule[]

        D->>L: logPhase2BatchComplete
    end

    D->>D: 形式変換 (shifts → monthlyShifts)
```

## 5. 評価フロー

```mermaid
flowchart TD
    A[EvaluationService<br/>evaluateSchedule] --> B[基本メトリクス計算]
    B --> C[制約違反検出]

    subgraph violations["制約違反検出"]
        C --> D1[staffShortage<br/>人員不足]
        C --> D2[consecutiveWork<br/>連勤超過]
        C --> D3[nightRestViolation<br/>夜勤後休息不足]
        C --> D4[qualificationMissing<br/>資格要件未充足]
        C --> D5[leaveRequestIgnored<br/>休暇希望未反映]
    end

    D1 & D2 & D3 & D4 & D5 --> E[制約レベル判定]

    subgraph levels["4段階評価"]
        E --> L1["Level 1: 絶対必須<br/>労基法違反 → 即0点"]
        E --> L2["Level 2: 運営必須<br/>人員不足 → -12点/件"]
        E --> L3["Level 3: 努力目標<br/>希望休 → -4点/件"]
        E --> L4["Level 4: 推奨<br/>減点なし"]
    end

    L1 & L2 & L3 & L4 --> F[スコア計算<br/>100点満点]
    F --> G[根本原因分析<br/>analyzeRootCauses]
    G --> H[AIEvaluationResult]
```

## 6. 現状の問題点と安定性リスク

### 6.1 モデル冗長性（重大）
```
問題: GENERATION_CONFIGS の primary/fallback が同じモデル（gemini-2.5-pro）
影響: 実質的なフォールバック効果なし
      モデル固有の障害時に両方失敗

推奨: 異なるモデルファミリーを組み合わせ
      例: primary=gemini-2.5-pro, fallback=gemini-2.0-flash
```

### 6.2 JSON パース不安定性（重大）
```
問題: AIレスポンスのJSON形式が不安定
根拠: parseGeminiJsonResponse に多数のワークアラウンド
  - Markdownコードブロック抽出
  - トレーリングカンマ削除
  - JSONコメント削除
  - シングルクォート変換

影響: 予測不能なパースエラー
      BUG-014, BUG-022 などの過去事例
```

### 6.3 処理時間のばらつき
```
実測値:
- 小規模（≤5名）: 30-60秒
- 大規模（>5名）: 90-400秒（バッチ数に比例）
- 評価処理: 数百ミリ秒

問題: 400秒はCloud Functionsのタイムアウト（540秒）に近い
```

### 6.4 レート制限（429エラー）
```
問題: 連続API呼び出しで429エラー発生
対策: withExponentialBackoff（最大3回リトライ）
不足: 3回で解消しない場合の救済策なし
```

### 6.5 データ整合性警告の無視
```
コード箇所: phased-generation.ts:1431
問題: Phase 2入力バリデーション失敗時も処理続行
  「処理を続行しますが、品質に影響する可能性があります」

影響: 低品質シフトが生成される可能性
```

### 6.6 両モデル失敗時のハンドリング
```
コード箇所: phased-generation.ts:185
throw new Error(`${operationName}: 両モデルとも空レスポンス`);

問題: 同一モデルのため「両モデル」が機能しない
```

## 7. 改善提案

### 7.1 短期対策
1. **フォールバックモデル変更**: gemini-2.0-flash を fallback に設定
2. **リトライ回数増加**: maxRetries: 3 → 5
3. **バリデーション失敗時の停止**: 継続せずエラー返却

### 7.2 中期対策
1. **構造化出力の活用**: Gemini API の JSON Mode 安定版待ち
2. **処理分割**: 大規模シフトを非同期ジョブ化
3. **キャッシュ戦略**: 類似リクエストのキャッシュ

### 7.3 長期対策
1. **ファインチューニング**: 施設固有のパターン学習
2. **ハイブリッドアプローチ**: AI生成 + 制約ソルバー

## 8. ファイル構成

| ファイル | 役割 |
|---------|------|
| `functions/src/shift-generation.ts` | エントリーポイント（Cloud Function） |
| `functions/src/phased-generation.ts` | Phase 1/2 生成ロジック |
| `functions/src/ai-model-config.ts` | モデル設定、GENERATION_CONFIGS |
| `functions/src/evaluation/evaluationLogic.ts` | 評価サービス（1186行） |
| `functions/src/evaluation/constraintLevelMapping.ts` | 制約レベル設定 |
| `functions/src/evaluation/rootCauseAnalysis.ts` | 根本原因分析 |

## 9. API仕様

### リクエスト
```json
POST /generateShift
{
  "staffList": [...],
  "requirements": {
    "targetMonth": "2025-01",
    "timeSlots": [...],
    "requirements": {...}
  },
  "leaveRequests": {...}
}
```

### レスポンス
```json
{
  "success": true,
  "schedule": [...],
  "evaluation": {
    "overallScore": 85,
    "fulfillmentRate": 90,
    "constraintViolations": [...],
    "recommendations": [...],
    "simulation": {...},
    "rootCauseAnalysis": {...}
  },
  "metadata": {
    "generatedAt": "...",
    "model": "gemini-2.5-pro",
    "tokensUsed": 12345
  }
}
```

---

**最終更新**: 2025-12-30
