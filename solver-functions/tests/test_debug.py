"""デバッグ: INFEASIBLEの原因特定"""
from ortools.sat.python import cp_model
from solver.model_builder import SolverModelBuilder
from solver.constraints import ConstraintBuilder
from solver.types import SHIFT_TYPES


def test_base_model_feasible(staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty):
    """制約なしの基本モデルが解けるか"""
    builder = SolverModelBuilder(staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty)
    model = builder.build_model()
    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    print(f"Base model status: {status}")
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def test_staffing_only(staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty):
    """人員配置制約のみ"""
    builder = SolverModelBuilder(staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty)
    model = builder.build_model()
    variables = builder.get_variables()

    # 人員制約のみ追加
    target_month = requirements_30["targetMonth"]
    for day in range(1, 32):
        for shift_type in SHIFT_TYPES:
            req_key = f"{target_month}-{day:02d}_{shift_type}"
            if req_key not in requirements_30["requirements"]:
                continue
            req = requirements_30["requirements"][req_key]
            total_required = req["totalStaff"]
            staff_on_shift = [
                variables[(s["id"], day, shift_type)]
                for s in staff_list_5
                if (s["id"], day, shift_type) in variables
            ]
            if staff_on_shift:
                model.Add(sum(staff_on_shift) >= total_required)

    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    print(f"Staffing only status: {status}")

    if status == cp_model.INFEASIBLE:
        # どの日が問題か特定
        for day in range(1, 32):
            available = []
            for s in staff_list_5:
                has_var = any((s["id"], day, st) in variables for st in SHIFT_TYPES)
                if has_var:
                    available.append(s["id"])
            print(f"Day {day}: {len(available)} available: {available}")

    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def test_consecutive_only(staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty):
    """連続勤務制約のみ"""
    builder = SolverModelBuilder(staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty)
    model = builder.build_model()
    variables = builder.get_variables()
    skel_map = {s["staffId"]: s for s in skeleton_5_30["staffSchedules"]}

    ConstraintBuilder._add_consecutive_work_constraints(
        model, variables, staff_list_5, skel_map, 31, leave_requests_empty
    )

    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    print(f"Consecutive only status: {status}")
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
