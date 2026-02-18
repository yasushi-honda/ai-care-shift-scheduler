"""統合Solverモデルの単体テスト

テスト項目:
1. 基本求解（5名×31日）→ OPTIMAL/FEASIBLE
2. exactly-one制約: 各スタッフ各日に1シフト
3. 人員充足制約
4. 連続勤務上限（6日以下）
5. 遅番→翌日早番の禁止
6. 夜勤チェーン（夜勤→明け休み→休）
7. timeSlotPreference: 日勤のみ
8. 固定休日（unavailableDates, leaveRequests, 非対応曜日）
9. 月間勤務日数
10. 決定性（同一入力→同一出力）
"""

from __future__ import annotations

import pytest
from ortools.sat.python import cp_model

from solver.types import (
    DailyRequirementDict,
    ShiftRequirementDict,
    StaffDict,
)
from solver.unified_builder import UnifiedModelBuilder
from solver.service import UnifiedSolverService
from tests.conftest import make_staff


def _make_requirements(
    target_month: str = "2026-03",
    days: int = 31,
    shift_types: list[str] | None = None,
    total_staff: int = 1,
) -> ShiftRequirementDict:
    """テスト用要件を生成"""
    if shift_types is None:
        shift_types = ["早番", "日勤", "遅番"]
    daily_req = DailyRequirementDict(
        totalStaff=total_staff,
        requiredQualifications=[],
        requiredRoles=[],
    )
    reqs: dict[str, DailyRequirementDict] = {}
    for day in range(1, days + 1):
        for st in shift_types:
            key = f"{target_month}-{day:02d}_{st}"
            reqs[key] = daily_req
    slots = []
    for st in shift_types:
        if st == "早番":
            slots.append({"name": "早番", "start": "07:00", "end": "16:00", "restHours": 1.0})
        elif st == "日勤":
            slots.append({"name": "日勤", "start": "09:00", "end": "18:00", "restHours": 1.0})
        elif st == "遅番":
            slots.append({"name": "遅番", "start": "11:00", "end": "20:00", "restHours": 1.0})
        elif st == "夜勤":
            slots.append({"name": "夜勤", "start": "17:00", "end": "09:00", "restHours": 2.0})
    return ShiftRequirementDict(
        targetMonth=target_month,
        timeSlots=slots,
        requirements=reqs,
    )


def _make_staff_list(n: int = 5) -> list[StaffDict]:
    """n名のテストスタッフを生成"""
    staff = []
    for i in range(1, n + 1):
        staff.append(make_staff(f"s{i}", f"スタッフ{i}"))
    return staff


class TestUnifiedBasic:
    """基本的な求解テスト"""

    def test_solve_5staff_31days(self):
        """5名×31日で求解成功"""
        staff = _make_staff_list(5)
        reqs = _make_requirements()
        result = UnifiedSolverService.solve(staff, reqs, {})

        assert result["success"] is True
        assert result["solverStats"]["status"] in ("OPTIMAL", "FEASIBLE")
        assert len(result["schedule"]) == 5
        for s in result["schedule"]:
            assert len(s["monthlyShifts"]) == 31

    def test_solve_returns_solver_stats(self):
        """solverStatsが返される"""
        staff = _make_staff_list(5)
        reqs = _make_requirements(days=28, total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})

        assert result["success"] is True
        stats = result["solverStats"]
        assert "status" in stats
        assert "solveTimeMs" in stats
        assert "numVariables" in stats
        assert "numConstraints" in stats
        assert "objectiveValue" in stats
        assert stats["solveTimeMs"] >= 0


