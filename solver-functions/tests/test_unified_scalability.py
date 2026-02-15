"""統合Solverスケーラビリティテスト

テスト目標:
- 15名: < 5秒
- 50名: < 15秒
- 100名: < 30秒（Phase 3目標）
"""

from __future__ import annotations

import time

import pytest

from solver.types import DailyRequirementDict, ShiftRequirementDict
from solver.service import UnifiedSolverService
from tests.conftest import make_staff


def _make_staff_n(n: int) -> list:
    """n名のスタッフリスト（資格・役割バリエーション付き）"""
    staff = []
    for i in range(1, n + 1):
        quals = []
        role = "介護職員"
        pref = "いつでも可"
        if i % 10 == 1:
            role = "看護職員"
            quals = ["看護師"]
        elif i % 5 == 0:
            quals = ["介護福祉士"]
        if i % 8 == 0:
            pref = "日勤のみ"
        staff.append(make_staff(f"s{i}", f"スタッフ{i}", role=role,
                                qualifications=quals,
                                time_slot_preference=pref))
    return staff


def _make_reqs(days: int = 31, total_staff: int = 2) -> ShiftRequirementDict:
    daily_req = DailyRequirementDict(
        totalStaff=total_staff,
        requiredQualifications=[],
        requiredRoles=[],
    )
    reqs = {}
    for day in range(1, days + 1):
        for st in ["早番", "日勤", "遅番"]:
            reqs[f"2026-03-{day:02d}_{st}"] = daily_req
    return ShiftRequirementDict(
        targetMonth="2026-03",
        timeSlots=[
            {"name": "早番", "start": "07:00", "end": "16:00", "restHours": 1.0},
            {"name": "日勤", "start": "09:00", "end": "18:00", "restHours": 1.0},
            {"name": "遅番", "start": "11:00", "end": "20:00", "restHours": 1.0},
        ],
        requirements=reqs,
    )


class TestScalability:

    def test_15_staff(self):
        """15名×31日: < 5秒"""
        staff = _make_staff_n(15)
        reqs = _make_reqs(total_staff=2)

        start = time.time()
        result = UnifiedSolverService.solve(staff, reqs, {})
        elapsed = time.time() - start

        assert result["success"] is True, f"Error: {result.get('error')}"
        assert elapsed < 5.0, f"15名で{elapsed:.1f}秒（目標: <5秒）"
        print(f"\n15名: {elapsed:.2f}秒, status={result['solverStats']['status']}")

    def test_50_staff(self):
        """50名×31日: < 15秒"""
        staff = _make_staff_n(50)
        reqs = _make_reqs(total_staff=5)

        start = time.time()
        result = UnifiedSolverService.solve(staff, reqs, {})
        elapsed = time.time() - start

        assert result["success"] is True, f"Error: {result.get('error')}"
        assert elapsed < 15.0, f"50名で{elapsed:.1f}秒（目標: <15秒）"
        print(f"\n50名: {elapsed:.2f}秒, status={result['solverStats']['status']}")

    @pytest.mark.slow
    def test_100_staff(self):
        """100名×31日: < 30秒（Phase 3目標）"""
        staff = _make_staff_n(100)
        reqs = _make_reqs(total_staff=10)

        start = time.time()
        result = UnifiedSolverService.solve(staff, reqs, {})
        elapsed = time.time() - start

        assert result["success"] is True, f"Error: {result.get('error')}"
        assert elapsed < 30.0, f"100名で{elapsed:.1f}秒（目標: <30秒）"
        print(f"\n100名: {elapsed:.2f}秒, status={result['solverStats']['status']}")
