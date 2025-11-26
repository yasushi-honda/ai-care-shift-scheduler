
import { Role, Qualification, TimeSlotPreference, ShiftTime, LeaveType, ShiftColor, ShiftTypeConfig } from './types';

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

// ==================== シフトタイプ設定（Phase 38）====================

// シフト表示色プリセット
export const SHIFT_COLOR_PRESETS: Record<string, ShiftColor> = {
  sky: { background: 'bg-sky-100', text: 'text-sky-700' },
  emerald: { background: 'bg-emerald-100', text: 'text-emerald-700' },
  amber: { background: 'bg-amber-100', text: 'text-amber-700' },
  indigo: { background: 'bg-indigo-100', text: 'text-indigo-700' },
  slate: { background: 'bg-slate-100', text: 'text-slate-700' },
  rose: { background: 'bg-rose-100', text: 'text-rose-700' },
  violet: { background: 'bg-violet-100', text: 'text-violet-700' },
  cyan: { background: 'bg-cyan-100', text: 'text-cyan-700' },
  lime: { background: 'bg-lime-100', text: 'text-lime-700' },
  orange: { background: 'bg-orange-100', text: 'text-orange-700' },
};

// デフォルトシフトタイプ設定
export const DEFAULT_SHIFT_TYPES: ShiftTypeConfig[] = [
  {
    id: 'early',
    name: '早番',
    start: '07:00',
    end: '16:00',
    restHours: 1,
    color: SHIFT_COLOR_PRESETS.sky,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'day',
    name: '日勤',
    start: '09:00',
    end: '18:00',
    restHours: 1,
    color: SHIFT_COLOR_PRESETS.emerald,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'late',
    name: '遅番',
    start: '11:00',
    end: '20:00',
    restHours: 1,
    color: SHIFT_COLOR_PRESETS.amber,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'night',
    name: '夜勤',
    start: '16:00',
    end: '09:00',
    restHours: 2,
    color: SHIFT_COLOR_PRESETS.indigo,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'off',
    name: '休',
    start: '',
    end: '',
    restHours: 0,
    color: SHIFT_COLOR_PRESETS.slate,
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'postnight',
    name: '明け休み',
    start: '',
    end: '',
    restHours: 0,
    color: SHIFT_COLOR_PRESETS.rose,
    isActive: true,
    sortOrder: 6,
  },
];

// デフォルトシフトサイクル（ダブルクリック時のサイクル順序）
export const DEFAULT_SHIFT_CYCLE: string[] = ['early', 'day', 'late', 'night', 'off', 'postnight'];
