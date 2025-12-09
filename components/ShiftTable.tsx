
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { StaffSchedule, GeneratedShift, FacilityShiftSettings, AIEvaluationResult } from '../types';
import { WEEKDAYS, DEFAULT_SHIFT_TYPES, DEFAULT_SHIFT_CYCLE } from '../constants';
import { ShiftEditConfirmModal } from '../src/components/ShiftEditConfirmModal';
import { EvaluationPanel } from '../src/components/EvaluationPanel';
import { EvaluationHistory } from '../src/components/EvaluationHistory';

interface ShiftTableProps {
  schedule: StaffSchedule[];
  targetMonth: string;
  onShiftChange?: (staffId: string, date: string, newShiftType: string) => void;
  onShiftUpdate?: (staffId: string, date: string, updatedShift: Partial<GeneratedShift>) => void;
  onBulkCopyClick?: () => void;
  /** ダブルクリックでシフトタイプを素早く変更する */
  onQuickShiftChange?: (staffId: string, date: string, type: 'planned' | 'actual', newShiftType: string) => void;
  /** Phase 38: シフトタイプ設定（オプション - 指定されない場合はデフォルト使用） */
  shiftSettings?: FacilityShiftSettings;
  /** Phase 40: AI評価結果（オプション） */
  evaluation?: AIEvaluationResult | null;
  /** Phase 54: シフト再評価コールバック */
  onReevaluate?: () => void;
  /** Phase 54: 再評価中フラグ */
  isReevaluating?: boolean;
  /** Phase 54: 施設ID（評価履歴取得用） */
  facilityId?: string;
  /** Phase 54: 評価選択コールバック */
  onSelectEvaluation?: (evaluation: AIEvaluationResult) => void;
}

const getShiftColor = (shiftType: string) => {
  switch (shiftType) {
    case '早番': return 'bg-sky-100 text-sky-800';
    case '日勤': return 'bg-emerald-100 text-emerald-800';
    case '遅番': return 'bg-amber-100 text-amber-800';
    case '夜勤': return 'bg-indigo-100 text-indigo-800';
    case '休': return 'bg-slate-100 text-slate-600';
    case '明け休み': return 'bg-slate-200 text-slate-700';
    default: return 'bg-white text-slate-900';
  }
};

const NoteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h2a2 2 0 002-2V4a2 2 0 00-2-2H9z" />
    <path d="M4 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
  </svg>
);


/**
 * シフトタイプのサイクル順序
 * ダブルクリックで次のシフトタイプに切り替える
 */
const SHIFT_CYCLE = ['早番', '日勤', '遅番', '夜勤', '休', '明け休み'];

/**
 * 次のシフトタイプを取得
 */
const getNextShiftType = (currentType: string | undefined): string => {
  if (!currentType) return SHIFT_CYCLE[0];
  const index = SHIFT_CYCLE.indexOf(currentType);
  if (index === -1) return SHIFT_CYCLE[0];
  return SHIFT_CYCLE[(index + 1) % SHIFT_CYCLE.length];
};

const AVAILABLE_SHIFT_TYPES = ['早番', '日勤', '遅番', '夜勤', '休', '明け休み'];

/** クリック判定のタイムアウト（ミリ秒） */
const DOUBLE_CLICK_DELAY = 250;

interface EditModalData {
  date: string;
  staffId: string;
  staffName: string;
  type: 'planned' | 'actual';
  currentShift: GeneratedShift | null;
}

