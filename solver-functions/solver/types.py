"""
Python型定義（TypeScript functions/src/types.ts 互換）

TypeScript側の型定義との対応関係:
- StaffDict ← Staff interface
- StaffScheduleSkeletonDict ← StaffScheduleSkeleton interface
- ScheduleSkeletonDict ← ScheduleSkeleton interface
- DailyRequirementDict ← DailyRequirement interface
- ShiftRequirementDict ← ShiftRequirement interface
- StaffScheduleDict ← StaffSchedule interface
- GeneratedShiftDict ← GeneratedShift interface
- SolverResponse ← GenerateShiftResponse (Solver専用)
- SolverErrorResponse ← (Solver専用)
- SolverStats ← (Solver専用)
"""

from typing import Literal, TypedDict


# --- Enum値（TypeScript enum互換） ---

ROLES = ["管理者", "介護職員", "看護職員", "ケアマネージャー", "オペレーター", "機能訓練指導員"]

QUALIFICATIONS = [
    "介護福祉士", "看護師", "准看護師", "普通自動車免許",
    "理学療法士", "生活相談員", "介護職員初任者研修",
]

TIME_SLOT_PREFERENCES = ["日勤のみ", "夜勤のみ", "いつでも可"]

SHIFT_TYPES = ["早番", "日勤", "遅番"]
ALL_SHIFT_TYPES = ["早番", "日勤", "遅番", "夜勤", "休", "明け休み"]

LEAVE_TYPES = ["希望休", "有給休暇", "研修"]


# --- 入力型 ---

class WeeklyWorkCountDict(TypedDict):
    hope: int
    must: int


class StaffDict(TypedDict):
    id: str
    name: str
    role: str
    qualifications: list[str]
    weeklyWorkCount: WeeklyWorkCountDict
    maxConsecutiveWorkDays: int
    availableWeekdays: list[int]
    timeSlotPreference: str
    isNightShiftOnly: bool
    unavailableDates: list[str]  # ["2026-03-05", ...] 出勤不可日


class StaffScheduleSkeletonDict(TypedDict):
    staffId: str
    staffName: str
    restDays: list[int]
    nightShiftDays: list[int]
    nightShiftFollowupDays: list[int]


class ScheduleSkeletonDict(TypedDict):
    staffSchedules: list[StaffScheduleSkeletonDict]


class QualReqDict(TypedDict):
    qualification: str
    count: int


class RoleReqDict(TypedDict):
    role: str
    count: int


class DailyRequirementDict(TypedDict):
    totalStaff: int
    requiredQualifications: list[QualReqDict]
    requiredRoles: list[RoleReqDict]


class ShiftTimeDict(TypedDict):
    name: str
    start: str
    end: str
    restHours: float


class ShiftRequirementDict(TypedDict):
    targetMonth: str
    timeSlots: list[ShiftTimeDict]
    requirements: dict[str, DailyRequirementDict]


# --- 出力型 ---

class GeneratedShiftDict(TypedDict):
    date: str
    shiftType: str


class StaffScheduleDict(TypedDict):
    staffId: str
    staffName: str
    monthlyShifts: list[GeneratedShiftDict]


# --- Solver専用レスポンス型 ---

class SolverStats(TypedDict):
    status: str
    solveTimeMs: int
    numVariables: int
    numConstraints: int
    objectiveValue: int


class SolverResponse(TypedDict):
    success: bool
    schedule: list[StaffScheduleDict]
    solverStats: SolverStats


class SolverErrorResponse(TypedDict):
    success: Literal[False]
    error: str
    errorType: str
    details: dict


# --- リクエスト型 ---

class SolverRequest(TypedDict):
    staffList: list[StaffDict]
    skeleton: ScheduleSkeletonDict
    requirements: ShiftRequirementDict
    leaveRequests: dict[str, dict[str, str]]


class UnifiedSolverRequest(TypedDict):
    """統合Solver用リクエスト（skeletonなし）"""
    staffList: list[StaffDict]
    requirements: ShiftRequirementDict
    leaveRequests: dict[str, dict[str, str]]
