# AI処理パイプライン アーキテクチャ図

**作成日**: 2025-12-08
**関連ドキュメント**: [ai-production-quality-review-2025-12-08.md](./ai-production-quality-review-2025-12-08.md)

---

## 1. 全体アーキテクチャ

```mermaid
graph TB
    subgraph "フロントエンド"
        A[React SPA<br/>ShiftManagement.tsx]
        B[geminiService.ts]
    end

    subgraph "Cloud Functions"
        C[generateShift<br/>エントリーポイント]
        D{スタッフ数<br/>判定}
        E[shift-generation.ts<br/>一括生成]
        F[phased-generation.ts<br/>2段階生成]
    end

    subgraph "AI生成エンジン"
        G[Phase 1: 骨子生成<br/>generateSkeleton]
        H[Phase 2: 詳細生成<br/>generateDetailedShifts]
        I[バッチ処理<br/>10名/バッチ]
    end

    subgraph "評価システム"
        J[EvaluationService<br/>evaluateSchedule]
        K[制約違反チェック<br/>6種類]
        L[数学的分析<br/>analyzeStaffConstraints]
    end

    subgraph "外部サービス"
        M[Vertex AI<br/>Gemini 2.5 Flash]
        N[Firestore<br/>schedules]
    end

    A -->|API Call| B
    B -->|HTTPS| C
    C --> D
    D -->|5名以下| E
    D -->|6名以上| F
    E --> M
    F --> G
    G --> M
    G --> H
    H --> I
    I --> M
    E --> J
    F --> J
    J --> K
    J --> L
    J --> N
    K --> N
    L --> N
```

---

## 2. 2段階生成パイプライン詳細

```mermaid
sequenceDiagram
    participant Client as フロントエンド
    participant CF as Cloud Function
    participant P1 as Phase 1 (骨子)
    participant P2 as Phase 2 (詳細)
    participant Gemini as Vertex AI
    participant Eval as EvaluationService
    participant FS as Firestore

    Client->>+CF: generateShift(staffList, requirements)
    CF->>CF: スタッフ数判定

    alt 6名以上
        CF->>+P1: generateSkeleton()
        P1->>P1: buildSkeletonPrompt()
        P1->>P1: buildDynamicPartTimeConstraints()
        P1->>+Gemini: 骨子生成リクエスト
        Gemini-->>-P1: ScheduleSkeleton
        P1-->>-CF: 全スタッフの月間パターン

        loop 10名ごとのバッチ
            CF->>+P2: generateDetailedShifts(batch)
            P2->>P2: buildDetailedPrompt()
            P2->>+Gemini: 詳細生成リクエスト
            Gemini-->>-P2: DetailedShifts
            P2-->>-CF: バッチ結果
        end
    else 5名以下
        CF->>+Gemini: 一括生成リクエスト
        Gemini-->>-CF: 完全なシフト
    end

    CF->>+Eval: evaluateSchedule(shifts)
    Eval->>Eval: checkStaffShortage()
    Eval->>Eval: checkConsecutiveWorkViolation()
    Eval->>Eval: checkNightRestViolation()
    Eval->>Eval: checkQualificationMissing()
    Eval->>Eval: checkLeaveRequestIgnored()
    Eval->>Eval: checkTimeSlotPreferenceViolation()
    Eval->>Eval: analyzeStaffConstraints()
    Eval->>Eval: generateAIComment()
    Eval-->>-CF: AIEvaluationResult

    CF->>FS: 保存（任意）
    CF-->>-Client: shifts + evaluation
```

---

## 3. 動的制約生成フロー

```mermaid
flowchart TD
    subgraph "入力データ"
        A[staffList<br/>スタッフ一覧]
        B[requirements<br/>シフト要件]
    end

    subgraph "動的制約生成"
        C[buildDynamicTimeSlotConstraints]
        D[buildDynamicNurseConstraints]
        E[buildDynamicPartTimeConstraints]
    end

    subgraph "フィルタリング"
        C1[日勤のみ<br/>スタッフ抽出]
        C2[夜勤のみ<br/>スタッフ抽出]
        D1[看護師資格<br/>保持者抽出]
        D2[資格要件<br/>チェック]
        E1[週3日以下<br/>希望者抽出]
        E2[曜日制限<br/>スタッフ抽出]
    end

    subgraph "プロンプト生成"
        F[時間帯制約<br/>プロンプト]
        G[看護師配置<br/>プロンプト]
        H[パート職員<br/>プロンプト]
    end

    subgraph "統合"
        I[buildSkeletonPrompt<br/>or buildShiftPrompt]
        J[Gemini API<br/>リクエスト]
    end

    A --> C
    A --> D
    A --> E
    B --> D

    C --> C1
    C --> C2
    D --> D1
    D --> D2
    E --> E1
    E --> E2

    C1 --> F
    C2 --> F
    D1 --> G
    D2 --> G
    E1 --> H
    E2 --> H

    F --> I
    G --> I
    H --> I
    I --> J
```

---

## 4. 評価システムの構成

