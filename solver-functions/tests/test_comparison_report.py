"""Task 8.2: Solver版の性能レポート生成

LLM版との比較に必要な定量データをSolver側で生成する。
実際のA/B比較はデプロイ後に同一入力データで実施する。
"""

import json
import time

from solver.service import SolverService
from solver.types import SHIFT_TYPES, ALL_SHIFT_TYPES


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

            # 簡易評価
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
                    if req_key not in requirements_30["requirements"]:
                        continue
                    req = requirements_30["requirements"][req_key]
                    count = sum(
                        1 for s in result["schedule"]
                        for shift in s["monthlyShifts"]
                        if int(shift["date"].split("-")[2]) == day
                        and shift["shiftType"] == shift_type
                    )
                    if count < req["totalStaff"]:
                        violations_l2 += 1

            score = max(0, 100 - violations_l1 * 100 - violations_l2 * 12)
            scores.append(score)
            level1_violations.append(violations_l1)

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
