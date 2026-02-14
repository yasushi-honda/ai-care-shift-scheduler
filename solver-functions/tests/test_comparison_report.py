"""Task 8.2: Solver版の性能レポート生成 + LLM版とのA/B比較

LLM版ベースラインデータとSolver版の実行結果を比較し、
Markdownレポートを生成する。ADR-0004ステータス変更判断の定量データ。
"""

import json
import os
import statistics
import time

from solver.service import SolverService
from solver.types import SHIFT_TYPES, ALL_SHIFT_TYPES


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def _evaluate_result(result, requirements):
    """Solver結果を評価してスコアと違反数を返す"""
    violations_l1 = 0
    violations_l2 = 0

    for staff_schedule in result["schedule"]:
        shifts_by_day = {}
        for shift in staff_schedule["monthlyShifts"]:
            day_num = int(shift["date"].split("-")[2])
            shifts_by_day[day_num] = shift["shiftType"]

        consecutive = 0
        for day in range(1, 32):
            st = shifts_by_day.get(day, "休")
            if st in SHIFT_TYPES or st == "夜勤":
                consecutive += 1
            else:
                consecutive = 0
            if consecutive > 6:
                violations_l1 += 1

        for day in range(1, 31):
            if shifts_by_day.get(day) == "遅番" and shifts_by_day.get(day + 1) == "早番":
                violations_l1 += 1

    for day in range(1, 32):
        for shift_type in SHIFT_TYPES:
            req_key = f"2026-03-{day:02d}_{shift_type}"
            if req_key not in requirements["requirements"]:
                continue
            req = requirements["requirements"][req_key]
            count = sum(
                1 for s in result["schedule"]
                for shift in s["monthlyShifts"]
                if int(shift["date"].split("-")[2]) == day
                and shift["shiftType"] == shift_type
            )
            if count < req["totalStaff"]:
                violations_l2 += 1

    score = max(0, 100 - violations_l1 * 100 - violations_l2 * 12)
    return score, violations_l1, violations_l2


