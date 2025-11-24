import React, { useState, useEffect, useRef } from 'react';
import type { StaffSchedule } from '../../types';
import type { BulkCopyOptions } from '../utils/bulkCopyPlannedToActual';
import { getUnfilledActualCount } from '../utils/bulkCopyPlannedToActual';

interface BulkCopyPlannedToActualModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: StaffSchedule[];
  targetMonth: string;
  onExecute: (options: BulkCopyOptions) => void;
}

export function BulkCopyPlannedToActualModal({
  isOpen,
  onClose,
  schedules,
  targetMonth,
  onExecute
}: BulkCopyPlannedToActualModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [overwrite, setOverwrite] = useState(false);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // フォーカス管理
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const previousActiveElement = document.activeElement as HTMLElement;
      modalRef.current.focus();
      return () => previousActiveElement?.focus();
    }
  }, [isOpen]);

  // モーダルが開いたときに初期値をセット
  useEffect(() => {
    if (isOpen) {
      // 対象月の開始日・終了日を計算
      const [year, month] = targetMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      const calculatedDateRange = { start: startDate, end: endDate };

      // 実績未入力のスタッフを自動選択（期間を考慮）
      const unfilledStaffIds = schedules
        .filter(staff => getUnfilledActualCount(staff, calculatedDateRange) > 0)
        .map(staff => staff.staffId);
      setSelectedStaffIds(unfilledStaffIds);

      setDateRange(calculatedDateRange);
      setOverwrite(false);
    }
  }, [isOpen, schedules, targetMonth]);

  // 日付範囲変更時に選択を同期
  useEffect(() => {
    setSelectedStaffIds(prev =>
      prev.filter(staffId => {
        const staff = schedules.find(s => s.staffId === staffId);
        return staff && getUnfilledActualCount(staff, dateRange) > 0;
      })
    );
  }, [dateRange, schedules]);

  function handleToggleStaff(staffId: string) {
    setSelectedStaffIds(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  }

  function handleToggleAll() {
    const selectableStaffIds = schedules
      .filter(staff => getUnfilledActualCount(staff, dateRange) > 0)
      .map(staff => staff.staffId);

    if (selectedStaffIds.length === selectableStaffIds.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(selectableStaffIds);
    }
  }

  function handleExecute() {
    if (selectedStaffIds.length === 0) {
      alert('スタッフを1名以上選択してください');
      return;
    }

    // 日付範囲バリデーション
    if (dateRange.start > dateRange.end) {
      alert('終了日は開始日以降の日付を指定してください');
      return;
    }

    // 確認ダイアログ
    const totalCount = schedules
      .filter(staff => selectedStaffIds.includes(staff.staffId))
      .reduce((sum, staff) => sum + getUnfilledActualCount(staff, dateRange), 0);

    const confirmMessage = `予定を実績にコピーします。

対象スタッフ: ${selectedStaffIds.length}名
対象シフト: ${totalCount}件
期間: ${dateRange.start} ～ ${dateRange.end}
${overwrite ? '※既存の実績を上書きします' : '※実績未入力のシフトのみコピーします'}

よろしいですか？`;

    if (window.confirm(confirmMessage)) {
      onExecute({
        staffIds: selectedStaffIds,
        dateRange,
        overwrite
      });
      onClose();
    }
  }

  if (!isOpen) return null;

  const selectableStaffIds = schedules
    .filter(staff => getUnfilledActualCount(staff, dateRange) > 0)
    .map(staff => staff.staffId);
  const allSelected = selectedStaffIds.length === selectableStaffIds.length && selectableStaffIds.length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* 背景オーバーレイ */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* モーダルコンテンツ */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          tabIndex={-1}
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full"
        >
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 id="modal-title" className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  予定を実績にコピー
                </h3>

                {/* スタッフ選択 */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      対象スタッフ
                    </label>
                    <button
                      type="button"
                      onClick={handleToggleAll}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {allSelected ? 'すべて解除' : 'すべて選択'}
                    </button>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {schedules.map(staff => {
                      const unfilledCount = getUnfilledActualCount(staff, dateRange);
                      const isSelected = selectedStaffIds.includes(staff.staffId);
                      const hasUnfilled = unfilledCount > 0;

                      return (
                        <label
                          key={staff.staffId}
                          className={`flex items-center justify-between py-2 px-2 rounded hover:bg-gray-50 cursor-pointer ${
                            !hasUnfilled ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleStaff(staff.staffId)}
                              disabled={!hasUnfilled}
                              className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-900">{staff.staffName}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {hasUnfilled ? `${unfilledCount}件未入力` : '実績入力済み'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 期間選択 */}
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      開始日
                    </label>
                    <input
                      type="date"
                      value={dateRange.start}
                      max={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      終了日
                    </label>
                    <input
                      type="date"
                      value={dateRange.end}
                      min={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {dateRange.start > dateRange.end && (
                  <p className="mb-4 text-sm text-red-600">
                    ⚠️ 終了日は開始日以降の日付を指定してください
                  </p>
                )}

                {/* 上書きオプション */}
                <div className="mb-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      既存の実績を上書きする
                    </span>
                  </label>
                  {overwrite && (
                    <p className="mt-1 text-xs text-orange-600">
                      ⚠️ すでに入力された実績も上書きされます。注意してください。
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ボタン */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleExecute}
              disabled={selectedStaffIds.length === 0}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              実行
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
