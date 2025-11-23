# Phase 25: コンプライアンスチェックフロー

**作成日**: 2025-11-20
**目的**: 人員配置基準、常勤換算、労基法チェックのロジックを視覚化する

---

## 全体フロー

```mermaid
flowchart TB
    A[スケジュールデータ取得] --> B[コンプライアンスチェック開始]

    B --> C[人員配置基準チェック]
    B --> D[常勤換算計算]
    B --> E[労基法チェック]

    C --> F{基準達成?}
    F -->|YES| G[🟢 人員配置基準: OK]
    F -->|NO| H[🔴 人員配置基準: NG]

    D --> I{常勤換算基準達成?}
    I -->|YES| J[🟢 常勤換算: OK]
    I -->|NO| K[🔴 常勤換算: NG]

    E --> L{労基法違反あり?}
    L -->|NO| M[🟢 労基法: OK]
    L -->|YES| N[🟡 労基法: 警告]

    G --> O[結果サマリー生成]
    H --> O
    J --> O
    K --> O
    M --> O
    N --> O

    O --> P{すべてOK?}
    P -->|YES| Q[ダッシュボードに緑バッジ表示]
    P -->|NO| R[ダッシュボードに警告バッジ表示]

    R --> S[詳細モーダル表示可能]
```

---

## 人員配置基準チェック詳細

### 3:1配置基準の場合

```mermaid
flowchart TD
    A[日付ごとにループ] --> B[その日の勤務スタッフ数を計算]

    B --> C{シフトタイプ}
    C -->|'休'| D[カウントしない]
    C -->|その他| E[カウント++]

    E --> F[actualStaff = カウント]
    D --> F

    F --> G[利用者数を取得<br/>例: 30人]
    G --> H[配置基準から必要人員を計算<br/>3:1の場合: 30 ÷ 3 = 10人]

    H --> I[充足率を計算<br/>actualStaff / requiredStaff × 100]

    I --> J{充足率 >= 100%?}
    J -->|YES| K[passed: true<br/>🟢 基準達成]
    J -->|NO| L[passed: false<br/>🔴 基準未達成]

    K --> M[次の日付へ]
    L --> M

    M --> N{すべての日をチェック完了?}
    N -->|NO| A
    N -->|YES| O[結果リスト返却]
```

### 固定人数配置基準の場合

```mermaid
flowchart TD
    A[日付ごとにループ] --> B[その日の勤務スタッフ数を計算]
    B --> C[requiredStaff = 固定人数<br/>例: 5人]
    C --> D{actualStaff >= requiredStaff?}
    D -->|YES| E[passed: true]
    D -->|NO| F[passed: false]
    E --> G[次の日付へ]
    F --> G
```

### データ構造

```typescript
interface StaffingCheckResult {
  date: string;            // "2025-11-01"
  requiredStaff: number;   // 10（必要人員数）
  actualStaff: number;     // 8（実際の人員数）
  fulfillmentRate: number; // 80（充足率%）
  passed: boolean;         // false（基準未達成）
}
```

---

## 常勤換算計算詳細

```mermaid
flowchart TD
    A[スタッフごとにループ] --> B[月間実績勤務時間を計算]

    B --> C[日付ごとにループ]
    C --> D{actualStartTime && actualEndTime?}
    D -->|NO| E[この日はスキップ]
    D -->|YES| F[勤務時間を計算]

    F --> G[startMinutes = HH:mm → 分に変換]
    F --> H[endMinutes = HH:mm → 分に変換]
    F --> I[breakMinutes = 休憩時間]

    G --> J[workMinutes = endMinutes - startMinutes - breakMinutes]
    J --> K[workHours = workMinutes / 60]

    K --> L[totalWorkHours += workHours]
    E --> L

    L --> M{すべての日をチェック完了?}
    M -->|NO| C
    M -->|YES| N[standardWeeklyHours = 週所定労働時間<br/>例: 40時間]

    N --> O[月の週数 = 4.33<br/>平均的な月は約4.33週]

    O --> P[fte = totalWorkHours / standardWeeklyHours × 4.33]

    P --> Q[結果を返却]
```

