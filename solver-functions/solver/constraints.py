"""
ConstraintBuilder: ハード制約の実装

1. 日別必要人数の充足
2. 資格要件の充足
3. 連続勤務6日以下
4. 勤務間インターバル（遅番→翌日早番禁止）
5. 休暇申請の反映
"""

import datetime

from ortools.sat.python import cp_model

from solver.types import (
    SHIFT_TYPES,
    ScheduleSkeletonDict,
    ShiftRequirementDict,
    StaffDict,
)


class ConstraintBuilder:
    @staticmethod
    def add_hard_constraints(
        model: cp_model.CpModel,
        variables: dict[tuple[str, int, str], cp_model.IntVar],
        staff_list: list[StaffDict],
        skeleton: ScheduleSkeletonDict,
        requirements: ShiftRequirementDict,
        leave_requests: dict[str, dict[str, str]],
    ) -> None:
        target_month = requirements["targetMonth"]
        year, month = map(int, target_month.split("-"))
        if month == 12:
            next_year, next_month = year + 1, 1
        else:
            next_year, next_month = year, month + 1
        days_in_month = (
            datetime.date(next_year, next_month, 1) - datetime.date(year, month, 1)
        ).days

        skel_map = {s["staffId"]: s for s in skeleton["staffSchedules"]}

        ConstraintBuilder._add_staffing_constraints(
            model, variables, staff_list, requirements, target_month, days_in_month
        )
        ConstraintBuilder._add_qualification_constraints(
            model, variables, staff_list, requirements, target_month, days_in_month
        )
        ConstraintBuilder._add_consecutive_work_constraints(
            model, variables, staff_list, skel_map, days_in_month, leave_requests
        )
        ConstraintBuilder._add_interval_constraints(
            model, variables, staff_list, days_in_month
        )

    @staticmethod
    def _add_staffing_constraints(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
        target_month: str,
        days_in_month: int,
    ) -> None:
        """各日・各シフトの必要人数制約"""
        for day in range(1, days_in_month + 1):
            for shift_type in SHIFT_TYPES:
                req_key = f"{target_month}-{day:02d}_{shift_type}"
                if req_key not in requirements["requirements"]:
                    continue
                req = requirements["requirements"][req_key]
                total_required = req["totalStaff"]

                staff_on_shift = [
                    variables[(s["id"], day, shift_type)]
                    for s in staff_list
                    if (s["id"], day, shift_type) in variables
                ]

                if staff_on_shift:
                    model.Add(sum(staff_on_shift) >= total_required)

    @staticmethod
    def _add_qualification_constraints(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
        target_month: str,
        days_in_month: int,
    ) -> None:
        """資格要件制約"""
        for day in range(1, days_in_month + 1):
            for shift_type in SHIFT_TYPES:
                req_key = f"{target_month}-{day:02d}_{shift_type}"
                if req_key not in requirements["requirements"]:
                    continue
                req = requirements["requirements"][req_key]

                for qual_req in req["requiredQualifications"]:
                    qualification = qual_req["qualification"]
                    required_count = qual_req["count"]

                    qualified_on_shift = [
                        variables[(s["id"], day, shift_type)]
                        for s in staff_list
                        if qualification in s["qualifications"]
                        and (s["id"], day, shift_type) in variables
                    ]

                    if qualified_on_shift:
                        model.Add(sum(qualified_on_shift) >= required_count)

    @staticmethod
    def _add_consecutive_work_constraints(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        skel_map: dict,
        days_in_month: int,
        leave_requests: dict[str, dict[str, str]],
    ) -> None:
        """連続勤務6日以下制約（任意の7日間ウィンドウで少なくとも1日休息）

        非固定日はexactly-one制約で必ず勤務日になるため、
        連続勤務はスケルトンの休日配置で決まる。
        7日連続で休日がないウィンドウがあればINFEASIBLEにする。
        """
        for staff in staff_list:
            staff_id = staff["id"]
            skel = skel_map[staff_id]
            rest_days = set(skel["restDays"])
            night_followup_days = set(skel["nightShiftFollowupDays"])
            leave_days = set()
            if staff_id in leave_requests:
                for date_str in leave_requests[staff_id]:
                    leave_days.add(int(date_str.split("-")[2]))

            all_rest_days = rest_days | night_followup_days | leave_days

            for start_day in range(1, days_in_month - 5):
                window_end = min(start_day + 7, days_in_month + 1)
                window_days = range(start_day, window_end)

                has_rest = any(day in all_rest_days for day in window_days)
                if not has_rest and len(list(window_days)) == 7:
                    # 7連勤は不可能 → モデルを矛盾させる
                    model.Add(0 >= 1)

    @staticmethod
    def _add_interval_constraints(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        days_in_month: int,
    ) -> None:
        """遅番→翌日早番の禁止"""
        for staff in staff_list:
            staff_id = staff["id"]
            for day in range(1, days_in_month):
                late_key = (staff_id, day, "遅番")
                early_next_key = (staff_id, day + 1, "早番")

                if late_key in variables and early_next_key in variables:
                    # 遅番[day] + 早番[day+1] <= 1
                    model.Add(
                        variables[late_key] + variables[early_next_key] <= 1
                    )
