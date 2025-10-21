
import { Role, Qualification, TimeSlotPreference, ShiftTime, LeaveType } from './types';

export const ROLES: Role[] = [
  Role.Admin,
  Role.CareWorker,
  Role.Nurse,
  Role.CareManager,
  Role.Operator,
];

export const QUALIFICATIONS: Qualification[] = [
  Qualification.CertifiedCareWorker,
  Qualification.RegisteredNurse,
  Qualification.LicensedPracticalNurse,
  Qualification.DriversLicense,
];

export const TIME_SLOT_PREFERENCES: TimeSlotPreference[] = [
  TimeSlotPreference.DayOnly,
  TimeSlotPreference.NightOnly,
  TimeSlotPreference.Any,
];

export const LEAVE_TYPES: LeaveType[] = [
  LeaveType.Hope,
  LeaveType.PaidLeave,
  LeaveType.Training,
];

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const DEFAULT_TIME_SLOTS: ShiftTime[] = [
  { name: "早番", start: "07:00", end: "16:00", restHours: 1 },
  { name: "日勤", start: "09:00", end: "18:00", restHours: 1 },
  { name: "遅番", start: "11:00", end: "20:00", restHours: 1 },
  { name: "夜勤", start: "16:00", end: "09:00", restHours: 2 },
];
