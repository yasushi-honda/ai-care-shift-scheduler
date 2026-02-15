"""
UnifiedModelBuilder: Phase 1-3を統合したCP-SATモデル

Skeletonなしで直接CP-SATモデルを構築する。
LLMによる骨子生成を排除し、全フェーズを1回の求解で完結する。

変数モデル:
  BoolVar x[staff_id, day, shift_type] = 1 iff スタッフが当日そのシフトに割当

制約:
  ハード: exactly-one, 人員充足, 資格要件, 連続勤務上限,
         勤務間インターバル, 夜勤チェーン, 固定休日
  ソフト: timeSlotPreference, 均等配分, 夜勤均等, 休日間隔
"""

import datetime

from ortools.sat.python import cp_model

from solver.types import (
    ALL_SHIFT_TYPES,
    SHIFT_TYPES,
    ShiftRequirementDict,
    StaffDict,
    StaffScheduleDict,
)

# 日勤系シフト（SHIFT_TYPES: 早番, 日勤, 遅番）
DAY_SHIFT_TYPES = SHIFT_TYPES
# 夜勤施設用の追加シフト
NIGHT_SHIFT_TYPES = ["夜勤"]
# 非勤務系
REST_SHIFT_TYPES = ["休", "明け休み"]


def _days_in_month(target_month: str) -> int:
    year, month = map(int, target_month.split("-"))
    if month == 12:
        next_year, next_month = year + 1, 1
    else:
        next_year, next_month = year, month + 1
    return (
        datetime.date(next_year, next_month, 1) - datetime.date(year, month, 1)
    ).days


def _has_night_shift(requirements: ShiftRequirementDict) -> bool:
    """要件キーに「夜勤」が含まれるか → 夜勤施設判定"""
    return any("夜勤" in key for key in requirements["requirements"])


def _non_operational_days(
    requirements: ShiftRequirementDict, days_in_month: int
) -> set[int]:
    """要件エントリがない日 → 非稼働日"""
    target_month = requirements["targetMonth"]
    operational = set()
    for key in requirements["requirements"]:
        date_part = key.split("_")[0]
        day = int(date_part.split("-")[2])
        operational.add(day)
    return set(range(1, days_in_month + 1)) - operational


def _js_weekday(year: int, month: int, day: int) -> int:
    """Python weekday (Mon=0) → JS weekday (Sun=0)"""
    return (datetime.date(year, month, day).weekday() + 1) % 7


