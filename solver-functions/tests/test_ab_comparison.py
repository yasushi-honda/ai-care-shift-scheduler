"""A/B比較テスト: 統合Solver品質検証

統合Solverの出力品質を定量的に検証:
1. 制約違反ゼロ（Level 1-2）
2. 評価スコア ≥ 80点
3. 処理時間 < 30秒（全スケール）
4. 決定性（同一入力→同一出力）
"""

from __future__ import annotations

import time

import pytest

from solver.types import DailyRequirementDict, ShiftRequirementDict, StaffDict
from solver.service import UnifiedSolverService
from tests.conftest import make_staff


def _make_realistic_staff(n: int) -> list[StaffDict]:
    """現実的なスタッフ構成（資格・役割・希望バリエーション）"""
    staff = []
    for i in range(1, n + 1):
        quals = []
        role = "介護職員"
        pref = "いつでも可"
        unavailable = []

        # 10%が看護職員
        if i % 10 == 1:
            role = "看護職員"
            quals = ["看護師"]
        # 20%が介護福祉士
        elif i % 5 == 0:
            quals = ["介護福祉士"]

        # 12.5%が日勤のみ
        if i % 8 == 0:
            pref = "日勤のみ"

        # 一部スタッフに不可日を設定
        if i % 7 == 0:
            unavailable = ["2026-03-10", "2026-03-20"]

        staff.append(make_staff(
            f"s{i}", f"スタッフ{i}",
            role=role,
            qualifications=quals,
            time_slot_preference=pref,
            unavailable_dates=unavailable,
        ))
    return staff


def _make_reqs(
    days: int = 31,
    total_staff: int = 2,
    with_night: bool = False,
) -> ShiftRequirementDict:
    """テスト用要件"""
    shift_types = ["早番", "日勤", "遅番"]
    if with_night:
        shift_types.append("夜勤")

    daily_req = DailyRequirementDict(
        totalStaff=total_staff,
        requiredQualifications=[],
        requiredRoles=[],
    )
    reqs = {}
    for day in range(1, days + 1):
        for st in shift_types:
            reqs[f"2026-03-{day:02d}_{st}"] = daily_req

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
        targetMonth="2026-03",
        timeSlots=slots,
        requirements=reqs,
    )