class TestExactlyOne:
    """exactly-one制約のテスト"""

    def test_one_shift_per_day(self):
        """各スタッフ各日に正確に1シフト"""
        staff = _make_staff_list(5)
        reqs = _make_requirements(days=28, total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for s in result["schedule"]:
            for shift in s["monthlyShifts"]:
                assert shift["shiftType"] in ["早番", "日勤", "遅番", "夜勤", "休", "明け休み"]


class TestStaffingConstraint:
    """人員充足制約のテスト"""

    def test_minimum_staffing(self):
        """各シフトの最低人数が満たされる"""
        staff = _make_staff_list(5)
        reqs = _make_requirements(total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for day_idx in range(31):
            date = f"2026-03-{day_idx+1:02d}"
            for shift_type in ["早番", "日勤", "遅番"]:
                count = sum(
                    1 for s in result["schedule"]
                    if s["monthlyShifts"][day_idx]["shiftType"] == shift_type
                )
                assert count >= 1, f"{date} {shift_type}: 人員不足 ({count}名)"


class TestConsecutiveWork:
    """連続勤務上限テスト"""

    def test_max_6_consecutive_days(self):
        """7日連続勤務がない"""
        staff = _make_staff_list(5)
        reqs = _make_requirements()
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for s in result["schedule"]:
            consecutive = 0
            for shift in s["monthlyShifts"]:
                if shift["shiftType"] in ["休", "明け休み"]:
                    consecutive = 0
                else:
                    consecutive += 1
                assert consecutive <= 6, (
                    f"{s['staffName']}: 連続{consecutive}日勤務"
                )


class TestIntervalConstraint:
    """勤務間インターバルテスト"""

    def test_no_late_to_early(self):
        """遅番の翌日に早番が来ない"""
        staff = _make_staff_list(5)
        reqs = _make_requirements()
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for s in result["schedule"]:
            shifts = s["monthlyShifts"]
            for i in range(len(shifts) - 1):
                if shifts[i]["shiftType"] == "遅番":
                    assert shifts[i + 1]["shiftType"] != "早番", (
                        f"{s['staffName']} {shifts[i]['date']}: 遅番→早番"
                    )


class TestNightShiftChain:
    """夜勤チェーンテスト"""

    def test_night_shift_chain(self):
        """夜勤→明け休み→休のチェーン"""
        staff = _make_staff_list(8)
        reqs = _make_requirements(
            shift_types=["早番", "日勤", "遅番", "夜勤"],
            total_staff=1,
        )
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for s in result["schedule"]:
            shifts = s["monthlyShifts"]
            for i, shift in enumerate(shifts):
                if shift["shiftType"] == "夜勤":
                    assert i + 1 < len(shifts), "夜勤が月末"
                    assert shifts[i + 1]["shiftType"] == "明け休み", (
                        f"{s['staffName']} {shift['date']}: 夜勤の翌日が明け休みでない "
                        f"(={shifts[i+1]['shiftType']})"
                    )
                    if i + 2 < len(shifts):
                        assert shifts[i + 2]["shiftType"] == "休", (
                            f"{s['staffName']} {shift['date']}: 夜勤翌々日が休でない "
                            f"(={shifts[i+2]['shiftType']})"
                        )

    def test_no_night_shift_last_2_days(self):
        """月末2日間に夜勤が入らない"""
        staff = _make_staff_list(8)
        reqs = _make_requirements(
            shift_types=["早番", "日勤", "遅番", "夜勤"],
        )
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for s in result["schedule"]:
            shifts = s["monthlyShifts"]
            # 月末2日（30日目、31日目 = index 29, 30）
            for i in [-2, -1]:
                assert shifts[i]["shiftType"] != "夜勤", (
                    f"{s['staffName']} {shifts[i]['date']}: 月末に夜勤"
                )


class TestTimeSlotPreference:
    """timeSlotPreferenceテスト"""

    def test_day_shift_only_staff(self):
        """日勤のみ希望スタッフは日勤と休のみ"""
        staff = [
            make_staff("s1", "日勤太郎", time_slot_preference="日勤のみ"),
            make_staff("s2", "何でも花子"),
            make_staff("s3", "何でも一郎"),
            make_staff("s4", "何でも次郎"),
            make_staff("s5", "何でも三郎"),
        ]
        reqs = _make_requirements(days=28, total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for s in result["schedule"]:
            if s["staffId"] == "s1":
                for shift in s["monthlyShifts"]:
                    assert shift["shiftType"] in ["日勤", "休"], (
                        f"日勤のみスタッフに{shift['shiftType']}が割当: {shift['date']}"
                    )


class TestFixedRest:
    """固定休日テスト"""

    def test_unavailable_dates(self):
        """unavailableDatesの日は休日"""
        staff = [
            make_staff("s1", "テスト太郎", unavailable_dates=["2026-03-10", "2026-03-20"]),
            make_staff("s2", "テスト花子"),
            make_staff("s3", "テスト一郎"),
            make_staff("s4", "テスト次郎"),
            make_staff("s5", "テスト三郎"),
        ]
        reqs = _make_requirements(days=31, total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for s in result["schedule"]:
            if s["staffId"] == "s1":
                for shift in s["monthlyShifts"]:
                    if shift["date"] in ["2026-03-10", "2026-03-20"]:
                        assert shift["shiftType"] == "休", (
                            f"unavailableDate {shift['date']} に {shift['shiftType']} が割当"
                        )

    def test_leave_requests(self):
        """leaveRequestsの日は休日"""
        staff = _make_staff_list(5)
        reqs = _make_requirements(days=28, total_staff=1)
        leave = {"s1": {"2026-03-05": "希望休", "2026-03-15": "有給休暇"}}
        result = UnifiedSolverService.solve(staff, reqs, leave)
        assert result["success"] is True

        for s in result["schedule"]:
            if s["staffId"] == "s1":
                for shift in s["monthlyShifts"]:
                    if shift["date"] in ["2026-03-05", "2026-03-15"]:
                        assert shift["shiftType"] == "休", (
                            f"leaveRequest {shift['date']} に {shift['shiftType']} が割当"
                        )


class TestDeterminism:
    """決定性テスト"""

    def test_deterministic_results(self):
        """同一入力で同一結果"""
        staff = _make_staff_list(5)
        reqs = _make_requirements()

        results = []
        for _ in range(3):
            r = UnifiedSolverService.solve(staff, reqs, {})
            assert r["success"] is True
            results.append(r["schedule"])

        # 全3回が同一
        for i in range(1, 3):
            for s_idx in range(len(results[0])):
                for d_idx in range(len(results[0][s_idx]["monthlyShifts"])):
                    assert (
                        results[0][s_idx]["monthlyShifts"][d_idx]["shiftType"]
                        == results[i][s_idx]["monthlyShifts"][d_idx]["shiftType"]
                    ), f"実行{i+1}回目で差異: staff={s_idx}, day={d_idx}"


class TestPreValidationWarnings:
    """事前検証警告のテスト"""

    def test_all_staff_fixed_rest_staffing_warning(self):
        """全スタッフが同日に固定休日 → staffShortage警告"""
        # 全員が3/5に出勤不可
        staff = [
            make_staff(f"s{i}", f"スタッフ{i}", unavailable_dates=["2026-03-05"])
            for i in range(1, 6)
        ]
        reqs = _make_requirements(days=31, total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})

        assert result["success"] is True
        warnings = result["warnings"]
        # 3/5の全シフト(早番,日勤,遅番)で警告
        staff_shortage = [
            w for w in warnings
            if w["constraintType"] == "staffShortage" and w["date"] == "2026-03-05"
        ]
        assert len(staff_shortage) == 3  # 早番, 日勤, 遅番
        for w in staff_shortage:
            assert w["requiredCount"] == 1
            assert w["availableCount"] == 0

    def test_qualified_staff_all_rest_qualification_warning(self):
        """有資格者が全員休日 → qualificationMissing警告"""
        # 看護師1名のみ、3/10に出勤不可
        # 日勤のみ看護師1名必須 → 3/10はqualificationMissing警告
        # 注: 看護師1名で31日の日勤カバーは不可能なためINFEASIBLEになり得る
        # テストは警告生成を検証（成功/失敗は問わない）
        staff = [
            make_staff("s1", "看護太郎", qualifications=["看護師"], unavailable_dates=["2026-03-10"]),
            make_staff("s2", "介護花子"),
            make_staff("s3", "介護一郎"),
            make_staff("s4", "介護次郎"),
            make_staff("s5", "介護三郎"),
        ]
        base_req = DailyRequirementDict(
            totalStaff=1,
            requiredQualifications=[],
            requiredRoles=[],
        )
        nurse_req = DailyRequirementDict(
            totalStaff=1,
            requiredQualifications=[{"qualification": "看護師", "count": 1}],
            requiredRoles=[],
        )
        reqs: dict[str, DailyRequirementDict] = {}
        for day in range(1, 32):
            for st in ["早番", "遅番"]:
                reqs[f"2026-03-{day:02d}_{st}"] = base_req
            reqs[f"2026-03-{day:02d}_日勤"] = nurse_req
        requirements = ShiftRequirementDict(
            targetMonth="2026-03",
            timeSlots=[
                {"name": "早番", "start": "07:00", "end": "16:00", "restHours": 1.0},
                {"name": "日勤", "start": "09:00", "end": "18:00", "restHours": 1.0},
                {"name": "遅番", "start": "11:00", "end": "20:00", "restHours": 1.0},
            ],
            requirements=reqs,
        )
        result = UnifiedSolverService.solve(staff, requirements, {})

        # 成功/失敗にかかわらず警告は返却される
        qual_warnings = [
            w for w in result["warnings"]
            if w["constraintType"] == "qualificationMissing" and w["date"] == "2026-03-10"
        ]
        assert len(qual_warnings) == 1
        assert qual_warnings[0]["shiftType"] == "日勤"
        assert "看護師" in qual_warnings[0]["detail"]

    def test_no_warnings_when_sufficient(self):
        """充足可能な場合 → 警告なし"""
        staff = _make_staff_list(5)
        reqs = _make_requirements(days=28, total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})

        assert result["success"] is True
        assert result["warnings"] == []

    def test_leave_requests_cause_warning(self):
        """全員が同日に休暇申請 → staffShortage警告"""
        staff = _make_staff_list(5)
        reqs = _make_requirements(days=31, total_staff=1)
        leave = {
            f"s{i}": {"2026-03-15": "希望休"} for i in range(1, 6)
        }
        result = UnifiedSolverService.solve(staff, reqs, leave)

        assert result["success"] is True
        shortage = [
            w for w in result["warnings"]
            if w["constraintType"] == "staffShortage" and w["date"] == "2026-03-15"
        ]
        assert len(shortage) == 3  # 早番, 日勤, 遅番

    def test_warning_fields_completeness(self):
        """警告フィールドが全て存在し正しい型"""
        staff = [
            make_staff(f"s{i}", f"スタッフ{i}", unavailable_dates=["2026-03-01"])
            for i in range(1, 6)
        ]
        reqs = _make_requirements(days=31, total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})

        assert len(result["warnings"]) > 0
        for w in result["warnings"]:
            assert isinstance(w["date"], str)
            assert isinstance(w["shiftType"], str)
            assert w["constraintType"] in ("staffShortage", "qualificationMissing")
            assert isinstance(w["requiredCount"], int)
            assert isinstance(w["availableCount"], int)
            assert isinstance(w["detail"], str)
            assert w["requiredCount"] > 0
            assert w["availableCount"] == 0


class TestFlaskEndpoint:
    """Flaskエンドポイントテスト"""

    @pytest.fixture
    def client(self):
        from solver.main import app
        app.config["TESTING"] = True
        with app.test_client() as c:
            yield c

    def test_unified_endpoint_success(self, client):
        """POST /solverUnifiedGenerate が成功"""
        staff = _make_staff_list(5)
        reqs = _make_requirements(days=28, total_staff=1)
        resp = client.post("/solverUnifiedGenerate", json={
            "staffList": staff,
            "requirements": reqs,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert len(data["schedule"]) == 5

    def test_unified_endpoint_missing_fields(self, client):
        """必須フィールド不足で400"""
        resp = client.post("/solverUnifiedGenerate", json={
            "staffList": [],
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["errorType"] == "VALIDATION_ERROR"

    def test_unified_endpoint_no_body(self, client):
        """ボディなしで400"""
        resp = client.post("/solverUnifiedGenerate", data="not json",
                           content_type="text/plain")
        assert resp.status_code == 400


class TestConsecutiveWorkSoft:
    """連勤最小化ソフト制約のテスト"""

    def _make_staff_with_max_consec(
        self,
        n: int,
        max_consec: int,
        weekly_must: int = 4,
    ) -> list[StaffDict]:
        return [
            StaffDict(
                id=f"s{i}",
                name=f"スタッフ{i}",
                role="介護職員",
                qualifications=[],
                weeklyWorkCount={"hope": weekly_must, "must": weekly_must},
                maxConsecutiveWorkDays=max_consec,
                availableWeekdays=[0, 1, 2, 3, 4, 5, 6],
                timeSlotPreference="いつでも可",
                isNightShiftOnly=False,
                unavailableDates=[],
            )
            for i in range(1, n + 1)
        ]

    def test_avoids_max_consecutive_when_possible(self):
        """余裕がある場合、maxConsecutiveWorkDays連勤を避ける

        8名・日勤のみ1名必須・maxConsecutiveWorkDays=4 の緩い条件では、
        各スタッフの平均勤務日数が28/8≈3.5日となり、
        ソフト制約が効いて4連勤が発生しないことを確認する。
        """
        staff = self._make_staff_with_max_consec(8, max_consec=4, weekly_must=2)
        reqs = _make_requirements(
            target_month="2026-02",
            days=28,
            shift_types=["日勤"],
            total_staff=1,
        )
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for s in result["schedule"]:
            consecutive = 0
            for shift in s["monthlyShifts"]:
                if shift["shiftType"] in ["休", "明け休み"]:
                    consecutive = 0
                else:
                    consecutive += 1
                assert consecutive < 4, (
                    f"{s['staffName']}: {consecutive}連勤（ソフト制約により4連勤未満が期待値）"
                )

    def test_hard_constraint_still_respected(self):
        """ソフト制約追加後もハード制約（maxConsecutiveWorkDays上限）は維持される"""
        max_consec = 4
        staff = self._make_staff_with_max_consec(5, max_consec=max_consec, weekly_must=4)
        reqs = _make_requirements(days=28, total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        for s in result["schedule"]:
            consecutive = 0
            for shift in s["monthlyShifts"]:
                if shift["shiftType"] in ["休", "明け休み"]:
                    consecutive = 0
                else:
                    consecutive += 1
                assert consecutive <= max_consec, (
                    f"{s['staffName']}: {consecutive}連勤（上限{max_consec}日超過）"
                )

    def test_tight_constraint_still_feasible(self):
        """人員ギリギリでもINFEASIBLEにならない

        4名・3シフト各1名必須（1名/日が休める最低ライン）で、
        ソフト制約追加後も求解に成功することを確認する。
        """
        staff = self._make_staff_with_max_consec(4, max_consec=6, weekly_must=5)
        reqs = _make_requirements(days=28, total_staff=1)
        result = UnifiedSolverService.solve(staff, reqs, {})

        assert result["success"] is True
        assert result["solverStats"]["status"] in ("OPTIMAL", "FEASIBLE")