class UnifiedModelBuilder:
    """Phase 1-3統合CP-SATモデルビルダー"""

    def __init__(
        self,
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
        leave_requests: dict[str, dict[str, str]],
    ) -> None:
        self._staff_list = staff_list
        self._requirements = requirements
        self._leave_requests = leave_requests
        self._model = cp_model.CpModel()
        self._variables: dict[tuple[str, int, str], cp_model.IntVar] = {}

        self._target_month = requirements["targetMonth"]
        self._year, self._month = map(int, self._target_month.split("-"))
        self._dim = _days_in_month(self._target_month)
        self._is_night_facility = _has_night_shift(requirements)
        self._non_op_days = _non_operational_days(requirements, self._dim)

        # スタッフごとの固定休日をキャッシュ
        self._fixed_rest: dict[str, set[int]] = {}
        for staff in staff_list:
            self._fixed_rest[staff["id"]] = self._compute_fixed_rest(staff)

    def build(self) -> cp_model.CpModel:
        """モデル構築のエントリポイント"""
        self._create_variables()
        self._add_exactly_one()
        UnifiedConstraintBuilder.add_all(
            self._model,
            self._variables,
            self._staff_list,
            self._requirements,
            self._leave_requests,
            self._dim,
            self._target_month,
            self._is_night_facility,
            self._non_op_days,
            self._fixed_rest,
            self._year,
            self._month,
        )
        UnifiedObjectiveBuilder.add_all(
            self._model,
            self._variables,
            self._staff_list,
            self._requirements,
            self._dim,
            self._is_night_facility,
            self._fixed_rest,
        )
        return self._model

    @property
    def variables(self) -> dict[tuple[str, int, str], cp_model.IntVar]:
        return self._variables

    def extract_solution(self, solver: cp_model.CpSolver) -> list[StaffScheduleDict]:
        """求解結果をStaffSchedule[]形式に変換"""
        schedules: list[StaffScheduleDict] = []
        for staff in self._staff_list:
            staff_id = staff["id"]
            monthly_shifts = []
            for day in range(1, self._dim + 1):
                date_str = f"{self._target_month}-{day:02d}"
                shift_type = "休"
                for st in self._shift_types_for_staff(staff):
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

    def _shift_types_for_staff(self, staff: StaffDict) -> list[str]:
        """スタッフのtimeSlotPreferenceに基づくシフト種類"""
        pref = staff["timeSlotPreference"]
        if pref == "日勤のみ":
            return ["日勤", "休"]
        if pref == "夜勤のみ" or staff.get("isNightShiftOnly", False):
            if self._is_night_facility:
                return ["夜勤", "明け休み", "休"]
            return ["日勤", "休"]  # 夜勤なし施設のフォールバック
        # いつでも可
        if self._is_night_facility:
            return DAY_SHIFT_TYPES + NIGHT_SHIFT_TYPES + REST_SHIFT_TYPES
        return DAY_SHIFT_TYPES + ["休"]

    def _compute_fixed_rest(self, staff: StaffDict) -> set[int]:
        """固定休日の計算: unavailableDates + leaveRequests + 非稼働日 + 非対応曜日"""
        fixed = set(self._non_op_days)
        staff_id = staff["id"]

        # unavailableDates
        for date_str in staff.get("unavailableDates", []):
            parts = date_str.split("-")
            if len(parts) == 3:
                d_year, d_month, d_day = int(parts[0]), int(parts[1]), int(parts[2])
                if d_year == self._year and d_month == self._month:
                    fixed.add(d_day)

        # leaveRequests
        if staff_id in self._leave_requests:
            for date_str in self._leave_requests[staff_id]:
                parts = date_str.split("-")
                if len(parts) == 3:
                    fixed.add(int(parts[2]))

        # availableWeekdays (JS format: 0=Sun)
        available = set(staff["availableWeekdays"])
        for day in range(1, self._dim + 1):
            js_wd = _js_weekday(self._year, self._month, day)
            if js_wd not in available:
                fixed.add(day)

        return fixed

    def _create_variables(self) -> None:
        """決定変数の生成"""
        for staff in self._staff_list:
            staff_id = staff["id"]
            fixed = self._fixed_rest[staff_id]
            shift_types = self._shift_types_for_staff(staff)

            for day in range(1, self._dim + 1):
                if day in fixed:
                    # 固定休日: 変数なし → extract_solutionで「休」として出力
                    continue
                for st in shift_types:
                    # 月末2日間は夜勤チェーン完結不能 → 夜勤変数を除外
                    if st == "夜勤" and day > self._dim - 2:
                        continue
                    # 月初日は前日夜勤がないので明け休みも不可
                    if st == "明け休み" and day == 1:
                        continue
                    var_name = f"x_{staff_id}_{day}_{st}"
                    self._variables[(staff_id, day, st)] = (
                        self._model.NewBoolVar(var_name)
                    )

    def _add_exactly_one(self) -> None:
        """各スタッフ・各非固定日にexactly-one制約"""
        for staff in self._staff_list:
            staff_id = staff["id"]
            shift_types = self._shift_types_for_staff(staff)
            for day in range(1, self._dim + 1):
                day_vars = [
                    self._variables[(staff_id, day, st)]
                    for st in shift_types
                    if (staff_id, day, st) in self._variables
                ]
                if day_vars:
                    self._model.AddExactlyOne(day_vars)


