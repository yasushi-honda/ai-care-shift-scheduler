import React, { useState, useEffect } from 'react';
import { TimePicker } from './TimePicker';
import type { GeneratedShift } from '../../types';

interface ShiftEditConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  staffId: string;
  staffName: string;
  type: 'planned' | 'actual';
  currentShift: GeneratedShift | null;
  onSave: (shift: Partial<GeneratedShift>) => void;
}

const AVAILABLE_SHIFT_TYPES = ['早番', '日勤', '遅番', '夜勤', '休', '明け休み'];

export function ShiftEditConfirmModal({
  isOpen,
  onClose,
  date,
  staffId,
  staffName,
  type,
  currentShift,
  onSave
}: ShiftEditConfirmModalProps) {
  const [shiftType, setShiftType] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [breakMinutes, setBreakMinutes] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);

  // モーダルが開いたときに現在の値をセット
  useEffect(() => {
    if (isOpen && currentShift) {
      if (type === 'planned') {
        setShiftType(currentShift.plannedShiftType || currentShift.shiftType || '');
        setStartTime(currentShift.plannedStartTime || '');
        setEndTime(currentShift.plannedEndTime || '');
      } else {
        setShiftType(currentShift.actualShiftType || '');
        setStartTime(currentShift.actualStartTime || '');
        setEndTime(currentShift.actualEndTime || '');
      }
      setBreakMinutes(currentShift.breakMinutes || 0);
      setNotes(currentShift.notes || '');
    } else if (isOpen && !currentShift) {
      // 新規作成の場合
      setShiftType('');
      setStartTime('');
      setEndTime('');
      setBreakMinutes(0);
      setNotes('');
    }
    setErrors([]);
  }, [isOpen, currentShift, type]);

  function calculateWorkHours(start: string, end: string, breakMins: number): number {
    if (!start || !end) return 0;

    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    let startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;

    // 日付をまたぐ場合
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
    }

    const totalMinutes = endMinutes - startMinutes - breakMins;
    return totalMinutes / 60;
  }

  function validate(): string[] {
    const validationErrors: string[] = [];

    if (!shiftType || shiftType.trim() === '') {
      validationErrors.push('シフトタイプを選択してください');
    }

    if (startTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTime)) {
      validationErrors.push('開始時刻の形式が正しくありません（HH:mm）');
    }

    if (endTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(endTime)) {
      validationErrors.push('終了時刻の形式が正しくありません（HH:mm）');
    }

    if (startTime && endTime && startTime === endTime) {
      validationErrors.push('終了時刻は開始時刻と異なる必要があります');
    }

    // 労基法チェック
    if (startTime && endTime && breakMinutes !== undefined) {
      const workHours = calculateWorkHours(startTime, endTime, breakMinutes);

      if (workHours > 8 && breakMinutes < 60) {
        validationErrors.push('8時間超の勤務には60分以上の休憩が必要です');
      } else if (workHours > 6 && breakMinutes < 45) {
        validationErrors.push('6時間超の勤務には45分以上の休憩が必要です');
      }
    }

    return validationErrors;
  }

  function handleConfirm() {
    // バリデーション
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // 確認ダイアログ
    const confirmMessage = `${type === 'planned' ? '予定' : '実績'}シフトを更新します。

日付: ${date}
スタッフ: ${staffName}
シフトタイプ: ${shiftType}
時刻: ${startTime || '未設定'} - ${endTime || '未設定'}
休憩: ${breakMinutes}分

よろしいですか？`;

    if (window.confirm(confirmMessage)) {
      // 保存
      const updatedShift: Partial<GeneratedShift> = type === 'planned'
        ? {
            plannedShiftType: shiftType,
            plannedStartTime: startTime || undefined,
            plannedEndTime: endTime || undefined,
            breakMinutes: breakMinutes || undefined,
            notes: notes || undefined
          }
        : {
            actualShiftType: shiftType,
            actualStartTime: startTime || undefined,
            actualEndTime: endTime || undefined,
            breakMinutes: breakMinutes || undefined,
            notes: notes || undefined
          };

      onSave(updatedShift);
      onClose();
    }
  }

  if (!isOpen) return null;

  const dateObj = new Date(date + 'T00:00:00');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = weekdays[dateObj.getDay()];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* 背景オーバーレイ */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* モーダルコンテンツ */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  シフト編集 - {type === 'planned' ? '予定' : '実績'}
                </h3>

                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">日付:</span> {date} ({dayOfWeek})
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">スタッフ:</span> {staffName}
                  </p>
                </div>

                {errors.length > 0 && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    {errors.map((error, index) => (
                      <p key={index} className="text-sm text-red-600">• {error}</p>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  {/* シフトタイプ */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      シフトタイプ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={shiftType}
                      onChange={(e) => setShiftType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">選択してください</option>
                      {AVAILABLE_SHIFT_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {/* 開始時刻 */}
                  <TimePicker
                    value={startTime}
                    onChange={setStartTime}
                    label="開始時刻"
                    required={false}
                  />

                  {/* 終了時刻 */}
                  <TimePicker
                    value={endTime}
                    onChange={setEndTime}
                    label="終了時刻"
                    required={false}
                  />

                  {/* 休憩時間 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      休憩時間（分）
                    </label>
                    <input
                      type="number"
                      value={breakMinutes}
                      onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
                      min="0"
                      step="15"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 特記事項 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      特記事項
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="欠勤理由、変更理由など"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ボタン */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              確認
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
