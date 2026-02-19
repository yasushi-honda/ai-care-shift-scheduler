# ADR-0004: ハイブリッドアーキテクチャ採用の決定

**日付**: 2026-02-14（フェーズ3更新: 2026-02-16）
**ステータス**: 採用（フェーズ3完了）
**関連**: [solver-generation-flow.md](../../.kiro/steering/solver-generation-flow.md)、[solver-optimization-strategy.md](../../.kiro/steering/solver-optimization-strategy.md)

## コンテキスト

### 現在のアーキテクチャの課題

現在のAIシフト生成はPhase 1（骨子生成）・Phase 2（詳細生成）ともに100% LLM（Gemini 2.5 Pro）に依存している。この構成には以下の課題がある：

| 課題 | 現状 | 影響 |
|------|------|------|
| 処理時間 | 90-400秒（バッチ数比例） | Cloud Functions 540秒タイムアウトに近い |
| コスト | 1回あたり数万トークン消費 | スケール時のコスト増大 |
| 最適性保証 | なし（LLMは確率的） | スコア0-100のばらつき |
| スケーラビリティ | 実質15名程度が限界 | 大規模施設に対応不可 |
| JSON安定性 | パースワークアラウンド多数 | BUG-014, BUG-022等の過去事例 |

### Phase 3リバランスの成功実績

Phase 3（後処理リバランス）は完全にアルゴリズムベースで実装済み。リバランスにより違反数を19→2に削減し、戦略A単体で目標スコアを達成した。これはハイブリッド化の第一歩として位置付けられる。

### 業界ベストプラクティス調査（2026-02-14）

Web調査により、シフトスケジューリングの業界動向を確認：

- **数理最適化（CP-SAT等）がコアエンジンとして主流**: Google OR-Tools、OptaPlanner、IBM CPLEX等のソルバーが看護師スケジューリング問題の標準的解法
- **LLMは制約解釈・説明生成に限定**: 自然言語での制約入力をソルバー用制約に変換、生成結果の説明文生成に活用
- **ハイブリッドアプローチが最新トレンド**: LLMとソルバーの役割を明確に分離し、それぞれの強みを活かす
- **処理性能**: ソルバーは15名1ヶ月のスケジュールを数秒で生成（LLMの90-400秒に対し大幅改善）

## 決定

段階的にハイブリッドアーキテクチャを採用する。

### LLMとSolverの役割分担

| 機能 | 現在（LLM） | 将来（ハイブリッド） |
|------|-------------|-------------------|
| 制約解釈 | LLM | **LLM**（自然言語→構造化制約） |
| スケジュール生成 | LLM | **Solver**（CP-SAT） |
| リバランス | アルゴリズム | **Solver**（統合最適化） |
| 評価・分析 | アルゴリズム | アルゴリズム（変更なし） |
| 説明生成 | なし | **LLM**（結果の説明文生成） |

### 推奨ソルバー: Google OR-Tools (CP-SAT)

| 項目 | 詳細 |
|------|------|
| ライブラリ | Google OR-Tools |
| ソルバー | CP-SAT (Constraint Programming - Boolean Satisfiability) |
| 言語 | Python（Cloud Functions v2で対応可）またはC++バインディング |
| ライセンス | Apache 2.0（商用利用可） |
| 選定理由 | Google製品との親和性、NSP（Nurse Scheduling Problem）の実績、無料 |

