"""Task 2.1-2.2: 決定変数の生成とスケルトン固定値の適用のテスト"""

from ortools.sat.python import cp_model

from solver.model_builder import SolverModelBuilder
from solver.types import SHIFT_TYPES


class TestVariableGeneration:
    """決定変数生成のテスト"""

    def test_variables_created_for_all_staff_days(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """5名・30日のテストデータで変数が正しく生成される"""
        builder = SolverModelBuilder(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        builder.build_model()
        variables = builder.get_variables()

        # 各スタッフ・各日・各シフトの変数が存在する（固定日を除く）
        assert len(variables) > 0
        for staff in staff_list_5:
            for day in range(1, 32):
                skel = next(
                    s for s in skeleton_5_30["staffSchedules"]
                    if s["staffId"] == staff["id"]
                )
                is_rest = day in skel["restDays"]
                is_night = day in skel["nightShiftDays"]
                is_followup = day in skel["nightShiftFollowupDays"]

                if is_rest or is_night or is_followup:
                    # 固定日にはシフト変数がない
                    for st in SHIFT_TYPES:
                        assert (staff["id"], day, st) not in variables
                else:
                    # 非固定日には3シフト変数がある
                    for st in SHIFT_TYPES:
                        assert (staff["id"], day, st) in variables

    def test_rest_days_fixed(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """休日・夜勤・明け休みの日が正しく固定される"""
        builder = SolverModelBuilder(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        model = builder.build_model()
        solver = cp_model.CpSolver()
        status = solver.Solve(model)

        assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)

        schedules = builder.extract_solution(solver)

        # s1の休日チェック（restDaysのうち夜勤followupでないもの）
        s1_schedule = next(s for s in schedules if s["staffId"] == "s1")
        s1_skel = skeleton_5_30["staffSchedules"][0]

        for shift in s1_schedule["monthlyShifts"]:
            day_num = int(shift["date"].split("-")[2])
            if day_num in s1_skel["nightShiftDays"]:
                assert shift["shiftType"] == "夜勤"
            elif day_num in s1_skel["nightShiftFollowupDays"]:
                assert shift["shiftType"] == "明け休み"
            elif day_num in s1_skel["restDays"]:
                # restDaysかつnightShiftFollowupDaysの日はfollowup優先
                if day_num not in s1_skel["nightShiftFollowupDays"]:
                    assert shift["shiftType"] == "休"

    def test_exactly_one_shift_on_working_days(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """非固定日にexactly-one制約が適用される"""
        builder = SolverModelBuilder(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        model = builder.build_model()
        solver = cp_model.CpSolver()
        status = solver.Solve(model)

        assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)

        schedules = builder.extract_solution(solver)

        for staff_schedule in schedules:
            staff_id = staff_schedule["staffId"]
            skel = next(
                s for s in skeleton_5_30["staffSchedules"]
                if s["staffId"] == staff_id
            )
            for shift in staff_schedule["monthlyShifts"]:
                day_num = int(shift["date"].split("-")[2])
                is_fixed = (
                    day_num in skel["restDays"]
                    or day_num in skel["nightShiftDays"]
                    or day_num in skel["nightShiftFollowupDays"]
                )
                if not is_fixed:
                    # 非固定日は早番・日勤・遅番のいずれか
                    assert shift["shiftType"] in SHIFT_TYPES

    def test_all_days_covered(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
    ):
        """全スタッフの全日にシフトが割り当てられる"""
        builder = SolverModelBuilder(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        model = builder.build_model()
        solver = cp_model.CpSolver()
        status = solver.Solve(model)

        assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)

        schedules = builder.extract_solution(solver)

        # 2026-03 は31日
        days_in_month = 31
        assert len(schedules) == 5
        for staff_schedule in schedules:
            assert len(staff_schedule["monthlyShifts"]) == days_in_month
            dates = [s["date"] for s in staff_schedule["monthlyShifts"]]
            for day in range(1, days_in_month + 1):
                assert f"2026-03-{day:02d}" in dates
