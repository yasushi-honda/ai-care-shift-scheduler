# Implementation Plan

## hybrid-solver-poc: CP-SAT Solverによるphase 2置換PoC

- [x] 1. Python Cloud Function プロジェクト基盤構築
- [x] 1.1 Python プロジェクトの初期化と依存関係設定
  - solver-functions ディレクトリを作成し、Python Cloud Function v2 の標準構成を整える
  - ortools、firebase-functions、flask 等の必要パッケージを requirements.txt に定義する
  - Python 3.12 ランタイム向けの設定を行い、ローカル実行できる状態にする
  - solver サブパッケージの初期構造（型定義、モデルビルダー、制約、目的関数）を作成する
  - _Requirements: 4.1, 4.2_

- [x] 1.2 firebase.json にマルチコードベース設定を追加
  - 既存の Node.js Functions エントリを維持したまま、Python Functions のエントリを追加する
  - Python 側のコードベース名、ランタイム、ソースディレクトリ、ignore パターンを設定する
  - predeploy スクリプトで依存関係のインストールを自動化する
  - _Requirements: 4.1_

- [x] 1.3 TypeScript 型定義と互換の Python 型定義を作成
  - Staff、ScheduleSkeleton、StaffScheduleSkeleton、ShiftRequirement、DailyRequirement 等の入力型を定義する
  - StaffSchedule、GeneratedShift 等の出力型を定義する
  - SolverResponse、SolverErrorResponse、SolverStats 等の API レスポンス型を定義する
  - 既存 TypeScript 型との対応関係をコメントで明示する
  - _Requirements: 4.2, 4.5, 5.2_

- [x] 2. CP-SAT 制約モデルの構築
- [x] 2.1 決定変数の生成とスケルトン固定値の適用
  - 各スタッフの各日について、シフトタイプ（早番・日勤・遅番）ごとのブール決定変数を生成する
  - ScheduleSkeleton の restDays を「休」として固定し、他のシフトタイプの変数を 0 にする
  - nightShiftDays を「夜勤」として固定する
  - nightShiftFollowupDays を「明け休み」として固定する
  - 非固定日には「早番」「日勤」「遅番」のいずれか 1 つのみ割当される制約を追加する（1日1シフト）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2.2 決定変数生成の単体テスト
  - 5名・30日のテストデータで変数が正しく生成されることを検証する
  - 休日・夜勤・明け休みの日が正しく固定されることを検証する
  - 非固定日に exactly-one 制約が適用されることを検証する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. ハード制約の実装
- [x] 3.1 日別必要人数と資格要件の制約を実装
  - 各日・各シフトタイプにおいて、requirements で指定された必要人数以上のスタッフを配置する制約を追加する
  - 各日・各シフトタイプにおいて、requiredQualifications で指定された資格保有者を必要数以上配置する制約を追加する
  - requiredRoles（役職要件）がある場合も同様に制約を追加する
  - _Requirements: 2.1, 2.2_

- [x] 3.2 連続勤務制限と勤務間インターバルの制約を実装
  - 連続勤務が 6 日を超えないように、任意の 7 日間ウィンドウで少なくとも 1 日の休息を保証する制約を追加する
  - 遅番の翌日に早番を割り当てない制約を追加する（勤務間インターバル 8 時間未満の禁止）
  - _Requirements: 2.3, 2.4_

- [x] 3.3 休暇申請の反映を実装
  - leaveRequests に含まれるスタッフ・日付の組を「休」として固定する
  - 休暇申請日には他のシフトタイプが割り当てられないことを保証する
  - _Requirements: 2.5_

- [x] 3.4 制約充足不可能時の検出と不足情報の特定を実装
  - Solver が INFEASIBLE を返した場合に、どの制約が充足できないかを特定するロジックを実装する
  - 不足しているリソース（スタッフ数、資格者数）を日別・シフト別に分析する
  - エラーレスポンスに不足情報を含める
  - _Requirements: 2.6, 7.1_

- [x] 3.5 ハード制約の単体テスト
  - 人員不足時に INFEASIBLE が正しく検出されることを検証する
  - 資格要件不足時の制約違反を検証する
  - 連勤 7 日連続のケースが禁止されることを検証する
  - 遅番→翌日早番のパターンが禁止されることを検証する
  - 休暇申請日が確実に「休」になることを検証する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 4. ソフト制約（目的関数）の実装
- [x] 4.1 時間帯希望の適合度最大化を実装
  - timeSlotPreference が「日勤のみ」のスタッフには日勤割当に高いボーナスを付与する
  - 「いつでも可」のスタッフにはシフト種類による差をつけない
  - 希望適合度のボーナスを目的関数の一部として重み付け加算する
  - _Requirements: 3.1_

