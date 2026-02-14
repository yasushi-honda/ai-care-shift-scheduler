# Requirements Document

## Introduction

ADR-0004に基づき、現在のLLM（Gemini 2.5 Pro）100%依存のシフト生成パイプラインにおける**Phase 2（詳細生成）をGoogle OR-Tools CP-SAT Solverで置換する概念実証（PoC）**を実施する。

### ビジネス価値

| 現状の課題 | Solverによる解決 |
|-----------|----------------|
| Phase 2処理時間: 60-280秒 | 目標 < 10秒 |
| JSON出力不安定（BUG-014, 022） | 構造化出力で根本解決 |
| スケーラビリティ: ~15名 | 100名以上対応可能 |
| トークンコスト大 | CPU計算のみ（80-90%削減） |
| 確率的な結果（スコアばらつき） | 数学的最適解保証 |

Phase 3リバランスのアルゴリズムベース成功実績（違反19→2、スコア目標達成）を基盤とし、Phase 2のSolver化でハイブリッドアーキテクチャへの移行可否を判断する。

---

## Requirements

### Requirement 1: CP-SAT制約モデルの構築

**Objective:** As a 開発者, I want Phase 1（骨子生成）の出力（ScheduleSkeleton）を入力としてCP-SAT制約モデルを構築できること, so that LLMに依存せず数学的に最適なシフト配分を生成できる。

#### Acceptance Criteria

1. WHEN ScheduleSkeletonが入力された THEN Solverサービス SHALL 各スタッフの各日について決定変数 `x[staff, day, shift]`（0/1）を生成する
2. WHEN ScheduleSkeletonにrestDaysが指定されている THEN Solverサービス SHALL 該当日を「休」として固定し、他のシフトタイプを割り当てない
3. WHEN ScheduleSkeletonにnightShiftDaysが指定されている THEN Solverサービス SHALL 該当日を「夜勤」として固定する
4. WHEN ScheduleSkeletonにnightShiftFollowupDaysが指定されている THEN Solverサービス SHALL 該当日を「明け休み」として固定する
5. WHEN 非休日・非夜勤日がある THEN Solverサービス SHALL 「早番」「日勤」「遅番」のいずれか1つを割り当てる（1日1シフト制約）

### Requirement 2: ハード制約の実装

**Objective:** As a 施設管理者, I want 労基法・介護保険法・運営上の必須制約が100%遵守されたシフトを得ること, so that コンプライアンス違反を防止できる。

#### Acceptance Criteria

1. WHILE シフトを生成する間 THE Solverサービス SHALL 各日・各シフトタイプにおいてrequirements（時間帯別必要人数）以上のスタッフを配置する
2. WHILE シフトを生成する間 THE Solverサービス SHALL 各日・各シフトタイプにおいて資格要件（qualifications）を満たすスタッフを必要数以上配置する
3. WHILE シフトを生成する間 THE Solverサービス SHALL 連続勤務が6日を超えないように制約する
4. WHILE シフトを生成する間 THE Solverサービス SHALL 遅番→翌日早番のような勤務間インターバル不足（8時間未満）パターンを禁止する
5. WHEN スタッフにleaveRequests（休暇申請）がある THEN Solverサービス SHALL 該当日を「休」として固定する
6. IF ハード制約を全て満たす実行可能解が存在しない THEN Solverサービス SHALL 制約充足不可能であることをエラーレスポンスで通知し、不足している制約の情報を含める

### Requirement 3: ソフト制約（目的関数）の実装

**Objective:** As a 施設管理者, I want スタッフの希望やシフトの公平性を最大限考慮したシフトを得ること, so that スタッフ満足度と運用品質を両立できる。

#### Acceptance Criteria

1. WHEN スタッフにtimeSlotPreference（時間帯希望）が設定されている THEN Solverサービス SHALL 希望に沿ったシフト配分を目的関数で最大化する
2. WHILE 目的関数を最適化する間 THE Solverサービス SHALL 各スタッフのシフト種類（早番・日勤・遅番）の月間回数が均等になるよう配分する
3. WHILE 目的関数を最適化する間 THE Solverサービス SHALL 各日のシフト種類別人数が要件に対して過不足なく近づくよう最適化する
4. IF 複数の実行可能解が存在する THEN Solverサービス SHALL ソフト制約のスコアが最も高い解を選択する

