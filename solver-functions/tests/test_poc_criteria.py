"""Task 8.1: PoC成功基準の検証テスト

成功基準:
- 処理時間 < 10秒（5名規模）
- 評価スコア >= 80（5回中5回）
- Level 1違反 = 0
- 決定性: 同一入力で同一結果
"""

import time

from solver.service import SolverService
from solver.types import SHIFT_TYPES, ALL_SHIFT_TYPES


class TestPoCCriteria:
    """PoC成功基準の検証"""

    def _evaluate_schedule(self, result, staff_list, requirements):
        """簡易評価: Level 1-4の違反をチェックして評価スコアを算出"""
        if not result["success"]:
            return {"score": 0, "level1_violations": 999, "violations": {}}

        violations = {
            "level1": [],  # 労基法違反（連勤7日超、勤務間インターバル不足）
            "level2": [],  # 人員不足
            "level3": [],  # 希望休未反映
            "level4": [],  # 推奨
        }

        for staff_schedule in result["schedule"]:
            shifts_by_day = {}
            for shift in staff_schedule["monthlyShifts"]:
                day_num = int(shift["date"].split("-")[2])
                shifts_by_day[day_num] = shift["shiftType"]

            # Level 1: 連続勤務チェック
            consecutive = 0
            for day in range(1, 32):
                st = shifts_by_day.get(day, "休")
                if st in SHIFT_TYPES or st == "夜勤":
                    consecutive += 1
                else:
                    consecutive = 0
                if consecutive > 6:
                    violations["level1"].append(
                        f"{staff_schedule['staffName']}: {consecutive}連勤"
                    )

            # Level 1: 遅番→翌日早番チェック
            for day in range(1, 31):
                if shifts_by_day.get(day) == "遅番" and shifts_by_day.get(day + 1) == "早番":
                    violations["level1"].append(
                        f"{staff_schedule['staffName']}: 日{day}遅番→日{day+1}早番"
                    )

        # Level 2: 人員不足チェック
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
                    violations["level2"].append(
                        f"日{day} {shift_type}: {count}/{req['totalStaff']}"
                    )

        # スコア算出
        score = 100
        score -= len(violations["level1"]) * 100  # Level 1: 即0点
        score -= len(violations["level2"]) * 12   # Level 2: -12点/件
        score -= len(violations["level3"]) * 4    # Level 3: -4点/件
        score = max(0, score)

        return {
            "score": score,
            "level1_violations": len(violations["level1"]),
            "violations": violations,
        }

    def test_5_runs_score_above_80(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """5回実行で全てスコア80以上"""
        for i in range(5):
            result = SolverService.solve(
                staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
            )
            assert result["success"] is True, f"Run {i+1}: 求解失敗"

            eval_result = self._evaluate_schedule(
                result, staff_list_5, requirements_30
            )
            assert eval_result["score"] >= 80, (
                f"Run {i+1}: スコア {eval_result['score']} < 80, "
                f"violations: {eval_result['violations']}"
            )

    def test_level1_violations_zero(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """Level 1（労基法）違反がゼロ"""
        result = SolverService.solve(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        assert result["success"] is True

        eval_result = self._evaluate_schedule(
            result, staff_list_5, requirements_30
        )
        assert eval_result["level1_violations"] == 0, (
            f"Level 1違反: {eval_result['violations']['level1']}"
        )

    def test_processing_time_under_10_seconds(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """処理時間が10秒以内"""
        start = time.time()
        result = SolverService.solve(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        elapsed = time.time() - start

        assert result["success"] is True
        assert elapsed < 10.0, f"処理時間 {elapsed:.2f}s > 10s"
        assert result["solverStats"]["solveTimeMs"] < 10000

    def test_deterministic_results(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """同一入力で決定的な結果"""
        results = []
        for _ in range(3):
            result = SolverService.solve(
                staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
            )
            assert result["success"] is True
            results.append(result)

        for i in range(1, len(results)):
            for s1, s2 in zip(results[0]["schedule"], results[i]["schedule"]):
                assert s1["staffId"] == s2["staffId"]
                for shift1, shift2 in zip(s1["monthlyShifts"], s2["monthlyShifts"]):
                    assert shift1["shiftType"] == shift2["shiftType"], (
                        f"Run 0 vs {i}: {s1['staffId']} {shift1['date']} "
                        f"{shift1['shiftType']} != {shift2['shiftType']}"
                    )

    def test_output_format_valid(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """出力形式が評価システム互換"""
        result = SolverService.solve(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        assert result["success"] is True

        for staff_schedule in result["schedule"]:
            assert isinstance(staff_schedule["staffId"], str)
            assert isinstance(staff_schedule["staffName"], str)
            assert len(staff_schedule["monthlyShifts"]) == 31

            for shift in staff_schedule["monthlyShifts"]:
                assert shift["date"].startswith("2026-03-")
                assert len(shift["date"]) == 10
                assert shift["shiftType"] in ALL_SHIFT_TYPES
