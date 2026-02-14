"""Task 5-6: 求解・出力変換・エンドポイントの統合テスト"""

import json
import time

from solver.types import SHIFT_TYPES, ALL_SHIFT_TYPES
from solver.service import SolverService


class TestSolverService:
    """SolverServiceの統合テスト"""

    def test_solve_returns_valid_schedule(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """有効なリクエストで正常レスポンスが返る"""
        result = SolverService.solve(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )

        assert result["success"] is True
        assert len(result["schedule"]) == 5

        for staff_schedule in result["schedule"]:
            assert "staffId" in staff_schedule
            assert "staffName" in staff_schedule
            assert len(staff_schedule["monthlyShifts"]) == 31

        stats = result["solverStats"]
        assert stats["status"] in ("OPTIMAL", "FEASIBLE")
        assert stats["solveTimeMs"] >= 0
        assert stats["numVariables"] > 0

    def test_output_format_compatible(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """出力がEvaluationService互換形式である"""
        result = SolverService.solve(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )

        for staff_schedule in result["schedule"]:
            assert isinstance(staff_schedule["staffId"], str)
            assert isinstance(staff_schedule["staffName"], str)

            for shift in staff_schedule["monthlyShifts"]:
                # date形式: YYYY-MM-DD
                assert len(shift["date"]) == 10
                assert shift["date"].startswith("2026-03-")

                # shiftType
                assert shift["shiftType"] in ALL_SHIFT_TYPES

    def test_solve_time_under_10_seconds(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """5名規模で10秒以内に完了"""
        start = time.time()
        result = SolverService.solve(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        elapsed = time.time() - start

        assert result["success"] is True
        assert elapsed < 10.0, f"Solve took {elapsed:.2f}s"
        assert result["solverStats"]["solveTimeMs"] < 10000

    def test_infeasible_returns_error(self):
        """INFEASIBLEケースでエラーレスポンスが返る"""
        from tests.conftest import make_staff
        from solver.types import ShiftRequirementDict, ScheduleSkeletonDict, DailyRequirementDict

        staff_list = [make_staff("s1", "唯一のスタッフ")]
        skeleton = ScheduleSkeletonDict(
            staffSchedules=[{
                "staffId": "s1",
                "staffName": "唯一のスタッフ",
                "restDays": [],
                "nightShiftDays": [],
                "nightShiftFollowupDays": [],
            }]
        )
        requirements = ShiftRequirementDict(
            targetMonth="2026-03",
            timeSlots=[
                {"name": "早番", "start": "07:00", "end": "16:00", "restHours": 1.0},
                {"name": "日勤", "start": "09:00", "end": "18:00", "restHours": 1.0},
                {"name": "遅番", "start": "11:00", "end": "20:00", "restHours": 1.0},
            ],
            requirements={
                f"2026-03-{d:02d}_{st}": DailyRequirementDict(
                    totalStaff=2, requiredQualifications=[], requiredRoles=[]
                )
                for d in range(1, 32)
                for st in SHIFT_TYPES
            },
        )

        result = SolverService.solve(staff_list, skeleton, requirements, {})

        assert result["success"] is False
        assert result["errorType"] == "INFEASIBLE"
        assert "error" in result

    def test_deterministic_output(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """同一入力で再現性のある結果が得られる"""
        result1 = SolverService.solve(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        result2 = SolverService.solve(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )

        assert result1["success"] is True
        assert result2["success"] is True

        # 同一入力で同一結果
        for s1, s2 in zip(result1["schedule"], result2["schedule"]):
            assert s1["staffId"] == s2["staffId"]
            for shift1, shift2 in zip(s1["monthlyShifts"], s2["monthlyShifts"]):
                assert shift1["date"] == shift2["date"]
                assert shift1["shiftType"] == shift2["shiftType"]

    def test_serializable_output(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """出力がJSON直列化可能"""
        result = SolverService.solve(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        json_str = json.dumps(result, ensure_ascii=False)
        parsed = json.loads(json_str)
        assert parsed["success"] is True