### 計算例

**スタッフA**:
- 月間実績勤務時間: 160時間
- 週所定労働時間: 40時間
- 常勤換算値: 160 / (40 × 4.33) = **0.92**

**スタッフB**:
- 月間実績勤務時間: 80時間
- 週所定労働時間: 40時間
- 常勤換算値: 80 / (40 × 4.33) = **0.46**

**事業所全体**:
- 常勤換算値合計: 0.92 + 0.46 = **1.38**

### データ構造

```typescript
interface FullTimeEquivalentResult {
  staffId: string;           // "staff_001"
  staffName: string;         // "田中太郎"
  totalWorkHours: number;    // 160（月間実績勤務時間）
  standardWeeklyHours: number;  // 40（週所定労働時間）
  fte: number;               // 0.92（常勤換算値）
}
```

---

## 労基法チェック詳細

### 休憩時間チェック

```mermaid
flowchart TD
    A[スタッフごとにループ] --> B[日付ごとにループ]

    B --> C{actualStartTime && actualEndTime?}
    C -->|NO| D[この日はスキップ]
    C -->|YES| E[勤務時間を計算]

    E --> F[workHours = calculateWorkHours<br/>startTime, endTime, breakMinutes]

    F --> G{workHours > 8時間?}
    G -->|YES| H{breakMinutes >= 60?}
    H -->|NO| I[🔴 違反: 8時間超は60分休憩必要]
    H -->|YES| J[OK]

    G -->|NO| K{workHours > 6時間?}
    K -->|YES| L{breakMinutes >= 45?}
    L -->|NO| M[🔴 違反: 6時間超は45分休憩必要]
    L -->|YES| J

    K -->|NO| J

    I --> N[violations配列に追加]
    M --> N
    J --> O[次の日付へ]
    D --> O
    N --> O

    O --> P{すべての日をチェック完了?}
    P -->|NO| B
    P -->|YES| Q{すべてのスタッフをチェック完了?}
    Q -->|NO| A
    Q -->|YES| R[violations配列を返却]
```

### 連続勤務制限チェック（既存機能を活用）

```mermaid
flowchart TD
    A[スタッフごとにループ] --> B[連続勤務日数をカウント]

    B --> C[日付ごとにループ]
    C --> D{シフトタイプ}
    D -->|'休'| E[連続勤務日数リセット]
    D -->|その他| F[連続勤務日数++]

    F --> G{連続勤務日数 > maxConsecutiveDays?}
    G -->|YES| H[🔴 違反: 連続勤務制限超過]
    G -->|NO| I[OK]

    H --> J[violations配列に追加]
    E --> K[次の日付へ]
    I --> K
    J --> K

    K --> L{すべての日をチェック完了?}
    L -->|NO| C
    L -->|YES| M[次のスタッフへ]
```

### 勤務間インターバルチェック（既存機能を活用）

```mermaid
flowchart TD
    A[スタッフごとにループ] --> B[日付ごとにループ]

    B --> C[前日のactualEndTimeを取得]
    C --> D[当日のactualStartTimeを取得]

    D --> E{前日・当日両方あり?}
    E -->|NO| F[スキップ]
    E -->|YES| G[インターバル時間を計算<br/>当日開始 - 前日終了]

    G --> H{インターバル < 8時間?}
    H -->|YES| I[🔴 違反: 勤務間インターバル不足]
    H -->|NO| J[OK]

    I --> K[violations配列に追加]
    F --> L[次の日付へ]
    J --> L
    K --> L

    L --> M{すべての日をチェック完了?}
    M -->|NO| B
    M -->|YES| N[次のスタッフへ]
```

### データ構造

