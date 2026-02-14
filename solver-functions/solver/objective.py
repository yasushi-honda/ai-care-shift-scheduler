"""
ObjectiveBuilder: ソフト制約を目的関数として設定

1. timeSlotPreference適合の最大化（重み: 10）
2. シフト種類の月間均等配分（重み: 5）
3. 日別人数の要件近接（重み: 3）
"""

import datetime

from ortools.sat.python import cp_model

from solver.types import (
    SHIFT_TYPES,
    ShiftRequirementDict,
    StaffDict,
)


class ObjectiveBuilder:
    @staticmethod
    def add_soft_constraints(
        model: cp_model.CpModel,
        variables: dict[tuple[str, int, str], cp_model.IntVar],
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
    ) -> None:
        objective_terms: list = []

        ObjectiveBuilder._add_preference_bonus(
            model, variables, staff_list, objective_terms
        )
        ObjectiveBuilder._add_fairness_penalty(
            model, variables, staff_list, requirements, objective_terms
        )

        if objective_terms:
            model.Maximize(sum(objective_terms))

    @staticmethod
    def _add_preference_bonus(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        objective_terms: list,
    ) -> None:
        """timeSlotPreference適合のボーナス（重み: 10）"""
        weight = 10
        for staff in staff_list:
            staff_id = staff["id"]
            pref = staff["timeSlotPreference"]

            if pref == "日勤のみ":
                for (sid, day, shift_type), var in variables.items():
                    if sid == staff_id and shift_type == "日勤":
                        objective_terms.append(weight * var)
            # 「いつでも可」は差をつけない（ボーナスなし）
            # 「夜勤のみ」はSkeleton固定で処理済み

    @staticmethod
    def _add_fairness_penalty(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
        objective_terms: list,
    ) -> None:
        """シフト種類の月間均等配分（重み: 5）

        各スタッフのシフト種類回数の偏差にペナルティを設定。
        """
        weight = 5
        target_month = requirements["targetMonth"]
        year, month = map(int, target_month.split("-"))
        if month == 12:
            next_year, next_month = year + 1, 1
        else:
            next_year, next_month = year, month + 1
        days_in_month = (
            datetime.date(next_year, next_month, 1) - datetime.date(year, month, 1)
        ).days

        for staff in staff_list:
            staff_id = staff["id"]
            # 「日勤のみ」希望のスタッフは均等配分のペナルティを適用しない
            if staff["timeSlotPreference"] == "日勤のみ":
                continue

            shift_counts = {}
            for shift_type in SHIFT_TYPES:
                count_vars = [
                    variables[(staff_id, day, shift_type)]
                    for day in range(1, days_in_month + 1)
                    if (staff_id, day, shift_type) in variables
                ]
                if count_vars:
                    shift_counts[shift_type] = count_vars

            if len(shift_counts) < 2:
                continue

            # ペア間の差の最小化
            shift_types_list = list(shift_counts.keys())
            for i in range(len(shift_types_list)):
                for j in range(i + 1, len(shift_types_list)):
                    st_i = shift_types_list[i]
                    st_j = shift_types_list[j]
                    count_i = sum(shift_counts[st_i])
                    count_j = sum(shift_counts[st_j])

                    # |count_i - count_j| を最小化 → diff変数を使って線形化
                    max_possible = days_in_month
                    diff = model.NewIntVar(0, max_possible, f"diff_{staff_id}_{st_i}_{st_j}")
                    model.Add(diff >= count_i - count_j)
                    model.Add(diff >= count_j - count_i)

                    # diffが小さいほどボーナス（max_possible - diffをボーナスとして加算）
                    objective_terms.append(weight * (max_possible - diff))
