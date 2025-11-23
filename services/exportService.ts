import type { StaffSchedule, Staff, ShiftRequirement } from '../types';
import { WEEKDAYS } from '../constants';

const getFormattedScheduleData = (
    schedule: StaffSchedule[],
    staffList: Staff[],
    requirements: ShiftRequirement,
) => {
  const staffMap = new Map(staffList.map(s => [s.id, s]));
  const timeSlotMap = new Map(requirements.timeSlots.map(ts => [ts.name, ts]));

  // データを日付とスタッフでフラットなリストに変換
  const flatSchedule: { date: Date; staffId: string; shiftType: string }[] = [];
  schedule.forEach(staffSchedule => {
    staffSchedule.monthlyShifts.forEach(shift => {
      flatSchedule.push({
        date: new Date(shift.date + 'T00:00:00'),
        staffId: staffSchedule.staffId,
        shiftType: shift.plannedShiftType || shift.shiftType || '休',
      });
    });
  });

  // 日付、次にスタッフ名でソート
  flatSchedule.sort((a, b) => {
    if (a.date.getTime() !== b.date.getTime()) {
      return a.date.getTime() - b.date.getTime();
    }
    const staffA = staffMap.get(a.staffId)?.name || '';
    const staffB = staffMap.get(b.staffId)?.name || '';
    return staffA.localeCompare(staffB);
  });

  return flatSchedule.map(({ date, staffId, shiftType }) => {
    const staff = staffMap.get(staffId);
    if (!staff) return null;

    const yyyymmdd = date.toISOString().split('T')[0];
    const dayOfWeek = WEEKDAYS[date.getDay()];
    
    let startTime = '', endTime = '', restHours = 0, workHours = 0;
    const timeSlot = timeSlotMap.get(shiftType);

    if (timeSlot) {
      startTime = timeSlot.start;
      endTime = timeSlot.end;
      restHours = timeSlot.restHours;
      
      const start = new Date(`1970-01-01T${timeSlot.start}:00`);
      let end = new Date(`1970-01-01T${timeSlot.end}:00`);
      
      if (end < start) { // 日付をまたぐ場合
        end.setDate(end.getDate() + 1);
      }
      
      const diffMs = end.getTime() - start.getTime();
      workHours = (diffMs / (1000 * 60 * 60)) - restHours;
    }

    return {
      date: yyyymmdd,
      dayOfWeek: dayOfWeek,
      staffName: staff.name,
      role: staff.role,
      qualifications: staff.qualifications.join(', '),
      shiftType: shiftType,
      startTime: startTime,
      endTime: endTime,
      restHours: restHours,
      workHours: workHours > 0 ? parseFloat(workHours.toFixed(2)) : 0,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}

const escapeCSVField = (field: string) => {
  // フィールドにカンマ、ダブルクォート、改行が含まれる場合はダブルクォートで囲む
  if (/[",\n\r]/.test(field)) {
    // 内部のダブルクォートは2つにエスケープする
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};

export const exportToCSV = (
  schedule: StaffSchedule[],
  staffList: Staff[],
  requirements: ShiftRequirement,
) => {
  const headers = [
    '日付', '曜日', 'スタッフ名', '役職', '資格', '勤務区分',
    '始業時刻', '終業時刻', '休憩時間', '実労働時間'
  ];

  const data = getFormattedScheduleData(schedule, staffList, requirements);

  const rows = data.map(d => [
    d.date,
    d.dayOfWeek,
    d.staffName,
    d.role,
    escapeCSVField(d.qualifications),
    d.shiftType,
    d.startTime,
    d.endTime,
    d.restHours.toString(),
    d.workHours.toString(),
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" // BOMを追加してExcelでの文字化けを防ぐ
    + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const targetMonth = requirements.targetMonth.replace('-', '');
  link.setAttribute("download", `shift_log_${targetMonth}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
