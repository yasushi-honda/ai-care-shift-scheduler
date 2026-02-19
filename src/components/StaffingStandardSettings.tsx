/**
 * StaffingStandardSettings.tsx
 *
 * Phase 65: 人員配置基準設定UI（サイドバーAccordion内）
 *
 * 機能:
 * - サービス種類選択 → デフォルト基準をロード
 * - 利用者数 number input（ratio方式の計算に使用）
 * - 職種別配置基準テーブル（行追加/削除）
 * - 保存ボタン
 */

import React, { useState, useEffect, useCallback } from 'react';
import { assertResultError, type StaffingStandardConfig, type StaffingRequirementEntry, type CareServiceType } from '../../types';
import { CARE_SERVICE_TYPES, DEFAULT_STAFFING_STANDARDS } from '../../constants';
import { saveStaffingStandard, subscribeStaffingStandard } from '../services/staffingStandardService';

// ==================== Icons ====================
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// ==================== Component ====================
interface StaffingStandardSettingsProps {
  facilityId: string;
  userId: string;
  disabled?: boolean;
}

export const StaffingStandardSettings: React.FC<StaffingStandardSettingsProps> = ({
  facilityId,
  userId,
  disabled = false,
}) => {
  const [config, setConfig] = useState<StaffingStandardConfig | null>(null);
  const [serviceType, setServiceType] = useState<CareServiceType>('通所介護');
  const [userCount, setUserCount] = useState<number>(20);
  const [requirements, setRequirements] = useState<StaffingRequirementEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Firestore リアルタイム購読
  useEffect(() => {
    if (!facilityId) return;

    const unsubscribe = subscribeStaffingStandard(
      facilityId,
      (loaded) => {
        setConfig(loaded);
        setServiceType(loaded.serviceType);
        setUserCount(loaded.userCount);
        setRequirements(loaded.requirements);
      },
      (err) => {
        console.error('StaffingStandardSettings subscription error:', err);
      },
      serviceType
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId]);

  // サービス種類変更時: デフォルト基準をロード
  const handleServiceTypeChange = useCallback((newType: CareServiceType) => {
    setServiceType(newType);
    setRequirements(DEFAULT_STAFFING_STANDARDS[newType] ?? []);
  }, []);

  // 職種別要件 フィールド更新
  const updateRequirement = useCallback(
    (index: number, field: keyof StaffingRequirementEntry, value: string | number) => {
      setRequirements((prev) =>
        prev.map((req, i) =>
          i === index ? { ...req, [field]: value } : req
        )
      );
    },
    []
  );

  // 行追加
  const addRequirement = useCallback(() => {
    setRequirements((prev) => [
      ...prev,
      { role: '', requiredFte: 1, calculationMethod: 'fixed' as const },
    ]);
  }, []);

  // 行削除
  const removeRequirement = useCallback((index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 保存
  const handleSave = async () => {
    if (saving || !facilityId) return;
    setSaving(true);
    setSaveMessage(null);

    const result = await saveStaffingStandard(
      facilityId,
      { serviceType, userCount, requirements, updatedBy: userId },
      userId
    );

    setSaving(false);
    if (result.success) {
      setSaveMessage('保存しました');
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      assertResultError(result);
      setSaveMessage(`エラー: ${result.error.message}`);
    }
  };

  if (!config) {
    return <p className="text-sm text-slate-500 px-2 py-3">読み込み中...</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      {/* サービス種類 */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">サービス種類</label>
        <select
          value={serviceType}
          onChange={(e) => handleServiceTypeChange(e.target.value as CareServiceType)}
          disabled={disabled}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
        >
          {CARE_SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* 利用者数 */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          利用者数（定員）
          <span className="text-slate-400 font-normal ml-1">ratio方式の基準計算に使用</span>
        </label>
        <input
          type="number"
          min={1}
          max={999}
          value={userCount}
          onChange={(e) => setUserCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          disabled={disabled}
          className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
        />
        <span className="ml-2 text-slate-500">人</span>
      </div>

      {/* 職種別要件テーブル */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-slate-600">職種別配置基準</label>
          <button
            type="button"
            onClick={addRequirement}
            disabled={disabled}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            <PlusIcon />行追加
          </button>
        </div>

        <div className="space-y-2">
          {requirements.map((req, idx) => (
            <div key={idx} className="border border-slate-200 rounded p-2 space-y-1.5 bg-slate-50">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="職種名"
                  value={req.role}
                  onChange={(e) => updateRequirement(idx, 'role', e.target.value)}
                  disabled={disabled}
                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => removeRequirement(idx)}
                  disabled={disabled}
                  className="text-red-400 hover:text-red-600 disabled:opacity-50 flex-shrink-0"
                  title="削除"
                >
                  <TrashIcon />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={req.calculationMethod}
                  onChange={(e) => updateRequirement(idx, 'calculationMethod', e.target.value)}
                  disabled={disabled}
                  className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                >
                  <option value="fixed">固定（人数指定）</option>
                  <option value="ratio">比率（利用者÷N）</option>
                </select>

                {req.calculationMethod === 'fixed' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={req.requiredFte}
                      onChange={(e) => updateRequirement(idx, 'requiredFte', parseFloat(e.target.value) || 0)}
                      disabled={disabled}
                      className="w-16 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                    />
                    <span className="text-xs text-slate-500">人</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-slate-600">
                    <span>利用者÷</span>
                    <input
                      type="number"
                      min={1}
                      value={req.ratioNumerator ?? 3}
                      onChange={(e) => updateRequirement(idx, 'ratioNumerator', parseInt(e.target.value, 10) || 1)}
                      disabled={disabled}
                      className="w-12 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                    />
                    <span className="text-xs text-slate-500">
                      ≒{((userCount ?? 20) / (req.ratioNumerator ?? 3)).toFixed(1)}人
                    </span>
                  </div>
                )}
              </div>

              {req.notes && (
                <p className="text-xs text-slate-400 leading-tight">{req.notes}</p>
              )}
            </div>
          ))}
        </div>

        {requirements.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2">
            配置基準が設定されていません。「行追加」で追加してください。
          </p>
        )}
      </div>

      {/* 保存ボタン */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        {saveMessage && (
          <span className={`text-xs ${saveMessage.startsWith('エラー') ? 'text-red-500' : 'text-green-600'}`}>
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
};