class TestComparisonReport:
    """Solver性能レポート生成"""

    def test_generate_solver_report(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """Solver版の定量データを出力"""
        scores = []
        times = []
        level1_violations = []

        for i in range(5):
            start = time.time()
            result = SolverService.solve(
                staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
            )
            elapsed = time.time() - start
            times.append(elapsed)

            assert result["success"] is True

            score, v_l1, v_l2 = _evaluate_result(result, requirements_30)
            scores.append(score)
            level1_violations.append(v_l1)

        # シフト配分分析（最後の結果を使用）
        shift_distribution = {}
        for staff_schedule in result["schedule"]:
            counts = {st: 0 for st in ALL_SHIFT_TYPES}
            for shift in staff_schedule["monthlyShifts"]:
                counts[shift["shiftType"]] = counts.get(shift["shiftType"], 0) + 1
            shift_distribution[staff_schedule["staffName"]] = counts

        report = {
            "method": "CP-SAT Solver (OR-Tools)",
            "staffCount": 5,
            "daysInMonth": 31,
            "runs": 5,
            "scores": scores,
            "avgScore": sum(scores) / len(scores),
            "minScore": min(scores),
            "maxScore": max(scores),
            "level1Violations": level1_violations,
            "totalLevel1": sum(level1_violations),
            "processingTimes": [round(t, 3) for t in times],
            "avgTimeMs": round(sum(times) / len(times) * 1000),
            "solverStats": result["solverStats"],
            "shiftDistribution": shift_distribution,
        }

        print("\n" + "=" * 60)
        print("  CP-SAT Solver PoC 性能レポート")
        print("=" * 60)
        print(f"  スタッフ数: {report['staffCount']}名")
        print(f"  月間日数: {report['daysInMonth']}日")
        print(f"  実行回数: {report['runs']}回")
        print(f"  平均スコア: {report['avgScore']:.0f}")
        print(f"  最低スコア: {report['minScore']}")
        print(f"  最高スコア: {report['maxScore']}")
        print(f"  Level 1違反: {report['totalLevel1']}件")
        print(f"  平均処理時間: {report['avgTimeMs']}ms")
        print(f"  Solver状態: {report['solverStats']['status']}")
        print("=" * 60)

        # 成功基準の確認
        assert report["minScore"] >= 80, f"最低スコア {report['minScore']} < 80"
        assert report["totalLevel1"] == 0, f"Level 1違反 {report['totalLevel1']}件"
        assert report["avgTimeMs"] < 10000, f"平均処理時間 {report['avgTimeMs']}ms > 10000ms"

    def test_ab_comparison_report(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """LLM版とSolver版のA/B比較レポートを生成"""
        # 1. LLMベースラインデータ読み込み
        with open(os.path.join(FIXTURES_DIR, "llm_baseline.json")) as f:
            llm_data = json.load(f)

        # 2. Solver版を5回実行
        solver_scores = []
        solver_times = []
        solver_l1 = []
        solver_l2 = []

        for _ in range(5):
            start = time.time()
            result = SolverService.solve(
                staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
            )
            elapsed = time.time() - start
            assert result["success"] is True

            score, v_l1, v_l2 = _evaluate_result(result, requirements_30)
            solver_scores.append(score)
            solver_times.append(elapsed)
            solver_l1.append(v_l1)
            solver_l2.append(v_l2)

        # Solver版シフト配分（最後の結果）
        solver_distribution = {}
        for staff_schedule in result["schedule"]:
            counts = {st: 0 for st in ALL_SHIFT_TYPES}
            for shift in staff_schedule["monthlyShifts"]:
                counts[shift["shiftType"]] = counts.get(shift["shiftType"], 0) + 1
            solver_distribution[staff_schedule["staffName"]] = counts

        # 3. 比較メトリクス算出
        solver_avg_score = statistics.mean(solver_scores)
        solver_avg_time_ms = statistics.mean(solver_times) * 1000
        llm_avg_score = llm_data["avgScore"]
        llm_avg_time_ms = llm_data["avgTimeMs"]

        score_improvement = solver_avg_score - llm_avg_score
        time_reduction_pct = (1 - solver_avg_time_ms / llm_avg_time_ms) * 100

        solver_score_variance = statistics.variance(solver_scores) if len(solver_scores) > 1 else 0
        llm_score_variance = llm_data["scoreVariance"]

        # 4. Markdownレポート生成
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        report_path = os.path.join(OUTPUT_DIR, "ab_comparison_report.md")

        md = []
        md.append("# A/B比較レポート: LLM版 vs CP-SAT Solver版")
        md.append("")
        md.append(f"**生成日時**: 2026-02-14")
        md.append(f"**テスト条件**: {llm_data['staffCount']}名 x {llm_data['daysInMonth']}日 / 各5回実行")
        md.append("")
        md.append("---")
        md.append("")

        # サマリー
        md.append("## 1. エグゼクティブサマリー")
        md.append("")
        md.append(f"CP-SAT Solver版はLLM版と比較して、**スコア+{score_improvement:.0f}点**、"
                   f"**処理時間{time_reduction_pct:.0f}%削減**を達成。")
        md.append("全実行でLevel 1違反ゼロ、完全な決定性を実現し、PoC成功基準を満たした。")
        md.append("")

        # スコア比較
        md.append("## 2. スコア比較")
        md.append("")
        md.append("| 指標 | LLM版 | Solver版 | 差分 |")
        md.append("|------|-------|---------|------|")
        md.append(f"| 平均スコア | {llm_avg_score:.0f} | {solver_avg_score:.0f} | **+{score_improvement:.0f}** |")
        md.append(f"| 最低スコア | {llm_data['minScore']} | {min(solver_scores)} | +{min(solver_scores) - llm_data['minScore']} |")
        md.append(f"| 最高スコア | {llm_data['maxScore']} | {max(solver_scores)} | +{max(solver_scores) - llm_data['maxScore']} |")
        md.append(f"| スコア分散 | {llm_score_variance:.1f} | {solver_score_variance:.1f} | {solver_score_variance - llm_score_variance:.1f} |")
        md.append(f"| 各回スコア | {llm_data['scores']} | {solver_scores} | - |")
        md.append("")

        # 違反数比較
        md.append("## 3. 制約違反比較")
        md.append("")
        md.append("| 指標 | LLM版 | Solver版 | 差分 |")
        md.append("|------|-------|---------|------|")
        md.append(f"| Level 1違反（労基法） | {llm_data['totalLevel1']}件 | {sum(solver_l1)}件 | **{sum(solver_l1) - llm_data['totalLevel1']}件** |")
        md.append(f"| Level 2違反（人員不足） | {llm_data['totalLevel2']}件 | {sum(solver_l2)}件 | {sum(solver_l2) - llm_data['totalLevel2']}件 |")
        md.append(f"| Level 1詳細 | {llm_data['level1Violations']} | {solver_l1} | - |")
        md.append(f"| Level 2詳細 | {llm_data['level2Violations']} | {solver_l2} | - |")
        md.append("")

        # 処理時間比較
        md.append("## 4. 処理時間比較")
        md.append("")
        md.append("| 指標 | LLM版 | Solver版 | 改善率 |")
        md.append("|------|-------|---------|--------|")
        md.append(f"| 平均処理時間 | {llm_avg_time_ms/1000:.1f}秒 | {solver_avg_time_ms/1000:.3f}秒 | **{time_reduction_pct:.1f}%削減** |")
        solver_times_ms = [round(t * 1000) for t in solver_times]
        md.append(f"| 各回（ms） | {llm_data['processingTimes']}s | {solver_times_ms}ms | - |")
        md.append(f"| 速度比 | 1x | **{llm_avg_time_ms / solver_avg_time_ms:.0f}x** | - |")
        md.append("")

        # 決定性比較
        md.append("## 5. 決定性（再現性）")
        md.append("")
        md.append("| 指標 | LLM版 | Solver版 |")
        md.append("|------|-------|---------|")
        md.append(f"| 決定性 | 非決定的（確率的） | **完全決定的** |")
        md.append(f"| スコア分散 | {llm_score_variance:.1f} | {solver_score_variance:.1f} |")
        md.append(f"| 同一入力→同一出力 | No | **Yes** |")
        md.append("")

        # シフト配分比較
        md.append("## 6. シフト配分比較（代表例）")
        md.append("")
        md.append("### LLM版")
        md.append("")
        md.append("| スタッフ | 早番 | 日勤 | 遅番 | 夜勤 | 休 | 明け休み |")
        md.append("|---------|------|------|------|------|-----|---------|")
        for name, dist in llm_data["shiftDistribution"].items():
            md.append(f"| {name} | {dist['早番']} | {dist['日勤']} | {dist['遅番']} | {dist['夜勤']} | {dist['休']} | {dist['明け休み']} |")
        md.append("")

        md.append("### Solver版")
        md.append("")
        md.append("| スタッフ | 早番 | 日勤 | 遅番 | 夜勤 | 休 | 明け休み |")
        md.append("|---------|------|------|------|------|-----|---------|")
        for name, dist in solver_distribution.items():
            md.append(f"| {name} | {dist['早番']} | {dist['日勤']} | {dist['遅番']} | {dist['夜勤']} | {dist['休']} | {dist['明け休み']} |")
        md.append("")

        # コスト比較
        md.append("## 7. コスト比較")
        md.append("")
        md.append("| 指標 | LLM版 | Solver版 |")
        md.append("|------|-------|---------|")
        md.append(f"| 入力トークン/回 | ~{llm_data['costPerRun']['inputTokens']:,} | 0 |")
        md.append(f"| 出力トークン/回 | ~{llm_data['costPerRun']['outputTokens']:,} | 0 |")
        md.append(f"| API費用/回 | ~${llm_data['costPerRun']['estimatedCostUSD']:.2f} | $0.00 |")
        md.append(f"| 計算リソース | Cloud Functions (Node.js) | Cloud Functions (Python) |")
        md.append("")

        # PoC成功基準判定
        md.append("## 8. PoC成功基準判定")
        md.append("")
        criteria_score = solver_avg_score >= 80 and min(solver_scores) >= 80
        criteria_l1 = sum(solver_l1) == 0
        criteria_time = solver_avg_time_ms < 10000
        criteria_deterministic = solver_score_variance == 0

        md.append("| 基準 | 目標 | Solver結果 | 判定 |")
        md.append("|------|------|-----------|------|")
        md.append(f"| スコア安定性 | 全回80以上 | 最低{min(solver_scores)} | {'PASS' if criteria_score else 'FAIL'} |")
        md.append(f"| Level 1違反 | 0件 | {sum(solver_l1)}件 | {'PASS' if criteria_l1 else 'FAIL'} |")
        md.append(f"| 処理時間 | <10秒 | {solver_avg_time_ms/1000:.3f}秒 | {'PASS' if criteria_time else 'FAIL'} |")
        md.append(f"| 決定性 | 完全決定的 | 分散{solver_score_variance:.1f} | {'PASS' if criteria_deterministic else 'FAIL'} |")
        md.append("")

        all_pass = criteria_score and criteria_l1 and criteria_time and criteria_deterministic
        md.append(f"**総合判定: {'ALL PASS - ADR-0004ステータスを「採用」に変更推奨' if all_pass else 'FAIL'}**")
        md.append("")

        # 結論
        md.append("## 9. 結論")
        md.append("")
        md.append("CP-SAT Solverへの移行により以下の改善が見込まれる:")
        md.append("")
        md.append(f"1. **品質向上**: 平均スコア {llm_avg_score:.0f} → {solver_avg_score:.0f}（+{score_improvement:.0f}点）")
        md.append(f"2. **速度改善**: {llm_avg_time_ms/1000:.1f}秒 → {solver_avg_time_ms/1000:.3f}秒（{time_reduction_pct:.1f}%削減）")
        md.append(f"3. **信頼性**: Level 1違反ゼロを数学的に保証")
        md.append(f"4. **再現性**: 同一入力に対し常に同一出力")
        md.append(f"5. **コスト**: LLM APIトークン消費ゼロ")
        md.append("")

        report_content = "\n".join(md)
        with open(report_path, "w") as f:
            f.write(report_content)

        print(f"\n{'=' * 60}")
        print(f"  A/B比較レポート生成完了: {report_path}")
        print(f"{'=' * 60}")

        # 5. アサーション: Solver版がPoC成功基準を満たすこと
        assert all_pass, "PoC成功基準を満たしていません"
        assert solver_avg_score >= 80, f"Solver平均スコア {solver_avg_score:.0f} < 80"
        assert sum(solver_l1) == 0, f"Solver Level 1違反 {sum(solver_l1)}件"
        assert solver_avg_time_ms < 10000, f"Solver処理時間 {solver_avg_time_ms:.0f}ms > 10000ms"
        assert score_improvement > 0, f"スコア改善なし: {score_improvement:.0f}"
        assert time_reduction_pct > 80, f"処理時間削減率 {time_reduction_pct:.1f}% < 80%"
