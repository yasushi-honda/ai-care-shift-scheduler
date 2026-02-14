"""
SolverModelBuilder: CP-SAT制約モデルの構築

ScheduleSkeletonとStaffListからCP-SATの決定変数と制約を構築する。
"""

from ortools.sat.python import cp_model

from solver.types import (
    SHIFT_TYPES,
    ScheduleSkeletonDict,
    ShiftRequirementDict,
    StaffDict,
    StaffScheduleDict,
)


class SolverModelBuilder:
    def __init__(
        self,
        staff_list: list[StaffDict],
        skeleton: ScheduleSkeletonDict,
        requirements: ShiftRequirementDict,
        leave_requests: dict[str, dict[str, str]],
    ) -> None:
        self._staff_list = staff_list
        self._skeleton = skeleton
        self._requirements = requirements
        self._leave_requests = leave_requests
        self._model = cp_model.CpModel()
        self._variables: dict[tuple[str, int, str], cp_model.IntVar] = {}
        self._target_month = requirements["targetMonth"]

        # 月の日数を算出
        year, month = map(int, self._target_month.split("-"))
        if month == 12:
            next_year, next_month = year + 1, 1
        else:
            next_year, next_month = year, month + 1
        import datetime
        self._days_in_month = (
            datetime.date(next_year, next_month, 1) - datetime.date(year, month, 1)
        ).days

        # スタッフIDからスケルトンへのマッピング
        self._skel_map = {
            s["staffId"]: s for s in skeleton["staffSchedules"]
        }

    def build_model(self) -> cp_model.CpModel:
        """CP-SATモデルを構築して返す"""
        self._create_variables()
        self._add_skeleton_constraints()
        self._add_exactly_one_constraints()
        return self._model

    def get_variables(self) -> dict[tuple[str, int, str], cp_model.IntVar]:
        """決定変数辞書 {(staffId, day, shiftType): BoolVar} を返す"""
        return self._variables

    def extract_solution(self, solver: cp_model.CpSolver) -> list[StaffScheduleDict]:
        """求解結果をStaffSchedule[]形式に変換する"""
        schedules: list[StaffScheduleDict] = []

        for staff in self._staff_list:
            staff_id = staff["id"]
            skel = self._skel_map[staff_id]
            monthly_shifts = []

            for day in range(1, self._days_in_month + 1):
                date_str = f"{self._target_month}-{day:02d}"

                if day in skel["nightShiftDays"]:
                    shift_type = "夜勤"
                elif day in skel["nightShiftFollowupDays"]:
                    shift_type = "明け休み"
                elif day in skel["restDays"] and day not in skel["nightShiftFollowupDays"]:
                    shift_type = "休"
                else:
                    # 決定変数から読み取り
                    shift_type = "休"  # デフォルト
                    for st in SHIFT_TYPES:
                        key = (staff_id, day, st)
                        if key in self._variables and solver.Value(self._variables[key]) == 1:
                            shift_type = st
                            break

                monthly_shifts.append({"date": date_str, "shiftType": shift_type})

            schedules.append({
                "staffId": staff_id,
                "staffName": staff["name"],
                "monthlyShifts": monthly_shifts,
            })

        return schedules

    def _create_variables(self) -> None:
        """各スタッフの各日について決定変数を生成"""
        for staff in self._staff_list:
            staff_id = staff["id"]
            skel = self._skel_map[staff_id]
            fixed_days = set(
                skel["restDays"] + skel["nightShiftDays"] + skel["nightShiftFollowupDays"]
            )
            # 休暇申請日も固定日に追加
            if staff_id in self._leave_requests:
                for date_str in self._leave_requests[staff_id]:
                    day_num = int(date_str.split("-")[2])
                    fixed_days.add(day_num)

            for day in range(1, self._days_in_month + 1):
                if day not in fixed_days:
                    for shift_type in SHIFT_TYPES:
                        var_name = f"x_{staff_id}_{day}_{shift_type}"
                        self._variables[(staff_id, day, shift_type)] = (
                            self._model.NewBoolVar(var_name)
                        )

    def _add_skeleton_constraints(self) -> None:
        """Skeleton固定値を制約として追加"""
        # Skeleton固定は変数を作らないことで実現しているため、
        # ここでは追加の制約は不要
        pass

    def _add_exactly_one_constraints(self) -> None:
        """非固定日に exactly-one 制約を追加"""
        for staff in self._staff_list:
            staff_id = staff["id"]
            for day in range(1, self._days_in_month + 1):
                day_vars = [
                    self._variables[(staff_id, day, st)]
                    for st in SHIFT_TYPES
                    if (staff_id, day, st) in self._variables
                ]
                if day_vars:
                    self._model.AddExactlyOne(day_vars)