```mermaid
classDiagram
    class EvaluationService {
        +evaluateSchedule(input: EvaluationInput): AIEvaluationResult
        -checkStaffShortage(schedule, requirements): ConstraintViolation[]
        -checkConsecutiveWorkViolation(schedule, staffList): ConstraintViolation[]
        -checkNightRestViolation(schedule): ConstraintViolation[]
        -checkQualificationMissing(schedule, staffList, requirements): ConstraintViolation[]
        -checkLeaveRequestIgnored(schedule, leaveRequests): ConstraintViolation[]
        -checkTimeSlotPreferenceViolation(schedule, staffList): ConstraintViolation[]
        -analyzeStaffConstraints(staffList, requirements): ConstraintAnalysis
        -calculateOverallScore(violations): number
        -calculateFulfillmentRate(schedule, requirements): number
        -generateRecommendations(violations, input): Recommendation[]
        -generateAIComment(score, rate, violations, recommendations): string
    }

    class EvaluationInput {
        +schedule: Schedule
        +staffList: Staff[]
        +requirements: ShiftRequirement
        +leaveRequests: LeaveRequest
    }

    class AIEvaluationResult {
        +overallScore: number
        +fulfillmentRate: number
        +constraintViolations: ConstraintViolation[]
        +recommendations: Recommendation[]
        +simulation: SimulationResult
        +aiComment: string
        +constraintAnalysis: ConstraintAnalysis
    }

    class ConstraintViolation {
        +type: string
        +severity: 'critical' | 'high' | 'medium' | 'low'
        +message: string
        +affectedStaff?: string[]
        +affectedDays?: number[]
    }

    class ConstraintAnalysis {
        +totalStaff: number
        +businessDays: number
        +totalSupplyPersonDays: number
        +totalRequiredPersonDays: number
        +isFeasible: boolean
        +infeasibilityReasons: string[]
        +suggestions: string[]
    }

    EvaluationService --> EvaluationInput
    EvaluationService --> AIEvaluationResult
    AIEvaluationResult --> ConstraintViolation
    AIEvaluationResult --> ConstraintAnalysis
```

---

## 5. タイムライン（開発履歴）

```mermaid
timeline
    title AI処理パイプライン 開発履歴

    section Phase 44 (2025-12-07)
        動的制約生成 : buildDynamicTimeSlotConstraints
                     : buildDynamicNurseConstraints
        評価強化 : analyzeStaffConstraints
               : checkTimeSlotPreferenceViolation

    section Phase 46 (2025-12-08)
        バグ修正 : BUG-008 thinkingBudget
                : BUG-009 権限同期
                : BUG-010 タイムアウト延長

    section Phase 47 (2025-12-08)
        パート職員対応 : buildDynamicPartTimeConstraints
                      : availableWeekdays情報追加
        品質改善 : 充足率 73% → 98% 回復見込み
```

---

## 6. スケーラビリティ対応

```mermaid
graph TD
    subgraph "スタッフ数による分岐"
        A[スタッフ数]
        B{判定}
        C[1-5名<br/>一括生成]
        D[6-15名<br/>2段階生成]
        E[16名以上<br/>要検討]
    end

    subgraph "一括生成"
        C --> C1[shift-generation.ts]
        C1 --> C2[1回のAPI呼び出し]
        C2 --> C3[処理時間: 60-90秒]
    end

    subgraph "2段階生成"
        D --> D1[Phase 1: 骨子]
        D1 --> D2[Phase 2: 詳細×N]
        D2 --> D3[バッチ: 10名/回]
        D3 --> D4[処理時間: 90-240秒]
    end

    subgraph "未対応領域"
        E --> E1[週単位分割?]
        E1 --> E2[並列処理?]
        E2 --> E3[検討中]
    end

    A --> B
    B -->|5以下| C
    B -->|6-15| D
    B -->|16以上| E
```

---

## 7. エラーハンドリングフロー

```mermaid
flowchart TD
    A[generateShift 開始] --> B{API呼び出し}

    B -->|成功| C{finishReason?}
    B -->|失敗| D[エラーログ出力]

    C -->|STOP| E[正常完了]
    C -->|MAX_TOKENS| F[トークン不足エラー]
    C -->|SAFETY| G[安全性フィルタエラー]

    E --> H{充足率チェック}
    H -->|95%以上| I[品質OK]
    H -->|95%未満| J[警告ログ出力]

    J --> K[改善提案生成]
    K --> L[AIコメント生成]

    F --> M[maxOutputTokens調整を提案]
    G --> N[プロンプト見直しを提案]
    D --> O[リトライなし<br/>エラー返却]

    I --> P[結果返却]
    L --> P

    style F fill:#ff6b6b
    style G fill:#ff6b6b
    style D fill:#ff6b6b
    style O fill:#ffd93d
```

---

## 8. 品質評価サマリー

```mermaid
pie showData
    title 評価項目別スコア
    "動的制約生成" : 5
    "柔軟性・拡張性" : 4
    "安定性" : 4
    "エラーハンドリング" : 3
    "可観測性" : 5
    "スケーラビリティ" : 4
```

---

**作成者**: Claude Opus 4.5
**最終更新**: 2025-12-08
