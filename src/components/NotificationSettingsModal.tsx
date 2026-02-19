import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 通知設定モーダル
 * Phase 63: 通知タイプ別ON/OFFトグル
 */
export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings } = useNotifications();

  if (!isOpen) return null;

  const scheduleConfirmedEnabled = settings?.enabledTypes.schedule_confirmed ?? true;

  const handleToggle = async (key: keyof NonNullable<typeof settings>['enabledTypes']) => {
    const currentValue =
      key === 'schedule_confirmed' ? scheduleConfirmedEnabled : true;
    await updateSettings({ [key]: !currentValue });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-settings-title"
    >
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* モーダルコンテンツ */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-5">
          <h2 id="notification-settings-title" className="text-lg font-semibold text-slate-900">
            通知設定
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* 設定項目 */}
        <div className="space-y-4">
          <ToggleItem
            label="シフト確定通知"
            description="シフトが確定したときに通知を受け取る"
            enabled={scheduleConfirmedEnabled}
            onToggle={() => handleToggle('schedule_confirmed')}
          />
        </div>

        <p className="text-xs text-slate-400 mt-5">
          ※ 通知はアプリ内のみです（プッシュ通知は対応していません）
        </p>
      </div>
    </div>
  );
};

interface ToggleItemProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ label, description, enabled, onToggle }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex-1">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative flex-shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        enabled ? 'bg-indigo-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);
