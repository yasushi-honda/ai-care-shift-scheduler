"""Task 6.1-6.3: Cloud Functionエンドポイントのテスト"""

import json

from solver.types import SHIFT_TYPES
from tests.conftest import make_staff


class TestSolverEndpoint:
    """HTTPエンドポイントのテスト"""

    def _make_request_body(self, staff_list, skeleton, requirements, leave_requests=None):
        """テスト用リクエストボディ生成"""
        return {
            "staffList": staff_list,
            "skeleton": skeleton,
            "requirements": requirements,
            "leaveRequests": leave_requests or {},
        }

    def test_valid_request_returns_200(
        self, staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty, client
    ):
        """有効なリクエストで200レスポンス"""
        body = self._make_request_body(
            staff_list_5, skeleton_5_30, requirements_30, leave_requests_empty
        )
        response = client.post(
            "/solverGenerateShift",
            data=json.dumps(body),
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert len(data["schedule"]) == 5
        assert "solverStats" in data

    def test_missing_staff_list_returns_400(self, client):
        """staffList欠落で400エラー"""
        body = {"skeleton": {}, "requirements": {}}
        response = client.post(
            "/solverGenerateShift",
            data=json.dumps(body),
            content_type="application/json",
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data["success"] is False
        assert "staffList" in data["error"]

    def test_missing_skeleton_returns_400(self, client):
        """skeleton欠落で400エラー"""
        body = {"staffList": [], "requirements": {}}
        response = client.post(
            "/solverGenerateShift",
            data=json.dumps(body),
            content_type="application/json",
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data["success"] is False
        assert "skeleton" in data["error"]

    def test_missing_requirements_returns_400(self, client):
        """requirements欠落で400エラー"""
        body = {"staffList": [], "skeleton": {}}
        response = client.post(
            "/solverGenerateShift",
            data=json.dumps(body),
            content_type="application/json",
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data["success"] is False
        assert "requirements" in data["error"]

    def test_infeasible_returns_422(self, client):
        """INFEASIBLEケースで422エラー"""
        from solver.types import ShiftRequirementDict, ScheduleSkeletonDict, DailyRequirementDict

        staff_list = [make_staff("s1", "唯一のスタッフ")]
        skeleton = ScheduleSkeletonDict(
            staffSchedules=[{
                "staffId": "s1",
                "staffName": "唯一のスタッフ",
                "restDays": [],
                "nightShiftDays": [],
                "nightShiftFollowupDays": [],
            }]
        )
        requirements = ShiftRequirementDict(
            targetMonth="2026-03",
            timeSlots=[
                {"name": "早番", "start": "07:00", "end": "16:00", "restHours": 1.0},
                {"name": "日勤", "start": "09:00", "end": "18:00", "restHours": 1.0},
                {"name": "遅番", "start": "11:00", "end": "20:00", "restHours": 1.0},
            ],
            requirements={
                f"2026-03-{d:02d}_{st}": DailyRequirementDict(
                    totalStaff=2, requiredQualifications=[], requiredRoles=[]
                )
                for d in range(1, 32)
                for st in SHIFT_TYPES
            },
        )

        body = self._make_request_body(staff_list, skeleton, requirements)
        response = client.post(
            "/solverGenerateShift",
            data=json.dumps(body),
            content_type="application/json",
        )
        assert response.status_code == 422
        data = response.get_json()
        assert data["success"] is False
        assert data["errorType"] == "INFEASIBLE"
