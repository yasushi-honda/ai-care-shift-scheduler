"""
SolverService: CP-SAT求解のオーケストレーション

SolverModelBuilder → ConstraintBuilder → ObjectiveBuilder → CpSolver
の一連のパイプラインを実行し、結果をSolverResponse形式で返す。

UnifiedSolverService: Phase 1-3統合版（Skeleton不要）
"""

import time

from ortools.sat.python import cp_model

from solver.model_builder import SolverModelBuilder
from solver.constraints import ConstraintBuilder
from solver.objective import ObjectiveBuilder
from solver.unified_builder import UnifiedModelBuilder
from solver.types import (
    ScheduleSkeletonDict,
    ShiftRequirementDict,
    StaffDict,
)


class SolverService:
    @staticmethod
    def solve(
        staff_list: list[StaffDict],
        skeleton: ScheduleSkeletonDict,
        requirements: ShiftRequirementDict,
        leave_requests: dict[str, dict[str, str]],
    ) -> dict:
        """CP-SAT求解を実行し結果を返す"""
        try:
            builder = SolverModelBuilder(
                staff_list, skeleton, requirements, leave_requests
            )
            model = builder.build_model()
            variables = builder.get_variables()

            ConstraintBuilder.add_hard_constraints(
                model, variables, staff_list, skeleton, requirements, leave_requests
            )
            ObjectiveBuilder.add_soft_constraints(
                model, variables, staff_list, requirements
            )

            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = 10.0
            solver.parameters.num_workers = 1

            start_time = time.time()
            status = solver.Solve(model)
            solve_time_ms = int((time.time() - start_time) * 1000)

            status_name = solver.StatusName(status)

            if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                schedule = builder.extract_solution(solver)
                return {
                    "success": True,
                    "schedule": schedule,
                    "solverStats": {
                        "status": status_name,
                        "solveTimeMs": solve_time_ms,
                        "numVariables": model.Proto().variables.__len__(),
                        "numConstraints": model.Proto().constraints.__len__(),
                        "objectiveValue": int(solver.ObjectiveValue()),
                    },
                }
            else:
                return {
                    "success": False,
                    "error": f"求解失敗: {status_name}",
                    "errorType": "INFEASIBLE",
                    "details": {
                        "status": status_name,
                        "solveTimeMs": solve_time_ms,
                    },
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "errorType": "INTERNAL_ERROR",
                "details": {},
            }


class UnifiedSolverService:
    """Phase 1-3統合Solver（Skeleton不要）"""

    @staticmethod
    def solve(
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
        leave_requests: dict[str, dict[str, str]],
    ) -> dict:
        """統合CP-SAT求解を実行し結果を返す"""
        try:
            builder = UnifiedModelBuilder(staff_list, requirements, leave_requests)
            model = builder.build()

            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = 30.0
            solver.parameters.num_workers = 1  # 決定性保証
            # 最適値の5%以内で早期終了（4シフト対応の高速化）
            solver.parameters.relative_gap_limit = 0.05

            start_time = time.time()
            status = solver.Solve(model)
            solve_time_ms = int((time.time() - start_time) * 1000)

            status_name = solver.StatusName(status)

            if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                schedule = builder.extract_solution(solver)
                return {
                    "success": True,
                    "schedule": schedule,
                    "solverStats": {
                        "status": status_name,
                        "solveTimeMs": solve_time_ms,
                        "numVariables": model.Proto().variables.__len__(),
                        "numConstraints": model.Proto().constraints.__len__(),
                        "objectiveValue": int(solver.ObjectiveValue()),
                    },
                }
            else:
                return {
                    "success": False,
                    "error": f"求解失敗: {status_name}",
                    "errorType": "INFEASIBLE",
                    "details": {
                        "status": status_name,
                        "solveTimeMs": solve_time_ms,
                    },
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "errorType": "INTERNAL_ERROR",
                "details": {},
            }