class UnifiedConstraintBuilder:
    """統合Solver用ハード制約"""

    @staticmethod
    def add_all(
        model: cp_model.CpModel,
        variables: dict[tuple[str, int, str], cp_model.IntVar],
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
        leave_requests: dict[str, dict[str, str]],
        days_in_month: int,
        target_month: str,
        is_night_facility: bool,
        non_op_days: set[int],
        fixed_rest: dict[str, set[int]],
        year: int,
        month: int,
    ) -> None:
        UnifiedConstraintBuilder._add_staffing(
            model, variables, staff_list, requirements, target_month, days_in_month
        )
        UnifiedConstraintBuilder._add_qualification(
            model, variables, staff_list, requirements, target_month, days_in_month
        )
        UnifiedConstraintBuilder._add_consecutive_work(
            model, variables, staff_list, days_in_month, fixed_rest
        )
        UnifiedConstraintBuilder._add_interval(
            model, variables, staff_list, days_in_month
        )
        if is_night_facility:
            UnifiedConstraintBuilder._add_night_shift_chain(
                model, variables, staff_list, days_in_month
            )

    @staticmethod
    def _add_staffing(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
        target_month: str,
        days_in_month: int,
    ) -> None:
        """各日・各シフトの必要人数制約"""
        for day in range(1, days_in_month + 1):
            for shift_type in SHIFT_TYPES + NIGHT_SHIFT_TYPES:
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
    def _add_qualification(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
        target_month: str,
        days_in_month: int,
    ) -> None:
        """資格要件制約"""
        for day in range(1, days_in_month + 1):
            for shift_type in SHIFT_TYPES + NIGHT_SHIFT_TYPES:
                req_key = f"{target_month}-{day:02d}_{shift_type}"
                if req_key not in requirements["requirements"]:
                    continue
                req = requirements["requirements"][req_key]
                for qual_req in req["requiredQualifications"]:
                    qualification = qual_req["qualification"]
                    required_count = qual_req["count"]
                    qualified = [
                        variables[(s["id"], day, shift_type)]
                        for s in staff_list
                        if qualification in s["qualifications"]
                        and (s["id"], day, shift_type) in variables
                    ]
                    if qualified:
                        model.Add(sum(qualified) >= required_count)

    @staticmethod
    def _add_consecutive_work(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        days_in_month: int,
        fixed_rest: dict[str, set[int]],
    ) -> None:
        """連続勤務上限制約（スライディングウィンドウ方式）

        maxConsecutiveWorkDays+1 日のウィンドウで、
        勤務日数 ≤ maxConsecutiveWorkDays を保証。
        固定休日は確定的に休日としてカウント。
        """
        for staff in staff_list:
            staff_id = staff["id"]
            max_consec = staff["maxConsecutiveWorkDays"]
            window_size = max_consec + 1
            fixed = fixed_rest[staff_id]

            for start in range(1, days_in_month - window_size + 2):
                work_in_window = []
                for d in range(start, min(start + window_size, days_in_month + 1)):
                    if d in fixed:
                        continue  # 固定休日 → 勤務変数なし → カウント不要
                    # 「休」「明け休み」以外の変数の合計 = 勤務日数
                    for st in SHIFT_TYPES + NIGHT_SHIFT_TYPES:
                        key = (staff_id, d, st)
                        if key in variables:
                            work_in_window.append(variables[key])
                if len(work_in_window) > max_consec:
                    model.Add(sum(work_in_window) <= max_consec)

    @staticmethod
    def _add_interval(
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
                early_next = (staff_id, day + 1, "早番")
                if late_key in variables and early_next in variables:
                    model.Add(
                        variables[late_key] + variables[early_next] <= 1
                    )

    @staticmethod
    def _add_night_shift_chain(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        days_in_month: int,
    ) -> None:
        """夜勤チェーン制約: 夜勤[d] → 明け休み[d+1] → 休[d+2]

        AddImplicationで実装:
        - 夜勤[d]=1 → 明け休み[d+1]=1
        - 夜勤[d]=1 → 休[d+2]=1
        - 明け休み[d]=1 → 夜勤[d-1]=1 (逆方向)
        - 月末2日間は夜勤不可（チェーン完結不能）
        """
        for staff in staff_list:
            staff_id = staff["id"]
            for day in range(1, days_in_month + 1):
                night_key = (staff_id, day, "夜勤")
                if night_key not in variables:
                    continue

                followup_key = (staff_id, day + 1, "明け休み")
                rest_key = (staff_id, day + 2, "休")

                # 夜勤→明け休み
                if followup_key in variables:
                    model.AddImplication(
                        variables[night_key], variables[followup_key]
                    )
                else:
                    # d+1が固定休日 → 夜勤不可
                    model.Add(variables[night_key] == 0)
                    continue

                # 夜勤→翌々日休
                if rest_key in variables:
                    model.AddImplication(
                        variables[night_key], variables[rest_key]
                    )
                else:
                    # d+2が固定休日なら自動的に休 → OK（制約不要）
                    pass

            # 逆方向: 明け休み[d] → 夜勤[d-1]
            for day in range(2, days_in_month + 1):
                followup_key = (staff_id, day, "明け休み")
                prev_night_key = (staff_id, day - 1, "夜勤")
                if followup_key in variables and prev_night_key in variables:
                    model.AddImplication(
                        variables[followup_key], variables[prev_night_key]
                    )
                elif followup_key in variables and prev_night_key not in variables:
                    # 前日に夜勤変数がない → 明け休みは不可
                    model.Add(variables[followup_key] == 0)

    @staticmethod
    def _add_weekly_work_count(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        days_in_month: int,
        fixed_rest: dict[str, set[int]],
        year: int,
        month: int,
    ) -> None:
        """月間勤務日数のハード上限制約

        下限は夜勤チェーンと矛盾しうるためソフト制約で扱う。
        上限のみハード制約として適用。
        """
        total_weeks = days_in_month / 7.0

        for staff in staff_list:
            staff_id = staff["id"]
            must = staff["weeklyWorkCount"]["must"]
            fixed = fixed_rest[staff_id]

            workable_days = days_in_month - len(fixed)
            target_max = min(int(must * total_weeks + 2), workable_days)

            work_vars = []
            for day in range(1, days_in_month + 1):
                if day in fixed:
                    continue
                for st in SHIFT_TYPES + NIGHT_SHIFT_TYPES:
                    key = (staff_id, day, st)
                    if key in variables:
                        work_vars.append(variables[key])

            if work_vars:
                model.Add(sum(work_vars) <= target_max)


class UnifiedObjectiveBuilder:
    """統合Solver用ソフト制約（目的関数）"""

    @staticmethod
    def add_all(
        model: cp_model.CpModel,
        variables: dict[tuple[str, int, str], cp_model.IntVar],
        staff_list: list[StaffDict],
        requirements: ShiftRequirementDict,
        days_in_month: int,
        is_night_facility: bool,
        fixed_rest: dict[str, set[int]],
    ) -> None:
        terms: list = []
        UnifiedObjectiveBuilder._add_preference_bonus(
            model, variables, staff_list, terms
        )
        UnifiedObjectiveBuilder._add_fairness(
            model, variables, staff_list, days_in_month, terms
        )
        if is_night_facility:
            UnifiedObjectiveBuilder._add_night_shift_fairness(
                model, variables, staff_list, days_in_month, terms
            )
        UnifiedObjectiveBuilder._add_rest_spacing(
            model, variables, staff_list, days_in_month, fixed_rest, terms
        )
        UnifiedObjectiveBuilder._add_work_count_target(
            model, variables, staff_list, days_in_month, fixed_rest, terms
        )
        if terms:
            model.Maximize(sum(terms))

    @staticmethod
    def _add_preference_bonus(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        terms: list,
    ) -> None:
        """timeSlotPreference適合ボーナス（重み: 10）

        日勤のみ希望のスタッフは変数生成時にハード制約化済みだが、
        追加のボーナスで安定化する。
        """
        weight = 10
        for staff in staff_list:
            staff_id = staff["id"]
            pref = staff["timeSlotPreference"]
            if pref == "日勤のみ":
                for (sid, day, st), var in variables.items():
                    if sid == staff_id and st == "日勤":
                        terms.append(weight * var)

    @staticmethod
    def _add_fairness(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        days_in_month: int,
        terms: list,
    ) -> None:
        """シフト種類の均等配分（重み: 5）"""
        weight = 5
        for staff in staff_list:
            staff_id = staff["id"]
            if staff["timeSlotPreference"] == "日勤のみ":
                continue
            if staff["timeSlotPreference"] == "夜勤のみ" or staff.get("isNightShiftOnly", False):
                continue

            shift_counts: dict[str, list] = {}
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

            types_list = list(shift_counts.keys())
            for i in range(len(types_list)):
                for j in range(i + 1, len(types_list)):
                    c_i = sum(shift_counts[types_list[i]])
                    c_j = sum(shift_counts[types_list[j]])
                    diff = model.NewIntVar(
                        0, days_in_month,
                        f"udiff_{staff_id}_{types_list[i]}_{types_list[j]}",
                    )
                    model.Add(diff >= c_i - c_j)
                    model.Add(diff >= c_j - c_i)
                    terms.append(weight * (days_in_month - diff))

    @staticmethod
    def _add_night_shift_fairness(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        days_in_month: int,
        terms: list,
    ) -> None:
        """夜勤回数の均等配分（重み: 8）

        夜勤可能スタッフ間で夜勤回数の差を最小化。
        """
        weight = 8
        night_eligible: list[tuple[str, list]] = []
        for staff in staff_list:
            if staff["timeSlotPreference"] == "日勤のみ":
                continue
            staff_id = staff["id"]
            night_vars = [
                variables[(staff_id, day, "夜勤")]
                for day in range(1, days_in_month + 1)
                if (staff_id, day, "夜勤") in variables
            ]
            if night_vars:
                night_eligible.append((staff_id, night_vars))

        for i in range(len(night_eligible)):
            for j in range(i + 1, len(night_eligible)):
                sid_i, vars_i = night_eligible[i]
                sid_j, vars_j = night_eligible[j]
                diff = model.NewIntVar(
                    0, days_in_month,
                    f"ndiff_{sid_i}_{sid_j}",
                )
                model.Add(diff >= sum(vars_i) - sum(vars_j))
                model.Add(diff >= sum(vars_j) - sum(vars_i))
                terms.append(weight * (days_in_month - diff))

    @staticmethod
    def _add_rest_spacing(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        days_in_month: int,
        fixed_rest: dict[str, set[int]],
        terms: list,
    ) -> None:
        """休日分散ボーナス（重み: 3）

        週ごとに休日がある → ボーナス。
        AddMaxEqualityの大量生成を避けた軽量版。
        """
        weight = 3
        for staff in staff_list:
            staff_id = staff["id"]
            fixed = fixed_rest[staff_id]

            # 7日ウィンドウ（非重複）で休日をカウント
            for week_start in range(1, days_in_month + 1, 7):
                week_end = min(week_start + 7, days_in_month + 1)
                rest_count = []
                for d in range(week_start, week_end):
                    if d in fixed:
                        rest_count.append(1)  # 定数
                    else:
                        rest_key = (staff_id, d, "休")
                        followup_key = (staff_id, d, "明け休み")
                        if rest_key in variables:
                            rest_count.append(variables[rest_key])
                        if followup_key in variables:
                            rest_count.append(variables[followup_key])
                if rest_count:
                    terms.append(weight * sum(rest_count))

    @staticmethod
    def _add_work_count_target(
        model: cp_model.CpModel,
        variables: dict,
        staff_list: list[StaffDict],
        days_in_month: int,
        fixed_rest: dict[str, set[int]],
        terms: list,
    ) -> None:
        """月間勤務日数の目標近接ボーナス（重み: 7）

        weeklyWorkCount.must × 週数 に近いほどボーナス。
        夜勤チェーンとの矛盾回避のためソフト制約で実装。
        """
        weight = 7
        total_weeks = days_in_month / 7.0

        for staff in staff_list:
            staff_id = staff["id"]
            must = staff["weeklyWorkCount"]["must"]
            fixed = fixed_rest[staff_id]
            target = int(must * total_weeks)

            work_vars = []
            for day in range(1, days_in_month + 1):
                if day in fixed:
                    continue
                for st in SHIFT_TYPES + NIGHT_SHIFT_TYPES:
                    key = (staff_id, day, st)
                    if key in variables:
                        work_vars.append(variables[key])

            if not work_vars:
                continue

            diff = model.NewIntVar(
                0, days_in_month,
                f"wdiff_{staff_id}",
            )
            total_work = sum(work_vars)
            model.Add(diff >= total_work - target)
            model.Add(diff >= target - total_work)
            terms.append(weight * (days_in_month - diff))
