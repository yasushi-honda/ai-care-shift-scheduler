import React, { useState, useCallback } from 'react';
import { FacilityShiftSettings, ShiftTypeConfig, ShiftColor } from '../../types';
import { SHIFT_COLOR_PRESETS } from '../../constants';

// アイコンコンポーネント
const PencilIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface ShiftTypeSettingsProps {
  settings: FacilityShiftSettings;
  onSave: (settings: Partial<Omit<FacilityShiftSettings, 'facilityId' | 'updatedAt' | 'updatedBy'>>) => Promise<void>;
  disabled?: boolean;
}

interface EditingShiftType extends ShiftTypeConfig {
  isNew?: boolean;
}

const colorOptions = Object.entries(SHIFT_COLOR_PRESETS).map(([key, value]) => ({
  key,
  ...value,
}));

export const ShiftTypeSettings: React.FC<ShiftTypeSettingsProps> = ({
  settings,
  onSave,
  disabled = false,
}) => {
  const [editingShiftType, setEditingShiftType] = useState<EditingShiftType | null>(null);
  const [saving, setSaving] = useState(false);

  const sortedShiftTypes = [...settings.shiftTypes].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleEdit = useCallback((shiftType: ShiftTypeConfig) => {
    setEditingShiftType({ ...shiftType });
  }, []);

  const handleAdd = useCallback(() => {
    const maxSortOrder = Math.max(0, ...settings.shiftTypes.map((st) => st.sortOrder));
    const newShiftType: EditingShiftType = {
      id: `shift-${Date.now()}`,
      name: '',
      start: '09:00',
      end: '18:00',
      restHours: 1,
      color: SHIFT_COLOR_PRESETS.sky,
      isActive: true,
      sortOrder: maxSortOrder + 1,
      isNew: true,
    };
    setEditingShiftType(newShiftType);
  }, [settings.shiftTypes]);

  const handleCancel = useCallback(() => {
    setEditingShiftType(null);
  }, []);

  const handleSaveShiftType = useCallback(async () => {
    if (!editingShiftType || !editingShiftType.name.trim()) {
      return;
    }

    setSaving(true);
    try {
      let newShiftTypes: ShiftTypeConfig[];
      const { isNew, ...shiftTypeData } = editingShiftType;

      if (isNew) {
        newShiftTypes = [...settings.shiftTypes, shiftTypeData];
      } else {
        newShiftTypes = settings.shiftTypes.map((st) =>
          st.id === shiftTypeData.id ? shiftTypeData : st
        );
      }

      await onSave({ shiftTypes: newShiftTypes });
      setEditingShiftType(null);
    } catch (error) {
      console.error('Failed to save shift type:', error);
    } finally {
      setSaving(false);
    }
  }, [editingShiftType, settings.shiftTypes, onSave]);

  const handleDelete = useCallback(async () => {
    if (!editingShiftType || editingShiftType.isNew) {
      setEditingShiftType(null);
      return;
    }

    if (!window.confirm(`「${editingShiftType.name}」を削除しますか？`)) {
      return;
    }

    setSaving(true);
    try {
      const newShiftTypes = settings.shiftTypes.filter((st) => st.id !== editingShiftType.id);
      const newCycle = settings.defaultShiftCycle.filter((id) => id !== editingShiftType.id);
      await onSave({ shiftTypes: newShiftTypes, defaultShiftCycle: newCycle });
      setEditingShiftType(null);
    } catch (error) {
      console.error('Failed to delete shift type:', error);
    } finally {
      setSaving(false);
    }
  }, [editingShiftType, settings.shiftTypes, settings.defaultShiftCycle, onSave]);

  const updateEditingField = useCallback(<K extends keyof EditingShiftType>(
    field: K,
    value: EditingShiftType[K]
  ) => {
    setEditingShiftType((prev) => (prev ? { ...prev, [field]: value } : null));
  }, []);

  const getColorPreview = (color: ShiftColor) => (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color.background} ${color.text}`}>
      サンプル
    </span>
  );

  return (
    <div className="space-y-4">
      {/* シフト種別一覧 */}
      <div className="space-y-2">
        {sortedShiftTypes.map((shiftType) => (
          <div
            key={shiftType.id}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              shiftType.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className={`inline-block w-16 px-2 py-1 rounded text-center text-sm font-medium ${shiftType.color.background} ${shiftType.color.text}`}>
                {shiftType.name}
              </span>
              <span className="text-sm text-slate-600">
                {shiftType.start && shiftType.end ? (
                  <>
                    {shiftType.start} - {shiftType.end}
                    <span className="ml-2 text-slate-400">休憩 {shiftType.restHours}h</span>
                  </>
                ) : (
                  <span className="text-slate-400">時間指定なし</span>
                )}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {!shiftType.isActive && (
                <span className="text-xs text-slate-400">無効</span>
              )}
              <button
                onClick={() => handleEdit(shiftType)}
                disabled={disabled}
                className="p-1.5 text-slate-400 hover:text-care-primary rounded-md hover:bg-slate-100 disabled:opacity-50"
                aria-label={`${shiftType.name}を編集`}
              >
                <PencilIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 追加ボタン */}
      <button
        onClick={handleAdd}
        disabled={disabled}
        className="flex items-center space-x-2 px-4 py-2 text-sm text-care-primary hover:bg-care-primary/10 rounded-lg disabled:opacity-50"
      >
        <PlusIcon className="w-4 h-4" />
        <span>新しいシフト種別を追加</span>
      </button>

      {/* シフトサイクル順序表示 */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-sm font-medium text-slate-700 mb-2">シフトサイクル順序（ダブルクリック時）:</p>
        <div className="flex flex-wrap gap-2 items-center">
          {settings.defaultShiftCycle.map((id, index) => {
            const shiftType = settings.shiftTypes.find((st) => st.id === id);
            if (!shiftType) return null;
            return (
              <React.Fragment key={id}>
                {index > 0 && <span className="text-slate-400">→</span>}
                <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${shiftType.color.background} ${shiftType.color.text}`}>
                  {shiftType.name}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 編集モーダル */}
      {editingShiftType && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleCancel}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {editingShiftType.isNew ? 'シフト種別を追加' : 'シフト種別を編集'}
              </h3>
              <button
                onClick={handleCancel}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                aria-label="閉じる"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* シフト名 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">シフト名</label>
                <input
                  type="text"
                  value={editingShiftType.name}
                  onChange={(e) => updateEditingField('name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-care-primary/50"
                  placeholder="例: 早番"
                />
              </div>

              {/* 開始・終了時間 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">開始時間</label>
                  <input
                    type="time"
                    value={editingShiftType.start}
                    onChange={(e) => updateEditingField('start', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-care-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">終了時間</label>
                  <input
                    type="time"
                    value={editingShiftType.end}
                    onChange={(e) => updateEditingField('end', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-care-primary/50"
                  />
                </div>
              </div>

              {/* 休憩時間 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">休憩時間（時間）</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editingShiftType.restHours}
                  onChange={(e) => updateEditingField('restHours', parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-care-primary/50"
                />
              </div>

              {/* 表示色 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">表示色</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => updateEditingField('color', { background: option.background, text: option.text })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${option.background} ${option.text} ${
                        editingShiftType.color.background === option.background
                          ? 'ring-2 ring-offset-2 ring-care-primary'
                          : ''
                      }`}
                    >
                      {option.key}
                    </button>
                  ))}
                </div>
              </div>

              {/* プレビュー */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">プレビュー</label>
                <span className={`inline-block px-3 py-1.5 rounded text-sm font-medium ${editingShiftType.color.background} ${editingShiftType.color.text}`}>
                  {editingShiftType.name || 'シフト名'}
                </span>
              </div>

              {/* 有効/無効 */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingShiftType.isActive}
                  onChange={(e) => updateEditingField('isActive', e.target.checked)}
                  className="w-4 h-4 text-care-primary border-slate-300 rounded focus:ring-care-primary"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-slate-700">
                  有効にする
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
              {!editingShiftType.isNew ? (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center space-x-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>削除</span>
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveShiftType}
                  disabled={saving || !editingShiftType.name.trim()}
                  className="flex items-center space-x-1 px-4 py-2 text-sm text-white bg-care-primary hover:bg-care-primary/90 rounded-lg disabled:opacity-50"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span>{saving ? '保存中...' : '保存'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftTypeSettings;