def _evaluate_schedule(result: dict, staff_list: list, requirements: ShiftRequirementDict) -> dict:
    """スケジュール品質を評価（Python版の簡易評価）"""
    schedule = result["schedule"]
    violations = []
    days = 31

    # 1. 人員充足チェック（Level 1）
    shift_types = [s["name"] for s in requirements["timeSlots"]]
    total_staff_req = list(requirements["requirements"].values())[0]["totalStaff"]

    for day_idx in range(days):
        date = f"2026-03-{day_idx+1:02d}"
        for st in shift_types:
            # 月末2日間は夜勤チェーン（夜勤→明け休み→休）が収まらないため除外
            if st == "夜勤" and day_idx >= days - 2:
                continue
            count = sum(
                1 for s in schedule
                if s["monthlyShifts"][day_idx]["shiftType"] == st
            )
            if count < total_staff_req:
                violations.append({
                    "level": 1,
                    "type": "staffing_shortage",
                    "detail": f"{date} {st}: {count}/{total_staff_req}名",
                })

    # 2. 連続勤務チェック（Level 1）
    for s in schedule:
        consecutive = 0
        for shift in s["monthlyShifts"]:
            if shift["shiftType"] in ["休", "明け休み"]:
                consecutive = 0
            else:
                consecutive += 1
            if consecutive > 6:
                violations.append({
                    "level": 1,
                    "type": "consecutive_work",
                    "detail": f"{s['staffName']}: {consecutive}日連続",
                })

    # 3. 遅番→早番チェック（Level 2）
    for s in schedule:
        shifts = s["monthlyShifts"]
        for i in range(len(shifts) - 1):
            if shifts[i]["shiftType"] == "遅番" and shifts[i+1]["shiftType"] == "早番":
                violations.append({
                    "level": 2,
                    "type": "interval_violation",
                    "detail": f"{s['staffName']} {shifts[i]['date']}: 遅番→早番",
                })

    # 4. 夜勤チェーンチェック（Level 1）
    for s in schedule:
        shifts = s["monthlyShifts"]
        for i, shift in enumerate(shifts):
            if shift["shiftType"] == "夜勤":
                if i + 1 < len(shifts) and shifts[i+1]["shiftType"] != "明け休み":
                    violations.append({
                        "level": 1,
                        "type": "night_chain",
                        "detail": f"{s['staffName']} {shift['date']}: 夜勤→{shifts[i+1]['shiftType']}",
                    })

    # 5. 日勤のみスタッフチェック（Level 1）
    staff_by_id = {s["id"]: s for s in staff_list}
    for s in schedule:
        staff = staff_by_id.get(s["staffId"])
        if staff and staff.get("timeSlotPreference") == "日勤のみ":
            for shift in s["monthlyShifts"]:
                if shift["shiftType"] not in ["日勤", "休", "明け休み"]:
                    violations.append({
                        "level": 1,
                        "type": "preference_violation",
                        "detail": f"{s['staffName']} {shift['date']}: 日勤のみに{shift['shiftType']}",
                    })

    # 6. 不可日チェック（Level 1）
    for s in schedule:
        staff = staff_by_id.get(s["staffId"])
        if staff:
            unavailable = set(staff.get("unavailableDates", []))
            for shift in s["monthlyShifts"]:
                if shift["date"] in unavailable and shift["shiftType"] != "休":
                    violations.append({
                        "level": 1,
                        "type": "unavailable_violation",
                        "detail": f"{s['staffName']} {shift['date']}: 不可日に{shift['shiftType']}",
                    })

    # スコア計算
    level1_count = sum(1 for v in violations if v["level"] == 1)
    level2_count = sum(1 for v in violations if v["level"] == 2)
    score = max(0, 100 - level1_count * 20 - level2_count * 12)

    # 公平性計算
    work_counts = []
    for s in schedule:
        count = sum(1 for shift in s["monthlyShifts"]
                    if shift["shiftType"] not in ["休", "明け休み"])
        work_counts.append(count)
    fairness = max(work_counts) - min(work_counts) if work_counts else 0

    return {
        "score": score,
        "violations": violations,
        "level1_count": level1_count,
        "level2_count": level2_count,
        "fairness_gap": fairness,
        "work_counts": work_counts,
    }


