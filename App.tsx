import React, { useState, useCallback } from 'react';
import {
  Role, Qualification, TimeSlotPreference, LeaveType,
  type Staff, type ShiftRequirement, type StaffSchedule, type GeneratedShift, type LeaveRequest, type WorkLogs, type WorkLogDetails
} from './types';
import { DEFAULT_TIME_SLOTS } from './constants';
import { generateShiftSchedule } from './services/geminiService';
import { exportToCSV } from './services/exportService';
import ShiftTable from './components/ShiftTable';
import Accordion from './components/Accordion';
import MonthNavigator from './components/MonthNavigator';
import StaffSettings from './components/StaffSettings';
import LeaveRequestCalendar from './components/LeaveRequestCalendar';
import ConfirmModal from './components/ConfirmModal';

const initialStaff: Staff[] = [
  { id: 's001', name: '田中 愛', role: Role.Nurse, qualifications: [Qualification.RegisteredNurse, Qualification.DriversLicense], weeklyWorkCount: { hope: 4, must: 4 }, maxConsecutiveWorkDays: 5, availableWeekdays: [1,2,3,4,5], unavailableDates: ['2025-11-10', '2025-11-22'], timeSlotPreference: TimeSlotPreference.Any, isNightShiftOnly: false },
  { id: 's002', name: '鈴木 太郎', role: Role.CareWorker, qualifications: [Qualification.CertifiedCareWorker, Qualification.DriversLicense], weeklyWorkCount: { hope: 5, must: 5 }, maxConsecutiveWorkDays: 4, availableWeekdays: [0,1,2,5,6], unavailableDates: [], timeSlotPreference: TimeSlotPreference.DayOnly, isNightShiftOnly: false },
  { id: 's003', name: '佐藤 花子', role: Role.CareWorker, qualifications: [Qualification.CertifiedCareWorker], weeklyWorkCount: { hope: 3, must: 3 }, maxConsecutiveWorkDays: 5, availableWeekdays: [1,2,3,4,5,6], unavailableDates: [], timeSlotPreference: TimeSlotPreference.Any, isNightShiftOnly: false },
  { id: 's004', name: '高橋 健太', role: Role.CareWorker, qualifications: [], weeklyWorkCount: { hope: 5, must: 4 }, maxConsecutiveWorkDays: 5, availableWeekdays: [0,1,2,3,4,5,6], unavailableDates: [], timeSlotPreference: TimeSlotPreference.NightOnly, isNightShiftOnly: true },
  { id: 's005', name: '渡辺 久美子', role: Role.Nurse, qualifications: [Qualification.LicensedPracticalNurse], weeklyWorkCount: { hope: 4, must: 0 }, maxConsecutiveWorkDays: 3, availableWeekdays: [2,3,4], unavailableDates: ['2025-11-15'], timeSlotPreference: TimeSlotPreference.DayOnly, isNightShiftOnly: false },
];

type ViewMode = 'shift' | 'leaveRequest';