const ShiftTable: React.FC<ShiftTableProps> = ({ schedule, targetMonth, onShiftChange, onShiftUpdate, onBulkCopyClick, onQuickShiftChange, shiftSettings, evaluation, onReevaluate, isReevaluating, facilityId, onSelectEvaluation }) => {
  const [editingShift, setEditingShift] = useState<{ staffId: string, date: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalData, setEditModalData] = useState<EditModalData | null>(null);

  // Phase 38: 動的シフトサイクルと色取得関数
  const { shiftCycle, shiftColorMap, availableShiftTypes } = useMemo(() => {
    const types = shiftSettings?.shiftTypes ?? DEFAULT_SHIFT_TYPES;
    const cycle = shiftSettings?.defaultShiftCycle ?? DEFAULT_SHIFT_CYCLE;

    // シフトサイクル（IDから名前に変換）
    const shiftCycleNames = cycle.map(id => {
      const type = types.find(t => t.id === id);
      return type?.name ?? '';
    }).filter(name => name !== '');

    // シフト名から色へのマップ
    const colorMap = new Map<string, string>();
    types.forEach(type => {
      colorMap.set(type.name, `${type.color.background} ${type.color.text}`);
    });

    // 利用可能なシフトタイプ名
    const availableTypes = types.filter(t => t.isActive).map(t => t.name);

    return {
      shiftCycle: shiftCycleNames.length > 0 ? shiftCycleNames : SHIFT_CYCLE,
      shiftColorMap: colorMap,
      availableShiftTypes: availableTypes.length > 0 ? availableTypes : AVAILABLE_SHIFT_TYPES,
    };
  }, [shiftSettings]);

  // Phase 38: 動的色取得関数
  const getDynamicShiftColor = useCallback((shiftType: string) => {
    return shiftColorMap.get(shiftType) || getShiftColor(shiftType);
  }, [shiftColorMap]);

  // Phase 38: 動的次のシフトタイプ取得関数
  const getDynamicNextShiftType = useCallback((currentType: string | undefined): string => {
    if (!currentType) return shiftCycle[0];
    const index = shiftCycle.indexOf(currentType);
    if (index === -1) return shiftCycle[0];
    return shiftCycle[(index + 1) % shiftCycle.length];
  }, [shiftCycle]);

  // シングル/ダブルクリック判定用タイマー
  const clickTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  /**
   * Phase 32: 矢印キーナビゲーション用セル参照管理
   * キー形式: `${staffIndex}-${dateIndex}-${type}`
   */
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  /**
   * セル参照を登録/解除
   */
  const setCellRef = useCallback((key: string, el: HTMLTableCellElement | null) => {
    if (el) {
      cellRefs.current.set(key, el);
    } else {
      cellRefs.current.delete(key);
    }
  }, []);

  // コンポーネントアンマウント時にタイマーをクリーンアップ
  useEffect(() => {
    const timers = clickTimerRef.current;
    return () => {
      Object.keys(timers).forEach(key => {
        const timer = timers[key];
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const handleShiftTypeChange = (staffId: string, date: string, newShiftType: string) => {
    if (onShiftChange) {
      onShiftChange(staffId, date, newShiftType);
    }
    setEditingShift(null);
  };

  /**
   * シングルクリック: モーダル表示
   */
  const openEditModal = useCallback((
    date: string,
    staffId: string,
    staffName: string,
    type: 'planned' | 'actual',
    currentShift: GeneratedShift | null
  ) => {
    setEditModalData({
      date,
      staffId,
      staffName,
      type,
      currentShift
    });
    setShowEditModal(true);
  }, []);

  /**
   * ダブルクリック: シフトタイプをサイクル切り替え
   */
  const handleDoubleClick = useCallback((
    staffId: string,
    date: string,
    type: 'planned' | 'actual',
    currentShiftType: string | undefined
  ) => {
    if (!onQuickShiftChange) return;

    const nextType = getDynamicNextShiftType(currentShiftType);
    onQuickShiftChange(staffId, date, type, nextType);
  }, [onQuickShiftChange, getDynamicNextShiftType]);

  /**
   * セルクリックハンドラー
   * シングルクリック: モーダル表示（遅延実行）
   * ダブルクリック: シフトサイクル（即座実行）
   */
  const handleCellClick = useCallback((
    date: string,
    staffId: string,
    staffName: string,
    type: 'planned' | 'actual',
    currentShift: GeneratedShift | null
  ) => {
    const cellKey = `${staffId}-${date}-${type}`;
    const currentShiftType = type === 'planned'
      ? (currentShift?.plannedShiftType || currentShift?.shiftType)
      : currentShift?.actualShiftType;

    // 既存タイマーがあればダブルクリック
    if (clickTimerRef.current[cellKey]) {
      clearTimeout(clickTimerRef.current[cellKey]!);
      clickTimerRef.current[cellKey] = null;
      handleDoubleClick(staffId, date, type, currentShiftType);
      return;
    }

    // シングルクリック（遅延実行）
    clickTimerRef.current[cellKey] = setTimeout(() => {
      clickTimerRef.current[cellKey] = null;
      openEditModal(date, staffId, staffName, type, currentShift);
    }, DOUBLE_CLICK_DELAY);
  }, [handleDoubleClick, openEditModal]);

  /**
   * Phase 32: 矢印キーでセル間移動
   */
  const handleArrowNavigation = useCallback((
    e: React.KeyboardEvent,
    staffIndex: number,
    dateIndex: number,
    type: 'planned' | 'actual',
    totalStaff: number,
    totalDates: number
  ) => {
    let newStaffIndex = staffIndex;
    let newDateIndex = dateIndex;
    let newType = type;

    // Phase 35: Ctrl+矢印でジャンプ移動
    if ((e.ctrlKey || e.metaKey) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      switch (e.key) {
        case 'ArrowUp':
          // 最初のスタッフに移動
          newStaffIndex = 0;
          newType = 'planned';
          break;
        case 'ArrowDown':
          // 最後のスタッフに移動
          newStaffIndex = totalStaff - 1;
          newType = 'actual';
          break;
        case 'ArrowLeft':
          // 1日目に移動（Homeと同等）
          newDateIndex = 0;
          break;
        case 'ArrowRight':
          // 月末に移動（Endと同等）
          newDateIndex = totalDates - 1;
          break;
      }
    } else {
      // 通常の矢印キー処理
      switch (e.key) {
        case 'ArrowUp':
          // 上に移動：同じ日付の前のスタッフ、または実績→予定
          if (type === 'actual') {
            newType = 'planned';
          } else if (staffIndex > 0) {
            newStaffIndex = staffIndex - 1;
            newType = 'actual';
          }
          break;
        case 'ArrowDown':
          // 下に移動：同じ日付の次のスタッフ、または予定→実績
          if (type === 'planned') {
            newType = 'actual';
          } else if (staffIndex < totalStaff - 1) {
            newStaffIndex = staffIndex + 1;
            newType = 'planned';
          }
          break;
        case 'ArrowLeft':
          // 左に移動：前の日付
          if (dateIndex > 0) {
            newDateIndex = dateIndex - 1;
          }
          break;
        case 'ArrowRight':
          // 右に移動：次の日付
          if (dateIndex < totalDates - 1) {
            newDateIndex = dateIndex + 1;
          }
          break;
        // Phase 34: Home/Endキーナビゲーション
        case 'Home':
          // 行の先頭（1日目）に移動
          newDateIndex = 0;
          break;
        case 'End':
          // 行の末尾（月末日）に移動
          newDateIndex = totalDates - 1;
          break;
        // Phase 36: PageUp/PageDownで週単位移動
        case 'PageUp':
          // 7日前に移動（最小0）
          newDateIndex = Math.max(0, dateIndex - 7);
          break;
        case 'PageDown':
          // 7日後に移動（最大月末）
          newDateIndex = Math.min(totalDates - 1, dateIndex + 7);
          break;
        default:
          return false;
      }
    }

    const newKey = `${newStaffIndex}-${newDateIndex}-${newType}`;
    const targetCell = cellRefs.current.get(newKey);

    if (targetCell) {
      e.preventDefault();
      targetCell.focus();
      return true;
    }
    return false;
  }, []);

  /**
   * キーボードイベントハンドラー
   * Enter: モーダル表示（シングルクリック相当）
   * Space: シフトサイクル（ダブルクリック相当）
   * Arrow keys: セル間移動（Phase 32）
   */
  const handleKeyDown = useCallback((
    e: React.KeyboardEvent,
    date: string,
    staffId: string,
    staffName: string,
    type: 'planned' | 'actual',
    currentShift: GeneratedShift | null,
    staffIndex: number,
    dateIndex: number,
    totalStaff: number,
    totalDates: number
  ) => {
    const currentShiftType = type === 'planned'
      ? (currentShift?.plannedShiftType || currentShift?.shiftType)
      : currentShift?.actualShiftType;

    // 矢印キー＋Home/End＋PageUp/PageDownナビゲーション（Phase 32, 34, 36）
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      handleArrowNavigation(e, staffIndex, dateIndex, type, totalStaff, totalDates);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      openEditModal(date, staffId, staffName, type, currentShift);
    } else if (e.key === ' ') {
      e.preventDefault();
      handleDoubleClick(staffId, date, type, currentShiftType);
    }
  }, [openEditModal, handleDoubleClick, handleArrowNavigation]);

  const handleSaveShift = (updatedShift: Partial<GeneratedShift>) => {
    if (!editModalData || !onShiftUpdate) return;

    onShiftUpdate(
      editModalData.staffId,
      editModalData.date,
      updatedShift
    );
  };

  if (!schedule.length) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg shadow-md">
        <div className="text-center p-8">
          <svg className="mx-auto h-16 w-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-slate-800">シフトが作成されていません</h3>
          <p className="mt-2 text-sm text-slate-500">左のパネルで条件を設定し、「シフト作成実行」ボタンを押してください。</p>
        </div>
      </div>
    );
  }

  const [year, month] = targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1));

  return (
    <>
      {/* Phase 54: シフト評価ボタンと評価パネル */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-start gap-4">
        {/* 評価ボタン */}
        {onReevaluate && schedule.length > 0 && (
          <button
            type="button"
            onClick={onReevaluate}
            disabled={isReevaluating}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              isReevaluating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {isReevaluating ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                評価中...
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                シフトを評価
              </>
            )}
          </button>
        )}
      </div>

      {/* Phase 40: AI評価パネル */}
      {evaluation && (
        <div className="mb-4">
          <EvaluationPanel evaluation={evaluation} />
        </div>
      )}

      {/* Phase 54: 評価履歴一覧 */}
      {facilityId && targetMonth && (
        <EvaluationHistory
          facilityId={facilityId}
          targetMonth={targetMonth}
          onSelectEvaluation={onSelectEvaluation}
          className="mb-4"
        />
      )}

      {/* 一括コピーボタン */}
      {onBulkCopyClick && (
        <div className="mb-4">
          <button
            type="button"
            onClick={onBulkCopyClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            予定を実績にコピー
          </button>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow-md">
        <table className="min-w-full divide-y divide-slate-200 border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-20">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-30 border-r border-slate-200">
                スタッフ名
              </th>
              {dates.map(date => {
                const day = date.getDate();
                const weekday = WEEKDAYS[date.getDay()];
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <th key={day} scope="col" className={`px-2 py-3 text-center text-xs font-semibold ${isWeekend ? 'text-pink-600' : 'text-slate-600'}`}>
                    <div>{day}</div>
                    <div className="font-medium">({weekday})</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white">
            {schedule.map((staffSchedule, staffIndex) => {
              // 差異があるかチェックする関数
              const hasDifference = (shift: GeneratedShift): boolean => {
                if (!shift.actualShiftType) return false;

                const plannedType = shift.plannedShiftType || shift.shiftType || '休';
                if (plannedType !== shift.actualShiftType) return true;

                if (shift.plannedStartTime !== shift.actualStartTime) return true;
                if (shift.plannedEndTime !== shift.actualEndTime) return true;

                return false;
              };

              const totalStaff = schedule.length;
              const totalDates = staffSchedule.monthlyShifts.length;

              return (
                <React.Fragment key={staffSchedule.staffId}>
                  {/* 予定行 */}
                  <tr className="border-b border-gray-200">
                    <td
                      className="px-4 py-1 text-sm font-medium text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-200"
                      rowSpan={2}
                    >
                      <div className="flex items-center gap-2">
                        <span>{staffSchedule.staffName}</span>
                      </div>
                    </td>
                    {staffSchedule.monthlyShifts.map((shift, dateIndex) => {
                      const plannedShiftType = shift.plannedShiftType || shift.shiftType || '休';
                      const hasDiff = hasDifference(shift);
                      const cellKey = `${staffIndex}-${dateIndex}-planned`;

                      return (
                        <td
                          key={`${staffSchedule.staffId}-${shift.date}-planned`}
                          ref={(el) => setCellRef(cellKey, el)}
                          tabIndex={0}
                          role="button"
                          aria-label={`${staffSchedule.staffName}の${shift.date}の予定: ${plannedShiftType}`}
                          className={`px-2 py-1 text-center text-xs cursor-pointer hover:bg-blue-50 active:scale-95 active:opacity-80 border-b border-gray-300 select-none transition-transform duration-75 focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasDiff ? 'ring-2 ring-orange-400 bg-orange-50' : 'bg-white'}`}
                          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                          onClick={() => handleCellClick(shift.date, staffSchedule.staffId, staffSchedule.staffName, 'planned', shift)}
                          onKeyDown={(e) => handleKeyDown(e, shift.date, staffSchedule.staffId, staffSchedule.staffName, 'planned', shift, staffIndex, dateIndex, totalStaff, totalDates)}
                        >
                          <span className={`inline-flex px-2 py-0.5 rounded-full ${getDynamicShiftColor(plannedShiftType)}`}>
                            {plannedShiftType}
                          </span>
                          {shift.plannedStartTime && shift.plannedEndTime && (
                            <div className="text-[10px] text-gray-600 mt-0.5">
                              {shift.plannedStartTime}-{shift.plannedEndTime}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 実績行 */}
                  <tr className="border-b border-gray-300">
                    {staffSchedule.monthlyShifts.map((shift, dateIndex) => {
                      const actualShiftType = shift.actualShiftType;
                      const hasDiff = hasDifference(shift);
                      const isEmpty = !actualShiftType;
                      const cellKey = `${staffIndex}-${dateIndex}-actual`;

                      return (
                        <td
                          key={`${staffSchedule.staffId}-${shift.date}-actual`}
                          ref={(el) => setCellRef(cellKey, el)}
                          tabIndex={0}
                          role="button"
                          aria-label={`${staffSchedule.staffName}の${shift.date}の実績: ${actualShiftType || '未入力'}`}
                          className={`px-2 py-1 text-center text-xs cursor-pointer hover:bg-blue-100 active:scale-95 active:opacity-80 border-b border-gray-400 select-none transition-transform duration-75 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            hasDiff ? 'ring-2 ring-orange-400 bg-orange-50' :
                            isEmpty ? 'bg-gray-100' : 'bg-gray-50'
                          }`}
                          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                          onClick={() => handleCellClick(shift.date, staffSchedule.staffId, staffSchedule.staffName, 'actual', shift)}
                          onKeyDown={(e) => handleKeyDown(e, shift.date, staffSchedule.staffId, staffSchedule.staffName, 'actual', shift, staffIndex, dateIndex, totalStaff, totalDates)}
                        >
                          {isEmpty ? (
                            <span className="text-gray-400 text-[10px]">未入力</span>
                          ) : (
                            <>
                              <span className={`inline-flex px-2 py-0.5 rounded-full ${getDynamicShiftColor(actualShiftType)}`}>
                                {actualShiftType}
                              </span>
                              {shift.actualStartTime && shift.actualEndTime && (
                                <div className="text-[10px] text-gray-600 mt-0.5">
                                  {shift.actualStartTime}-{shift.actualEndTime}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* シフト編集モーダル */}
      {editModalData && (
        <ShiftEditConfirmModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          date={editModalData.date}
          staffId={editModalData.staffId}
          staffName={editModalData.staffName}
          type={editModalData.type}
          currentShift={editModalData.currentShift}
          onSave={handleSaveShift}
        />
      )}
    </>
  );
};

export default ShiftTable;