- [x] 4.2 シフト公平配分と日別充足最適化を実装
  - 各スタッフの月間シフト種類（早番・日勤・遅番）回数が均等に近づくよう、偏差にペナルティを設定する
  - 各日のシフト種類別人数が requirements の totalStaff に過不足なく近づくよう最適化する
  - 複数の実行可能解がある場合にソフト制約スコアが最大の解を選択する目的関数を構成する
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 4.3 ソフト制約の単体テスト
  - timeSlotPreference「日勤のみ」のスタッフが日勤に優先配置されることを検証する
  - シフト種類の月間回数が大きく偏らないことを検証する
  - 目的関数値が高い解が優先されることを検証する
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5. 求解と出力変換の実装
- [x] 5.1 CP-SAT 求解の実行と結果抽出を実装
  - CpSolver を生成し、タイムアウト 30 秒で求解を実行する
  - OPTIMAL または FEASIBLE の場合、決定変数の値を読み取り StaffSchedule 形式に変換する
  - 求解統計情報（求解時間、変数数、制約数、目的関数値、ステータス）を SolverStats として返却する
  - _Requirements: 4.2, 4.3, 4.4_

- [x] 5.2 出力形式の既存評価システム互換性を確保
  - 出力の StaffSchedule に staffId、staffName、monthlyShifts（date + shiftType）を含める
  - date は "YYYY-MM-DD" 形式、shiftType は "早番"/"日勤"/"遅番"/"夜勤"/"休"/"明け休み" のいずれかとする
  - 既存の EvaluationService で評価可能な形式であることをテストで検証する
  - _Requirements: 4.5, 5.2, 5.3_

- [x] 6. Python Cloud Function エンドポイントの実装
- [x] 6.1 HTTP エンドポイントの実装
  - POST `/solverGenerateShift` エンドポイントを実装する
  - リクエストボディのバリデーション（staffList、skeleton、requirements の必須チェック）を行う
  - 正常系で SolverResponse（success、schedule、solverStats）を返却する
  - 異常系でエラー種別に応じた HTTP ステータスコードとエラー詳細を返却する
  - _Requirements: 4.1, 4.2, 7.2, 7.3_

- [x] 6.2 タイムアウトとメモリ制約の設定
  - Cloud Function のタイムアウトを適切に設定し、Solver のタイムアウト（30秒）と整合させる
  - メモリ上限を 256MiB に設定する（5名規模）
  - タイムアウト時に feasible solution があればそれを返却し、なければタイムアウトエラーを返却する
  - _Requirements: 4.3, 4.4, 7.2, 7.4_

- [x] 6.3 エンドポイントの統合テスト
  - 有効なリクエストで正常レスポンスが返ることを検証する
  - 不正なリクエスト（フィールド欠落）で 400 エラーが返ることを検証する
  - INFEASIBLE ケースで 422 エラーと不足情報が返ることを検証する
  - 内部エラー時に 500 レスポンスとエラーログが出力されることを検証する
  - _Requirements: 4.1, 4.2, 7.1, 7.2, 7.3_

- [x] 7. 既存パイプラインとの統合
- [x] 7.1 Node.js Cloud Function から Solver を呼び出す連携を実装
  - 既存の shift-generation.ts に Solver 呼び出し関数を追加する
  - Phase 1 の ScheduleSkeleton 出力をそのまま Solver の入力として渡す
  - Solver の出力を Phase 3（リバランス）と同一の StaffSchedule 形式として受け取る
  - _Requirements: 5.1, 5.2_

- [x] 7.2 評価システムでの Solver 出力検証
  - Solver 出力を既存の評価システムで評価し、4段階評価（Level 1-4）が正しく機能することを検証する
  - Level 1 違反（労基法）がゼロであることを検証する
  - _Requirements: 5.3, 6.3_

- [x] 8. PoC 成功基準の検証と比較テスト
- [x] 8.1 成功基準テストの実装
  - 5名規模のテストデータで Solver を 5 回実行し、全回でスコア 80 以上を達成することを検証する
  - 処理時間が 10 秒以内であることを検証する
  - Level 1 違反が 0 件であることを検証する
  - 同一入力で再現性のある結果が得られることを検証する
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 8.2 LLM 版との A/B 比較レポート生成
  - 同一入力データ（staffList、requirements、leaveRequests、skeleton）で LLM 版と Solver 版の両方の結果を取得する
  - スコア、違反数、処理時間、シフト配分の差異を比較レポートとして出力する
  - ADR-0004 のステータス変更判断に必要な定量データを提示する
  - _Requirements: 5.4, 6.4, 6.5_
