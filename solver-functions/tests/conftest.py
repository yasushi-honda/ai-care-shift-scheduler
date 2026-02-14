"""テスト共通フィクスチャ: 5名・30日のテストデータ"""

import pytest
from solver.types import (
    StaffDict,
    ScheduleSkeletonDict,
    ShiftRequirementDict,
    DailyRequirementDict,
)


def make_staff(
    staff_id: str,
    name: str,
    role: str = "介護職員",
    qualifications: list[str] | None = None,
    time_slot_preference: str = "いつでも可",
    is_night_shift_only: bool = False,
) -> StaffDict:
    return StaffDict(
        id=staff_id,
        name=name,
        role=role,
        qualifications=qualifications or [],
        weeklyWorkCount={"hope": 5, "must": 5},
        maxConsecutiveWorkDays=6,
        availableWeekdays=[0, 1, 2, 3, 4, 5, 6],
        timeSlotPreference=time_slot_preference,
        isNightShiftOnly=is_night_shift_only,
    )


@pytest.fixture
def staff_list_5() -> list[StaffDict]:
    """5名のスタッフリスト"""
    return [
        make_staff("s1", "田中太郎", role="看護職員", qualifications=["看護師"]),
        make_staff("s2", "佐藤花子", qualifications=["介護福祉士"]),
        make_staff("s3", "鈴木一郎", qualifications=["介護福祉士"]),
        make_staff("s4", "高橋美咲", time_slot_preference="日勤のみ"),
        make_staff("s5", "伊藤健太"),
    ]


@pytest.fixture
def skeleton_5_30() -> ScheduleSkeletonDict:
    """5名・30日のスケルトン（2026-03月想定）"""
    return ScheduleSkeletonDict(
        staffSchedules=[
            {
                "staffId": "s1",
                "staffName": "田中太郎",
                "restDays": [4, 5, 11, 12, 18, 19, 25, 26],
                "nightShiftDays": [3, 10],
                "nightShiftFollowupDays": [4, 5, 11, 12],
            },
            {
                "staffId": "s2",
                "staffName": "佐藤花子",
                "restDays": [6, 7, 13, 14, 20, 21, 27, 28],
                "nightShiftDays": [],
                "nightShiftFollowupDays": [],
            },
            {
                "staffId": "s3",
                "staffName": "鈴木一郎",
                "restDays": [1, 7, 8, 14, 15, 21, 22, 28],
                "nightShiftDays": [],
                "nightShiftFollowupDays": [],
            },
            {
                "staffId": "s4",
                "staffName": "高橋美咲",
                "restDays": [3, 4, 10, 11, 17, 18, 24, 25],
                "nightShiftDays": [],
                "nightShiftFollowupDays": [],
            },
            {
                "staffId": "s5",
                "staffName": "伊藤健太",
                "restDays": [5, 6, 12, 13, 19, 20, 26, 27],
                "nightShiftDays": [],
                "nightShiftFollowupDays": [],
            },
        ]
    )


@pytest.fixture
def requirements_30() -> ShiftRequirementDict:
    """30日分のシフト要件"""
    daily_req = DailyRequirementDict(
        totalStaff=1,
        requiredQualifications=[],
        requiredRoles=[],
    )
    reqs: dict[str, DailyRequirementDict] = {}
    for day in range(1, 32):  # 2026-03は31日
        for slot_name in ["早番", "日勤", "遅番"]:
            key = f"2026-03-{day:02d}_{slot_name}"
            reqs[key] = daily_req

    return ShiftRequirementDict(
        targetMonth="2026-03",
        timeSlots=[
            {"name": "早番", "start": "07:00", "end": "16:00", "restHours": 1.0},
            {"name": "日勤", "start": "09:00", "end": "18:00", "restHours": 1.0},
            {"name": "遅番", "start": "11:00", "end": "20:00", "restHours": 1.0},
        ],
        requirements=reqs,
    )


@pytest.fixture
def leave_requests_empty() -> dict[str, dict[str, str]]:
    """空の休暇申請"""
    return {}


@pytest.fixture
def client():
    """Flaskテストクライアント"""
    from solver.main import app
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c