const App: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>(initialStaff);
  const [requirements, setRequirements] = useState<ShiftRequirement>({
    targetMonth: '2025-11',
    timeSlots: DEFAULT_TIME_SLOTS,
    requirements: {
      "早番": { totalStaff: 2, requiredQualifications: [{ qualification: Qualification.DriversLicense, count: 1 }], requiredRoles: [] },
      "日勤": { totalStaff: 3, requiredQualifications: [], requiredRoles: [{ role: Role.Nurse, count: 1 }] },
      "遅番": { totalStaff: 2, requiredQualifications: [{ qualification: Qualification.DriversLicense, count: 1 }], requiredRoles: [] },
      "夜勤": { totalStaff: 1, requiredQualifications: [], requiredRoles: [{ role: Role.CareWorker, count: 1 }] },
    }
  });
  const [schedule, setSchedule] = useState<StaffSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('shift');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest>({
    's001': { '2025-11-18': LeaveType.PaidLeave },
    's003': { '2025-11-25': LeaveType.Hope, '2025-11-26': LeaveType.Hope },
  });
  const [workLogs, setWorkLogs] = useState<WorkLogs>({
    '2025-11-01': {
      's001': { workDetails: 'バイタルチェック、配薬、記録', notes: '田中様、微熱あり。要経過観察。' }
    },
    '2025-11-03': {
      's002': { workDetails: '入浴介助、レクリエーション担当', notes: '' }
    }
  });
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);

  const handleStaffChange = useCallback((updatedStaff: Staff) => {
    setStaffList(prevList =>
      prevList.map(staff => (staff.id === updatedStaff.id ? updatedStaff : staff))
    );
  }, []);
  
  const handleAddNewStaff = useCallback(() => {
    const newStaffId = 's' + Date.now();
    const newStaff: Staff = {
      id: newStaffId,
      name: '新規スタッフ',
      role: Role.CareWorker,
      qualifications: [],
      weeklyWorkCount: { hope: 4, must: 4 },
      maxConsecutiveWorkDays: 5,
      availableWeekdays: [1, 2, 3, 4, 5],
      unavailableDates: [],
      timeSlotPreference: TimeSlotPreference.Any,
      isNightShiftOnly: false,
    };
    setStaffList(prevList => [...prevList, newStaff]);
    // 新規追加されたスタッフを自動的に展開状態にする
    setOpenStaffId(newStaffId);
  }, []);

  const handleDeleteStaff = useCallback((staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (staff) {
        setStaffToDelete(staff);
    }
  }, [staffList]);

  const executeDeleteStaff = useCallback(() => {
    if (!staffToDelete) return;

    const staffId = staffToDelete.id;

    setStaffList(prevList => prevList.filter(staff => staff.id !== staffId));
    
    setLeaveRequests(prev => {
        const newRequests = { ...prev };
        delete newRequests[staffId];
        return newRequests;
    });

    setWorkLogs(prev => {
        const newLogs = JSON.parse(JSON.stringify(prev));
        for (const date in newLogs) {
            if (newLogs[date][staffId]) {
                delete newLogs[date][staffId];
                if (Object.keys(newLogs[date]).length === 0) {
                    delete newLogs[date];
                }
            }
        }
        return newLogs;
    });

    setStaffToDelete(null);
  }, [staffToDelete]);

  const handleLeaveRequestChange = useCallback((staffId: string, date: string, leaveType: LeaveType | null) => {
    setLeaveRequests(prev => {
        const newRequests = JSON.parse(JSON.stringify(prev));
        if (!newRequests[staffId]) {
            newRequests[staffId] = {};
        }
        if (leaveType) {
            newRequests[staffId][date] = leaveType;
        } else {
            delete newRequests[staffId][date];
        }
        return newRequests;
    });
  }, []);

  const handleWorkLogChange = useCallback((staffId: string, date: string, details: WorkLogDetails) => {
    setWorkLogs(prev => {
      const newLogs = JSON.parse(JSON.stringify(prev));
      if (!newLogs[date]) {
        newLogs[date] = {};
      }
      if (!details.workDetails && !details.notes) {
        delete newLogs[date][staffId];
        if (Object.keys(newLogs[date]).length === 0) {
          delete newLogs[date];
        }
      } else {
        newLogs[date][staffId] = details;
      }
      return newLogs;
    });
  }, []);

  const handleGenerateClick = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSchedule([]);
    try {
      const result = await generateShiftSchedule(staffList, requirements, leaveRequests);
      setSchedule(result);
      setViewMode('shift');
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  }, [staffList, requirements, leaveRequests]);

  const handleExportCSV = () => {
    if (schedule.length > 0) {
      exportToCSV(schedule, staffList, requirements, workLogs);
    } else {
      alert("エクスポートするシフトデータがありません。");
    }
  };

  const handleGenerateDemo = () => {
    const [year, month] = requirements.targetMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const shiftTypes = [...requirements.timeSlots.map(ts => ts.name), '休', '休', '休'];

    const demoSchedule: StaffSchedule[] = staffList.map(staff => {
      const monthlyShifts: GeneratedShift[] = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const date = `${requirements.targetMonth}-${String(i).padStart(2, '0')}`;
        const randomShiftType = shiftTypes[Math.floor(Math.random() * shiftTypes.length)];
        monthlyShifts.push({ date, shiftType: randomShiftType });
      }
      return { staffId: staff.id, staffName: staff.name, monthlyShifts };
    });
    
    setError(null);
    setSchedule(demoSchedule);
    setViewMode('shift');
  };

  const ViewSwitcher = () => (
    <div className="flex border-b border-slate-300">
      <button 
        onClick={() => setViewMode('shift')}
        className={`px-4 py-2 text-sm font-semibold transition-colors duration-200 ${viewMode === 'shift' ? 'border-b-2 border-care-secondary text-care-secondary' : 'text-slate-500 hover:text-slate-800'}`}
      >
        シフト表
      </button>
      <button 
        onClick={() => setViewMode('leaveRequest')}
        className={`px-4 py-2 text-sm font-semibold transition-colors duration-200 ${viewMode === 'leaveRequest' ? 'border-b-2 border-care-secondary text-care-secondary' : 'text-slate-500 hover:text-slate-800'}`}
      >
        休暇希望入力
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      <aside className="w-1/3 max-w-lg bg-white shadow-2xl flex flex-col h-screen">
        <header className="p-5 bg-gradient-to-r from-care-dark to-care-secondary text-white shadow-md">
          <h1 className="text-2xl font-bold">AIシフト自動作成</h1>
          <p className="text-sm text-indigo-200 mt-1">介護・福祉事業所向け</p>
        </header>
        <div className="flex-grow overflow-y-auto">
          <Accordion title="スタッフ情報設定" icon={<UserGroupIcon/>}>
            <StaffSettings
              staffList={staffList}
              onStaffChange={handleStaffChange}
              onAddNewStaff={handleAddNewStaff}
              onDeleteStaff={handleDeleteStaff}
              targetMonth={requirements.targetMonth}
              openStaffId={openStaffId}
              onOpenStaffChange={setOpenStaffId}
            />
          </Accordion>
          <Accordion title="事業所のシフト要件設定" icon={<ClipboardIcon/>}>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">対象月</label>
                <MonthNavigator
                  currentMonth={requirements.targetMonth}
                  onMonthChange={(newMonth) => setRequirements(prev => ({ ...prev, targetMonth: newMonth }))}
                />
              </div>
              <div>
                 <h4 className="text-md font-bold text-slate-700 mb-2">時間帯別 必要人員</h4>
                 <div className="space-y-2 text-sm">
                    {Object.entries(requirements.requirements).map(([shiftName, req]) => (
                        <div key={shiftName} className="p-3 bg-white rounded-lg border border-slate-200">
                           <span className="font-semibold">{shiftName}:</span> 合計 {req.totalStaff}人
                           {req.requiredRoles.length > 0 && `, (内 ${req.requiredRoles.map(r => `${r.role} ${r.count}人`).join(', ')})`}
                           {req.requiredQualifications.length > 0 && `, (内 ${req.requiredQualifications.map(q => `${q.qualification} ${q.count}人`).join(', ')})`}
                        </div>
                    ))}
                 </div>
              </div>
            </div>
          </Accordion>
        </div>
        <footer className="p-4 border-t bg-white shadow-inner">
          <button
            onClick={handleGenerateClick}
            disabled={isLoading}
            className="w-full bg-care-secondary hover:bg-care-dark text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                AIがシフトを作成中...
              </>
            ) : "シフト作成実行"}
          </button>
          {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
        </footer>
      </aside>

      <main className="flex-1 p-6 flex flex-col overflow-hidden">
        <header className="flex justify-between items-center mb-1">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{requirements.targetMonth.replace('-', '年 ')}月</h2>
            <ViewSwitcher />
          </div>
          <div className="space-x-2">
            <button onClick={handleGenerateDemo} className="bg-care-secondary hover:bg-care-dark text-white font-semibold py-2 px-4 rounded-lg shadow-sm text-sm inline-flex items-center transition-colors duration-200">
              <SparklesIcon/>
              <span className="ml-2">デモシフト作成</span>
            </button>
            <button onClick={handleExportCSV} className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 border border-slate-300 rounded-lg shadow-sm text-sm inline-flex items-center transition-colors duration-200">
              <DownloadIcon/>
              <span className="ml-2">CSV形式でダウンロード</span>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto pt-4 pb-4">
          {viewMode === 'shift' ? (
             <ShiftTable 
                schedule={schedule} 
                targetMonth={requirements.targetMonth}
                workLogs={workLogs}
                onWorkLogChange={handleWorkLogChange}
             />
          ) : (
             <LeaveRequestCalendar 
                staffList={staffList}
                targetMonth={requirements.targetMonth}
                leaveRequests={leaveRequests}
                onLeaveRequestChange={handleLeaveRequestChange}
             />
          )}
        </div>
      </main>

      <ConfirmModal
        isOpen={!!staffToDelete}
        title="スタッフの削除"
        message={
          <>
            本当に <strong>{staffToDelete?.name}</strong> さんを削除しますか？<br />
            関連する休暇希望や業務日誌もすべて削除され、この操作は元に戻せません。
          </>
        }
        onConfirm={executeDeleteStaff}
        onCancel={() => setStaffToDelete(null)}
        confirmText="削除する"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
      />
    </div>
  );
};

const UserGroupIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-care-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.282-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.282.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
);
const ClipboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-care-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
);
const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);
const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 010 1.414L10 16l-4 4-4-4 5.293-5.293a1 1 0 011.414 0L13 13m0 0l2.293 2.293a1 1 0 010 1.414L10 21l-4-4 4-4 3 3z" />
  </svg>
);

export default App;