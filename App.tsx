import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Role, Qualification, TimeSlotPreference, LeaveType,
  type Staff, type ShiftRequirement, type StaffSchedule, type GeneratedShift, type LeaveRequest, type ScheduleVersion, type LeaveRequestDocument, type Facility,
  type FacilityShiftSettings, type FacilityLeaveSettings,
  type AIEvaluationResult,
  assertResultError, assertResultSuccess
} from './types';
import { DEFAULT_TIME_SLOTS, DEFAULT_SHIFT_TYPES, DEFAULT_SHIFT_CYCLE, DEFAULT_LEAVE_SETTINGS } from './constants';
import { generateShiftSchedule } from './services/geminiService';
import { exportToCSV } from './services/exportService';
import { StaffService } from './src/services/staffService';
import { ScheduleService } from './src/services/scheduleService';
import { LeaveRequestService } from './src/services/leaveRequestService';
import { RequirementService } from './src/services/requirementService';
import { getFacilityById } from './src/services/facilityService';
import { subscribeToShiftSettings, saveShiftSettings } from './src/services/shiftTypeService';
import { subscribeToLeaveSettings, saveLeaveSettings } from './src/services/leaveBalanceService';
import { useAuth } from './src/contexts/AuthContext';
import { useToast } from './src/contexts/ToastContext';
import ShiftTable from './components/ShiftTable';
import Accordion from './components/Accordion';
import MonthNavigator from './components/MonthNavigator';
import StaffSettings from './components/StaffSettings';
import LeaveRequestCalendar from './components/LeaveRequestCalendar';
import ConfirmModal from './components/ConfirmModal';
import VersionHistoryModal from './components/VersionHistoryModal';
import { Button } from './src/components/Button';
import { BulkCopyPlannedToActualModal } from './src/components/BulkCopyPlannedToActualModal';
import { bulkCopyPlannedToActual, type BulkCopyOptions } from './src/utils/bulkCopyPlannedToActual';
import KeyboardHelpModal from './src/components/KeyboardHelpModal';
import { ShiftTypeSettings } from './src/components/ShiftTypeSettings';
import { LeaveBalanceDashboard } from './src/components/LeaveBalanceDashboard';
import { Timestamp } from 'firebase/firestore';
// Phase 42: UIデザイン改善コンポーネント
import { IconButton } from './src/components/IconButton';
import { ActionToolbar } from './src/components/ActionToolbar';
// Phase 43: デモ環境改善・排他制御
import { DemoBanner } from './src/components/DemoBanner';
import { LockStatusModal } from './src/components/LockStatusModal';
import { LockService, LockInfo } from './src/services/lockService';

type ViewMode = 'shift' | 'leaveRequest';

/**
 * Phase 31: アンドゥ履歴エントリ
 */
interface ShiftHistoryEntry {
  staffId: string;
  date: string;
  type: 'planned' | 'actual';
  previousValue: Partial<GeneratedShift>;
  timestamp: number;
}

/**
 * LeaveRequestDocument配列をLeaveRequest型に変換
 */
function convertToLeaveRequest(documents: LeaveRequestDocument[]): LeaveRequest {
  const result: LeaveRequest = {};

  for (const doc of documents) {
    if (!result[doc.staffId]) {
      result[doc.staffId] = {};
    }
    result[doc.staffId][doc.date] = doc.leaveType;
  }

  return result;
}