### ターゲットアーキテクチャ

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   LLM        │     │   Solver         │     │  LLM         │
│  (Gemini)    │     │  (OR-Tools)      │     │  (Gemini)    │
│              │     │                  │     │              │
│ 制約解釈     │────▶│ スケジュール生成   │────▶│ 説明生成     │
│ 自然言語入力  │     │ CP-SAT最適化     │     │ 結果の解説   │
│ → 構造化制約  │     │ 最適解保証       │     │ 改善提案     │
└──────────────┘     └──────────────────┘     └──────────────┘
```

## PoC結果（2026-02-14）

PoCで5名×31日のテストデータに対しCP-SAT SolverとLLM版のA/B比較を実施。全基準を達成し、本ADRステータスを「採用」に変更。

| 指標 | LLM版 | Solver版 | 改善 |
|------|-------|---------|------|
| 平均スコア | 72 | 100 | +28点 |
| Level 1違反 | 2件 | 0件 | 数学的に保証 |
| 処理時間 | 122.5秒 | ~1秒 | 99%削減 |
| 決定性 | 非決定的 | 完全決定的 | 分散0 |
| コスト/回 | ~$0.15 | $0.00 | 100%削減 |

**詳細**: [A/B比較レポート](../../solver-functions/tests/output/ab_comparison_report.md)

**成功基準テスト**: 58/58通過（`solver-functions/tests/`）（フェーズ3で+25テスト追加）

## 移行ロードマップ

### フェーズ1: PoC（概念実証） - 完了

- **スコープ**: 小規模施設（5名）でOR-Tools CP-SATによるスケジュール生成を検証
- **目標**: 処理時間 < 10秒、スコア80以上の安定出力
- **成果物**: PoC用Cloud Function（既存APIとは別エンドポイント）
- **結果**: 全成功基準達成 → ステータスを「採用」に変更

### フェーズ2: Phase 2 Solver化 - 完了

- **スコープ**: Phase 2（詳細生成）をOR-Tools CP-SATに置換
- **Phase 1（骨子生成）は当面LLMを維持**（柔軟な制約解釈が必要なため）
- **Phase 3（リバランス）はSolverに統合**

### フェーズ3: 全体最適化 - 完了（2026-02-16）

- **スコープ**: Phase 1-3を統合した単一CP-SATモデル。LLMは生成パイプラインから完全除去
- **アーキテクチャ**: `LLM Phase1(60-120s) → Solver Phase2(~1s) → Algorithm Phase3(<1s)` → **`Unified Solver(<30s)`**
- **100名以上の施設に対応**: 15名<5s, 50名<15s, 100名<30s（全目標達成）
- **決定性保証**: `num_workers=1` で同一入力→同一出力（3回テスト検証済み）
- **テスト**: 58テスト全通過（単体15 + スケーラビリティ3 + PoC34 + A/B比較6）

#### フェーズ3 A/B比較結果

| 指標 | LLM版（Phase 1+2+3） | 統合Solver | 改善 |
|------|---------------------|-----------|------|
| 12名処理時間 | 90-400秒 | 0.22秒 | 99.8%削減 |
| 50名処理時間 | タイムアウト | 0.89秒 | 対応不可→対応可 |
| 100名処理時間 | 対応不可 | <30秒 | 新規対応 |
| Level 1違反 | 0-5件 | 0件 | 数学的保証 |
| 評価スコア | 72-100 | 100 | 安定的最適解 |
| 決定性 | 非決定的 | 完全決定的 | 分散0 |
| LLMコスト/回 | ~$0.15 | $0.00 | 100%削減 |

#### 統合Solverモデル概要

- **変数**: `x[staff_id, day, shift_type]` = BoolVar（各スタッフ×各日×各シフト種別）
- **ハード制約**: exactly-one, 人員充足, 連続勤務上限, 遅番→早番禁止, 夜勤チェーン, 固定休日, timeSlotPreference
- **ソフト制約（目的関数）**: シフト希望ボーナス, 公平性, 夜勤公平性, 休息間隔, 勤務日数目標
- **実装**: `solver-functions/solver/unified_builder.py` (UnifiedModelBuilder + UnifiedConstraintBuilder + UnifiedObjectiveBuilder)

## 影響

### 正の影響

| 指標 | 現在（LLM） | 期待値（Solver） | 改善率 |
|------|------------|-----------------|--------|
| 処理時間 | 90-400秒 | 5-30秒 | 83-93%削減 |
| コスト/回 | トークン消費大 | 計算リソースのみ | 80-90%削減 |
| 最適性 | 確率的（ばらつき大） | 数学的保証（最適解） | 定性的改善 |
| スケーラビリティ | ~15名 | 100名以上 | 6倍以上 |
| JSON安定性 | ワークアラウンド多数 | 構造化出力 | 根本解決 |

### 負の影響

- **実装コスト**: 新しいソルバー層の設計・実装が必要
- **技術スタック追加**: Python（OR-Tools）またはWASMバインディングの導入
- **学習コスト**: CP-SAT/制約プログラミングの知識が必要
- **移行リスク**: 段階的移行中の2系統並行運用

## 参照

### プロジェクト内ドキュメント
- [solver-generation-flow.md](../../.kiro/steering/solver-generation-flow.md) - Solverシフト生成フロー
- [solver-optimization-strategy.md](../../.kiro/steering/solver-optimization-strategy.md) - Solver最適化戦略
- [architecture.md](../../.kiro/steering/architecture.md) - システムアーキテクチャ

### 外部参照
- [Google OR-Tools](https://developers.google.com/optimization) - 推奨ソルバー
- [CP-SAT Solver](https://developers.google.com/optimization/cp/cp_solver) - 制約プログラミングソルバー
- [Nurse Scheduling Problem](https://developers.google.com/optimization/scheduling/employee_scheduling) - OR-Tools公式の看護師スケジューリング例