```typescript
interface LaborLawCheckResult {
  staffId: string;                    // "staff_001"
  staffName: string;                  // "田中太郎"
  date: string;                       // "2025-11-05"
  violationType: 'break' | 'consecutive' | 'interval';
  message: string;                    // "8時間超の勤務には60分以上の休憩が必要です"
}
```

---

## 結果表示フロー

```mermaid
flowchart TB
    A[コンプライアンスチェック結果取得] --> B[結果サマリー生成]

    B --> C{人員配置基準}
    C -->|すべて達成| D[🟢 人員配置基準: 基準達成]
    C -->|一部未達成| E[🔴 人員配置基準: 未達成 3日間]

    B --> F{常勤換算}
    F -->|基準達成| G[🟢 常勤換算: 基準達成]
    F -->|基準未達成| H[🔴 常勤換算: 基準未達成]

    B --> I{労基法}
    I -->|違反なし| J[🟢 労基法: 問題なし]
    I -->|違反あり| K[🟡 労基法: 警告あり 2件]

    D --> L[ダッシュボードに表示]
    E --> L
    G --> L
    H --> L
    J --> L
    K --> L

    L --> M{ユーザーが詳細ボタンクリック}
    M -->|YES| N[ComplianceDetailModal表示]

    N --> O[違反日リスト表示]
    N --> P[違反内容詳細表示]
    N --> Q[改善提案表示]

    O --> R[例: 2025-11-05 充足率 90%]
    P --> R
    Q --> S[例: スタッフAの出勤を調整してください]
```

---

## Excel/PDF出力時の警告表示

```mermaid
flowchart TD
    A[Excel/PDF出力ボタンクリック] --> B[コンプライアンスチェック実行]

    B --> C{違反あり?}
    C -->|NO| D[通常の出力処理]
    C -->|YES| E[警告ダイアログ表示]

    E --> F["⚠️ 以下のコンプライアンス違反があります:<br/>- 人員配置基準未達成: 3日間<br/>- 労基法違反: 2件<br/><br/>このままエクスポートしますか？"]

    F --> G{ユーザーの選択}
    G -->|キャンセル| H[出力中止]
    G -->|続行| I[警告マーク付きで出力]

    I --> J[Excelシートに警告セクション追加]
    J --> K["## ⚠️ コンプライアンス警告<br/>- 2025-11-05: 人員配置基準未達成<br/>- 2025-11-12: 労基法違反（休憩時間不足）"]

    D --> L[通常の出力完了]
    K --> L
```

---

## AIシフト生成後のバリデーションフロー

```mermaid
flowchart TD
    A[AIシフト生成完了] --> B[Firestoreに保存]
    B --> C[クライアント側で取得]

    C --> D[コンプライアンスチェック実行]
    D --> E[checkStaffingStandard]
    D --> F[calculateFullTimeEquivalent]
    D --> G[checkLaborLaw]

    E --> H[結果を集約]
    F --> H
    G --> H

    H --> I{違反あり?}
    I -->|NO| J[🟢 シフト生成成功<br/>トースト通知表示]
    I -->|YES| K[⚠️ 再生成提案モーダル表示]

    K --> L["以下の問題が検出されました:<br/>- 人員配置基準未達成: 3日間<br/>- 労基法違反: 2件<br/><br/>シフトを再生成しますか？"]

    L --> M{ユーザーの選択}
    M -->|再生成| N[AIシフト再生成リクエスト]
    M -->|手動調整| O[シフト表示画面へ]
    M -->|このまま確定| P[シフト確定処理]

    N --> A
```

---

## 関連ドキュメント

- [要件定義書](../requirements.md)
- [技術設計書](../design.md)
- [実装タスク一覧](../tasks.md)
- [データモデル図](./data-model-diagram.md)
- [UIフロー図](./ui-flow-diagram.md)
- [コンポーネント構成図](./component-architecture.md)