const App: React.FC = () => {
  const { selectedFacilityId, currentUser, isSuperAdmin, userProfile, selectFacility, signOut, isDemoEnvironment } = useAuth();
  const { showSuccess, showError, showWithAction } = useToast();
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState<Map<string, Facility>>(new Map());
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleRetryTrigger, setScheduleRetryTrigger] = useState(0);
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
  const [evaluation, setEvaluation] = useState<AIEvaluationResult | null>(null);
  const [currentScheduleId, setCurrentScheduleId] = useState<string | null>(null);
  const [currentScheduleStatus, setCurrentScheduleStatus] = useState<'draft' | 'confirmed' | 'archived'>('draft');
  const [isLoading, setIsLoading] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  // AI生成直後のFirestoreリスナー発火時に評価がクリアされるのを防ぐためのRef
  // 複数回のリスナー発火に対応するため、カウンターを使用（BUG-005修正）
  const skipEvaluationClearCountRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('shift');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest>({});
  const [leaveRequestDocuments, setLeaveRequestDocuments] = useState<LeaveRequestDocument[]>([]);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);
  const [versionHistoryModalOpen, setVersionHistoryModalOpen] = useState(false);
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [bulkCopyModalOpen, setBulkCopyModalOpen] = useState(false);
  // Phase 43: 排他制御用state
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [currentLockInfo, setCurrentLockInfo] = useState<LockInfo | null>(null);

  // Phase 31: アンドゥ履歴スタック（最大10件）
  const [undoStack, setUndoStack] = useState<ShiftHistoryEntry[]>([]);

  // Phase 33: リドゥ履歴スタック（最大10件）
  const [redoStack, setRedoStack] = useState<ShiftHistoryEntry[]>([]);

  // Phase 37: キーボードショートカットヘルプモーダル
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Phase 38: シフトタイプ設定
  const [shiftSettings, setShiftSettings] = useState<FacilityShiftSettings>({
    facilityId: '',
    shiftTypes: DEFAULT_SHIFT_TYPES,
    defaultShiftCycle: DEFAULT_SHIFT_CYCLE,
    updatedAt: Timestamp.now(),
    updatedBy: 'system',
  });

  // Phase 39: 休暇残高設定
  const [leaveSettings, setLeaveSettings] = useState<FacilityLeaveSettings>({
    facilityId: '',
    publicHoliday: DEFAULT_LEAVE_SETTINGS.publicHoliday,
    paidLeave: DEFAULT_LEAVE_SETTINGS.paidLeave,
    updatedAt: Timestamp.now(),
    updatedBy: 'system',
  });

  // ユーザーがアクセスできる施設情報をロード
  useEffect(() => {
    if (!currentUser || !userProfile || !userProfile.facilities) {
      setLoadingFacilities(false);
      return;
    }

    const loadFacilities = async () => {
      setLoadingFacilities(true);
      const facilityMap = new Map<string, Facility>();

      // 各施設IDに対して施設情報を取得
      for (const facilityAccess of userProfile.facilities) {
        const result = await getFacilityById(facilityAccess.facilityId, currentUser.uid);
        if (result.success) {
          facilityMap.set(facilityAccess.facilityId, result.data);
        }
      }

      setFacilities(facilityMap);
      setLoadingFacilities(false);
    };

    loadFacilities();
  }, [currentUser, userProfile]);

  // Firestoreから要件設定を読み込む（施設選択時のみ）
  useEffect(() => {
    if (!selectedFacilityId) {
      return;
    }

    const loadRequirement = async () => {
      const result = await RequirementService.getRequirement(selectedFacilityId);

      if (!result.success) {
        assertResultError(result);
        console.error('Failed to load requirement:', result.error);
        showError(`要件設定の読み込みに失敗しました: ${result.error.message}`);
        return;
      }

      if (result.data) {
        // Firestoreから取得した要件設定を使用
        setRequirements(result.data);
      } else {
        // 要件設定が存在しない場合はデフォルト設定を維持
        console.log('No requirement found, using default');
      }
    };

    loadRequirement();
  }, [selectedFacilityId]);

  // 要件設定が変更されたときに自動保存
  useEffect(() => {
    // Phase 43: デモ環境では自動保存しない
    if (!selectedFacilityId || isDemoEnvironment) {
      return;
    }

    // 初回マウント時は保存しない（無限ループ防止）
    const saveRequirement = async () => {
      const result = await RequirementService.saveRequirement(
        selectedFacilityId,
        requirements
      );

      if (!result.success) {
        assertResultError(result);
        console.error('Failed to save requirement:', result.error);
        // エラー通知はUIに表示しない（自動保存のため）
      }
    };

    // debounce: 1秒後に保存（頻繁な更新を防ぐ）
    const timerId = setTimeout(saveRequirement, 1000);

    return () => clearTimeout(timerId);
  }, [selectedFacilityId, requirements, isDemoEnvironment]);

  // Firestoreからスタッフデータをリアルタイムで購読
  useEffect(() => {
    if (!selectedFacilityId) {
      setStaffList([]);
      setLoadingStaff(false);
      setStaffError(null);
      return;
    }

    setLoadingStaff(true);
    setStaffError(null);

    try {
      const unsubscribe = StaffService.subscribeToStaffList(
        selectedFacilityId,
        (staffList, error) => {
          if (error) {
            // サブスクリプション実行中のエラー（権限エラー、ネットワークエラーなど）
            console.error('Subscription error:', error);
            setStaffError(`スタッフ情報の読み込みに失敗しました: ${error.message}`);
            setStaffList([]);
            setLoadingStaff(false);
            return;
          }

          // 正常時の処理
          setStaffList(staffList);
          setLoadingStaff(false);
          setStaffError(null);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      // サブスクリプション設定時のエラー
      console.error('Failed to setup staff subscription:', err);
      const errorMessage = err instanceof Error ? err.message : 'スタッフ情報の購読設定に失敗しました';
      setStaffError(`スタッフ情報の購読設定に失敗しました: ${errorMessage}`);
      setLoadingStaff(false);
      setStaffList([]);
    }
  }, [selectedFacilityId, retryTrigger]);

  // Firestoreからスケジュールデータをリアルタイムで購読
  useEffect(() => {
    // 手動生成中は購読をスキップ
    if (generatingSchedule) {
      return;
    }

    if (!selectedFacilityId || !requirements.targetMonth) {
      setSchedule([]);
      setLoadingSchedule(false);
      setScheduleError(null);
      return;
    }

    setLoadingSchedule(true);
    setScheduleError(null);

    try {
      const unsubscribe = ScheduleService.subscribeToSchedules(
        selectedFacilityId,
        requirements.targetMonth,
        (schedules, error) => {
          if (error) {
            // サブスクリプション実行中のエラー
            console.error('Schedule subscription error:', error);
            setScheduleError(`シフトデータの読み込みに失敗しました: ${error.message}`);
            setSchedule([]);
            setLoadingSchedule(false);
            return;
          }

          // 正常時の処理
          if (schedules.length > 0) {
            // 最新のスケジュール（最初の要素）を使用
            setSchedule(schedules[0].staffSchedules);
            setCurrentScheduleId(schedules[0].id);
            setCurrentScheduleStatus(schedules[0].status);
          } else {
            // シフトが存在しない場合は空の配列
            setSchedule([]);
            setCurrentScheduleId(null);
            setCurrentScheduleStatus('draft');
          }
          // Phase 40: 既存スケジュールロード時は評価をクリア
          // （評価は新規生成時のみ有効なため）
          // ただし、AI生成直後のリスナー発火時はクリアしない（BUG-005修正）
          // 複数回のリスナー発火に対応するため、カウンターを使用
          if (skipEvaluationClearCountRef.current > 0) {
            skipEvaluationClearCountRef.current -= 1;
          } else {
            setEvaluation(null);
          }
          setLoadingSchedule(false);
          setScheduleError(null);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      // サブスクリプション設定時のエラー
      console.error('Failed to setup schedule subscription:', err);
      const errorMessage = err instanceof Error ? err.message : 'シフトデータの購読設定に失敗しました';
      setScheduleError(`シフトデータの購読設定に失敗しました: ${errorMessage}`);
      setLoadingSchedule(false);
      setSchedule([]);
    }
  }, [selectedFacilityId, requirements.targetMonth, scheduleRetryTrigger]);

  // Firestoreから休暇申請データをリアルタイムで購読
  useEffect(() => {
    if (!selectedFacilityId || !requirements.targetMonth) {
      setLeaveRequests({});
      setLeaveRequestDocuments([]);
      return;
    }

    try {
      const unsubscribe = LeaveRequestService.subscribeToLeaveRequests(
        selectedFacilityId,
        requirements.targetMonth,
        (leaveRequestDocs, error) => {
          if (error) {
            console.error('LeaveRequest subscription error:', error);
            showError(`休暇申請の読み込みに失敗しました: ${error.message}`);
            setLeaveRequests({});
            setLeaveRequestDocuments([]);
            return;
          }

          // ドキュメントを保存（削除時にIDが必要）
          setLeaveRequestDocuments(leaveRequestDocs);

          // LeaveRequestDocument[]をLeaveRequest型に変換
          const converted = convertToLeaveRequest(leaveRequestDocs);
          setLeaveRequests(converted);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Failed to setup leave request subscription:', err);
      const errorMessage = err instanceof Error ? err.message : '休暇申請の購読設定に失敗しました';
      showError(`休暇申請の購読設定に失敗しました: ${errorMessage}`);
      setLeaveRequests({});
      setLeaveRequestDocuments([]);
    }
  }, [selectedFacilityId, requirements.targetMonth]);

  // Phase 38: シフト設定の購読
  useEffect(() => {
    if (!selectedFacilityId) {
      return;
    }

    const unsubscribe = subscribeToShiftSettings(
      selectedFacilityId,
      (settings) => {
        setShiftSettings(settings);
      },
      (error) => {
        console.error('Failed to subscribe to shift settings:', error);
        showError(`シフト設定の読み込みに失敗しました: ${error.message}`);
      }
    );

    return () => unsubscribe();
  }, [selectedFacilityId]);

  // Phase 39: 休暇設定の購読
  useEffect(() => {
    if (!selectedFacilityId) {
      return;
    }

    const unsubscribe = subscribeToLeaveSettings(
      selectedFacilityId,
      (settings) => {
        setLeaveSettings(settings);
      },
      (error) => {
        console.error('Failed to subscribe to leave settings:', error);
        showError(`休暇設定の読み込みに失敗しました: ${error.message}`);
      }
    );

    return () => unsubscribe();
  }, [selectedFacilityId]);

  // Phase 38: シフト設定の保存ハンドラ
  const handleSaveShiftSettings = useCallback(async (
    settings: Partial<Omit<FacilityShiftSettings, 'facilityId' | 'updatedAt' | 'updatedBy'>>
  ) => {
    if (!selectedFacilityId || !currentUser) {
      return;
    }

    const result = await saveShiftSettings(selectedFacilityId, settings, currentUser.uid);
    if (!result.success) {
      assertResultError(result);
      throw new Error(result.error.message);
    }
    showSuccess('シフト設定を保存しました');
  }, [selectedFacilityId, currentUser, showSuccess]);

  // Phase 39: 休暇設定の保存ハンドラ
  const handleSaveLeaveSettings = useCallback(async (
    settings: Partial<Omit<FacilityLeaveSettings, 'facilityId' | 'updatedAt' | 'updatedBy'>>
  ) => {
    if (!selectedFacilityId || !currentUser) {
      return;
    }

    const result = await saveLeaveSettings(selectedFacilityId, settings, currentUser.uid);
    if (!result.success) {
      assertResultError(result);
      throw new Error(result.error.message);
    }
    showSuccess('休暇設定を保存しました');
  }, [selectedFacilityId, currentUser, showSuccess]);

  const handleStaffChange = useCallback(async (updatedStaff: Staff) => {
    if (!selectedFacilityId) return;

    // 楽観的UIアップデート用に現在のリストを保存
    const previousStaffList = staffList;
    setStaffList(prevList =>
      prevList.map(staff => (staff.id === updatedStaff.id ? updatedStaff : staff))
    );

    // Firestoreに保存
    const result = await StaffService.updateStaff(
      selectedFacilityId,
      updatedStaff.id,
      updatedStaff
    );

    if (!result.success) {
      assertResultError(result);
      console.error('Failed to update staff:', result.error);
      // 楽観的アップデートをrevert
      setStaffList(previousStaffList);
      setError(`スタッフ情報の更新に失敗しました: ${result.error.message}`);
    }
  }, [selectedFacilityId, staffList]);

  const handleRetryStaffLoad = useCallback(() => {
    setRetryTrigger(prev => prev + 1);
  }, []);

  const handleRetryScheduleLoad = useCallback(() => {
    setScheduleRetryTrigger(prev => prev + 1);
  }, []);

  // LocalStorage auto-save: save schedule draft every 3 seconds after edit
  useEffect(() => {
    if (!selectedFacilityId || schedule.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      const key = `draft-schedule-${selectedFacilityId}-${requirements.targetMonth}`;
      try {
        localStorage.setItem(key, JSON.stringify({
          schedule,
          savedAt: new Date().toISOString(),
        }));
        console.log('Draft auto-saved to LocalStorage');
      } catch (err) {
        console.error('Failed to save draft to LocalStorage:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [schedule, selectedFacilityId, requirements.targetMonth]);

  // Load draft from LocalStorage on mount
  useEffect(() => {
    if (!selectedFacilityId || !requirements.targetMonth) {
      return;
    }

    const key = `draft-schedule-${selectedFacilityId}-${requirements.targetMonth}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const { schedule: draftSchedule, savedAt } = JSON.parse(saved);
        console.log(`Draft loaded from LocalStorage (saved at ${savedAt})`);
        // Apply draft only if no schedule exists yet
        // Note: Firestore real-time listener will override this if Firestore has data
        if (schedule.length === 0 && Array.isArray(draftSchedule)) {
          setSchedule(draftSchedule);
        }
      }
    } catch (err) {
      console.error('Failed to load draft from LocalStorage:', err);
    }
  }, [selectedFacilityId, requirements.targetMonth]);

  // Phase 31/33/37: キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Phase 37: ?キーでショートカットヘルプ表示
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        // 入力フィールドにフォーカスがある場合は無視
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement ||
            activeElement instanceof HTMLTextAreaElement ||
            activeElement instanceof HTMLSelectElement) {
          return;
        }
        e.preventDefault();
        setShowKeyboardHelp(true);
        return;
      }

      // Ctrl+Z または Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        // 入力フィールドにフォーカスがある場合は無視
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement ||
            activeElement instanceof HTMLTextAreaElement ||
            activeElement instanceof HTMLSelectElement) {
          return;
        }

        e.preventDefault();

        if (e.shiftKey) {
          // Phase 33: Ctrl+Shift+Z / Cmd+Shift+Z でリドゥ
          if (redoStack.length > 0) {
            const lastEntry = redoStack[redoStack.length - 1];

            // 現在の値をアンドゥスタックに追加
            setSchedule(prev => {
              const currentStaff = prev.find(s => s.staffId === lastEntry.staffId);
              const currentShift = currentStaff?.monthlyShifts.find(s => s.date === lastEntry.date);

              if (currentShift) {
                const currentValue: Partial<GeneratedShift> = lastEntry.type === 'planned'
                  ? {
                      plannedShiftType: currentShift.plannedShiftType || currentShift.shiftType,
                      shiftType: currentShift.shiftType,
                    }
                  : { actualShiftType: currentShift.actualShiftType };

                setUndoStack(prevUndo => [...prevUndo.slice(-9), {
                  ...lastEntry,
                  previousValue: currentValue,
                  timestamp: Date.now(),
                }]);
              }

              // スケジュールを復元
              return prev.map(staff => {
                if (staff.staffId === lastEntry.staffId) {
                  return {
                    ...staff,
                    monthlyShifts: staff.monthlyShifts.map(shift => {
                      if (shift.date === lastEntry.date) {
                        return {
                          ...shift,
                          ...lastEntry.previousValue,
                        };
                      }
                      return shift;
                    }),
                  };
                }
                return staff;
              });
            });

            // リドゥ履歴から削除
            setRedoStack(prev => prev.slice(0, -1));
            showSuccess('変更をやり直しました (Ctrl+Shift+Z)');
          }
        } else {
          // Phase 31: Ctrl+Z / Cmd+Z でアンドゥ
          if (undoStack.length > 0) {
            const lastEntry = undoStack[undoStack.length - 1];

            // 現在の値をリドゥスタックに追加
            setSchedule(prev => {
              const currentStaff = prev.find(s => s.staffId === lastEntry.staffId);
              const currentShift = currentStaff?.monthlyShifts.find(s => s.date === lastEntry.date);

              if (currentShift) {
                const currentValue: Partial<GeneratedShift> = lastEntry.type === 'planned'
                  ? {
                      plannedShiftType: currentShift.plannedShiftType || currentShift.shiftType,
                      shiftType: currentShift.shiftType,
                    }
                  : { actualShiftType: currentShift.actualShiftType };

                setRedoStack(prevRedo => [...prevRedo.slice(-9), {
                  ...lastEntry,
                  previousValue: currentValue,
                  timestamp: Date.now(),
                }]);
              }

              // スケジュールを復元
              return prev.map(staff => {
                if (staff.staffId === lastEntry.staffId) {
                  return {
                    ...staff,
                    monthlyShifts: staff.monthlyShifts.map(shift => {
                      if (shift.date === lastEntry.date) {
                        return {
                          ...shift,
                          ...lastEntry.previousValue,
                        };
                      }
                      return shift;
                    }),
                  };
                }
                return staff;
              });
            });

            // アンドゥ履歴から削除
            setUndoStack(prev => prev.slice(0, -1));
            showSuccess('変更を元に戻しました (Ctrl+Z)');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, showSuccess]);

  const handleAddNewStaff = useCallback(async () => {
    if (!selectedFacilityId) return;

    const newStaff = {
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

    // Firestoreに作成
    const result = await StaffService.createStaff(selectedFacilityId, newStaff);

    if (!result.success) {
      assertResultError(result);
      console.error('Failed to create staff:', result.error);
      setError(`スタッフの追加に失敗しました: ${result.error.message}`);
      return;
    }

    // 新規追加されたスタッフを自動的に展開状態にする
    setOpenStaffId(result.data);
  }, [selectedFacilityId]);

  const handleDeleteStaff = useCallback((staffId: string) => {
    const staff = staffList.find(s => s.id === staffId);
    if (staff) {
        setStaffToDelete(staff);
    }
  }, [staffList]);

  const executeDeleteStaff = useCallback(async () => {
    if (!staffToDelete || !selectedFacilityId) return;

    const staffId = staffToDelete.id;

    // Firestoreから削除
    const result = await StaffService.deleteStaff(selectedFacilityId, staffId);

    if (!result.success) {
      assertResultError(result);
      console.error('Failed to delete staff:', result.error);
      setError(`スタッフの削除に失敗しました: ${result.error.message}`);
      setStaffToDelete(null);
      return;
    }

    // 関連データのクリーンアップ
    setLeaveRequests(prev => {
      const newRequests = { ...prev };
      delete newRequests[staffId];
      return newRequests;
    });

    setStaffToDelete(null);
  }, [staffToDelete, selectedFacilityId]);

  const handleLeaveRequestChange = useCallback(async (staffId: string, date: string, leaveType: LeaveType | null) => {
    if (!selectedFacilityId) return;

    // スタッフ名を取得
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) {
      console.error('Staff not found:', staffId);
      return;
    }

    if (leaveType) {
      // 休暇申請を作成
      const result = await LeaveRequestService.createLeaveRequest(selectedFacilityId, {
        staffId,
        staffName: staff.name,
        date,
        leaveType,
      });

      if (!result.success) {
        assertResultError(result);
        console.error('Failed to create leave request:', result.error);
        showError(`休暇申請の登録に失敗しました: ${result.error.message}`);
      }
    } else {
      // 休暇申請を削除
      // leaveRequestDocumentsから該当するドキュメントを検索
      const targetDoc = leaveRequestDocuments.find(
        doc => doc.staffId === staffId && doc.date === date
      );

      if (targetDoc) {
        const result = await LeaveRequestService.deleteLeaveRequest(
          selectedFacilityId,
          targetDoc.id
        );

        if (!result.success) {
          assertResultError(result);
          console.error('Failed to delete leave request:', result.error);
          showError(`休暇申請の削除に失敗しました: ${result.error.message}`);
        }
      }
    }
  }, [selectedFacilityId, staffList, leaveRequestDocuments]);

  const handleShiftChange = useCallback((staffId: string, date: string, newShiftType: string) => {
    setSchedule(prev => {
      return prev.map(staff => {
        if (staff.staffId === staffId) {
          return {
            ...staff,
            monthlyShifts: staff.monthlyShifts.map(shift => {
              if (shift.date === date) {
                return {
                  ...shift,
                  plannedShiftType: newShiftType,
                  shiftType: newShiftType, // 後方互換性のため
                };
              }
              return shift;
            }),
          };
        }
        return staff;
      });
    });
  }, []);

  const handleShiftUpdate = useCallback((staffId: string, date: string, updatedShift: Partial<GeneratedShift>) => {
    setSchedule(prev => {
      return prev.map(staff => {
        if (staff.staffId === staffId) {
          return {
            ...staff,
            monthlyShifts: staff.monthlyShifts.map(shift => {
              if (shift.date === date) {
                return {
                  ...shift,
                  ...updatedShift,
                  // 後方互換性: plannedShiftTypeが更新された場合はshiftTypeも更新
                  ...(updatedShift.plannedShiftType && { shiftType: updatedShift.plannedShiftType })
                };
              }
              return shift;
            }),
          };
        }
        return staff;
      });
    });
  }, []);

  /**
   * Phase 31: アンドゥ実行
   */
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const lastEntry = undoStack[undoStack.length - 1];

    // スケジュールを復元
    setSchedule(prev => {
      return prev.map(staff => {
        if (staff.staffId === lastEntry.staffId) {
          return {
            ...staff,
            monthlyShifts: staff.monthlyShifts.map(shift => {
              if (shift.date === lastEntry.date) {
                return {
                  ...shift,
                  ...lastEntry.previousValue,
                };
              }
              return shift;
            }),
          };
        }
        return staff;
      });
    });

    // 履歴から削除
    setUndoStack(prev => prev.slice(0, -1));
    showSuccess('変更を元に戻しました');
  }, [undoStack, showSuccess]);

  /**
   * ダブルクリックでシフトタイプを素早く変更するハンドラー
   * Phase 28: ダブルクリック機能追加
   * Phase 31: アンドゥ履歴追加
   */
  const handleQuickShiftChange = useCallback((
    staffId: string,
    date: string,
    type: 'planned' | 'actual',
    newShiftType: string
  ) => {
    // 現在の値を取得して履歴に追加
    const currentStaff = schedule.find(s => s.staffId === staffId);
    const currentShift = currentStaff?.monthlyShifts.find(s => s.date === date);

    if (currentShift) {
      const previousValue: Partial<GeneratedShift> = type === 'planned'
        ? {
            plannedShiftType: currentShift.plannedShiftType || currentShift.shiftType,
            shiftType: currentShift.shiftType,
          }
        : { actualShiftType: currentShift.actualShiftType };

      const historyEntry: ShiftHistoryEntry = {
        staffId,
        date,
        type,
        previousValue,
        timestamp: Date.now(),
      };

      // 履歴スタックに追加（最大10件）
      setUndoStack(prev => [...prev.slice(-9), historyEntry]);

      // Phase 33: 新しい変更時はリドゥスタックをクリア
      setRedoStack([]);

      // アンドゥボタン付きトーストを表示
      showWithAction({
        message: 'シフトを変更しました',
        type: 'success',
        actionLabel: '元に戻す',
        onAction: () => {
          // スケジュールを復元
          setSchedule(prev => {
            return prev.map(staff => {
              if (staff.staffId === staffId) {
                return {
                  ...staff,
                  monthlyShifts: staff.monthlyShifts.map(shift => {
                    if (shift.date === date) {
                      return {
                        ...shift,
                        ...previousValue,
                      };
                    }
                    return shift;
                  }),
                };
              }
              return staff;
            });
          });

          // 履歴から削除
          setUndoStack(prev => prev.filter(e => e.timestamp !== historyEntry.timestamp));
          showSuccess('変更を元に戻しました');
        },
      });
    }

    setSchedule(prev => {
      return prev.map(staff => {
        if (staff.staffId === staffId) {
          return {
            ...staff,
            monthlyShifts: staff.monthlyShifts.map(shift => {
              if (shift.date === date) {
                if (type === 'planned') {
                  return {
                    ...shift,
                    plannedShiftType: newShiftType,
                    shiftType: newShiftType, // 後方互換性のため
                  };
                } else {
                  return {
                    ...shift,
                    actualShiftType: newShiftType,
                  };
                }
              }
              return shift;
            }),
          };
        }
        return staff;
      });
    });
  }, [schedule, showWithAction, showSuccess]);

  const handleBulkCopyExecute = useCallback(async (options: BulkCopyOptions) => {
    if (!selectedFacilityId || !currentUser || !currentScheduleId) {
      showError('保存に必要な情報が不足しています');
      return;
    }

    if (isLoading) {
      return;
    }

    const previousSchedule = schedule;

    // Firestoreに自動保存
    setIsLoading(true);
    try {
      const updatedSchedule = bulkCopyPlannedToActual(schedule, options);
      setSchedule(updatedSchedule);

      const result = await ScheduleService.updateSchedule(
        selectedFacilityId,
        currentScheduleId,
        currentUser.uid,
        {
          staffSchedules: updatedSchedule,
          status: currentScheduleStatus,
        }
      );

      if (!result.success) {
        assertResultError(result);
        setSchedule(previousSchedule);
        showError(`保存に失敗しました: ${result.error.message}`);
        return;
      }

      showSuccess('予定を実績にコピーし、保存しました');
      setBulkCopyModalOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存時にエラーが発生しました';
      setSchedule(previousSchedule);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [schedule, selectedFacilityId, currentUser, currentScheduleId, currentScheduleStatus, isLoading, showSuccess, showError]);

  const handleGenerateClick = useCallback(async () => {
    if (!selectedFacilityId || !currentUser) {
      showError('施設またはユーザー情報が取得できません');
      return;
    }

    setIsLoading(true);
    setGeneratingSchedule(true);
    setError(null);

    try {
      // Phase 43: ロック取得（デモ環境でも競合防止のため取得）
      const lockResult = await LockService.acquireLock(
        selectedFacilityId,
        requirements.targetMonth,
        currentUser.uid,
        'ai-generation',
        currentUser.email || undefined
      );

      if (!lockResult.success) {
        setCurrentLockInfo(lockResult.existingLock ?? null);
        setLockModalOpen(true);
        return;
      }

      try {
        // AI生成
        const generationResult = await generateShiftSchedule(staffList, requirements, leaveRequests);

        // 評価結果をstateに保存（Phase 40: AI評価・フィードバック機能）
        setEvaluation(generationResult.evaluation);
        // Firestoreリスナー発火時に評価がクリアされるのを防ぐ（BUG-005修正）
        // 複数回のリスナー発火（キャッシュ、サーバー、更新通知）に対応するため3回スキップ
        skipEvaluationClearCountRef.current = 3;

        // Phase 43: デモ環境では保存しない（画面表示のみ）
        if (isDemoEnvironment) {
          // 画面に表示するためにstateを更新
          setSchedule(generationResult.schedule);
          showSuccess('シフトを生成しました（デモ環境のため保存されません）');
          setViewMode('shift');
          return;
        }

        // 既存のスケジュールがあるかチェック
        if (currentScheduleId) {
          // 既存スケジュールを更新（バージョン履歴を保持）
          const updateResult = await ScheduleService.updateSchedule(
            selectedFacilityId,
            currentScheduleId,
            currentUser.uid,
            {
              staffSchedules: generationResult.schedule,
              status: 'draft', // 下書き状態を維持
            }
          );

          if (!updateResult.success) {
            assertResultError(updateResult);
            showError(`保存に失敗しました: ${updateResult.error.message}`);
            setError(`保存に失敗しました: ${updateResult.error.message}`);
            return;
          }

          showSuccess('シフトを生成し、更新しました');
        } else {
          // 新規作成（初回のみ）
          const saveResult = await ScheduleService.saveSchedule(
            selectedFacilityId,
            currentUser.uid,
            {
              targetMonth: requirements.targetMonth,
              staffSchedules: generationResult.schedule,
              version: 1,
              status: 'draft',
            }
          );

          if (!saveResult.success) {
            assertResultError(saveResult);
            showError(`保存に失敗しました: ${saveResult.error.message}`);
            setError(`保存に失敗しました: ${saveResult.error.message}`);
            return;
          }

          showSuccess('シフトを生成し、保存しました');
        }

        setViewMode('shift');
      } finally {
        // Phase 43: ロック解放
        await LockService.releaseLock(
          selectedFacilityId,
          requirements.targetMonth,
          currentUser.uid
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
      setGeneratingSchedule(false);
    }
  }, [staffList, requirements, leaveRequests, selectedFacilityId, currentUser, currentScheduleId, showSuccess, showError, isDemoEnvironment]);

  const handleExportCSV = () => {
    if (schedule.length > 0) {
      exportToCSV(schedule, staffList, requirements);
    } else {
      alert("エクスポートするシフトデータがありません。");
    }
  };

  const handleSaveDraft = useCallback(async () => {
    // Phase 43: デモ環境では保存しない
    if (isDemoEnvironment) {
      showWithAction({
        message: 'デモ環境では保存されません。本番環境でお試しください。',
        type: 'info',
        actionLabel: '閉じる',
        onAction: () => {},
        duration: 5000,
      });
      return;
    }

    if (!selectedFacilityId || !currentUser || !currentScheduleId) {
      showError('保存に必要な情報が不足しています');
      return;
    }

    if (schedule.length === 0) {
      showError('保存するシフトがありません');
      return;
    }

    setIsLoading(true);

    try {
      // Phase 43: ロック取得
      const lockResult = await LockService.acquireLock(
        selectedFacilityId,
        requirements.targetMonth,
        currentUser.uid,
        'saving',
        currentUser.email || undefined
      );

      if (!lockResult.success) {
        setCurrentLockInfo(lockResult.existingLock ?? null);
        setLockModalOpen(true);
        return;
      }

      try {
        const result = await ScheduleService.updateSchedule(
          selectedFacilityId,
          currentScheduleId,
          currentUser.uid,
          {
            staffSchedules: schedule,
            status: 'draft',
          }
        );

        if (!result.success) {
          assertResultError(result);
          showError(`保存に失敗しました: ${result.error.message}`);
          return;
        }

        showSuccess('下書きを保存しました');
        // LocalStorageの下書きを削除
        const key = `draft-schedule-${selectedFacilityId}-${requirements.targetMonth}`;
        localStorage.removeItem(key);
      } finally {
        // Phase 43: ロック解放
        await LockService.releaseLock(
          selectedFacilityId,
          requirements.targetMonth,
          currentUser.uid
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存時にエラーが発生しました';
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFacilityId, currentUser, currentScheduleId, schedule, requirements.targetMonth, showSuccess, showError, showWithAction, isDemoEnvironment]);

  const handleConfirmSchedule = useCallback(async () => {
    // Phase 43: デモ環境では確定しない
    if (isDemoEnvironment) {
      showWithAction({
        message: 'デモ環境では確定できません。本番環境でお試しください。',
        type: 'info',
        actionLabel: '閉じる',
        onAction: () => {},
        duration: 5000,
      });
      return;
    }

    if (!selectedFacilityId || !currentUser || !currentScheduleId) {
      showError('確定に必要な情報が不足しています');
      return;
    }

    if (schedule.length === 0) {
      showError('確定するシフトがありません');
      return;
    }

    if (currentScheduleStatus !== 'draft') {
      showError(`このシフトは既に${currentScheduleStatus === 'confirmed' ? '確定' : 'アーカイブ'}されています`);
      return;
    }

    setIsLoading(true);

    try {
      const result = await ScheduleService.confirmSchedule(
        selectedFacilityId,
        currentScheduleId,
        currentUser.uid,
        '確定'
      );

      if (!result.success) {
        assertResultError(result);
        showError(`確定に失敗しました: ${result.error.message}`);
        return;
      }

      showSuccess('シフトを確定しました');
      // LocalStorageの下書きを削除
      const key = `draft-schedule-${selectedFacilityId}-${requirements.targetMonth}`;
      localStorage.removeItem(key);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '確定時にエラーが発生しました';
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFacilityId, currentUser, currentScheduleId, schedule, currentScheduleStatus, requirements.targetMonth, showSuccess, showError, showWithAction, isDemoEnvironment]);

  const handleShowVersionHistory = useCallback(async () => {
    if (!selectedFacilityId || !currentScheduleId) {
      showError('バージョン履歴を表示できません');
      return;
    }

    setVersionHistoryModalOpen(true);
    setVersionLoading(true);

    try {
      const result = await ScheduleService.getVersionHistory(selectedFacilityId, currentScheduleId);

      if (!result.success) {
        assertResultError(result);
        showError(`履歴の取得に失敗しました: ${result.error.message}`);
        return;
      }

      setVersions(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '履歴の取得時にエラーが発生しました';
      showError(errorMessage);
    } finally {
      setVersionLoading(false);
    }
  }, [selectedFacilityId, currentScheduleId, showSuccess, showError]);

  const handleRestoreVersion = useCallback(async (versionNumber: number) => {
    if (!selectedFacilityId || !currentUser || !currentScheduleId) {
      showError('復元に必要な情報が不足しています');
      return;
    }

    setIsLoading(true);

    try {
      const result = await ScheduleService.restoreVersion(
        selectedFacilityId,
        currentScheduleId,
        versionNumber,
        currentUser.uid
      );

      if (!result.success) {
        assertResultError(result);
        showError(`復元に失敗しました: ${result.error.message}`);
        return;
      }

      showSuccess(`バージョン${versionNumber}に復元しました`);

      // バージョン履歴をリフレッシュ（復元時に作成された新しいスナップショットを表示）
      try {
        const historyResult = await ScheduleService.getVersionHistory(selectedFacilityId, currentScheduleId);
        if (!historyResult.success) {
          assertResultError(historyResult);
          console.error('Failed to refresh version history:', historyResult.error);
          return;
        }
        setVersions(historyResult.data);
      } catch (refreshErr) {
        console.error('Error refreshing version history:', refreshErr);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '復元時にエラーが発生しました';
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFacilityId, currentUser, currentScheduleId, showSuccess, showError]);

  // Phase 43: 削除 - handleGenerateDemo（開発用ランダムシフト生成は不要）

  // 施設選択ハンドラー
  const handleFacilityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newFacilityId = event.target.value;
    if (newFacilityId) {
      selectFacility(newFacilityId);
    }
  };

  // Phase 20: ログアウトハンドラー
  // Phase 42.1: 確認ダイアログ追加
  const handleSignOut = async () => {
    // 確認ダイアログを表示
    const confirmed = window.confirm('ログアウトしますか？');
    if (!confirmed) {
      return; // キャンセル時は何もしない
    }

    setIsSigningOut(true);
    const result = await signOut();
    if (result.success) {
      navigate('/');
    } else {
      assertResultError(result);
      console.error('Sign out failed:', result.error);
      showError(`ログアウトに失敗しました: ${result.error.message}`);
      setIsSigningOut(false);
    }
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
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800">
      {/* Phase 43: デモ環境バナー */}
      {isDemoEnvironment && <DemoBanner />}

      {/* Phase 43: ロック競合モーダル */}
      <LockStatusModal
        isOpen={lockModalOpen}
        lockInfo={currentLockInfo}
        onClose={() => setLockModalOpen(false)}
      />

      <div className="flex flex-1 overflow-hidden">
      <aside className="w-1/3 max-w-lg bg-white shadow-2xl flex flex-col h-full">
        <header className="p-5 bg-gradient-to-r from-care-dark to-care-secondary text-white shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold">AIシフト自動作成</h1>
              <p className="text-sm text-indigo-200 mt-1">介護・福祉事業所向け</p>
            </div>
            {/* Phase 42: 統一されたIconButtonナビゲーション */}
            <div className="flex items-center gap-1">
              {/* ユーザー名表示 */}
              {userProfile && (
                <div className="hidden sm:block text-xs text-indigo-100 mr-2">
                  <span className="font-medium">{userProfile.name || 'ユーザー'}</span>
                </div>
              )}
              <IconButton
                as={Link}
                to="/reports"
                icon={<ChartBarIcon />}
                label="レポート"
                variant="light"
              />
              <IconButton
                as="a"
                href="/manual.html"
                target="_blank"
                rel="noopener noreferrer"
                icon={<BookOpenIcon />}
                label="マニュアル"
                variant="light"
              />
              {isSuperAdmin() && (
                <IconButton
                  as={Link}
                  to="/admin"
                  icon={<CogIcon />}
                  label="管理"
                  variant="light"
                />
              )}
              {currentUser && (
                <IconButton
                  icon={<LogoutIcon />}
                  label={isSigningOut ? 'ログアウト中...' : 'ログアウト'}
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  variant="light"
                />
              )}
            </div>
          </div>
          {/* 施設選択 */}
          {userProfile && userProfile.facilities && userProfile.facilities.length > 0 && (
            <div className="mt-3">
              {userProfile.facilities.length === 1 ? (
                // 1施設のみの場合は施設名を表示（選択不可）
                <div className="text-sm">
                  <span className="text-indigo-200">施設:</span>{' '}
                  <span className="font-semibold">
                    {loadingFacilities ? '読み込み中...' : facilities.get(userProfile.facilities[0].facilityId)?.name || userProfile.facilities[0].facilityId}
                  </span>
                </div>
              ) : (
                // 複数施設の場合はドロップダウンを表示
                <div>
                  <label htmlFor="facility-select" className="block text-xs text-indigo-200 mb-1">
                    施設を選択:
                  </label>
                  <select
                    id="facility-select"
                    value={selectedFacilityId || ''}
                    onChange={handleFacilityChange}
                    className="w-full px-3 py-2 text-sm bg-white text-slate-800 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                    disabled={loadingFacilities}
                  >
                    <option value="">-- 施設を選択してください --</option>
                    {userProfile.facilities.map((facilityAccess) => (
                      <option key={facilityAccess.facilityId} value={facilityAccess.facilityId}>
                        {loadingFacilities
                          ? facilityAccess.facilityId
                          : facilities.get(facilityAccess.facilityId)?.name || facilityAccess.facilityId
                        }
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </header>
        <div className="flex-grow overflow-y-auto">
          <Accordion title="スタッフ情報設定" icon={<UserGroupIcon/>}>
            {loadingStaff ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-care-secondary"></div>
                <p className="mt-2 text-sm text-slate-600">スタッフ情報を読み込み中...</p>
              </div>
            ) : staffError ? (
              <div className="p-8 text-center">
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm font-medium">エラーが発生しました</p>
                  <p className="text-red-600 text-sm mt-1">{staffError}</p>
                </div>
                <button
                  onClick={handleRetryStaffLoad}
                  className="px-4 py-2 bg-care-secondary hover:bg-care-dark text-white font-semibold rounded-lg transition-colors shadow-sm"
                >
                  再試行
                </button>
              </div>
            ) : (
              <StaffSettings
                staffList={staffList}
                onStaffChange={handleStaffChange}
                onAddNewStaff={handleAddNewStaff}
                onDeleteStaff={handleDeleteStaff}
                targetMonth={requirements.targetMonth}
                openStaffId={openStaffId}
                onOpenStaffChange={setOpenStaffId}
              />
            )}
          </Accordion>
          <Accordion title="シフト種別設定" icon={<ShiftTypeIcon/>}>
            <ShiftTypeSettings
              settings={shiftSettings}
              onSave={handleSaveShiftSettings}
              disabled={!selectedFacilityId}
            />
          </Accordion>
          <Accordion title="休暇残高管理" icon={<LeaveBalanceIcon/>}>
            <LeaveBalanceDashboard
              facilityId={selectedFacilityId || ''}
              staffList={staffList}
              targetMonth={requirements.targetMonth}
              leaveSettings={leaveSettings}
              onSaveSettings={handleSaveLeaveSettings}
              disabled={!selectedFacilityId}
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
                    {Object.entries(requirements.requirements).map(([shiftName, req]: [string, any]) => (
                        <div key={shiftName} className="p-3 bg-white rounded-lg border border-slate-200">
                           <span className="font-semibold">{shiftName}:</span> 合計 {req.totalStaff}人
                           {req.requiredRoles.length > 0 && `, (内 ${req.requiredRoles.map((r: any) => `${r.role} ${r.count}人`).join(', ')})`}
                           {req.requiredQualifications.length > 0 && `, (内 ${req.requiredQualifications.map((q: any) => `${q.qualification} ${q.count}人`).join(', ')})`}
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
          {/* Phase 42: ActionToolbarで統一されたボタンデザイン */}
          {/* Phase 43: onDemoClick削除（開発用機能） */}
          <ActionToolbar
            onSaveClick={handleSaveDraft}
            onConfirmClick={handleConfirmSchedule}
            onHistoryClick={handleShowVersionHistory}
            onExportClick={handleExportCSV}
            isLoading={isLoading}
            canSave={!!currentScheduleId && schedule.length > 0 && currentScheduleStatus === 'draft'}
            canConfirm={!!currentScheduleId && schedule.length > 0 && currentScheduleStatus === 'draft'}
            canShowHistory={!!currentScheduleId}
          />
        </header>
        <div className="flex-1 overflow-auto pt-4 pb-4">
          {viewMode === 'shift' ? (
            loadingSchedule ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-care-secondary"></div>
                <p className="mt-2 text-sm text-slate-600">シフトデータを読み込み中...</p>
              </div>
            ) : scheduleError ? (
              <div className="p-8 text-center">
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm font-medium">エラーが発生しました</p>
                  <p className="text-red-600 text-sm mt-1">{scheduleError}</p>
                </div>
                <button
                  onClick={handleRetryScheduleLoad}
                  className="px-4 py-2 bg-care-secondary hover:bg-care-dark text-white font-semibold rounded-lg transition-colors shadow-sm"
                >
                  再試行
                </button>
              </div>
            ) : (
              <ShiftTable
                schedule={schedule}
                targetMonth={requirements.targetMonth}
                onShiftChange={handleShiftChange}
                onShiftUpdate={handleShiftUpdate}
                onBulkCopyClick={() => setBulkCopyModalOpen(true)}
                onQuickShiftChange={handleQuickShiftChange}
                shiftSettings={shiftSettings}
                evaluation={evaluation}
              />
            )
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

      <VersionHistoryModal
        isOpen={versionHistoryModalOpen}
        onClose={() => setVersionHistoryModalOpen(false)}
        versions={versions}
        onRestore={handleRestoreVersion}
        loading={versionLoading}
      />

      <BulkCopyPlannedToActualModal
        isOpen={bulkCopyModalOpen}
        onClose={() => setBulkCopyModalOpen(false)}
        schedules={schedule}
        targetMonth={requirements.targetMonth}
        onExecute={handleBulkCopyExecute}
      />

      {/* Phase 37: キーボードショートカットヘルプモーダル */}
      <KeyboardHelpModal
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
      </div>
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
const ShiftTypeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-care-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const LeaveBalanceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-care-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

// Phase 42: ヘッダーナビゲーション用アイコン
const ChartBarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const BookOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
const CogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

export default App;