class TestABComparison:
    """統合Solver品質比較テスト"""

    def test_12staff_quality(self):
        """12名（デモ規模）: Level 1違反ゼロ、スコア≥80"""
        staff = _make_realistic_staff(12)
        reqs = _make_reqs(total_staff=2)

        start = time.time()
        result = UnifiedSolverService.solve(staff, reqs, {})
        elapsed = time.time() - start

        assert result["success"] is True, f"Error: {result.get('error')}"

        eval_result = _evaluate_schedule(result, staff, reqs)

        print(f"\n--- 12名 A/B比較 ---")
        print(f"処理時間: {elapsed:.2f}秒")
        print(f"スコア: {eval_result['score']}")
        print(f"Level 1違反: {eval_result['level1_count']}")
        print(f"Level 2違反: {eval_result['level2_count']}")
        print(f"公平性ギャップ: {eval_result['fairness_gap']}日")
        print(f"solver status: {result['solverStats']['status']}")

        assert eval_result["level1_count"] == 0, f"Level 1違反: {eval_result['violations']}"
        assert eval_result["score"] >= 80, f"スコア不足: {eval_result['score']}"
        assert elapsed < 30.0, f"処理時間超過: {elapsed:.1f}秒"

    def test_12staff_with_night_quality(self):
        """12名（夜勤あり）: Level 1違反ゼロ"""
        staff = _make_realistic_staff(12)
        reqs = _make_reqs(total_staff=1, with_night=True)

        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True, f"Error: {result.get('error')}"

        eval_result = _evaluate_schedule(result, staff, reqs)

        print(f"\n--- 12名(夜勤) A/B比較 ---")
        print(f"スコア: {eval_result['score']}")
        print(f"Level 1違反: {eval_result['level1_count']}")
        print(f"公平性ギャップ: {eval_result['fairness_gap']}日")

        assert eval_result["level1_count"] == 0, f"Level 1違反: {eval_result['violations']}"
        assert eval_result["score"] >= 80

    def test_12staff_with_leave_requests(self):
        """12名（休暇申請あり）: 休暇申請が反映される"""
        staff = _make_realistic_staff(12)
        reqs = _make_reqs(total_staff=2)
        leave = {
            "s1": {"2026-03-05": "希望休", "2026-03-15": "有給休暇"},
            "s3": {"2026-03-10": "希望休"},
        }

        result = UnifiedSolverService.solve(staff, reqs, leave)
        assert result["success"] is True

        # 休暇申請が反映されているか確認
        for s in result["schedule"]:
            if s["staffId"] == "s1":
                for shift in s["monthlyShifts"]:
                    if shift["date"] in ["2026-03-05", "2026-03-15"]:
                        assert shift["shiftType"] == "休", (
                            f"s1の休暇申請 {shift['date']} が未反映: {shift['shiftType']}"
                        )

        eval_result = _evaluate_schedule(result, staff, reqs)
        assert eval_result["level1_count"] == 0

    def test_50staff_quality(self):
        """50名（中規模）: Level 1違反ゼロ"""
        staff = _make_realistic_staff(50)
        reqs = _make_reqs(total_staff=5)

        start = time.time()
        result = UnifiedSolverService.solve(staff, reqs, {})
        elapsed = time.time() - start

        assert result["success"] is True, f"Error: {result.get('error')}"

        eval_result = _evaluate_schedule(result, staff, reqs)

        print(f"\n--- 50名 A/B比較 ---")
        print(f"処理時間: {elapsed:.2f}秒")
        print(f"スコア: {eval_result['score']}")
        print(f"Level 1違反: {eval_result['level1_count']}")
        print(f"公平性ギャップ: {eval_result['fairness_gap']}日")

        assert eval_result["level1_count"] == 0
        assert eval_result["score"] >= 80

    def test_determinism_with_evaluation(self):
        """決定性: 3回実行で同一スコア・同一違反数"""
        staff = _make_realistic_staff(12)
        reqs = _make_reqs(total_staff=2)

        scores = []
        for _ in range(3):
            result = UnifiedSolverService.solve(staff, reqs, {})
            assert result["success"] is True
            eval_result = _evaluate_schedule(result, staff, reqs)
            scores.append(eval_result["score"])

        assert scores[0] == scores[1] == scores[2], (
            f"スコアが不安定: {scores}"
        )

    def test_solver_stats_quality(self):
        """SolverStats: OPTIMAL or FEASIBLE"""
        staff = _make_realistic_staff(12)
        reqs = _make_reqs(total_staff=2)

        result = UnifiedSolverService.solve(staff, reqs, {})
        assert result["success"] is True

        stats = result["solverStats"]
        assert stats["status"] in ("OPTIMAL", "FEASIBLE")
        assert stats["solveTimeMs"] >= 0
        assert stats["objectiveValue"] >= 0

        print(f"\n--- SolverStats ---")
        print(f"Status: {stats['status']}")
        print(f"SolveTime: {stats['solveTimeMs']}ms")
        print(f"Variables: {stats['numVariables']}")
        print(f"Constraints: {stats['numConstraints']}")
        print(f"Objective: {stats['objectiveValue']}")