### Requirement 4: Python Cloud Function実装

**Objective:** As a 開発者, I want OR-Tools CP-SATをPython Cloud Function (v2)として実装すること, so that 既存のNode.js Functionと独立して運用・テストできる。

#### Acceptance Criteria

1. WHEN `/solverGenerateShift` エンドポイントにPOSTリクエストが送信された THEN Python Cloud Function SHALL 既存generateShiftと同一形式のリクエストボディを受け付ける
2. WHEN 有効なリクエストとScheduleSkeletonが入力された THEN Python Cloud Function SHALL CP-SATモデルを構築・求解し、StaffSchedule[]形式のレスポンスを返却する
3. WHILE リクエストを処理する間 THE Python Cloud Function SHALL 処理時間を10秒以内に完了する（5名規模）
4. IF OR-Toolsの求解がタイムアウトした（30秒上限） THEN Python Cloud Function SHALL その時点での最良解（feasible solution）を返却する
5. WHEN レスポンスを返却する THEN Python Cloud Function SHALL 既存の評価システム（EvaluationService）と互換性のある出力形式を使用する

### Requirement 5: 既存パイプラインとの統合

**Objective:** As a 開発者, I want 既存のPhase 1（骨子生成）→ Solver Phase 2 → 評価のパイプラインで動作すること, so that 段階的移行が可能であることを検証できる。

#### Acceptance Criteria

1. WHEN Phase 1（LLM）がScheduleSkeletonを生成した THEN SolverサービスSHALL そのSkeletonをそのまま入力として受け取り、Phase 2相当の詳細シフトを生成する
2. WHEN Solverがシフトを生成した THEN 出力 SHALL 既存Phase 3（リバランス）と同一のStaffSchedule[]形式に変換可能である
3. WHEN Solverがシフトを生成した THEN 既存の評価システム SHALL LLM生成時と同じ4段階評価（Level 1-4）で評価可能である
4. WHEN A/Bテストを実施する THEN 同一入力（staffList, requirements, leaveRequests, skeleton）に対してLLM版とSolver版の両方の結果を取得・比較できる

### Requirement 6: PoC成功基準と比較検証

**Objective:** As a プロダクトオーナー, I want LLM版との定量比較でSolverの優位性を検証すること, so that ADR-0004のステータスを「提案」から「採用」に変更する判断材料を得られる。

#### Acceptance Criteria

1. WHEN 5名規模のテストデータでSolverを実行した THEN 評価スコア SHALL 80以上を安定的に達成する（5回中5回）
2. WHEN 5名規模のテストデータでSolverを実行した THEN 処理時間 SHALL 10秒以内である
3. WHEN 5名規模のテストデータでSolverを実行した THEN Level 1違反（労基法） SHALL 0件である
4. WHEN 同一入力でLLM版とSolver版を比較した THEN 比較レポート SHALL スコア・違反数・処理時間・シフト配分の差異を出力する
5. IF Solverが全テストケースで成功基準を満たした THEN 開発者 SHALL ADR-0004のステータスを「採用」に更新する根拠を提示できる

### Requirement 7: エラーハンドリングと運用

**Objective:** As a 開発者, I want Solver固有のエラーケースが適切にハンドリングされること, so that 本番導入時の運用安定性を確保できる。

#### Acceptance Criteria

1. IF CP-SATが制約充足不可能（INFEASIBLE）を返した THEN Solverサービス SHALL 不足しているリソース（スタッフ数・資格者数）を特定し、エラーレスポンスに含める
2. IF CP-SATの求解時間が上限（30秒）に達した THEN Solverサービス SHALL feasible solutionが存在すればそれを返却し、存在しなければタイムアウトエラーを返却する
3. WHEN Solverサービスが内部エラーを発生した THEN Cloud Function SHALL エラーログを出力し、HTTP 500レスポンスを返却する
4. WHILE Solverサービスが稼働中 THE Cloud Function SHALL メモリ使用量を256MiB以内に維持する（5名規模）
