"""Task 4.1-4.3: ソフト制約（目的関数）の単体テスト"""

from ortools.sat.python import cp_model

from solver.model_builder import SolverModelBuilder
from solver.constraints import ConstraintBuilder
from solver.objective import ObjectiveBuilder
from solver.types import SHIFT_TYPES
from tests.conftest import make_staff


def _solve_with_objective(staff_list, skeleton, requirements, leave_requests=None):
    """ヘルパー: モデル構築＋ハード制約＋ソフト制約＋求解"""
    leave = leave_requests or {}
    builder = SolverModelBuilder(staff_list, skeleton, requirements, leave)
    model = builder.build_model()
    variables = builder.get_variables()
    ConstraintBuilder.add_hard_constraints(
        model, variables, staff_list, skeleton, requirements, leave
    )
    ObjectiveBuilder.add_soft_constraints(
        model, variables, staff_list, requirements
    )
    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    return status, solver, builder


class TestTimeSlotPreference:
    """時間帯希望の適合度テスト"""

    def test_day_only_preference_gets_day_shift(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """timeSlotPreference「日勤のみ」のスタッフが日勤に優先配置される"""
        status, solver, builder = _solve_with_objective(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)

        schedules = builder.extract_solution(solver)

        # s4は「日勤のみ」希望
        s4 = next(s for s in schedules if s["staffId"] == "s4")
        day_shift_count = sum(
            1 for shift in s4["monthlyShifts"]
            if shift["shiftType"] == "日勤"
        )
        other_shift_count = sum(
            1 for shift in s4["monthlyShifts"]
            if shift["shiftType"] in ("早番", "遅番")
        )
        # 日勤の割合が他のシフトより多いはず
        assert day_shift_count > other_shift_count


class TestFairDistribution:
    """シフト公平配分のテスト"""

    def test_shift_distribution_not_heavily_skewed(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """シフト種類の月間回数が大きく偏らない"""
        status, solver, builder = _solve_with_objective(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)

        schedules = builder.extract_solution(solver)

        # 「いつでも可」のスタッフのみ均等チェック（日勤のみ希望は除外）
        any_pref_staff = [s["id"] for s in staff_list_5 if s["timeSlotPreference"] == "いつでも可"]
        for staff_schedule in schedules:
            if staff_schedule["staffId"] not in any_pref_staff:
                continue
            counts = {st: 0 for st in SHIFT_TYPES}
            for shift in staff_schedule["monthlyShifts"]:
                if shift["shiftType"] in SHIFT_TYPES:
                    counts[shift["shiftType"]] += 1
            total_working = sum(counts.values())
            if total_working == 0:
                continue
            # 各シフトが均等（ideal = total/3）からの偏差が60%以内
            ideal = total_working / 3
            for st, count in counts.items():
                if ideal > 0:
                    deviation = abs(count - ideal) / ideal
                    assert deviation < 0.6, (
                        f"{staff_schedule['staffName']}: {st}={count}, "
                        f"ideal={ideal:.1f}, deviation={deviation:.1%}"
                    )


class TestObjectiveValue:
    """目的関数値のテスト"""

    def test_objective_value_positive(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """目的関数値が正の値を持つ（最大化問題）"""
        status, solver, builder = _solve_with_objective(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
        assert solver.ObjectiveValue() > 0
